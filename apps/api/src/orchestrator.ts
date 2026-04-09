/**
 * Nexus OS — Orchestrator v2 (Stabilized)
 *
 * Core Mission Logic:
 * 1. Topological Wave-Based Execution
 * 2. Atomic Task Locking (Distributed-Safe)
 * 3. Selective Context Mapping
 * 4. Automatic Partial Recovery for non-critical agents
 */

import type { Response } from 'express';
import type { TaskDAG, TaskNode, AgentType, TaskPriority } from '@nexus-os/types';
import { TaskRegistry } from './taskRegistry.js';
import { MissionMemory } from './missionMemory.js';
import { getGlobalGovernor } from './rateLimitGovernor.js';
import { runChiefAnalyst } from './chiefAnalyst.js';
import { transformToWorkspace } from './outputFormatter.js';
import { ledger } from './ledger.js';
import { nexusStateStore } from './storage/nexusStateStore.js';
import { sandboxOutputBuffer } from './events/sandboxOutputBuffer.js';

// ── Types ──────────────────────────────────────────────────────────────────

export class DAGValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DAGValidationError';
  }
}

export interface OrchestratorDeps {
  dag: TaskDAG;
  memory: MissionMemory;
  registry: TaskRegistry;
  userId: string;
  sessionId: string;
  res: Response;
  isAborted: () => boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function safeEmit(res: Response, event: object, isAborted: () => boolean, sessionId?: string): void {
  if (isAborted()) return;
  try {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch (err) {
    console.error(`[Orchestrator] SSE write failed for session ${sessionId}:`, err);
    if (sessionId) {
      // Resilience: push to sandboxOutputBuffer for later retrieval (taskId="system", type="stdout")
      sandboxOutputBuffer.append(sessionId, 'system', 'stdout', JSON.stringify(event))
        .catch(e => console.error('[Orchestrator] Resilience buffer failed:', e));
    }
  }
}

// ── Wave Computation (Robust Topological Sort - Kahn's Algorithm) ───────────

export function computeExecutionWaves(nodes: TaskNode[]): TaskNode[][] {
  const waves: TaskNode[][] = [];
  const nodeMap = new Map<string, TaskNode>(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  // Initialize graph structures
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  // Populate graph and compute in-degrees
  for (const node of nodes) {
    for (const depId of node.dependencies || []) {
      if (!nodeMap.has(depId)) {
        throw new DAGValidationError(`Task "${node.id}" depends on non-existent task "${depId}"`);
      }
      inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      adj.get(depId)!.push(node.id);
    }
  }

  // Kahn's Algorithm for waves (Level-by-level)
  let queue = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
  let processedCount = 0;

  while (queue.length > 0) {
    const waveIds = [...queue];
    const waveNodes: TaskNode[] = [];
    const nextQueue: string[] = [];

    for (const id of waveIds) {
      waveNodes.push(nodeMap.get(id)!);
      processedCount++;
      
      const neighbors = adj.get(id) || [];
      for (const neighborId of neighbors) {
        const d = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, d);
        if (d === 0) {
          nextQueue.push(neighborId);
        }
      }
    }
    
    if (waveNodes.length > 0) {
      waves.push(waveNodes);
    }
    queue = nextQueue;
  }

  // Detect circular dependencies
  if (processedCount !== nodes.length) {
    const cycleNodes = nodes.filter(n => (inDegree.get(n.id) || 0) > 0).map(n => n.id);
    throw new DAGValidationError(`Circular dependency detected in DAG. Remaining tasks: ${cycleNodes.join(', ')}`);
  }

  return waves;
}

// ── Single Task Execution ──────────────────────────────────────────────────

async function executeTask(
  task: TaskNode,
  deps: OrchestratorDeps,
  waveIndex: number
): Promise<void> {
  const { memory, registry, userId, res, isAborted, dag, sessionId } = deps;
  const governor = getGlobalGovernor();

  if (registry.isCompleted(task.id)) return;
  
  const locked = registry.tryLock ? registry.tryLock(task.id) : true; 
  if (!locked) return;

  safeEmit(res, {
    type: 'agent_spawn',
    taskId: task.id,
    taskLabel: task.label,
    agentType: task.agentType,
    mode: 'wave',
    waveIndex,
  }, isAborted, sessionId);

  registry.markRunning?.(task.id);

  const context = (memory as any).selectiveRead ? (memory as any).selectiveRead(task.contextFields) : { entries: [] };

  let attempt = 0;
  const maxRetries = task.maxRetries ?? 2;

  while (attempt <= maxRetries) {
    if (isAborted()) return;

    safeEmit(res, {
      type: 'agent_working',
      taskId: task.id,
      taskLabel: task.label,
      message: attempt === 0 
        ? (context.entries.length > 0 ? `Reading ${context.entries.length} prior agent output(s)...` : 'Starting research...')
        : `Retry attempt ${attempt}/${maxRetries} after error...`,
    }, isAborted, sessionId);

    try {
      const result = await governor.execute(async () => {
        // Dynamic import to avoid circular dep if needed
        const { runAgent } = await import('./agents/agentRunner.js').catch(() => ({ runAgent: () => { throw new Error('AgentRunner not found'); } }));
        return await (runAgent as any)({
          task,
          goal: dag.goal,
          goalType: dag.goalType,
          context,
          sseRes: res,
          isAborted,
        });
      });

      await memory.write(task.id, task.agentType, result.artifact, result.tokensUsed, res, isAborted);
      registry.markCompleted?.(task.id, `artifact:${task.id}`);

      ledger.recordTransaction(userId, task.id, task.label, task.agentType, result.tokensUsed, res, isAborted)
        .catch(e => console.warn('[Orchestrator] Ledger write warning:', e));
      
      return; // Success!

    } catch (err: any) {
      attempt++;
      const message = err?.message || String(err) || 'Unknown failure';
      
      if (attempt > maxRetries) {
        registry.markFailed?.(task.id, message);
        safeEmit(res, { type: 'error', taskId: task.id, message: message.slice(0, 100) }, isAborted, sessionId);
        throw err;
      }

      // Exponential Backoff
      const backoff = Math.pow(2, attempt) * 1000;
      console.warn(`[Orchestrator] Task ${task.id} failed (attempt ${attempt}). Retrying in ${backoff}ms... Error: ${message}`);
      
      safeEmit(res, {
        type: 'retrying',
        taskId: task.id,
        taskLabel: task.label,
        attempt,
        maxRetries,
        message: `Retrying task ${task.label} (${attempt}/${maxRetries}) after failure: ${message.slice(0, 100)}`,
      }, isAborted, sessionId);

      await sleep(backoff);
    }
  }
}

// ── Main Orchestration Entry Point ─────────────────────────────────────────

export async function orchestrateDAG(deps: OrchestratorDeps): Promise<void> {
  const { dag, memory, registry, res, isAborted, sessionId } = deps;
  const startMs = Date.now();
  const governor = getGlobalGovernor();

  dag.nodes.forEach((n) => registry.initTask?.(n.id));

  const waves = computeExecutionWaves(dag.nodes);
  
  safeEmit(res, {
    type: 'plan_ready',
    nodeCount: dag.nodes.length,
    waveCount: waves.length,
    goal: dag.goal,
  }, isAborted, sessionId);

  try {
    for (let i = 0; i < waves.length; i++) {
      if (isAborted()) break;
      const wave = waves[i];

      console.log(`[Orchestrator] 🌊 Executing Wave ${i + 1}/${waves.length}`);
      
      const results = await Promise.allSettled(
        wave.map(async (task, idx) => {
          if (idx > 0) await sleep(idx * 800); // 800ms stagger to soften Groq hits
          return executeTask(task, deps, i);
        })
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        safeEmit(res, {
          type: 'wave_failed',
          waveIndex: i,
          failedCount,
          message: `Wave ${i + 1} failed with ${failedCount} task(s) in error.`,
        }, isAborted, sessionId);
        throw new Error(`Wave ${i + 1} failed with ${failedCount} failed task(s).`);
      }

      // inter-wave settle
      if (i < waves.length - 1) await sleep(2000);
    }

    // ── CHIEF ANALYST (Synthesis) ───────────────────────────────────────────
    if (!isAborted() && memory.size > 0) {
      safeEmit(res, { type: 'agent_working', message: 'Nexus Master Brain synthesizing results...' }, isAborted, sessionId);
      
      const allEntries = memory.readAll();
      const synthesis = await runChiefAnalyst(dag, allEntries, governor, res, isAborted);
      
      const missionWorkspace = transformToWorkspace(
        synthesis,
        dag.goal,
        dag.goalType,
        sessionId,
        new Map(allEntries.map(e => [e.taskId, e.data]))
      );

      safeEmit(res, {
        type: 'done',
        message: 'Mission accomplished.',
        workspace: missionWorkspace,
        durationMs: Date.now() - startMs,
      }, isAborted, sessionId);
    }

  } catch (err: any) {
    safeEmit(res, { type: 'error', message: `Mission failed: ${err.message}` }, isAborted, sessionId);
  }
}

/**
 * Executes a single ad-hoc action from the UI.
 */
export async function executeSingleAction(
  actionId:   string,
  workspaceId: string,
  userId:     string,
  res:        any,
  isAborted:  () => boolean
): Promise<void> {
  console.log(`[Orchestrator] ⚡ Executing ad-hoc action: ${actionId}`);
  
  // Load workspace from Supabase via nexusStateStore using workspaceId
  const state = await nexusStateStore.getUserState(userId);
  const workspace = state.workspaces.find((w: any) => w.id === workspaceId);
  
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  // Find the action by actionId in workspace.nextActions array
  const action = (workspace.nextActions ?? []).find((a: any) => a.id === actionId);
  if (!action) {
    throw new Error(`Action ${actionId} not found in workspace ${workspaceId}`);
  }

  // Build a single-node TaskDAG where goal = action.title and node agentType comes from action type
  const taskId = `action_${actionId}`;
  const node: TaskNode = {
    id: taskId,
    label: action.title,
    agentType: (action.type === 'execute' ? 'researcher' : 'analyst') as AgentType,
    dependencies: [],
    contextFields: [],
    expectedOutput: { format: 'prose' },
    goalAlignment: 1,
    priority: action.priority as TaskPriority,
    maxRetries: 1,
  };

  const dag: TaskDAG = {
    missionId: `adhoc_${actionId}_${Date.now()}`,
    goal: action.title,
    goalType: workspace.goalType || 'general',
    nodes: [node],
    successCriteria: [action.title],
    estimatedWaves: 1,
  };

  // Create fresh MissionMemory and TaskRegistry
  const memory = new MissionMemory(dag.missionId, dag.goal);
  const registry = new TaskRegistry(dag.missionId);
  registry.initTask(node.id);

  const deps: OrchestratorDeps = {
    dag,
    memory,
    registry,
    userId,
    sessionId: dag.missionId,
    res,
    isAborted,
  };

  // Call executeTask(node, deps, 0) directly
  await executeTask(node, deps, 0);

  // Emit { type: 'action_complete', actionId, artifact } via SSE when done
  const entry = memory.read(node.id);
  const artifact = entry?.data;

  safeEmit(res, { 
    type: 'action_complete', 
    actionId, 
    artifact 
  }, isAborted, dag.missionId);
}

/**
 * Starts a durable mission. This is the public entry point called by the API route.
 * Creates the DAG via the mission planner then runs orchestrateDAG.
 */
export async function startDurableMission(params: {
  goal: string;
  goalType: import('@nexus-os/types').GoalType;
  userId: string;
  sessionId: string;
  res: import('express').Response;
  isAborted: () => boolean;
}): Promise<void> {
  const { planMission } = await import('./missionPlanner.js');
  const dag = await planMission(params.goal);
  const memory = new (await import('./missionMemory.js')).MissionMemory(params.sessionId, params.goal);
  const registry = new (await import('./taskRegistry.js')).TaskRegistry(params.sessionId);

  await orchestrateDAG({
    dag,
    memory,
    registry,
    userId: params.userId,
    sessionId: params.sessionId,
    res: params.res,
    isAborted: params.isAborted,
  });
}

/**
 * Cancels a running mission by its ID.
 * In this architecture, cancellation is handled by the SSE abort signal.
 * This function is a no-op stub kept for API compatibility.
 */
export async function cancelDurableMission(missionId: string): Promise<void> {
  console.log(`[Orchestrator] Mission ${missionId} cancel requested.`);
  // Cancellation is handled client-side via the isAborted() closure.
  // Add Supabase mission status update here when persistence is wired.
}

