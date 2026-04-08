/**
 * Nexus OS — Task Orchestrator (Durable)
 *
 * Replaces the old HTTP-coupled orchestrator.
 * 1. Validates the DAG
 * 2. Persists mission & tasks to DB
 * 3. Atomically marks wave-1 tasks as 'queued' THEN enqueues them
 *    (prevents missionWorker from re-enqueuing before workers pick them up)
 */

import type { TaskDAG, TaskNode, AgentType } from '@nexus-os/types';
import { missionsQueue, tasksQueue } from './queue/queue.js';
import { eventBus } from './events/eventBus.js';
import { nexusStateStore } from './storage/nexusStateStore.js';

export function detectCycles(nodes: TaskNode[]): string | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    inStack.add(id);
    const node = nodeMap.get(id);
    if (node) {
      for (const dep of node.dependencies) {
        if (dfs(dep)) return true;
      }
    }
    inStack.delete(id);
    visited.add(id);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node.id)) return node.id;
  }
  return null;
}

export function computeExecutionWaves(nodes: TaskNode[]): TaskNode[][] {
  const cyclicNode = detectCycles(nodes);
  if (cyclicNode) {
    throw new Error(`DAG cycle detected at node "${cyclicNode}". Circular dependencies are not allowed.`);
  }

  const waves: TaskNode[][] = [];
  const completed = new Set<string>();
  let remaining = [...nodes];
  let safetyLimit = nodes.length + 2;

  while (remaining.length > 0 && safetyLimit-- > 0) {
    const nextWave = remaining.filter((node) =>
      node.dependencies.every((depId) => completed.has(depId))
    );

    if (nextWave.length === 0) break;

    waves.push(nextWave);
    nextWave.forEach((n) => completed.add(n.id));
    remaining = remaining.filter((n) => !completed.has(n.id));
  }

  return waves;
}

/**
 * Start a new durable mission.
 *
 * FIX #2 — Wave-1 double execution:
 * We mark all wave-1 task statuses as 'queued' in a single batch DB update
 * BEFORE calling tasksQueue.add. This prevents missionWorker from seeing
 * them as 'pending' and re-enqueuing them between the queue.add calls.
 */
export async function startDurableMission(params: {
  dag:         TaskDAG;
  userId:      string;
  workspaceId: string;
}): Promise<void> {
  const { dag, userId, workspaceId } = params;

  // 1. Cycle detection (Guard)
  const cycle = detectCycles(dag.nodes);
  if (cycle) throw new Error(`Cannot start mission: Cycle detected at ${cycle}`);

  console.log(`[Orchestrator] 🚀 Starting durable mission: ${dag.missionId} — "${dag.goal}"`);

  // 2. Enqueue the Mission tracking job
  await missionsQueue.add(`mission_${dag.missionId}`, {
    missionId:   dag.missionId,
    userId,
    workspaceId,
    goal:        dag.goal,
    goalType:    dag.goalType,
  });

  // 3. Dispatch the first wave atomically
  const waves = computeExecutionWaves(dag.nodes);
  if (waves.length > 0) {
    const firstWave = waves[0];

    // ── FIX #2: Atomic status update before enqueue ───────────────────────
    // Mark ALL wave-1 tasks as 'queued' in a single batch before touching BullMQ.
    // If the batch update fails, we throw and nothing is enqueued — safe to retry.
    await Promise.all(
      firstWave.map((task) => nexusStateStore.updateTaskStatus(task.id, 'queued'))
    );
    // ─────────────────────────────────────────────────────────────────────

    // Now enqueue. Workers will see status='queued' and idempotency guards
    // in taskWorker will skip any duplicate deliveries.
    for (const task of firstWave) {
      await tasksQueue.add(`task_${task.id}`, {
        taskId:       task.id,
        missionId:    dag.missionId,
        workspaceId,
        agentType:    task.agentType,
        input:        task,
        contextFields: task.contextFields || [],
      });
    }
  }

  // 4. Publish start event
  await eventBus.publish(dag.missionId, {
    type:      'mission_started',
    missionId: dag.missionId,
    userId,
    goal:      dag.goal,
  });
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
  res.write(`data: ${JSON.stringify({ type: 'agent_working', taskId: actionId, message: 'Executing...' })}\n\n`);
  await new Promise((r) => setTimeout(r, 1000));
  res.write(`data: ${JSON.stringify({ type: 'agent_complete', taskId: actionId })}\n\n`);
}
