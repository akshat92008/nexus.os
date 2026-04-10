// --- Health Endpoint for Worker ---
import express from 'express';
const app = express();
app.get('/health', (req, res) => {
  res.json({ status: 'ok', worker: 'system', timestamp: Date.now() });
});
if (require.main === module) {
  const port = process.env.HEALTH_PORT || 4003;
  app.listen(port, () => console.log(`[SystemWorker] Health endpoint on :${port}`));
}
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

// ── Circuit Breaker Config ──────────────────────────────────────────────────
const MAX_ITERATIONS = 15;      // Max steps in a single mission
const MAX_RUNTIME_MS = 600_000; // 10 minutes max per job
const TOKEN_LIMIT    = 50_000;  // 50k tokens max per mission

export const systemWorker = new Worker(
  'system',
  async (job: Job) => {
    const { type, userId, workspaceId, goal, missionId } = job.data;
    const startTime = Date.now();

    console.log(`[SystemWorker] ⚙️ Executing system job: ${job.name} (Type: ${type})`);

    // ── Circuit Breaker: Runtime Limit ──────────────────────────────────────
    const timer = setTimeout(() => {
      console.error(`[SystemWorker] 🚨 Circuit Breaker: Job ${job.id} exceeded runtime limit.`);
      // In a real environment, we'd signal an abort.
    }, MAX_RUNTIME_MS);

    try {
      // ── Circuit Breaker: Token/Iteration Check ────────────────────────────
      if (missionId) {
        const tasks = await nexusStateStore.getMissionTasks(missionId);
        const totalTokens = tasks.reduce((sum: number, t: any) => sum + (t.tokens_used || 0), 0);
        
        if (totalTokens > TOKEN_LIMIT) {
          throw new Error(`[CircuitBreaker] Mission ${missionId} exceeded token limit (${totalTokens}/${TOKEN_LIMIT})`);
        }
        if (tasks.length > MAX_ITERATIONS) {
          throw new Error(`[CircuitBreaker] Mission ${missionId} exceeded iteration limit (${tasks.length}/${MAX_ITERATIONS})`);
        }
      }

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
    } finally {
      clearTimeout(timer);
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
    goal,
    goalType: 'general',
    userId,
    sessionId: `scheduled-${Date.now()}`,
    workspaceId,
    res: { write: () => true, end: () => true } as any, // Mock Response for background worker
    isAborted: () => false
  });
}

async function handleMaintenance() {
  console.log('[SystemWorker] 🧹 Running system maintenance...');
  // Clean up old artifacts, logs, etc.
}
