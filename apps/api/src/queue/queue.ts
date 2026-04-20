import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { TaskNode, AgentType } from '@nexus-os/types';

import { logger } from '../logger.js';

const REDIS_URL = process.env.REDIS_URL;
let connection: Redis | undefined;

if (!REDIS_URL) {
  logger.warn('[Queue] Redis URL missing. Background workers and durable queues will be DISABLED (In-Memory Mock Mode).');
} else {
  try {
    connection = new Redis(REDIS_URL, { 
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    connection.on('error', (err) => {
      logger.error({ err: err.message }, '[Queue] Redis connection error (falling back to mock mode)');
      // If we lose connection, we don't nullify the object because BullMQ needs it, 
      // but we log it and the app continues.
    });
  } catch (err: any) {
    logger.fatal({ err: err.message }, '[Queue] Could not initialize Redis client');
  }
}

// Lite-mode mocks if Redis is missing to prevent ECONNREFUSED
const mockQueue = (name: string) => ({
  name,
  add: async () => {
    logger.info({ queue: name }, '[MockQueue] Task added to in-memory fallback');
    return { id: `mock-${Date.now()}` };
  },
  getJob: async () => null,
  getWaitingCount: async () => 0,
  on: () => {},
  obliterate: async () => {},
  getJobs: async () => [],
} as any);

// Check if connection is actually present before using it
export const missionsQueue = (connection && REDIS_URL) ? new Queue('missions', { connection }) : mockQueue('missions');
export const tasksQueue    = (connection && REDIS_URL) ? new Queue('tasks', { connection, defaultJobOptions: { attempts: 4, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true, removeOnFail: false } }) : mockQueue('tasks');
export const systemQueue   = (connection && REDIS_URL) ? new Queue('system', { connection }) : mockQueue('system');

export interface MissionJobData {
  missionId: string;
  userId: string;
  workspaceId: string;
  goal: string;
  goalType: string;
  type?: 'mission_check';
  taskId?: string;
}

export interface TaskJobData {
  taskId: string;
  missionId: string;
  userId: string;
  workspaceId: string;
  agentType: AgentType;
  input: TaskNode;
  contextFields: string[];
}
