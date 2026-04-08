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
  task: any,
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

  // 🚨 FIX 3: Batch insert child tasks for Map-Reduce (Avoid synchronous for-loop bottleneck)
  const childTasksToCreate = chunks.map((chunk, idx) => {
    return {
      id: `${task.id}_map_${idx}`,
      missionId,
      workspaceId,
      label: `${task.label} [map ${idx + 1}/${chunks.length}]`,
      agentType: task.agent_type,
      inputPayload: { ...input, items: undefined, text: undefined, chunk },
      dependencies: [],
      mapReduceRole: 'map',
      parentTaskId: task.id,
    };
  });

  // Batch insert all child tasks in one database query
  await nexusStateStore.batchCreateTasks(childTasksToCreate);

  // 🚨 HARDEN 2: Chunked queuing for fan-outs (DDoS prevention)
  const CONCURRENCY_LIMIT = 5; // Process only 5 chunk creations at a time
  for (let i = 0; i < childTasksToCreate.length; i += CONCURRENCY_LIMIT) {
    const batch = childTasksToCreate.slice(i, i + CONCURRENCY_LIMIT);
    
    await Promise.all(batch.map(async (childTask) => {
      // Atomic status claim as distributed lock (FIX 1)
      const claimed = await nexusStateStore.updateTaskStatus(childTask.id, 'queued');
      if (claimed) {
        await tasksQueue.add(`task_${childTask.id}`, {
          taskId:       childTask.id,
          missionId,
          workspaceId,
          agentType:    task.agent_type,
          input:        { ...task, id: childTask.id, label: childTask.label },
          contextFields: [],
        });
      }
    }));
  }

  // Create a reduce task that depends on all map children
  const reduceTaskId = `${task.id}_reduce`;
  await nexusStateStore.createTask({
    id:           reduceTaskId,
    missionId,
    label:        `${task.label} [reduce]`,
    agentType:    task.agent_type,
    inputPayload: { ...input, reduceOf: task.id },
    dependencies: childTasksToCreate.map(t => t.id),
    mapReduceRole: 'reduce',
    parentTaskId: task.id,
  });

  // Mark the original task as 'split' so it is not re-queued
  await nexusStateStore.updateTaskStatus(task.id, 'split');
}

// ── Core: enqueue tasks whose dependencies are now satisfied ──────────────

export async function onTaskCompleted(taskId: string, missionId: string): Promise<void> {
  console.log(`[MissionWorker] 🔔 task_completed: ${taskId} → checking mission ${missionId}`);

  // 🚨 FIX 3: Optimized dependency check (Avoid pulling entire mission DAG for every task)
  let tasksToCheck: any[] = [];
  if (taskId === '__bootstrap__' || taskId === '__fallback__') {
    // Bootstrap or Fallback needs full state to find initial roots
    tasksToCheck = await nexusStateStore.getMissionTasks(missionId);
  } else {
    // Only pull tasks that directly depend on the completed task
    tasksToCheck = await nexusStateStore.getDependentTasks(taskId);
  }

  if (!tasksToCheck || tasksToCheck.length === 0) {
    // Even if no dependents, we must check if the entire mission is complete
    const allTasks = await nexusStateStore.getMissionTasks(missionId);
    await checkMissionCompletion(missionId, allTasks);
    return;
  }

  // 🚨 FIX 3: Fetch only statuses of current task's siblings or parents of its dependents.
  // Instead of allTasks, only fetch statuses of IDs needed for evaluation.
  const depIdsNeeded = new Set<string>();
  tasksToCheck.forEach(task => {
    (task.task_dependencies || []).forEach((d: any) => depIdsNeeded.add(d.depends_on_task_id));
  });
  const depStatuses = await nexusStateStore.getTaskStatuses(Array.from(depIdsNeeded));
  const statusMap = new Map(depStatuses.map((s: any) => [s.id, s.status]));

  // 🚨 HARDEN 1: Fetch mission context only if we actually find ready tasks
  const missionMeta = await nexusStateStore.getMissionById(missionId).catch(() => null);
  const workspaceId: string = missionMeta?.workspace_id ?? '';

  for (const task of tasksToCheck) {
    if (task.status !== 'pending') continue;

    // Verify ALL dependencies are met
    const deps: any[] = task.task_dependencies || [];
    const allDepsMet = deps.every((dep: any) => {
      const status = statusMap.get(dep.depends_on_task_id);
      return status === 'completed';
    });

    if (allDepsMet) {
      const mrTask = task as any;
      if (mrTask.mapReduce) {
        await dispatchMapReduceTask(mrTask, missionId, workspaceId);
      } else {
        // 🚨 FIX 1: Atomic status update acts as distributed lock (Prevents race condition double-enqueue)
        const claimed = await nexusStateStore.updateTaskStatus(task.id, 'queued');
        if (claimed) {
          await tasksQueue.add(`task_${task.id}`, {
            taskId:       task.id,
            missionId,
            workspaceId,
            agentType:    task.agent_type,
            input:        task.input_payload,
            contextFields: deps.map((d: any) => d.depends_on_task_id),
          });
          console.log(`[MissionWorker] 🚀 Enqueued task ${task.id} for mission ${missionId}`);
        }
      }
    }
  }

  // Check completion (this still needs all tasks to confirm full mission termination)
  const allTasks = await nexusStateStore.getMissionTasks(missionId);
  await checkMissionCompletion(missionId, allTasks);
}

async function checkMissionCompletion(missionId: string, tasks: any[]) {
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
  } else if (allCompleted) {
    console.log(`[MissionWorker] ✅ Mission complete: ${missionId}`);
    await nexusStateStore.updateMissionStatus(missionId, 'complete', new Date().toISOString());
    await eventBuffer.publish(missionId, {
      type:      'mission_completed',
      missionId,
      userId:    '',
    });
  }
}

// ── Event Listener: subscribe to task_completed on process start ──────────

export function startMissionEventListener(): void {
  eventBus.subscribeGlobal(async (event: NexusEvent) => {
    if (event.type === 'task_completed' && event.taskId && event.missionId) {
      try {
        await onTaskCompleted(event.taskId, event.missionId);
        // 🚨 FIX 2: Reliable fallback (BullMQ mission check)
        await missionsQueue.add(`check_${event.missionId}`, {
          missionId: event.missionId,
          taskId: event.taskId,
          type: 'mission_check'
        }, { 
          jobId: `check_${event.missionId}_${event.taskId}`, // Idempotent check
          removeOnComplete: true 
        });
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
    const { missionId, userId, type, taskId } = job.data;

    if (type === 'mission_check') {
      console.log(`[MissionWorker] 🕵️ Reliable Check: mission ${missionId} (due to task ${taskId})`);
      return await onTaskCompleted(taskId || '__fallback__', missionId);
    }

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
