import 'dotenv/config';
import { env } from './config/env.js';
import { logger } from './logger.js';
import express, { type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { applyRateLimits } from './middleware/rateLimiter.js';
import { registerSalesRoutes } from './routes/sales.js';
import { registerRuntimeRoutes } from './routes/runtime.js';
import { masterBrain } from './core/masterBrain.js';
import { taskRunner } from './core/taskRunner.js';
import { digestService } from './core/digestService.js';
import { runMigrations } from './scripts/migrate.js';
import cors from 'cors';
import helmet from 'helmet';

console.log('[Boot] 🛰️  Nexus OS Kernel Initializing (AI Employee V2)...');

const app = express();
const PORT = parseInt(env.PORT, 10);

let systemStatus = 'initializing';
const systemHealth: Record<string, 'ok' | 'degraded' | 'offline'> = {};

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: (origin, callback) => {
    const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowed.includes(origin) || env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    logger.warn({ origin }, '[CORS] Blocked request from unauthorized origin');
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-ID'],
}));

app.use((req: any, res: any, next: any) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// Phase 2: Expose health with degraded subsystem payloads
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
        status: systemStatus === 'ready' ? 'ready' : systemStatus,
        subsystems: systemHealth,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

async function initSubsystem(name: string, fn: () => Promise<void>, required = false) {
  try {
    await fn();
    systemHealth[name] = 'ok';
    console.log(`[Boot] ✅ ${name} ready`);
  } catch (err: any) {
    systemHealth[name] = required ? 'offline' : 'degraded';
    console.warn(`[Boot] ⚠️  ${name} failed (${required ? 'CRITICAL' : 'non-critical'}): ${err.message}`);
    if (required) throw err;
  }
}

async function bootstrap() {
    try {
        console.log('[Boot] 📦 Loading Service Layers...');

        await initSubsystem('Database Migrations', async () => { await runMigrations(); }, false);
        
        const { getSupabase } = await import('./storage/supabaseClient.js');
        await initSubsystem('Supabase', async () => { await getSupabase(); }, true);

        const { getRedis } = await import('./storage/redisClient.js');
        await initSubsystem('Redis', async () => { await getRedis().ping(); }, false);

        const { channelManager } = await import('./channels/channelManager.js');
        await initSubsystem('ChannelManager', async () => { await channelManager.initialize(); }, false);

        const { canvasManager } = await import('./canvas/canvasManager.js');
        await initSubsystem('CanvasManager', async () => { await canvasManager.initialize(); }, false);

        const { requireAuth } = await import('./middleware/auth.js');
        app.use(requireAuth);
        applyRateLimits(app);

        registerSalesRoutes(app);
        registerRuntimeRoutes(app);

        const { nexusStateStore } = await import('./storage/nexusStateStore.js');

        app.get('/api/state', async (req: any, res: any) => {
            try {
                const state = await nexusStateStore.getUserState(req.user.id);
                res.json(state || {});
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        app.put('/api/state', async (req: any, res: any) => {
            try {
                await nexusStateStore.syncUserState(req.user.id, req.body);
                res.json({ status: 'synced' });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/api/nexus/command', async (req: any, res: any) => {
            try {
                const { command } = req.body;
                if (!command) return res.status(400).json({ error: 'Command required' });
                const result = await masterBrain.processCommand(command, req.user.id);
                res.json(result);
            } catch (err: any) {
                logger.error(`[NexusCore] Command error: ${err.message}`);
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/api/nexus/digest', async (req: any, res: any) => {
            try {
                const result = await digestService.getDigest(req.user.id);
                res.json(result);
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        // Google Calendar OAuth
        app.get('/api/integrations/google/connect', async (req: any, res: any) => {
          const userId = req.user?.id;
          if (!userId) return res.status(401).json({ error: 'Unauthorized' });

          const clientId = process.env.GOOGLE_CLIENT_ID;
          const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3006/api/integrations/google/callback';

          if (!clientId) return res.status(501).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID.' });

          const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/calendar',
            access_type: 'offline',
            prompt: 'consent',
            state: Buffer.from(JSON.stringify({ userId })).toString('base64'),
          });

          res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
        });

        app.get('/api/integrations/google/callback', async (req: any, res: any) => {
          try {
            const { code, state } = req.query as { code: string; state: string };
            const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID || '',
                client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
                redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3006/api/integrations/google/callback',
                grant_type: 'authorization_code',
              }),
            });

            const tokens = await tokenRes.json() as any;
            if (!tokens.access_token) throw new Error('No access token returned from Google');

            const { calendarDriver } = await import('./integrations/drivers/calendarDriver.js');
            await (calendarDriver as any).storeToken(userId, tokens.access_token, tokens.refresh_token || '');

            res.redirect('/dashboard?integration=google_calendar&status=connected');
          } catch (err: any) {
            logger.error({ err }, '[Google OAuth] Callback failed');
            res.status(500).json({ error: err.message });
          }
        });

        systemStatus = 'ready';
        console.log('✅ [Boot] Nexus OS Engine is READY.');

    } catch (err: any) {
        console.error('[Boot] ❌ CRITICAL FAILURE:', err.message);
        systemStatus = 'degraded';
        process.exit(1);
    }
}

// ── Graceful startup — listen ONLY after all middleware is registered ──────
bootstrap()
  .then(() => {
    app.listen(Number(env.PORT), '0.0.0.0', () => {
      logger.info(`[Server] Nexus OS API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  })
  .catch((err) => {
    logger.error({ err }, '[Server] Fatal: Bootstrap failed. Shutting down.');
    process.exit(1);
  });

// ── Unhandled rejection safety net ────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '[Server] Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, '[Server] Uncaught Exception — shutting down');
  process.exit(1);
});
