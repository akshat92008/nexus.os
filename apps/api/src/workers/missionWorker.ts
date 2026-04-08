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

  // 🚨 HARDEN 2: Chunked queuing for fan-outs (DDoS prevention)
  const CONCURRENCY_LIMIT = 5; // Process only 5 chunk creations at a time
  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
    
    await Promise.all(batch.map(async (chunk, batchIdx) => {
      const idx = i + batchIdx;
      const childTaskId = `${task.id}_map_${idx}`;

      await nexusStateStore.createTask({
        id:          childTaskId,
        missionId,
        label:       `${task.label} [map ${idx + 1}/${chunks.length}]`,
        agentType:   task.agent_type,
        inputPayload: { ...input, items: undefined, text: undefined, chunk },
        dependencies: [],
        mapReduceRole: 'map',
        parentTaskId: task.id,
      });

      const claimed = await nexusStateStore.updateTaskStatus(childTaskId, 'queued');
      if (claimed) {
        await tasksQueue.add(`task_${childTaskId}`, {
          taskId:       childTaskId,
          missionId,
          workspaceId,
          agentType:    task.agent_type,
          input:        { ...task, id: childTaskId, label: `${task.label} [map ${idx + 1}]` },
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

  // 🚨 FIX 4: Optimized dependency check
  // If bootstrap, we need all tasks. Otherwise, we only check tasks dependent on taskId.
  let tasksToCheck: any[] = [];
  if (taskId === '__bootstrap__') {
    tasksToCheck = await nexusStateStore.getMissionTasks(missionId);
  } else {
    tasksToCheck = await nexusStateStore.getDependentTasks(taskId);
  }

  if (!tasksToCheck || tasksToCheck.length === 0) {
    // Check if mission is complete if no more dependent tasks
    const allTasks = await nexusStateStore.getMissionTasks(missionId);
    await checkMissionCompletion(missionId, allTasks);
    return;
  }

  // For dependent tasks, we still need full mission state to verify ALL deps are done
  const allTasks = await nexusStateStore.getMissionTasks(missionId);
  
  // Fetch workspaceId
  const missionMeta = await nexusStateStore.getMissionById(missionId).catch(() => null);
  const workspaceId: string = missionMeta?.workspace_id ?? '';

  for (const task of tasksToCheck) {
    if (task.status !== 'pending') continue;

    const deps: any[] = task.task_dependencies || [];
    const allDepsMet = deps.every((dep: any) => {
      const depTask = allTasks.find((t: any) => t.id === dep.depends_on_task_id);
      return depTask && depTask.status === 'completed';
    });

    if (allDepsMet) {
      const mrTask = task as MapReduceTaskNode;
      if (mrTask.mapReduce) {
        await dispatchMapReduceTask(mrTask, missionId, workspaceId);
      } else {
        // 🚨 FIX 1: Atomic updateTaskStatus acts as distributed lock
        const updated = await nexusStateStore.updateTaskStatus(task.id, 'queued');
        if (updated) {
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
    }
  }

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
