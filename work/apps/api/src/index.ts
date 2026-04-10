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
// startup log deferred until logger is imported
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { planMission }      from './missionPlanner.js';
import { 
  missionsQueue,
  tasksQueue 
} from './queue/queue.js';
import { startDurableMission, cancelDurableMission, executeSingleAction } from './orchestrator.js';
import { eventBus }         from './events/eventBus.js';
import { nexusStateStore }  from './storage/nexusStateStore.js';
import { approvalGuard }   from './ApprovalGuard.js';
import { startMissionEventListener } from './workers/missionWorker.js';
import './workers/taskWorker.js'; // Ensure task worker is initialized
import { AGENT_REGISTRY } from './agents/agentRegistry.js';
import type { OrchestrateRequest } from '@nexus-os/types';
import { requireAuth } from './middleware/auth.js';
import { getSupabase } from './storage/supabaseClient.js';
import { rateLimitMonitor } from './llm/RateLimitMonitor.js';
import { logger } from './logger.js';
import { attachSSEHeartbeat, attachSSETimeout } from './events/eventBus.js';
import { getRedis } from './storage/redisClient.js';
import { checkAndConsume } from './rateLimitGovernor.js';
import { randomUUID } from 'crypto';

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
    logger.info('Initializing Nexus OS durable services');
    
    try {
      // Start global mission event listener (reliable DAG orchestration)
      startMissionEventListener();
      
      // Marks 'pending' approvals older than 10 mins as 'rejected'
      await approvalGuard.cleanupStaleApprovals();
      
      logger.info('Durable services initialized');
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

app.get('/api/llm/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    health: rateLimitMonitor.getHealthSummary(),
    providers: rateLimitMonitor.getAllStatuses(),
    recentEvents: rateLimitMonitor.getRecentEvents(25),
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

app.post('/api/marketplace/agents/:id/install', async (req, res) => {
  const agent = MARKETPLACE_AGENTS.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  // Task 13: Persist installed agent to user's profile in Supabase
  try {
    const supabase = await getSupabase();
    const userId = req.user!.id;
    // Upsert into user_state.installed_agents (JSONB array)
    const { data: state } = await supabase
      .from('user_state')
      .select('installed_agents')
      .eq('user_id', userId)
      .single();
    const current: string[] = state?.installed_agents ?? [];
    if (!current.includes(req.params.id)) {
      await supabase
        .from('user_state')
        .upsert({ user_id: userId, installed_agents: [...current, req.params.id] }, { onConflict: 'user_id' });
    }
  } catch (dbErr) {
    // Non-fatal: log but still return success (agent data is static)
    console.error('[Install] Failed to persist agent install:', dbErr);
  }
  res.json({ success: true, agentId: req.params.id, message: `${agent.name} installed successfully` });
});

// Correlation ID — attach to every request (Task 17)
app.use((req: Request, res: Response, next) => {
  const id = randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// Apply requireAuth to all subsequent routes
app.use(requireAuth);

/**
 * Readiness Check (Dependencies)
 */
app.get('/api/ready', async (req, res) => {
  const failures: string[] = [];

  // Redis ping
  let redisStatus = 'connected';
  try {
    const redis = getRedis();
    if (!redis) throw new Error('REDIS_URL not configured');
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error(`Unexpected ping response: ${pong}`);
  } catch (err: any) {
    redisStatus = 'unavailable';
    failures.push(`redis: ${err.message}`);
  }

  // Supabase SELECT 1
  let dbStatus = 'connected';
  try {
    const supabase = await getSupabase();
    const { error: dbError } = await supabase
      .from('nexus_missions')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (dbError) throw dbError;
  } catch (err: any) {
    dbStatus = 'unavailable';
    failures.push(`database: ${err.message}`);
  }

  if (failures.length > 0) {
    return res.status(503).json({ status: 'unready', redis: redisStatus, database: dbStatus, failures });
  }

  try {
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
// Global rate limit: 100 req/min per IP (Task 12)
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — max 100/min' },
});
app.use(globalLimiter);

const orchestrateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

app.post('/api/orchestrate', orchestrateLimiter, async (req: Request<{}, {}, OrchestrateRequest>, res: Response) => {
  const { goal: rawGoal, workspaceId, archMode = 'legacy' } = req.body;
  const userId = req.user!.id;

  // ── Input validation (Task 10) ────────────────────────────────────────────
  if (!rawGoal || typeof rawGoal !== 'string') {
    return res.status(400).json({ error: 'goal is required and must be a string.' });
  }
  // Strip HTML tags
  const goal = rawGoal.replace(/<[^>]*>/g, '').trim();
  if (goal.length < 10) {
    return res.status(400).json({ error: 'goal must be at least 10 characters.' });
  }
  if (goal.length > 500) {
    return res.status(400).json({ error: 'goal must be 500 characters or fewer.' });
  }
  if (workspaceId !== undefined) {
    if (typeof workspaceId !== 'string' || !/^[a-zA-Z0-9_]+$/.test(workspaceId)) {
      return res.status(400).json({ error: 'workspaceId must be alphanumeric with underscores only.' });
    }
  }

  // ── Per-user LLM rate limit check ────────────────────────────────────────
  const { allowed, remaining } = await checkAndConsume(userId);
  if (!allowed) {
    return res.status(429).json({ error: 'Hourly LLM quota exceeded (30/hr). Try again later.', remaining });
  }

  try {
    const dag = await planMission(goal, archMode);
    // Task 11: crypto.randomUUID() instead of Math.random()
    const workspace_id = workspaceId ?? `ws_${randomUUID().slice(0, 8)}`;

    // 1. Persist the mission metadata
    await nexusStateStore.createMission({
      id:           dag.missionId,
      user_id:      userId,
      goal,
      goal_type:    dag.goalType,
      workspace_id,
      status:       'queued',
      created_at:   new Date().toISOString()
    });

    // 2. Persist all tasks in the DAG as 'pending'
    const tasksToCreate = dag.nodes.map(node => ({
      id:           node.id,
      missionId:    dag.missionId,
      workspaceId:  workspace_id,
      label:        node.label,
      agentType:    node.agentType,
      inputPayload: { goal: dag.goal, contextFields: node.contextFields },
      dependencies: node.dependencies || [],
      status:       'pending' as const
    }));
    await nexusStateStore.batchCreateTasks(tasksToCreate);

    // 3. Hand off to BullMQ missions queue for background orchestration
    await missionsQueue.add(`mission_${dag.missionId}`, {
      missionId:    dag.missionId,
      userId,
      workspaceId:  workspace_id,
      goal,
      type:         'bootstrap'
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
 * Approve a pending task (Task 19)
 * POST /api/approvals/:id/approve
 */
app.post('/api/approvals/:id/approve', async (req, res) => {
  const { id } = req.params;
  const userId  = req.user!.id;
  try {
    const supabase = await getSupabase();
    // Verify ownership via the related mission
    const { data: appr, error: fetchErr } = await supabase
      .from('pending_approvals')
      .select('*, nexus_missions!inner(user_id)')
      .eq('id', id)
      .single();
    if (fetchErr || !appr) return res.status(404).json({ error: 'Approval not found' });
    if (appr.nexus_missions.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (appr.status !== 'pending') return res.status(409).json({ error: `Approval already ${appr.status}` });

    const { error: updateErr } = await supabase
      .from('pending_approvals')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (updateErr) throw updateErr;

    // Resume the paused task via BullMQ
    if (appr.task_id) {
      const job = await tasksQueue.getJob(appr.task_id);
      if (job) await job.updateData({ ...job.data, approvalStatus: 'approved' });
    }

    logger.info({ approvalId: id, userId }, 'Approval granted');
    res.json({ success: true, status: 'approved' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Reject a pending task (Task 19)
 * POST /api/approvals/:id/reject
 */
app.post('/api/approvals/:id/reject', async (req, res) => {
  const { id } = req.params;
  const userId  = req.user!.id;
  try {
    const supabase = await getSupabase();
    const { data: appr, error: fetchErr } = await supabase
      .from('pending_approvals')
      .select('*, nexus_missions!inner(user_id)')
      .eq('id', id)
      .single();
    if (fetchErr || !appr) return res.status(404).json({ error: 'Approval not found' });
    if (appr.nexus_missions.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (appr.status !== 'pending') return res.status(409).json({ error: `Approval already ${appr.status}` });

    const { error: updateErr } = await supabase
      .from('pending_approvals')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (updateErr) throw updateErr;

    logger.info({ approvalId: id, userId }, 'Approval rejected');
    res.json({ success: true, status: 'rejected' });
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

  // Heartbeat every 25s + auto-close after 10 min (Task 1)
  const stopHeartbeat = attachSSEHeartbeat(res);
  const stopTimeout   = attachSSETimeout(res, () => {
    eventBus.unsubscribe(missionId, handler);
  });

  req.on('close', () => {
    logger.info({ missionId }, 'SSE stream closed by client');
    stopHeartbeat();
    stopTimeout();
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

/**
 * Metrics endpoint (Task 16)
 * GET /api/metrics
 * Exposes: active_missions, queue_depth, tasks_completed_today, llm_errors_last_hour
 */
app.get('/api/metrics', async (req, res) => {
  try {
    const redis   = getRedis();
    const supabase = await getSupabase();

    // Active missions from DB
    const { count: activeMissions } = await supabase
      .from('nexus_missions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued', 'running'])
      .then((r) => ({ count: r.count ?? 0 }));

    // BullMQ queue depths
    const [missionWaiting, taskWaiting] = await Promise.all([
      missionsQueue.getWaitingCount(),
      tasksQueue.getWaitingCount(),
    ]);

    // Redis counters written by existing code
    const [completedToday, llmErrors] = redis
      ? await Promise.all([
          redis.get('nexus:metrics:tasks_completed_today').then((v) => parseInt(v ?? '0')),
          redis.get('nexus:metrics:llm_errors_last_hour').then((v) => parseInt(v ?? '0')),
        ])
      : [0, 0];

    res.json({
      active_missions:         activeMissions,
      queue_depth:             missionWaiting + taskWaiting,
      missions_queue:          missionWaiting,
      tasks_queue:             taskWaiting,
      tasks_completed_today:   completedToday,
      llm_errors_last_hour:    llmErrors,
      timestamp:               new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Nexus OS API running');
    logger.info({ allowedOrigins: ALLOWED_ORIGINS }, 'CORS origins configured');
  });
}
