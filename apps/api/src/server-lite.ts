/**
 * Nexus OS — Lightweight API Server
 * 
 * A minimal Express server that satisfies the frontend's health/status checks
 * without importing the heavy BullMQ/Worker/Redis infrastructure that hangs
 * on memory-constrained machines.
 * 
 * Use this when the full API server (index.ts) fails to start.
 */
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';

dotenv.config();

// ⛔ DEVELOPMENT ONLY — never deploy this server
if (process.env.NODE_ENV === 'production') {
  logger.error('[server-lite] FATAL: This server must never run in production. Use index.ts.');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS — wide open for local dev
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 📝 Request Logger
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, '[Lite] Request');
  next();
});

// ── Health & Status ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'lite',
    uptime: Math.floor(process.uptime()),
    version: '2.7.0-lite',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', (_req, res) => {
  res.json({
    status: 'ready',
    mode: 'lite',
    redis: 'skipped',
    database: 'skipped',
  });
});

// ── LLM Status (stubbed) ───────────────────────────────────────────────────
app.get('/api/llm/status', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    health: { overall: 'healthy', mode: 'lite' },
    providers: [],
    recentEvents: [],
  });
});

app.get('/api/llm/providers', (_req, res) => {
  res.json({ providers: [], mode: 'lite' });
});

app.get('/api/models/health', (_req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    results: {},
    mode: 'lite',
  });
});

// ── Marketplace Agents ──────────────────────────────────────────────────────
const MARKETPLACE_AGENTS = [
  { id: 'gtm-strategist', name: 'GTM Strategist', description: 'Go-to-market planning for B2B SaaS', persona: 'founder', capabilities: ['market sizing', 'channel strategy'], installCount: 142 },
  { id: 'lead-hunter', name: 'Lead Hunter', description: 'Finds and qualifies B2B leads', persona: 'founder', capabilities: ['lead research', 'email personalisation'], installCount: 98 },
  { id: 'code-reviewer', name: 'Code Reviewer', description: 'Reviews PRs, finds bugs, suggests refactors', persona: 'developer', capabilities: ['TypeScript', 'React', 'Node.js'], installCount: 215 },
  { id: 'api-architect', name: 'API Architect', description: 'Designs REST and GraphQL APIs', persona: 'developer', capabilities: ['API design', 'OpenAPI spec'], installCount: 87 },
  { id: 'essay-coach', name: 'Essay Coach', description: 'Structures and improves academic essays', persona: 'student', capabilities: ['argument structure', 'citations'], installCount: 174 },
  { id: 'exam-prep', name: 'Exam Prep', description: 'Creates revision plans and mock questions', persona: 'student', capabilities: ['flashcards', 'practice questions'], installCount: 63 },
];

app.get('/api/marketplace/agents', (_req, res) => {
  res.json(MARKETPLACE_AGENTS);
});

// ── User State (in-memory stub) ─────────────────────────────────────────────
const memoryState: Record<string, any> = {};

app.get(['/api/state', '/api/state/:id'], (req, res) => {
  const id = req.params.id || 'default';
  res.json(memoryState[id] || { 
    userId: id,
    layout: 'standard',
    theme: 'dark',
    activeMissions: []
  });
});

app.post(['/api/state', '/api/state/:id'], (req, res) => {
  const id = req.params.id || 'default';
  memoryState[id] = { ...(memoryState[id] || {}), ...req.body };
  res.json(memoryState[id]);
});

app.put(['/api/state', '/api/state/:id'], (req, res) => {
  const id = req.params.id || 'default';
  memoryState[id] = { ...(memoryState[id] || {}), ...req.body };
  res.json(memoryState[id]);
});

// ── Metrics (stubbed) ───────────────────────────────────────────────────────
app.get('/api/metrics', (_req, res) => {
  res.json({
    active_missions: 0,
    queue_depth: 0,
    missions_queue: 0,
    tasks_queue: 0,
    tasks_completed_today: 0,
    llm_errors_last_hour: 0,
    timestamp: new Date().toISOString(),
    mode: 'lite',
  });
});

// ── Agents (stub) ───────────────────────────────────────────────────────────
app.get('/api/agents', (_req, res) => {
  res.json(MARKETPLACE_AGENTS);
});

// ── Orchestrate (stub — returns queued) ────────────────────────────────────
app.post('/api/orchestrate', (req, res) => {
  const missionId = `mission_lite_${Date.now()}`;
  logger.info({ goal: req.body?.goal, missionId }, '[Lite] Orchestrate request');
  res.json({
    missionId,
    status: 'queued',
    mode: 'lite',
    message: 'Running in lite mode. Full orchestration requires the full API server.',
  });
});

// ── Mission Status (stub) ──────────────────────────────────────────────────
app.get('/api/missions/:id/status', (req, res) => {
  res.json({
    mission: { id: req.params.id, status: 'completed', mode: 'lite' },
    tasks: [],
  });
});

// ── Events Stream (minimal SSE) ────────────────────────────────────────────
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/Vercel proxies
  res.write('\n');

  // Send initial "connected" heartbeat
  res.write('retry: 3000\n\n');
  res.write('event: connected\ndata: {"status":"connected","mode":"lite"}\n\n');

  // Send a heartbeat every 15 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    logger.info('[Lite] SSE Stream closed');
  });
});

// ── Approvals (stub) ───────────────────────────────────────────────────────
app.get('/api/approvals/pending', (_req, res) => {
  res.json([]);
});

// ── Master Brain (stub) ────────────────────────────────────────────────────
app.get('/api/master/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'lite' });
});

// ── Catch-all for unknown routes ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', mode: 'lite' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, '🚀 Nexus OS API (Lite Mode) started');
  logger.info('   Mode: lightweight — no Redis/BullMQ/Workers');
  logger.info(`   Frontend should connect to: http://localhost:${PORT}`);
});
