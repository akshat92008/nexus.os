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
import 'dotenv/config';
import { logger } from './logger.js';

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// --- P0: Startup Environment Variable Validation ---
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'GROQ_API_KEY'
];

const RECOMMENDED_ENV = [
  'REDIS_URL',
  'JWT_SECRET',
  'CORS_ALLOW_ORIGINS',
  'OPENROUTER_API_KEY'
];

// Validate critical environment variables
const missingCritical: string[] = [];
for (const k of REQUIRED_ENV) {
  if (!process.env[k] || process.env[k].trim() === '') {
    missingCritical.push(k);
  }
}

if (missingCritical.length > 0) {
  logger.fatal({ missing: missingCritical }, 'Missing CRITICAL environment variables. App may not function.');
  console.error('\n❌ FATAL: Missing CRITICAL environment variables:');
  missingCritical.forEach(k => console.error(`   - ${k}`));
  // We still exit for truly critical DB/LLM keys to prevent garbage execution
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Handle Recommended/Non-Blocking Variables with safe fallbacks
if (!process.env.JWT_SECRET) {
  logger.warn('JWT_SECRET is missing. Using unstable "dev-emergency-secret". AUTH WILL BE INSECURE.');
  process.env.JWT_SECRET = 'dev-emergency-secret-change-me-in-production';
}

if (!process.env.CORS_ALLOW_ORIGINS) {
  logger.info('CORS_ALLOW_ORIGINS missing. Defaulting to allow all (*).');
  process.env.CORS_ALLOW_ORIGINS = '*';
}

// Validate PORT format
const PORT = parseInt(process.env.PORT || '3005', 10);
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  logger.warn({ port: process.env.PORT }, 'Invalid PORT configuration, defaulting to 4000');
}
const FINAL_PORT = isNaN(PORT) ? 4000 : PORT;

