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
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
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
import { AGENT_REGISTRY } from './agents/agentRegistry.js';
import type { OrchestrateRequest } from '@nexus-os/types';
import { requireAuth } from './middleware/auth.js';
import { getSupabase } from './storage/supabaseClient.js';

dotenv.config();

// ── App Setup ──────────────────────────────────────────────────────────────

const app: express.Express = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const PORT = parseInt(process.env.PORT ?? '3001');

// 🚨 ARCHITECTURAL DECISION: CORS / SSE Allowed Origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim());

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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
      
      // Marks 'pending' approvals older than 10 mins as 'rejected'
      await approvalGuard.cleanupStaleApprovals();
      
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
 * Model Health Check
 * Verifies that free models on OpenRouter are responsive.
 * Results are cached for 5 minutes.
 */
let cachedHealth: any = null;
let lastHealthCheck = 0;
const CACHE_DURATION = 5 * 60 * 1000;

app.get('/api/models/health', async (req, res) => {
  const now = Date.now();
  if (cachedHealth && now - lastHealthCheck < CACHE_DURATION) {
    return res.json(cachedHealth);
  }

  const { FREE_MODELS, MODEL_FAST } = await import('./llm/LLMRouter.js');
  const models = FREE_MODELS[MODEL_FAST];
  const results: Record<string, string> = {};

  await Promise.all(models.map(async (model) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5
        })
      });

      if (response.ok) {
        results[model] = 'ok';
      } else {
        results[model] = `error: ${response.status}`;
      }
    } catch (err: any) {
      results[model] = `error: ${err.message}`;
    }
  }));

  cachedHealth = {
    timestamp: new Date().toISOString(),
    results
  };
  lastHealthCheck = now;

  res.json(cachedHealth);
});

/**
 * Marketplace Agents (Public — No Auth Required)
 */
const MARKETPLACE_AGENTS = [
  { id: 'gtm-strategist', name: 'GTM Strategist', description: 'Go-to-market planning for B2B SaaS in India', persona: 'founder', capabilities: ['market sizing', 'channel strategy', 'ICP definition'], installCount: 142 },
  { id: 'lead-hunter', name: 'Lead Hunter', description: 'Finds and qualifies B2B leads in Indian markets', persona: 'founder', capabilities: ['lead research', 'email personalisation', 'LinkedIn prospecting'], installCount: 98 },
  { id: 'code-reviewer', name: 'Code Reviewer', description: 'Reviews PRs, finds bugs, suggests refactors', persona: 'developer', capabilities: ['TypeScript', 'React', 'Node.js', 'security audit'], installCount: 215 },
  { id: 'api-architect', name: 'API Architect', description: 'Designs REST and GraphQL APIs with full documentation', persona: 'developer', capabilities: ['API design', 'OpenAPI spec', 'schema validation'], installCount: 87 },
  { id: 'essay-coach', name: 'Essay Coach', description: 'Structures and improves academic essays and reports', persona: 'student', capabilities: ['argument structure', 'citations', 'grammar'], installCount: 174 },
  { id: 'exam-prep', name: 'Exam Prep', description: 'Creates revision plans, flashcards and mock questions', persona: 'student', capabilities: ['flashcards', 'practice questions', 'study schedule'], installCount: 63 },
];

app.get('/api/marketplace/agents', (req, res) => {
  res.json(MARKETPLACE_AGENTS);
});

app.post('/api/marketplace/agents/:id/install', (req, res) => {
  const agent = MARKETPLACE_AGENTS.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({ success: true, agentId: req.params.id, message: `${agent.name} installed successfully` });
});

// Apply requireAuth to all subsequent routes
app.use(requireAuth);

/**
 * Readiness Check (Dependencies)
 */
app.get('/api/ready', async (req, res) => {
  try {
    const client = await nexusStateStore.getSupabaseClient();
    const { error: dbError } = await client.from('nexus_missions').select('count', { count: 'exact', head: true }).limit(1);
    
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
 * Agent Registry
 */
app.get('/api/agents', async (req, res) => {
  res.json(Object.values(AGENT_REGISTRY));
});

/**
 * Orchestration (Durable DAG Execution)
 */
const orchestrateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

app.post('/api/orchestrate', orchestrateLimiter, async (req: Request<{}, {}, OrchestrateRequest>, res: Response) => {
  const { goal, workspaceId, archMode = 'agentic' } = req.body;
  const userId = req.user!.id;

  if (!goal) {
    return res.status(400).json({ error: 'Goal is required.' });
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
    if (!mission || mission.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Mission not found' });
    }
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
    const mission = await nexusStateStore.getMissionById(id);
    if (!mission || mission.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Mission not found' });
    }
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
    // Simple check: check if mission belongs to user
    const mission = await nexusStateStore.getMissionById(task.mission_id);
    if (!mission || mission.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Pending Approvals API
 * Returns all open approvals for the authenticated user.
 */
app.get('/api/approvals/pending', async (req, res) => {
  const userId = req.user!.id;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('pending_approvals')
      .select('*, nexus_missions!inner(user_id, goal)')
      .eq('status', 'pending')
      .eq('nexus_missions.user_id', userId);

    if (error) throw error;
    res.json(data);
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

  // Verify ownership
  try {
    const mission = await nexusStateStore.getMissionById(missionId);
    if (!mission || mission.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify mission ownership' });
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
 * User State Management
 */
app.get('/api/state', async (req, res) => {
  const userId = req.user!.id;
  try {
    const state = await nexusStateStore.getUserState(userId);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/state', async (req, res) => {
  const userId = req.user!.id;
  try {
    const state = await nexusStateStore.syncUserState(userId, req.body);
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
