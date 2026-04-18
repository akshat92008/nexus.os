/**
 * Nexus OS — Unified API Boundary
 * 
 * "Turbo Boot" Edition: Instant HTTP availability + Async Service Loading
 */
import 'dotenv/config';
import { logger } from './logger.js';
import express, { type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { sagaManager } from './services/SagaManager.js';
import { stripeConfig } from './config/stripe.js';

console.log('[Boot] 🛰️  Nexus OS Kernel Initializing (TURBO MODE)...');

let app = express();
const PORT = parseInt(process.env.PORT || '3006', 10);
let systemStatus = 'initializing';

// --- INSTANT PORT BINDING ---
// We listen immediately to satisfy Cloud Run health checks while heavy services load in background
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [TurboBoot] Nexus OS API is LISTENING on http://0.0.0.0:${PORT}`);
    console.log(`📡 [TurboBoot] Dashboard can now connect. Heavy services loading in background...\n`);
});

async function bootstrap() {
    // 1. ESSENTIAL MIDDLEWARE (Sync)
    const cors = (await import('cors')).default;
    const helmet = (await import('helmet')).default;
    
    app.use(helmet({ crossOriginEmbedderPolicy: false }));
    app.use(express.json({ limit: '1mb' }));
    app.use(cors({ 
        origin: true, // Echo back the origin of the requester
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-ID']
    }));

    app.use((req: any, res: any, next: any) => {
        req.requestId = randomUUID();
        res.setHeader('X-Request-ID', req.requestId);
        next();
    });

    // 2. HEALTH & READY ROUTES (Sync)
    app.get('/api/health', (req: Request, res: Response) => {
        res.json({ 
            status: systemStatus === 'ready' ? 'ok' : 'warming_up',
            system: systemStatus,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });

    // 4. ASYNC HEAVY INITIALIZATION (Background)
    initHeavyServices().catch(err => {
        logger.fatal({ err: err.message }, '[Boot] ❌ ASYNC INITIALIZATION FAILED');
        systemStatus = 'degraded';
    });
}

async function initHeavyServices() {
    try {
        console.log('[Boot] 🧪 Validating Environment...');
        const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY'];
        const missing = REQUIRED_ENV.filter(k => !process.env[k]);
        if (missing.length > 0) {
            console.error('❌ FATAL: Missing Critical Keys:', missing);
            process.exit(1);
        }

        console.log('[Boot] 📦 Loading Service Layers...');
        const { getRedis } = await import('./storage/redisClient.js');
        const { getSupabase } = await import('./storage/supabaseClient.js');
        const { nexusStateStore } = await import('./storage/nexusStateStore.js');
        const { nexusFS } = await import('./storage/nexusFS.js');
        const { eventBus } = await import('./events/eventBus.js');
        const { requireAuth } = await import('./middleware/auth.js');
        
        // Infrastructure
        const redis = getRedis();
        try {
            await Promise.race([
                redis.ping(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            console.log('[Boot] ⚡ Redis Client verified');
        } catch (err) {
            console.warn('[Boot] ⚠️  Redis optional mode (Timeout)');
        }

        // Intelligence & Orchestration
        const { llmHealthRouter } = await import('./llm/LLMRouter.js');
        const { masterBrainRouter } = await import('./masterBrain.js');
        const { planMission } = await import('./missionPlanner.js');
        const { MissionMemory } = await import('./missionMemory.js');
        const { TaskRegistry } = await import('./taskRegistry.js');
        const { orchestrateDAG } = await import('./orchestrator.js');

        // Queues & Workers
        await import('./queue/queue.js');
        await import('./workers/taskWorker.js');
        await import('./workers/missionWorker.js');

        // --- REGISTER PROTECTED ROUTES ---
        app.use('/api/llm/providers', llmHealthRouter);
        app.use('/api/master', masterBrainRouter);
        
        app.get('/api/marketplace/agents', async (req: any, res: any) => {
            const supabase = await getSupabase();
            const { data } = await supabase.from('marketplace_agents').select('*').eq('is_active', true);
            res.json(data || []);
        });

        // Protected Routes
        app.use(requireAuth);

        app.get('/api/orchestrate', async (req: any, res: any) => {
            const { goal, archMode } = req.query;
            const dag = await planMission(goal, archMode || 'legacy');
            await nexusStateStore.createMission({
                id: dag.missionId, userId: req.user.id, goal, dagData: dag, goalType: dag.goalType
            });
            
            setImmediate(async () => {
                const memory = new MissionMemory(dag.missionId, goal);
                const registry = new TaskRegistry(dag.missionId);
                await orchestrateDAG({ 
                    dag, memory, registry, userId: req.user.id, sessionId: dag.missionId, 
                    res: { write: (d: any) => {
                        const line = d.replace(/^data:\s*/, '').trim();
                        if (line) eventBus.publish(dag.missionId, JSON.parse(line)).catch(() => {});
                    }, end: () => {} } as any,
                    isAborted: () => false
                });
            });
            res.json({ missionId: dag.missionId, status: 'queued' });
        });

        app.post('/api/rollback', async (req: any, res: any) => {
            const { missionId } = req.body;
            console.log(`[Saga] ⏪ Rollback requested for mission ${missionId}`);
            
            const lastAction = await sagaManager.getLastAction(missionId);
            if (!lastAction) {
                return res.status(404).json({ error: 'No actions found to rollback.' });
            }

            // In a real system, we would trigger the 'undo_params' action here
            // via the toolExecutor or direct Rust bridge.
            console.log(`[Saga] 🔄 Undoing ${lastAction.tool_id} with params:`, lastAction.undo_params);
            
            await sagaManager.clearAction(lastAction.id);
            res.json({ status: 'rolled_back', action: lastAction.tool_id });
        });

        app.get('/api/events/stream', async (req: any, res: any) => {
            const { missionId } = req.query;
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
            const handler = (event: any) => res.write(`data: ${JSON.stringify(event)}\n\n`);
            eventBus.subscribe(missionId, handler);
            req.on('close', () => eventBus.unsubscribe(missionId, handler));
        });

        app.post('/api/agents/spawn', async (req: any, res: any) => {
            const { agentType, workspaceId } = req.body;
            console.log(`[Spawn] 🐣 Initializing ${agentType} agent for workspace ${workspaceId}...`);
            
            const spawnId = randomUUID();
            
            // Persist the spawn in the system state (this would normally trigger a container or process)
            const supabase = await getSupabase();
            const { data: currentState } = await supabase.from('nexus_state').select('state').eq('id', req.user.id).single();
            const newState = currentState?.state || { installedAgentIds: [] };
            
            if (!newState.spawnedAgents) newState.spawnedAgents = [];
            newState.spawnedAgents.push({
                id: spawnId,
                type: agentType,
                workspaceId,
                startedAt: new Date().toISOString(),
                status: 'online'
            });
            
            await nexusStateStore.syncUserState(req.user.id, newState);
            
            res.json({ status: 'success', spawnId, agentType });
        });

        app.post('/api/billing/checkout', async (req: any, res: any) => {
            const { priceId } = req.body;
            console.log(`[Billing] 💰 Checkout requested for price ${priceId}`);
            
            // Map plan to config
            const plan = Object.values(stripeConfig.plans).find(p => p.priceId === priceId);
            const sessionUrl = plan ? `https://checkout.stripe.com/pay/${plan.priceId}` : process.env.STRIPE_CHECKOUT_URL;
            
            res.json({ url: sessionUrl || 'https://buy.stripe.com/test_nexus_os_refill' });
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

        app.get('/api/brain/stats', async (req: any, res: any) => {
            const supabase = await getSupabase();
            const { data: missions } = await supabase.from('nexus_missions').select('status');
            const { data: state } = await supabase.from('nexus_state').select('state').eq('id', req.user.id).single();
            
            const totalMissions = missions?.length || 0;
            const activeMissions = missions?.filter(m => m.status === 'running' || m.status === 'paused').length || 0;
            
            const globalReflection = state?.state?.globalReflection || {};
            
            res.json({
                totalMissions,
                activeMissions,
                globalActions: globalReflection.actions?.length || 0,
                opportunities: globalReflection.themes?.length || 0,
                risks: globalReflection.risks?.length || 0,
                reflection: globalReflection
            });
        });

        app.get('/api/state/:userId', async (req: any, res: any) => {
            const state = await nexusStateStore.getUserState(req.params.userId);
            res.json(state || {});
        });

        app.put('/api/state/:userId', async (req: any, res: any) => {
            await nexusStateStore.syncUserState(req.params.userId, req.body);
            res.json({ status: 'synced' });
        });

        systemStatus = 'ready';
        console.log('✅ [TurboBoot] All heavy services initialized and routes registered.');

    } catch (err: any) {
        console.error('[Boot] ❌ CRITICAL ASYNC FAILURE:', err.message);
        systemStatus = 'degraded';
    }
}

bootstrap();
