/**
 * Nexus OS — Task Queue
 * 
 * Powered by BullMQ (Redis-backed).
 * Handles mission and task lifecycle asynchronously.
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { TaskNode, AgentType } from '@nexus-os/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

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
}

export interface TaskJobData {
  taskId:      string;
  missionId:   string;
  workspaceId: string;
  agentType:   AgentType;
  input:       TaskNode;
  contextFields: string[];
}
