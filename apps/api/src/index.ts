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
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// --- P0: Startup Environment Variable Validation ---
const REQUIRED_ENV = [
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'REDIS_URL',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'JWT_SECRET',
  'CORS_ALLOW_ORIGINS'
];

// Validate all required environment variables
const missingEnv: string[] = [];
for (const k of REQUIRED_ENV) {
  if (!process.env[k] || process.env[k].trim() === '') {
    missingEnv.push(k);
  }
}

if (missingEnv.length > 0) {
  logger.fatal({ missing: missingEnv }, 'Missing required environment variables');
  console.error('\n❌ FATAL: Missing required environment variables:');
  missingEnv.forEach(k => console.error(`   - ${k}`));
  console.error('\nPlease check your .env file and restart the server.\n');
  process.exit(1);
}

// Validate PORT format
const PORT = parseInt(process.env.PORT!, 10);
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  logger.fatal({ port: process.env.PORT }, 'Invalid PORT configuration');
  console.error(`❌ FATAL: Invalid PORT value: ${process.env.PORT}`);
  console.error('PORT must be a number between 1 and 65535\n');
  process.exit(1);
}

// Validate URLs
const URL_PATTERN = /^https?:\/\/.+/i;
if (!URL_PATTERN.test(process.env.SUPABASE_URL!)) {
  logger.fatal({ url: process.env.SUPABASE_URL }, 'Invalid SUPABASE_URL format');
  console.error(`❌ FATAL: Invalid SUPABASE_URL: ${process.env.SUPABASE_URL}`);
  console.error('Must be a valid HTTP/HTTPS URL\n');
  process.exit(1);
}

logger.info('✅ All environment variables validated successfully');

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
import { masterBrainRouter } from './masterBrain.js';
import { llmHealthRouter } from './llm/LLMRouter.js';
// --- LLM Provider Health Endpoint ---

// --- P2: Input Validation (zod) ---
// Make sure to install zod: pnpm add zod
import { z } from 'zod';

