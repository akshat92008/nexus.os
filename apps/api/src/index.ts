/**
 * Nexus OS — API Server (Entry Point)
 *
 * Routes:
 *   POST /api/orchestrate           → SSE stream of agent events
 *   GET  /api/ledger/:userId        → Ledger summary for a user
 *   GET  /api/export/:sessionId     → Download merged artifact file
 *   GET  /api/health                → System health check
 *
 * All routes are fully typed. CORS is open in dev; lock it down in prod.
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { planMission }      from './missionPlanner.js';
import { startDurableMission, executeSingleAction } from './orchestrator.js';
import { TaskRegistry }     from './taskRegistry.js';
import { MissionMemory }    from './missionMemory.js';
import { globalGovernor }   from './rateLimitGovernor.js';
import { MCPBridge }        from './mcpBridge.js';
import { ledger }           from './ledger.js';
import { masterBrain }      from './masterBrain.js';
import { schedulerEngine }  from './scheduler.js';
import { nexusStateStore }  from './storage/nexusStateStore.js';
import { approvalGuard }   from './ApprovalGuard.js';
import {
  executeIntegration,
  listTools,
  listPendingApprovals,
  resolveApproval,
  initWorkspacePermissions,
  grantPermission,
} from './integrationManager.js';
import { nexusFS }         from './storage/nexusFS.js';
import type {
  ApplicationWindowType,
  OrchestrateRequest,
  ExportFormat,
  GoalType,
  UserStateSnapshot,
  AgentType,
  TaskDAG,
} from '@nexus-os/types';

dotenv.config();


// ── App Setup ──────────────────────────────────────────────────────────────

const app: express.Express = express();
const PORT = parseInt(process.env.PORT ?? '3001');

// Session-scoped Mission Objects (Memory or Bridges) keyed by sessionId
const sessions = new Map<string, MissionMemory | MCPBridge>();


// --- Session Guard: track active AbortControllers per user ---
const activeUserTasks = new Map<string, AbortController>();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '1mb' }));

// ── Durable System Initialization ──────────────────────────────────────────

void (async () => {
  console.log('[API] 🚀 Initializing Nexus OS Durable Services...');
  
  try {
    // Initialize Master Brain's durable loops (repeatable jobs)
    await masterBrain.initDurableLoops();
    
    console.log('[API] ✅ Durable Services Initialized.');
  } catch (err) {
    console.error('[API] ❌ Durable Services Initialization failed:', err);
  }
})();

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), version: '2.5.0' });
});

/**
 * User State Management (Supabase-backed)
 */
app.get('/api/state/:userId', async (req, res) => {
  try {
    const state = await nexusStateStore.getUserState(req.params.userId);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/state/:userId', async (req, res) => {
  try {
    const state = await nexusStateStore.syncUserState(req.params.userId, req.body);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Orchestration (Durable DAG Execution)
 */
app.post('/api/orchestrate', async (req: Request<{}, {}, OrchestrateRequest>, res: Response) => {
  const { goal, userId, workspaceId } = req.body;

  if (!goal || !userId) {
    return res.status(400).json({ error: 'Goal and userId are required.' });
  }

  console.log(`[API] 🎯 Orchestrating mission for user ${userId}: "${goal}"`);

  try {
    // 1. Plan the mission (DAG Generation)
    const dag = await planMission(goal);

    // 2. Start Durable Mission (DB Persistence + Queue Enqueuing)
    await startDurableMission({
      dag,
      userId,
      workspaceId: workspaceId ?? `ws_${crypto.randomUUID().slice(0, 8)}`
    });

    res.json({ missionId: dag.missionId, status: 'queued' });
  } catch (err: any) {
    console.error('[API] ❌ Orchestration failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ... rest of the file ...
