/**
 * Nexus OS — Unified API Boundary
 * 
 * Hardware-Optimized Bootstrap (8GB RAM Safe)
 * ESM-Native + Dynamic Service Loading
 */
import 'dotenv/config';
import { logger } from './logger.js';
import express, { type Request, type Response } from 'express';
import { randomUUID } from 'crypto';

console.log('[Boot] 🛰️  Nexus OS Kernel Initializing ESM...');

// Shared Application State
let app: any;

async function bootstrap() {
    try {
        console.log('[Boot] 🧪 Validating Environment...');
        const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY'];
        const missing = REQUIRED_ENV.filter(k => !process.env[k]);
        if (missing.length > 0) {
            console.error('❌ FATAL: Missing Critical Keys:', missing);
            process.exit(1);
        }

        console.log('[Boot] 📦 Loading Service Layer...');
        const { AGENT_REGISTRY } = await import('./agents/agentRegistry.js');
        const { getRedis } = await import('./storage/redisClient.js');
        const { getSupabase } = await import('./storage/supabaseClient.js');
        const { nexusStateStore } = await import('./storage/nexusStateStore.js');
        const { nexusFS } = await import('./storage/nexusFS.js');
        const { ledger } = await import('./ledger.js');
        
        console.log('[Boot] 🔌 Connecting to Infrastructure...');
        const redis = getRedis();
        const redisPing = Promise.race([
            redis.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);

        try {
            await redisPing;
            console.log('[Boot] ⚡ Redis Client verified');
        } catch (err) {
            console.warn('[Boot] ⚠️  Redis optional mode (Timeout)');
        }

        console.log('[Boot] 📬 Initializing Durable Queues...');
        const { missionsQueue, tasksQueue } = await import('./queue/queue.js');
        await import('./workers/taskWorker.js');
        await import('./workers/missionWorker.js');

        console.log('[Boot] 🧠 Loading Intelligence Layer...');
        const { llmHealthRouter } = await import('./llm/LLMRouter.js');
        const { masterBrainRouter } = await import('./masterBrain.js');
        const { planMission } = await import('./missionPlanner.js');
        const { rateLimitMonitor } = await import('./llm/RateLimitMonitor.js');
        const { checkAndConsume } = await import('./rateLimitGovernor.js');
        const { eventBus, attachSSEHeartbeat, attachSSETimeout } = await import('./events/eventBus.js');
        const { orchestrateDAG } = await import('./orchestrator.js');
        const { missionStore } = await import('./storage/missionStore.js');
        const { MissionMemory } = await import('./missionMemory.js');
        const { TaskRegistry } = await import('./taskRegistry.js');
        const { cancelDurableMission } = await import('./orchestrator.js');
        const { requireAuth } = await import('./middleware/auth.js');

        // --- Express Setup ---
        const cors = (await import('cors')).default;
        const helmet = (await import('helmet')).default;
        const { rateLimit } = await import('express-rate-limit');
        const { z } = await import('zod');

        app = express();
        const PORT = parseInt(process.env.PORT || '3006', 10);
        const ALLOWED_ORIGINS = (process.env.CORS_ALLOW_ORIGINS ?? 'http://localhost:3015').split(',').map(s => s.trim());

        app.use(helmet({ crossOriginEmbedderPolicy: false }));
        app.use(express.json({ limit: '1mb' }));
        app.use(cors({ origin: '*', credentials: true })); // Dev-Friendly CORS

        // Correlation ID
        app.use((req: any, res: any, next: any) => {
            req.requestId = randomUUID();
            res.setHeader('X-Request-ID', req.requestId);
            next();
        });

        // --- PUBLIC ROUTES ---
        app.get('/api/health', (req: any, res: any) => res.json({ status: 'ok', uptime: process.uptime() }));
        app.use('/api/llm/providers', llmHealthRouter);
        app.use('/api/master', masterBrainRouter);
        
        app.get('/api/marketplace/agents', async (req: any, res: any) => {
            const supabase = await getSupabase();
            const { data } = await supabase.from('marketplace_agents').select('*').eq('is_active', true);
            res.json(data || []);
        });

        // --- AUTH PROTECTED ROUTES ---
        app.use(requireAuth);

        app.post('/api/orchestrate', async (req: any, res: any) => {
            const { goal, archMode } = req.body;
            const dag = await planMission(goal, archMode || 'legacy');
            await nexusStateStore.createMission({
                id: dag.missionId, userId: req.user.id, goal, dagData: dag, goalType: dag.goalType
            });
            
            // Async Execution
            setImmediate(async () => {
                const memory = new MissionMemory(dag.missionId, goal);
                const registry = new TaskRegistry(dag.missionId);
                await orchestrateDAG({ 
                    dag, 
                    memory, 
                    registry, 
                    userId: req.user.id, 
                    sessionId: dag.missionId, 
                    res: { write: (d: any) => {
                        const line = d.replace(/^data:\s*/, '').trim();
                        if (line) eventBus.publish(dag.missionId, JSON.parse(line)).catch(() => {});
                    }, end: () => {} } as any,
                    isAborted: () => false
                });
            });

            res.json({ missionId: dag.missionId, status: 'queued' });
        });

        app.get('/api/events/stream', async (req: any, res: any) => {
            const { missionId } = req.query;
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
            const handler = (event: any) => res.write(`data: ${JSON.stringify(event)}\n\n`);
            eventBus.subscribe(missionId, handler);
            req.on('close', () => eventBus.unsubscribe(missionId, handler));
        });

        app.get('/api/fs/list', async (req: any, res: any) => {
            const parentId = req.query.parentId || 'root';
            const folders = await nexusFS.getFolders(parentId === 'root' ? null : parentId, req.user.id);
            const files = await nexusFS.getFiles(parentId === 'root' ? null : parentId, req.user.id);
            res.json([...folders, ...files]);
        });

        app.get('/api/missions', async (req: any, res: any) => {
            const supabase = await getSupabase();
            const { data } = await supabase.from('nexus_missions').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
            res.json({ missions: data || [] });
        });

        app.get('/api/state/:userId', async (req: any, res: any) => {
            const state = await nexusStateStore.getUserState(req.params.userId);
            res.json(state || {});
        });

        app.put('/api/state/:userId', async (req: any, res: any) => {
            await nexusStateStore.syncUserState(req.params.userId, req.body);
            res.json({ status: 'synced' });
        });

        // --- START SERVER ---
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Nexus OS API is now LIVE on http://0.0.0.0:${PORT}`);
        });

    } catch (err: any) {
        console.error('[Boot] ❌ CRITICAL STARTUP FAILURE:', err.message);
        process.exit(1);
    }
}

bootstrap();
