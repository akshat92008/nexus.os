/**
 * Nexus OS — Task Queue
 * 
 * Powered by BullMQ (Redis-backed).
 * Handles mission and task lifecycle asynchronously.
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { TaskNode, AgentType } from '@nexus-os/types';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error('[Queue] FATAL: Redis unavailable. Set REDIS_URL in .env');
  throw new Error('[Queue] FATAL: Redis unavailable. Set REDIS_URL in .env');
}

let connection: Redis;
try {
  connection = new Redis(REDIS_URL, { 
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  });
  connection.on('error', (err) => {
    console.error('[Queue] Redis connection error:', err.message);
  });
} catch (err: any) {
  console.error('[Queue] FATAL: Redis unavailable. Set REDIS_URL in .env');
  throw err;
}

// ── Queue Definitions ────────────────────────────────────────────────────────

/**
 * Missions Queue: Handles DAG planning and wave orchestration
 */
export const missionsQueue = new Queue('missions', { connection });

/**
 * Tasks Queue: Handles individual agent executions
 */
export const tasksQueue = new Queue('tasks', { connection });

/**
 * System Queue: Handles periodic maintenance, master brain loops, and schedules
 */
export const systemQueue = new Queue('system', { connection });

// ── Job Types ────────────────────────────────────────────────────────────────

export interface MissionJobData {
  missionId:   string;
  userId:      string;
  workspaceId: string;
  goal:        string;
  goalType:    string;
  type?:       'mission_check';
  taskId?:     string;
}

export interface TaskJobData {
  taskId:      string;
  missionId:   string;
  workspaceId: string;
  agentType:   AgentType;
  input:       TaskNode;
  contextFields: string[];
}
