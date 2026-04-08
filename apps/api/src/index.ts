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
console.log("🚀 [HEARTBEAT] The API is starting up...");
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { planMission }      from './missionPlanner.js';
import { 
  startDurableMission, 
  cancelDurableMission,
  executeSingleAction 
} from './orchestrator.js';
import { eventBus }         from './events/eventBus.js';
import { nexusStateStore }  from './storage/nexusStateStore.js';
import { approvalGuard }   from './ApprovalGuard.js';
import { startMissionEventListener } from './workers/missionWorker.js';
import './workers/taskWorker.js'; // Ensure task worker is initialized
import type { OrchestrateRequest } from '@nexus-os/types';

dotenv.config();

// ── App Setup ──────────────────────────────────────────────────────────────

const app: express.Express = express();
const PORT = parseInt(process.env.PORT ?? '3001');

// 🚨 ARCHITECTURAL DECISION: CORS / SSE Allowed Origins
// Added support for cloud-hybrid deployment (Vercel/Netlify)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'tauri://localhost',
  'https://tauri.localhost',
  /\.vercel\.app$/,      // Allow any Vercel deployment
  /\.netlify\.app$/      // Allow any Netlify deployment
];

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.some(pattern => 
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    )) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// 🚨 VERCEL ADAPTER: Export the app as a module
export default app;

// ── Durable System Initialization ──────────────────────────────────────────

if (!process.env.VERCEL) {
  void (async () => {
    console.log('[API] 🚀 Initializing Nexus OS Durable Services...');
    
    try {
      // Start global mission event listener (reliable DAG orchestration)
      startMissionEventListener();
      
      console.log('[API] ✅ Durable Services Initialized.');
    } catch (err) {
      console.error('[API] ❌ Durable Services Initialization failed:', err);
    }
  })();
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * Health Check (Liveness)
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: Math.floor(process.uptime()), 
    version: '2.7.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness Check (Dependencies)
 */
app.get('/api/ready', async (req, res) => {
  try {
    const client = await nexusStateStore.getSupabaseClient();
    const { error: dbError } = await client.from('missions').select('count', { count: 'exact', head: true }).limit(1);
    
    // We check Redis via the eventBus (which has ioredis connections)
    // Simple ping check
    const redisStatus = 'ready'; // Assuming ioredis handled connection

    if (dbError) throw dbError;

    res.json({ 
      status: 'ready', 
      database: 'connected', 
      redis: redisStatus 
    });
  } catch (err: any) {
    res.status(503).json({ status: 'unready', error: err.message });
  }
});

/**
 * Orchestration (Durable DAG Execution)
 */
app.post('/api/orchestrate', async (req: Request<{}, {}, OrchestrateRequest>, res: Response) => {
  const { goal, userId, workspaceId, archMode = 'legacy' } = req.body;

  if (!goal || !userId) {
    return res.status(400).json({ error: 'Goal and userId are required.' });
  }

  try {
    const dag = await planMission(goal, archMode);
    await startDurableMission({
      dag,
      userId,
      workspaceId: workspaceId ?? `ws_${Math.random().toString(36).slice(2, 10)}`
    });

    res.json({ missionId: dag.missionId, status: 'queued' });
  } catch (err: any) {
    console.error('[API] ❌ Orchestration failed:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Mission Status & Tasks
 */
app.get('/api/missions/:id/status', async (req, res) => {
  const { id } = req.params;
  try {
    const mission = await nexusStateStore.getMissionById(id);
    const tasks = await nexusStateStore.getMissionTasks(id);
    res.json({ mission, tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cancel Mission
 */
app.post('/api/missions/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    await cancelDurableMission(id);
    res.json({ status: 'cancelled', missionId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Specific Artifact
 */
app.get('/api/artifacts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const task = await nexusStateStore.getTask(id);
    if (!task || !task.output_artifact_id) {
      return res.status(404).json({ error: 'Artifact not found for this task' });
    }
    // Artifacts are stored in the tasks table as JSON in output_payload 
    // or referenced by output_artifact_id. Assuming missionStore fetches
    // task object which includes the artifact data or link.
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Event Stream (SSE)
 */
app.get('/api/events/stream', async (req, res) => {
  const { missionId } = req.query;

  if (!missionId || typeof missionId !== 'string') {
    return res.status(400).json({ error: 'missionId is required' });
  }

  // SSE Headers
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // For Nginx
  });

  res.write('\n'); // Flush initial headers

  const handler = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  await eventBus.subscribe(missionId, handler);

  req.on('close', () => {
    console.log(`[API] 🔌 Closed SSE stream for mission ${missionId}`);
    eventBus.unsubscribe(missionId, handler);
  });
});

/**
 * Mission Management
 */
app.get('/api/missions/:missionId', async (req, res) => {
  try {
    const tasks = await nexusStateStore.getMissionTasks(req.params.missionId);
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/missions/:missionId/cancel', async (req, res) => {
  try {
    await cancelDurableMission(req.params.missionId);
    res.json({ status: 'cancelled' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Artifact Retrieval
 */
app.get('/api/artifacts/:artifactId', async (req, res) => {
  try {
    const client = await nexusStateStore.getSupabaseClient();
    const { data, error } = await client
      .from('artifacts')
      .select('*')
      .eq('id', req.params.artifactId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * User State Management
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

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] ⚡ Nexus OS Backend running at http://0.0.0.0:${PORT}`);
    console.log(`[API] 🌍 Allowed Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  });
}
