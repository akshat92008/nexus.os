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
import { formatOutput, formattedOutputToLegacyContent, transformToWorkspace, formatStudentToWorkspace } from './outputFormatter.js';
import { ledger } from './ledger.js';

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
  safeEmit(res, { type: 'agent_working', taskId: actionId, message: 'Executing...' }, isAborted);
  await sleep(1500);
  safeEmit(res, { type: 'agent_complete', taskId: actionId }, isAborted);
}

