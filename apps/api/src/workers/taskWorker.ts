/**
 * Nexus OS — Task Worker
 * 
 * Separate process that executes individual agent tasks.
 * Durable: Resumes on crash, handles retries.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { runAgent } from '../agentRunner.js';
import { eventBus } from '../events/eventBus.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { MissionMemory } from '../missionMemory.js';
import { tasksQueue, TaskJobData } from '../queue/queue.js';
import type { TypedArtifact } from '@nexus-os/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const taskWorker = new Worker<TaskJobData>(
  'tasks',
  async (job: Job<TaskJobData>) => {
    const { taskId, missionId, workspaceId, agentType, input, contextFields } = job.data;

    console.log(`[Worker] 🛠️  Executing task: ${taskId} (${agentType}) — Mission: ${missionId}`);

    try {
      // 1. Publish start event
      await eventBus.publish(missionId, {
        type: 'task_started',
        taskId,
        missionId,
        label: input.label,
        agentType
      });

      // 2. Build context selectively from memory
      // We read from the current mission's memory — contextFields are previous task outputs
      const memory = new MissionMemory(missionId, input.label);
      const context = memory.selectiveRead(contextFields);

      // 3. Run the Agent
      const result = await runAgent({
        task: input,
        goal: input.label, // Use task label for context
        goalType: 'general',
        context,
        isAborted: () => false // Durable tasks are not aborted by HTTP socket closure
      });

      // 4. Save Artifact & Update DB
      await memory.write(taskId, agentType, result.artifact, result.tokensUsed);
      
      // Update task in DB (this would be a proper Postgres call in a full refactor)
      // await db.tasks.update({ where: { id: taskId }, data: { status: 'completed', output_data: result.artifact } });

      // 5. Publish completion events
      await eventBus.publish(missionId, {
        type: 'artifact_created',
        taskId,
        missionId,
        artifact: result.artifact
      });

      await eventBus.publish(missionId, {
        type: 'task_completed',
        taskId,
        missionId,
        artifact: result.artifact
      });

      // 6. Check for downstream tasks (DAG execution engine)
      // This part would normally be handled by the MissionWorker/Orchestrator
      // which checks which tasks are now unblocked.
      
    } catch (err: any) {
      console.error(`[Worker] ❌ Task failed: ${taskId}`, err);
      await eventBus.publish(missionId, {
        type: 'task_failed',
        taskId,
        missionId,
        error: err.message
      });
      throw err; // Allow BullMQ to handle retries
    }
  },
  { connection, concurrency: 5 }
);

taskWorker.on('failed', (job, err) => {
  console.error(`[Worker] 🚨 Job ${job?.id} failed persistently:`, err);
});
