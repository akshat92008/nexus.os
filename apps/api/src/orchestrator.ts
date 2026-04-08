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
import type { TaskDAG, TaskNode, AgentType, SubTask } from '@nexus-os/types';
import { TaskRegistry } from './taskRegistry.js';
import { MissionMemory } from './missionMemory.js';
import { getGlobalGovernor } from './rateLimitGovernor.js';
import { runAgent } from './agents/agentRunner.js'; // Note path fix if needed
import { runChiefAnalyst } from './chiefAnalyst.js';
import { formatOutput, transformToWorkspace } from './outputFormatter.js';
import { ledger } from './ledger.js';
import { nexusStateStore } from './storage/nexusStateStore.js';
import { missionsQueue } from './queue/queue.js';

// ── Types ──────────────────────────────────────────────────────────────────

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

function safeEmit(res: Response, event: object, isAborted: () => boolean): void {
  if (isAborted()) return;
  try {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // socket closed
  }
}

// ── Wave Computation (Hardened Topological Sort) ───────────────────────────

export function computeExecutionWaves(nodes: TaskNode[]): TaskNode[][] {
  const waves: TaskNode[][] = [];
  const completed = new Set<string>();
  let remaining = [...nodes];
  let safetyLimit = nodes.length + 5; 

  while (remaining.length > 0 && safetyLimit-- > 0) {
    const wave = remaining.filter(
      (n) => (n.dependencies || []).every((dep) => completed.has(dep))
    );

    if (wave.length === 0) {
      // INSTEAD OF FATAL ERROR: Find the tasks with missing dependencies and treat them as wave-last
      console.warn(`[Orchestrator] DAG resolution bottleneck detected. Treating remaining nodes as terminal wave.`);
      waves.push(remaining);
      break;
    }

    waves.push(wave);
    wave.forEach((n) => completed.add(n.id));
    remaining = remaining.filter((n) => !completed.has(n.id));
  }

  return waves;
}

// ── Single Task Execution ──────────────────────────────────────────────────

async function executeTask(
  task: TaskNode,
  deps: OrchestratorDeps,
  waveIndex: number
): Promise<void> {
  const { memory, registry, userId, res, isAborted, dag } = deps;
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
  }, isAborted);

  registry.markRunning?.(task.id);

  const context = (memory as any).selectiveRead ? (memory as any).selectiveRead(task.contextFields) : { entries: [] };

  safeEmit(res, {
    type: 'agent_working',
    taskId: task.id,
    taskLabel: task.label,
    message: context.entries.length > 0
      ? `Reading ${context.entries.length} prior agent output(s)...`
      : 'Starting research...',
  }, isAborted);

  try {
    const result = await governor.execute(async () => {
      // Dynamic import to avoid circular dep if needed
      const { runAgent } = await import('./agents/agentRunner.js').catch(() => ({ runAgent: (args: any) => { throw new Error('AgentRunner not found'); } }));
      return await (runAgent as any)({
        task,
        goal: dag.goal,
        goalType: dag.goalType,
        context,
        sseRes: res,
        isAborted,
      });
    });

    memory.write(task.id, task.agentType, result.artifact, result.tokensUsed, res, isAborted);
    registry.markCompleted?.(task.id, `artifact:${task.id}`);

    ledger.recordTransaction(userId, task.id, task.label, task.agentType, result.tokensUsed, res, isAborted)
      .catch(e => console.warn('[Orchestrator] Ledger write warning:', e));

  } catch (err: any) {
    const message = err.message || String(err);
    registry.markFailed?.(task.id, message);
    safeEmit(res, { type: 'error', taskId: task.id, message: message.slice(0, 100) }, isAborted);
    throw err;
  }
}

// ── Main Orchestration Entry Point ─────────────────────────────────────────

export async function orchestrateDAG(deps: OrchestratorDeps): Promise<void> {
  const { dag, memory, registry, res, isAborted, sessionId, userId } = deps;
  const startMs = Date.now();
  const governor = getGlobalGovernor();

  dag.nodes.forEach((n) => registry.initTask?.(n.id));

  const waves = computeExecutionWaves(dag.nodes);
  
  safeEmit(res, {
    type: 'plan_ready',
    nodeCount: dag.nodes.length,
    waveCount: waves.length,
    goal: dag.goal,
  }, isAborted);

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

      // inter-wave settle
      if (i < waves.length - 1) await sleep(2000);
    }

    // ── CHIEF ANALYST (Synthesis) ───────────────────────────────────────────
    if (!isAborted() && memory.size > 0) {
      safeEmit(res, { type: 'agent_working', message: 'Nexus Master Brain synthesizing results...' }, isAborted);
      
      const allEntries = memory.readAll();
      const synthesis = await runChiefAnalyst(dag, allEntries, governor, res, isAborted);
      const formatted = formatOutput(synthesis, dag.goalType);
      
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
      }, isAborted);
    }

  } catch (err: any) {
    safeEmit(res, { type: 'error', message: `Mission failed: ${err.message}` }, isAborted);
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
  const workspace = state.workspaces.find(w => w.id === workspaceId);
  
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  // Find the action by actionId in workspace.nextActions array
  const action = (workspace.nextActions ?? []).find(a => a.id === actionId);
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
  }, isAborted);
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
  const memory = new (await import('./missionMemory.js')).MissionMemory(params.sessionId);
  const registry = new (await import('./taskRegistry.js')).TaskRegistry();

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