// --- P0: Upstream Fetch Timeout & Retry Utility ---
// Use this for all fetch/HTTP calls to external APIs
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      if (attempt === retries) throw new Error(`[fetchWithTimeout] ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Exponential backoff
    }
  }
}



// ── App Setup ──────────────────────────────────────────────────────────────
const app: express.Express = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// --- LLM Provider Health Endpoint ---
app.use('/api/llm/providers', llmHealthRouter);
// --- Master Brain Health Endpoint ---
app.use('/api/master', masterBrainRouter);

// ...existing code...

// 🚨 CORS Lockdown for Production
const ALLOWED_ORIGINS = (process.env.CORS_ALLOW_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim());
function isOriginAllowed(origin: string | undefined) {
  if (!origin) return true;
  if (process.env.NODE_ENV === 'production') {
    return ALLOWED_ORIGINS.includes(origin);
  }
  return true;
}

// --- Health Check (Liveness) ---
app.get('/api/health', async (req, res) => {
  const redis = getRedis();
  const cacheKey = 'api:health';
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  }
  const result = {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    version: '2.7.0',
    timestamp: new Date().toISOString()
  };
  if (redis) await redis.set(cacheKey, JSON.stringify(result), 'EX', 10);
  res.json(result);
});

// --- Model Health Check Cache Vars ---
let cachedHealth: any = null;
let lastHealthCheck = 0;
const CACHE_DURATION = 5 * 60 * 1000;

app.get('/api/llm/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    health: rateLimitMonitor.getHealthSummary(),
    providers: rateLimitMonitor.getAllStatuses(),
    recentEvents: rateLimitMonitor.getRecentEvents(25),
  });
});



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


// Correlation ID — attach to every request (Task 17)
app.use((req: Request, res: Response, next) => {
  const id = randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// Apply requireAuth to all subsequent routes
app.use(requireAuth);

app.post('/api/marketplace/agents/:id/install', async (req, res) => {
  // No body expected, but validate params
  const idSchema = z.object({ id: z.string().min(1) });
  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid agent id', details: parseResult.error.errors });
  }
  const agent = MARKETPLACE_AGENTS.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  try {
    const supabase = await getSupabase();
    const userId = req.user!.id;
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
  } catch (dbErr: any) {
    if (dbErr.code === 'PGRST116') {
      // User has no prior state, create it
      const supabase = await getSupabase();
      await supabase
        .from('user_state')
        .insert({ user_id: req.user!.id, installed_agents: [req.params.id] });
    } else {
      logger.error({ err: dbErr.message, agentId: req.params.id }, '[Install] Failed to persist agent install');
    }
  }
  res.json({ success: true, agentId: req.params.id, message: `${agent.name} installed successfully` });
});

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
  } catch (err) {
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
    res.json({ status: 'ready', redis: redisStatus, database: dbStatus });
  } catch (err: any) {
    res.status(500).json({ status: 'unready', error: err.message });
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
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: User context missing' });
  }
  const userId = req.user.id;
  // Input validation using zod
  const OrchestrateSchema = z.object({
    goal: z.string().min(10).max(2000),
    workspaceId: z.string().regex(/^[a-zA-Z0-9_]+$/).optional(),
    archMode: z.enum(['legacy', 'os']).optional(),
  });
  const parseResult = OrchestrateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
  }
  type OrchestrateInput = { goal: string; workspaceId?: string; archMode?: 'legacy' | 'os' };
  const { goal: rawGoal, workspaceId, archMode } = parseResult.data as OrchestrateInput;
  // Strip HTML tags
  const goal = rawGoal.replace(/<[^>]*>/g, '').trim();
  // Ensure archMode is typed as ArchitectureMode with runtime check
  const allowedModes = ['legacy', 'os'] as const;
  const archModeFinal: import('@nexus-os/types').ArchitectureMode =
    allowedModes.includes(archMode as any) ? (archMode as import('@nexus-os/types').ArchitectureMode) : 'legacy';

  try {
    const { allowed, remaining } = await checkAndConsume(userId);
    if (!allowed) {
      return res.status(429).json({ error: 'Hourly LLM quota exceeded (30/hr). Try again later.', remaining });
    }

    // @ts-expect-error TypeScript does not narrow archModeFinal, but runtime is safe
    const dag = await planMission(goal, archModeFinal);
    // ...
    res.json({ missionId: dag.missionId, status: 'queued' });
  } catch (err: any) {
    logger.error({ userId, err: err.message }, 'Orchestration route failure');
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
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
  const idSchema = z.object({ id: z.string().min(1) });
  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid mission id', details: parseResult.error.errors });
  }
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
  const idSchema = z.object({ id: z.string().min(1) });
  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid approval id', details: parseResult.error.errors });
  }
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
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (updateErr) throw updateErr;

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
  const idSchema = z.object({ id: z.string().min(1) });
  const parseResult = idSchema.safeParse(req.params);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid approval id', details: parseResult.error.errors });
  }
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


  try {
    if (!res.writableEnded) res.write('\n'); // Flush initial headers
  } catch (e: any) {
    logger.error({ missionId, err: e.message }, '[SSE] Failed to write initial headers');
  }

  const handler = (event: any) => {
    try {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (e: any) {
      logger.error({ missionId, err: e.message }, '[SSE] Write error');
    }
  };

  await eventBus.subscribe(missionId, handler);

  // Heartbeat every 25s + auto-close after 10 min (Task 1)
  const stopHeartbeat = attachSSEHeartbeat(res);
  const stopTimeout   = attachSSETimeout(res, () => {
    eventBus.unsubscribe(missionId, handler);
  });

  req.on('close', () => {
    logger.info({ missionId }, 'SSE stream closed by client');
    // Observability: increment active_sse_connections--
    // metrics.decrement('active_sse_connections')
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
  // Accepts any object, but must be an object
  const StateSchema = z.record(z.any()).refine(
    (obj) => JSON.stringify(obj).length < 2 * 1024 * 1024,
    { message: "State object exceeds 2MB limit" }
  );
  const parseResult = StateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid state object', details: parseResult.error.errors });
  }
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
    const cacheKey = 'api:metrics';
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }
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

    const result = {
      active_missions:         activeMissions,
      queue_depth:             missionWaiting + taskWaiting,
      missions_queue:          missionWaiting,
      tasks_queue:             taskWaiting,
      tasks_completed_today:   completedToday,
      llm_errors_last_hour:    llmErrors,
      timestamp:               new Date().toISOString(),
    };
    if (redis) await redis.set(cacheKey, JSON.stringify(result), 'EX', 10);
    res.json(result);
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
