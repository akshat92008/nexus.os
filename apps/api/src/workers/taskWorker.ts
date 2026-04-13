import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { TaskJobData } from '../queue/queue';
import { logger } from '../logger';

const REDIS_URL = process.env.REDIS_URL;
let connection: Redis | undefined;

if (REDIS_URL) {
  try {
    connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  } catch (err) {
    console.error('[Worker] Redis connection failed:', err);
  }
}

export const taskWorker = connection ? new Worker<TaskJobData>(
  'tasks',
  async (job) => {
    logger.info({ taskId: job.data.taskId }, 'Processing task');
    // Minimal processing logic for lite mode recovery
  },
  { connection, concurrency: 1 }
) : null;
