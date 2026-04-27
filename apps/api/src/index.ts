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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true, 
    credentials: true,
    methods:['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-ID']
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

        systemStatus = 'ready';
        console.log('✅ [Boot] Nexus OS Engine is READY.');

    } catch (err: any) {
        console.error('[Boot] ❌ CRITICAL FAILURE:', err.message);
        systemStatus = 'degraded';
        process.exit(1);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Nexus OS API is LISTENING on http://0.0.0.0:${PORT}\n`);
    bootstrap();
});
