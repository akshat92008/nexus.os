/**
 * Nexus OS — Unified API Boundary
 * 
 * "Sales MVP" Edition: Focused, Scalable, Secure.
 */
import 'dotenv/config';
import { logger } from './logger.js';
import express, { type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { applyRateLimits } from './middleware/rateLimiter.js';
import { registerSalesRoutes } from './routes/sales.js';
import { getHubSpotAuthUrl, exchangeCodeForTokens, storeTokens } from './integrations/hubspotOAuth.js';
import { masterBrain } from './core/masterBrain.js';
import { integrationManager } from './integrations/integrationManager.js';
import { taskRunner } from './core/taskRunner.js';
import { digestService } from './core/digestService.js';

console.log('[Boot] 🛰️  Nexus OS Kernel Initializing (AI Employee V2)...');

const app = express();
const PORT = parseInt(process.env.PORT || '3006', 10);
let systemStatus = 'initializing';

import cors from 'cors';
import helmet from 'helmet';

// --- MIDDLEWARE ---
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cors({ 
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-ID']
}));

app.use((req: any, res: any, next: any) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// Rate limits applied after auth in bootstrap()

// --- PUBLIC ROUTES ---
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
        status: systemStatus === 'ready' ? 'ok' : 'warming_up',
        system: systemStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// --- BOOTSTRAP ---
async function bootstrap() {
    try {
        console.log('[Boot] 📦 Loading Service Layers...');
        const { getSupabase } = await import('./storage/supabaseClient.js');
        const { requireAuth } = await import('./middleware/auth.js');
        const { nexusStateStore } = await import('./storage/nexusStateStore.js');

        // 1. Auth Middleware
        app.use(requireAuth);

        // 2. Rate Limits (after auth so req.user.id is available for per-user limits)
        applyRateLimits(app);

        // 3. Sales Routes (Module 1)
        registerSalesRoutes(app);

        // 3. Hubspot Integration (Kept for CRM vertical)
        app.get('/api/integrations/hubspot/connect', (req, res) => {
            const userId = (req as any).user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });
            res.redirect(getHubSpotAuthUrl(userId));
        });

        app.get('/api/integrations/hubspot/callback', async (req: any, res: any) => {
            try {
                const { code, state } = req.query as { code: string; state: string };
                const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
                
                if (req.user?.id !== userId) {
                    return res.status(403).json({ error: 'Forbidden: state userId does not match authenticated user' });
                }

                const tokens = await exchangeCodeForTokens(code);
                await storeTokens(userId, tokens);
                res.redirect('/workspace?integration=hubspot&status=connected');
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        });

        // 4. User State (FIXED: IDOR Vulnerability)
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

        // 5. Cleanup redundant /api/state/:userId (The Vulnerable Routes)
        // These are intentionally omitted.

        // 6. Nexus Agentic Core Routes
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

        app.post('/api/nexus/task', async (req: any, res: any) => {
            try {
                const { task, params } = req.body;
                if (!task) return res.status(400).json({ error: 'Task type required' });
                
                const result = await taskRunner.runTask(task, req.user.id, params);
                res.json(result);
            } catch (err: any) {
                logger.error(`[NexusCore] Task error: ${err.message}`);
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
    }
}

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Nexus OS API is LISTENING on http://0.0.0.0:${PORT}\n`);
    bootstrap();
});
