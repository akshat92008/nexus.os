/**
 * Nexus OS — Mission Worker
 *
 * Orchestrates the DAG of tasks for a mission.
 * Event-driven: triggered by task_completed events via Redis Pub/Sub.
 * NO polling loops.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { eventBus } from '../events/eventBus.js';
import { eventBuffer } from '../events/eventBuffer.js';
import { tasksQueue, missionsQueue, MissionJobData } from '../queue/queue.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import type { MapReduceTaskNode } from '../missionPlanner.js';
import type { NexusEvent } from '../db/models.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// ── Map-Reduce Helpers ────────────────────────────────────────────────────

const MAX_CHUNK_SIZE = 10;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function chunkText(text: string, maxChars = 2000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

// ── Map-Reduce Dispatch ───────────────────────────────────────────────────

async function dispatchMapReduceTask(
  task: MapReduceTaskNode,
  missionId: string,
  workspaceId: string
): Promise<void> {
  const input = task.input_payload;
  let chunks: any[] = [];

  if (Array.isArray(input?.items)) {
    chunks = chunkArray(input.items, MAX_CHUNK_SIZE);
  } else if (typeof input?.text === 'string') {
    chunks = chunkText(input.text);
  } else {
    // Fallback: no chunking needed, treat as single item
    chunks = [input];
  }

  console.log(`[MissionWorker] 🔀 Map-Reduce: splitting task ${task.id} into ${chunks.length} map chunks`);

  // Create child map-task records and enqueue them
  for (let i = 0; i < chunks.length; i++) {
    const childTaskId = `${task.id}_map_${i}`;

    await nexusStateStore.createTask({
      id:          childTaskId,
      missionId,
      label:       `${task.label} [map ${i + 1}/${chunks.length}]`,
      agentType:   task.agent_type,
      inputPayload: { ...input, items: undefined, text: undefined, chunk: chunks[i] },
      dependencies: [],
      mapReduceRole: 'map',
      parentTaskId: task.id,
    });

    await nexusStateStore.updateTaskStatus(childTaskId, 'queued');

    await tasksQueue.add(`task_${childTaskId}`, {
      taskId:       childTaskId,
      missionId,
      workspaceId,
      agentType:    task.agent_type,
      input:        { ...task, id: childTaskId, label: `${task.label} [map ${i + 1}]` },
      contextFields: [],
    });
  }

  // Create a reduce task that depends on all map children
  const reduceTaskId = `${task.id}_reduce`;
  await nexusStateStore.createTask({
    id:           reduceTaskId,
    missionId,
    label:        `${task.label} [reduce]`,
    agentType:    task.agent_type,
    inputPayload: { ...input, reduceOf: task.id },
    dependencies: chunks.map((_, i) => `${task.id}_map_${i}`),
    mapReduceRole: 'reduce',
    parentTaskId: task.id,
  });

  // Mark the original task as 'split' so it is not re-queued
  await nexusStateStore.updateTaskStatus(task.id, 'split' as any);
}

// ── Core: enqueue tasks whose dependencies are now satisfied ──────────────

export async function onTaskCompleted(taskId: string, missionId: string): Promise<void> {
  console.log(`[MissionWorker] 🔔 task_completed: ${taskId} → checking mission ${missionId}`);

  const tasks = await nexusStateStore.getMissionTasks(missionId);
  if (!tasks || tasks.length === 0) return;

  // Resolve mission-level terminal states first
  const activeTasks = tasks.filter((t: any) => t.status !== 'split');
  const allCompleted = activeTasks.every((t: any) => t.status === 'completed');
  const anyFailed    = activeTasks.some((t: any)  => t.status === 'failed');

  if (anyFailed) {
    console.log(`[MissionWorker] ❌ Mission failed: ${missionId}`);
    await nexusStateStore.updateMissionStatus(missionId, 'failed');
    await eventBuffer.publish(missionId, {
      type:      'mission_failed',
      missionId,
      userId:    '',
      error:     'One or more tasks failed.',
    });
    return;
  }

  if (allCompleted) {
    console.log(`[MissionWorker] ✅ Mission complete: ${missionId}`);
    await nexusStateStore.updateMissionStatus(missionId, 'complete', new Date().toISOString());
    await eventBuffer.publish(missionId, {
      type:      'mission_completed',
      missionId,
      userId:    '',
    });
    return;
  }

  // Find tasks that are pending and unblocked
  const readyToEnqueue = tasks.filter((task: any) => {
    if (task.status !== 'pending') return false;
    const deps: any[] = task.task_dependencies || [];
    if (deps.length === 0) return true;
    return deps.every((dep: any) => {
      const depTask = tasks.find((t: any) => t.id === dep.depends_on_task_id);
      return depTask && depTask.status === 'completed';
    });
  });

  // Fetch workspaceId from one of the already-running tasks' mission context
  const missionMeta = await nexusStateStore.getMissionById?.(missionId).catch(() => null);
  const workspaceId: string = missionMeta?.workspace_id ?? '';

  for (const task of readyToEnqueue) {
    const mrTask = task as MapReduceTaskNode;

    if (mrTask.mapReduce) {
      await dispatchMapReduceTask(mrTask, missionId, workspaceId);
      continue;
    }

    // Mark 'queued' atomically before enqueue to prevent double execution
    await nexusStateStore.updateTaskStatus(task.id, 'queued');

    await tasksQueue.add(`task_${task.id}`, {
      taskId:       task.id,
      missionId,
      workspaceId,
      agentType:    task.agent_type,
      input:        task.input_payload,
      contextFields: (task.task_dependencies || []).map((d: any) => d.depends_on_task_id),
    });

    console.log(`[MissionWorker] 🚀 Enqueued task ${task.id} for mission ${missionId}`);
  }
}

// ── Event Listener: subscribe to task_completed on process start ──────────

export function startMissionEventListener(): void {
  eventBus.subscribeGlobal(async (event: NexusEvent) => {
    if (event.type === 'task_completed' && event.taskId && event.missionId) {
      try {
        await onTaskCompleted(event.taskId, event.missionId);
      } catch (err) {
        console.error('[MissionWorker] ❌ onTaskCompleted error:', err);
      }
    }
  });

  console.log('[MissionWorker] 👂 Listening for task_completed events');
}

// ── BullMQ Worker: handles initial mission bootstrap only ─────────────────
// The worker no longer polls. It runs once to validate the mission is set up,
// then event-driven orchestration takes over via onTaskCompleted.

export const missionWorker = new Worker<MissionJobData>(
  'missions',
  async (job: Job<MissionJobData>) => {
    const { missionId, userId } = job.data;

    console.log(`[MissionWorker] 🧠 Mission bootstrapped: ${missionId}`);

    const tasks = await nexusStateStore.getMissionTasks(missionId);
    if (!tasks || tasks.length === 0) {
      console.warn(`[MissionWorker] ⚠️ No tasks found for mission: ${missionId}`);
      return;
    }

    // Surface any tasks that are already stuck in 'pending' with no unstarted
    // dependencies — they should have been queued by orchestrator, but guard here.
    const alreadyQueued = tasks.some(
      (t: any) => t.status === 'queued' || t.status === 'running'
    );
    if (!alreadyQueued) {
      // Trigger the first dependency check as if task "bootstrap" completed
      await onTaskCompleted('__bootstrap__', missionId);
    }

    await eventBuffer.publish(missionId, {
      type:      'mission_started',
      missionId,
      userId,
      goal:      job.data.goal,
    });
  },
  { connection }
);