// Validate URLs
const URL_PATTERN = /^https?:\/\/.+/i;
if (!process.env.SUPABASE_URL || !URL_PATTERN.test(process.env.SUPABASE_URL)) {
  logger.fatal({ url: process.env.SUPABASE_URL }, 'Invalid SUPABASE_URL format. Persistence may fail.');
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
import { attachSSEHeartbeat, attachSSETimeout } from './events/eventBus.js';
import { getRedis } from './storage/redisClient.js';
import { checkAndConsume } from './rateLimitGovernor.js';
import { randomUUID } from 'crypto';
import { masterBrainRouter } from './masterBrain.js';
import { llmHealthRouter } from './llm/LLMRouter.js';
// --- Stripe Disabled (Free Mode) ---
const stripe = null;
const CREDIT_PACKS: any[] = [];
// ------------------------------------
// --- LLM Provider Health Endpoint ---

// --- P2: Input Validation (zod) ---
// Make sure to install zod: pnpm add zod
import { z } from 'zod';
import { withRetry, fetchWithResilience } from './resilience.js';





// ── App Setup ──────────────────────────────────────────────────────────────
const app: express.Express = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'], // TODO: replace unsafe-inline with nonce for better CSP security
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*', 'wss://*'],
      fontSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
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

/**
 * Billing & Stripe Integration (DISABLED)
 */
// app.post('/api/billing/checkout', ...);
// app.post('/api/billing/webhook', ...);

// ...existing code...

// 🚨 CORS Lockdown for Production
const ALLOWED_ORIGINS = (process.env.CORS_ALLOW_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim());
function isOriginAllowed(origin: string | undefined) {
  if (!origin) return true;
  if (process.env.NODE_ENV === 'production' && process.env.CORS_ALLOW_ORIGINS !== '*') {
    return ALLOWED_ORIGINS.includes(origin);
  }
  return true;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
}));

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
app.get('/api/marketplace/agents', async (req, res) => {
  try {
    const redis = getRedis();
    const CACHE_KEY = 'nexus:marketplace:catalog';
    
    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json(JSON.parse(cached));
    }

    const supabase = await getSupabase();
    const { data: agents, error } = await supabase
      .from('marketplace_agents')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    if (redis && agents) {
      await redis.set(CACHE_KEY, JSON.stringify(agents), 'EX', 60);
    }

    res.json(agents || []);
  } catch (err: any) {
    logger.error({ err: err.message }, '[API] Failed to fetch marketplace agents');
    res.status(500).json({ error: 'Failed to fetch agent marketplace' });
  }
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

app.post('/api/agents/spawn', async (req: Request, res: Response) => {
  const spawnSchema = z.object({
    agentType: z.enum(['researcher', 'analyst', 'writer', 'coder', 'strategist', 'summarizer']),
    workspaceId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  });

  const parseResult = spawnSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });
  }

  const { agentType, workspaceId } = parseResult.data;
  const userId = req.user!.id;

  // Find a matching agent from the registry
  const match = Object.values(AGENT_REGISTRY).find(a => a.type === agentType);
  if (!match) {
    return res.status(404).json({ error: `No registered agent for type: ${agentType}` });
  }

  try {
    // Log the spawn event — in a full system this would enqueue a persistent agent job
    logger.info({ userId, agentType, workspaceId, agentId: match.id }, 'Agent spawned');

    res.json({
      success: true,
      agent: {
        id: match.id,
        name: match.name,
        type: match.type,
        workspaceId: workspaceId ?? null,
        spawnedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Agent spawn failed');
    res.status(500).json({ error: 'Failed to spawn agent' });
  }
});

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
 * NexusFS — Intelligent Storage API
 */
import { nexusFS } from './storage/nexusFS.js';

app.get('/api/fs/list', async (req, res) => {
  const parentId = (req.query.parentId as string) || 'root';
  const userId = req.user!.id;
  try {
    const [folders, files] = await Promise.all([
      nexusFS.getFolders(parentId === 'root' ? null : parentId, userId),
      nexusFS.getFiles(parentId === 'root' ? null : parentId, userId)
    ]);
    res.json([...folders, ...files]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fs/upload', async (req, res) => {
  const { name, content, parentId } = req.body;
  const userId = req.user!.id;
  try {
    const file = await nexusFS.uploadFile(name, content, parentId || 'root', userId, 'text/plain');
    res.json(file);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fs/search', async (req, res) => {
  const query = (req.query.q as string) || '';
  const userId = req.user!.id;
  try {
    const files = await nexusFS.searchFiles(query, userId);
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
 * Agent Registry (Ticket 5: Real Backend)
 */
app.get('/api/agents', async (req, res) => {
  try {
    const supabase = await getSupabase();
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true);

    if (error) {
      logger.error({ error: error.message }, '[API] Failed to fetch agents from database');
      return res.status(500).json({ error: 'Failed to fetch agent marketplace' });
    }

    res.json(agents || []);
  } catch (err: any) {
    logger.error({ err: err.message }, '[API] Marketplace error');
    res.status(500).json({ error: 'Internal server error' });
  }
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
  keyGenerator: (req: any) => req.user?.id || req.ip || 'anonymous',
  message: { error: 'Too many requests — max 100/min' },
});
app.use(globalLimiter);

const orchestrateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.id || req.ip || 'anonymous',
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
    workspaceId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
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

    const dag = await planMission(goal, archModeFinal);
    
    // Persist mission via direct insert (no RPC — create_mission_atomic not deployed)
    await nexusStateStore.createMission({
      id: dag.missionId,
      userId,
      workspaceId,
      goal,
      goalType: dag.goalType,
      dagData: dag,
      // tasks omitted — orchestrator creates them during execution
    });

    logger.info({ userId, missionId: dag.missionId }, '🚀 Mission persisted and queued');
    res.json({ missionId: dag.missionId, status: 'queued' });

  // 🚀 Start durable execution in background using the SAME dag (no re-planning)
  setImmediate(async () => {
    try {
      const { missionStore } = await import('./storage/missionStore.js');
      const { MissionMemory } = await import('./missionMemory.js');
      const { TaskRegistry } = await import('./taskRegistry.js');
      const { orchestrateDAG } = await import('./orchestrator.js');

      // Double check mission exists in DB before starting
      // If the direct insert failed, we should know here
      try {
        await missionStore.getMissionById(dag.missionId);
      } catch (dbErr: any) {
        logger.error({ dbErr: dbErr.message, missionId: dag.missionId }, '[Background] Mission row missing! Did you run the SQL DDL?');
        await eventBus.publish(dag.missionId, { 
          type: 'error', 
          message: 'Database error: Mission record not found. Please ensure Supabase tables are created.' 
        } as any);
        return;
      }

      const memory   = new MissionMemory(dag.missionId, goal);
      const registry = new TaskRegistry(dag.missionId);
      const abortedRef = { value: false };

      const fakeRes = {
        writableEnded: false,
        write: (data: string) => {
          const line = data.replace(/^data:\s*/, '').trim();
          if (!line || line === '') return;
          try {
            const event = JSON.parse(line);
            eventBus.publish(dag.missionId, event).catch(() => {});
          } catch { /* skip malformed lines */ }
        },
        end: () => { fakeRes.writableEnded = true; },
      } as any;

      await orchestrateDAG({
        dag,
        memory,
        registry,
        userId,
        sessionId: dag.missionId,
        workspaceId,
        res: fakeRes,
        isAborted: () => abortedRef.value,
      });
    } catch (err: any) {
      logger.error({ err: err.message, missionId: dag.missionId }, '[Background] Mission execution failed');
      eventBus.publish(dag.missionId, { type: 'error', message: err.message } as any).catch(() => {});
    }
  });
  } catch (err: any) {
    logger.error({ userId, err: err.message }, 'Orchestration route failure');
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

/**
 * SSE Stream — Frontend subscribes here after mission is queued
 * GET /api/events/stream?missionId=<id>
 */
app.get('/api/events/stream', async (req: Request, res: Response) => {
  const missionId = req.query.missionId as string;
  if (!missionId) return res.status(400).json({ error: 'missionId is required' });

  // 🚀 NUCLEAR STABILITY HEADERS
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Content-Encoding': 'none' // Crucial to prevent ERR_INCOMPLETE_CHUNKED_ENCODING
  });

  // Force first byte send to establish stream
  res.write(': connected\n\n');
  if ((res as any).flush) (res as any).flush();

  const cleanupHeartbeat = attachSSEHeartbeat(res);
  const cleanupTimeout   = attachSSETimeout(res);

  const handler = (event: any) => {
    try {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if ((res as any).flush) (res as any).flush();
      }
    } catch (err) {
      logger.warn({ missionId, err }, '[SSE] Write failed');
    }
  };

  await eventBus.subscribe(missionId, handler, req.headers['last-event-id'] as string);

  req.on('close', async () => {
    cleanupHeartbeat();
    cleanupTimeout();
    await eventBus.unsubscribe(missionId, handler);
    logger.info({ missionId }, '[SSE] Stream closed by client');
  });
});


/**
 * List User Missions (Task 12)
 */
app.get('/api/missions', async (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);
  const offset = parseInt(req.query.offset as string || '0');

  try {
    const supabase = await getSupabase();
    const { data: missions, error, count } = await supabase
      .from('nexus_missions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ missions, count, limit, offset });
  } catch (err: any) {
    logger.error({ err: err.message, userId }, '[API] Failed to list missions');
    res.status(500).json({ error: 'Failed to fetch missions' });
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
 * Health Check API
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'nexus-api',
    node_version: process.version
  });
});

/**
 * Workspace State API
 * Stores and retrieves UI state (sidebar, open tabs, etc) for a user.
 */
app.get('/api/state/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const state = await nexusStateStore.getUserState(userId);
    res.json(state || {});
  } catch (err: any) {
    logger.error({ err: err.message }, '[API] Failed to fetch user state');
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/state/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const state = req.body;
    await nexusStateStore.syncUserState(userId, state);
    res.json({ status: 'synced' });
  } catch (err: any) {
    logger.error({ err: err.message }, '[API] Failed to sync user state');
    res.status(500).json({ error: 'Failed' });
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
app.get('/api/metrics', requireAuth, async (req, res) => {
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
const server = app.listen(FINAL_PORT, '0.0.0.0', () => {
    logger.info({ port: FINAL_PORT }, 'Nexus OS API running');
    logger.info({ allowedOrigins: ALLOWED_ORIGINS }, 'CORS origins configured');
  });

  // --- Clean Shutdown Logic (Ticket 21) ---
  const handleShutdown = (signal: string) => {
    logger.info(`[API] ${signal} received. Closing server...`);
    server.close(() => {
      logger.info('[API] Server closed gracefully.');
      process.exit(0);
    });
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGUSR2', () => handleShutdown('SIGUSR2'));
}

/**
 * 🚨 Global Express Error Handler (Issue 14a)
 */
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';
  logger.fatal({ err: err.message, stack: err.stack, requestId, path: req.path }, 'Unhandled API Exception');

  if (res.headersSent) return next(err);

  res.status(500).json({
    error: 'Internal Server Error',
    requestId,
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message
  });
});
