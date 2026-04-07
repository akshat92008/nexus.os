/**
 * Nexus OS — Mission Worker
 * 
 * Orchestrates the DAG of tasks for a mission.
 * Decides when to enqueue tasks based on dependency completion.
 * This is the "Brain" that keeps the mission moving forward.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { eventBus } from '../events/eventBus.js';
import { tasksQueue, MissionJobData } from '../queue/queue.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const missionWorker = new Worker<MissionJobData>(
  'missions',
  async (job: Job<MissionJobData>) => {
    const { missionId, userId, workspaceId, goal } = job.data;

    console.log(`[MissionWorker] 🧠 Orchestrating mission: ${missionId} — "${goal}"`);

    try {
      // 1. Fetch all tasks for this mission from the DB
      const tasks = await nexusStateStore.getMissionTasks(missionId);
      
      if (!tasks || tasks.length === 0) {
        console.log(`[MissionWorker] ⚠️ No tasks found for mission: ${missionId}`);
        return;
      }

      // 2. Check for overall mission completion or failure
      const allCompleted = tasks.every(t => t.status === 'completed');
      const anyFailed = tasks.some(t => t.status === 'failed');

      if (allCompleted) {
        console.log(`[MissionWorker] ✅ Mission complete: ${missionId}`);
        await nexusStateStore.updateMissionStatus(missionId, 'complete', new Date().toISOString());
        await eventBus.publish(missionId, { type: 'mission_completed', missionId, userId });
        return;
      }

      if (anyFailed) {
        console.log(`[MissionWorker] ❌ Mission failed: ${missionId}`);
        await nexusStateStore.updateMissionStatus(missionId, 'failed');
        await eventBus.publish(missionId, { type: 'mission_failed', missionId, userId, error: 'One or more tasks failed.' });
        return;
      }

      // 3. Identify tasks that are 'pending' and unblocked
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      const readyToEnqueue = pendingTasks.filter(task => {
        const dependencies = task.task_dependencies || [];
        if (dependencies.length === 0) return true;

        // Check if all dependencies are completed
        return dependencies.every((dep: any) => {
          const depTask = tasks.find(t => t.id === dep.depends_on_task_id);
          return depTask && depTask.status === 'completed';
        });
      });

      console.log(`[MissionWorker] 🚀 Found ${readyToEnqueue.length} tasks ready to enqueue for mission ${missionId}`);

      // 4. Enqueue ready tasks
      for (const task of readyToEnqueue) {
        // Mark as 'queued' in DB first to avoid double-enqueuing
        await nexusStateStore.updateTaskStatus(task.id, 'queued');

        await tasksQueue.add(`task_${task.id}`, {
          taskId:      task.id,
          missionId:   missionId,
          workspaceId: workspaceId,
          agentType:   task.agent_type,
          input:       task.input_payload,
          contextFields: (task.task_dependencies || []).map((d: any) => d.depends_on_task_id)
        });
      }

      // 5. If we enqueued anything, we might need to check again later.
      // However, BullMQ jobs can be repeatable or we can re-enqueue the mission job 
      // with a delay if there are still pending tasks.
      const stillPending = tasks.some(t => t.status === 'pending' || t.status === 'queued' || t.status === 'running');
      if (stillPending) {
        // Re-enqueue the mission orchestration job to check again in a few seconds
        // This ensures the DAG keeps moving even if a task completion event is missed.
        await job.updateProgress(50);
        await job.queue.add(job.name, job.data, { delay: 5000 });
      }
      
    } catch (err: any) {
      console.error(`[MissionWorker] ❌ Mission orchestration failed: ${missionId}`, err);
      throw err;
    }
  },
  { connection }
);
