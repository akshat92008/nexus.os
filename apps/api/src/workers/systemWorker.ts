/**
 * Nexus OS — System Worker
 * 
 * Handles periodic maintenance, master brain loops, and scheduled missions.
 * Powered by BullMQ repeatable jobs.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { eventBus } from '../events/eventBus.js';
import { startDurableMission } from '../orchestrator.js';
import { planMission } from '../missionPlanner.js';
import { masterBrain } from '../masterBrain.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const systemWorker = new Worker(
  'system',
  async (job: Job) => {
    const { type, userId, workspaceId, goal } = job.data;

    console.log(`[SystemWorker] ⚙️ Executing system job: ${job.name} (Type: ${type})`);

    try {
      switch (type) {
        case 'master_brain_loop':
          await masterBrain.runDecisionCycle();
          break;

        case 'master_brain_reflection':
          await masterBrain.runGlobalReflection();
          break;

        case 'scheduled_mission':
          await handleScheduledMission(userId, workspaceId, goal);
          break;

        case 'maintenance':
          await handleMaintenance();
          break;

        default:
          console.warn(`[SystemWorker] Unknown job type: ${type}`);
      }
    } catch (err: any) {
      console.error(`[SystemWorker] ❌ Job ${job.id} failed:`, err);
      throw err;
    }
  },
  { connection }
);

async function handleScheduledMission(userId: string, workspaceId: string, goal: string) {
  console.log(`[SystemWorker] ⏰ Triggering scheduled mission for user ${userId}: "${goal}"`);
  
  // 1. Plan the mission
  const dag = await planMission(goal);
  
  // 2. Start durable mission
  await startDurableMission({
    dag,
    userId,
    workspaceId
  });
}

async function handleMaintenance() {
  console.log('[SystemWorker] 🧹 Running system maintenance...');
  // Clean up old artifacts, logs, etc.
}
