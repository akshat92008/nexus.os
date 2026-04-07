/**
 * Nexus OS — Mission Worker
 * 
 * Orchestrates the DAG of tasks for a mission.
 * Decides when to enqueue tasks based on dependency completion.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { eventBus } from '../events/eventBus.js';
import { tasksQueue, MissionJobData } from '../queue/queue.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { computeExecutionWaves, detectCycles } from '../orchestrator.js';
import type { TaskNode } from '@nexus-os/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const missionWorker = new Worker<MissionJobData>(
  'missions',
  async (job: Job<MissionJobData>) => {
    const { missionId, userId, workspaceId, goal, goalType } = job.data;

    console.log(`[MissionWorker] 🧠 Orchestrating mission: ${missionId} — "${goal}"`);

    try {
      // 1. Fetch DAG (In a real DB, this would be a query)
      // For now, we assume the DAG is passed or planned here
      // const dag = await planMission(goal, goalType); 

      // 2. Publish mission started
      await eventBus.publish(missionId, {
        type: 'mission_started',
        missionId,
        userId,
        goal
      });

      // 3. Logic for DAG execution:
      // In this refactor, we transition from "Wave" logic to "Dependency Tracking"
      // We enqueue all tasks that have ZERO dependencies first.
      
      // Let's assume we have the DAG nodes here
      // const nodes = dag.nodes;
      
      // For Phase 4, we'd store tasks in DB and a watcher/event-listener
      // would enqueue the next tasks when their dependencies finish.
      
    } catch (err: any) {
      console.error(`[MissionWorker] ❌ Mission failed: ${missionId}`, err);
      await eventBus.publish(missionId, {
        type: 'mission_failed',
        missionId,
        userId,
        error: err.message
      });
      throw err;
    }
  },
  { connection }
);
