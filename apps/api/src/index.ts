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
import { toolExecutor } from './tools/toolExecutor.js';
import { runSalesFollowUpWorkflow } from './workflows/salesFollowUp.js';
import { buildAPResolverAwaitingApprovalEvent, runAPResolverWorkflow } from './workflows/apResolver.js';

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
        const { hybridBridge } = await import('./services/hybridBridge.js');
        const { skillRuntime } = await import('./tools/skillRuntime.js');
        
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

        // ═══════════════════════════════════════════════════════════════
        // NEW OPENCLAW-INSPIRED SYSTEMS INITIALIZATION
        // ═══════════════════════════════════════════════════════════════
        
        // 1. Multi-Channel Messaging System
        const { channelManager, SlackAdapter, DiscordAdapter, TelegramAdapter } = await import('./channels/channelManager.js');
        await channelManager.initialize();
        channelManager.registerAdapter('slack', new SlackAdapter());
        channelManager.registerAdapter('discord', new DiscordAdapter());
        channelManager.registerAdapter('telegram', new TelegramAdapter());
        console.log('[Boot] 📡 Multi-Channel System ready');

        // 2. Sub-Agent Spawning System
        const { subAgentManager } = await import('./agents/subAgentManager.js');
        await subAgentManager.initialize();
        console.log('[Boot] 🤖 Sub-Agent System ready');

        // 3. Skills System
        const { skillManager } = await import('./skills/skillManager.js');
        await skillManager.initialize();
        console.log('[Boot] 🛠️ Skills System ready');

        // 4. Semantic Memory System
        const { semanticMemory } = await import('./memory/semanticMemory.js');
        await semanticMemory.initialize();
        console.log('[Boot] 🧠 Semantic Memory ready');

        // 5. Cron/Task Scheduler
        const { cronManager } = await import('./scheduler/cronManager.js');
        await cronManager.initialize();
        console.log('[Boot] ⏰ Task Scheduler ready');

        // 6. MCP Bridge
        const { mcpManager } = await import('./mcp/mcpManager.js');
        await mcpManager.initialize();
        console.log('[Boot] 🔌 MCP Bridge ready');

        // 7. Canvas / Live Document System
        const { canvasManager } = await import('./canvas/canvasManager.js');
        await canvasManager.initialize();
        console.log('[Boot] 🎨 Canvas System ready');

        // 8. Voice / Audio Pipeline
        const { voiceManager } = await import('./voice/voiceManager.js');
        await voiceManager.initialize();
        console.log('[Boot] 🎙️ Voice Pipeline ready');

        // 9. TUI (Terminal UI) System
        const { tuiManager } = await import('./tui/tuiManager.js');
        await tuiManager.initialize();
        console.log('[Boot] 🖥️ TUI System ready');

        // 10. Docker Sandbox
        const { dockerSandbox } = await import('./sandbox/dockerSandbox.js');
        await dockerSandbox.initialize();
        console.log('[Boot] 📦 Docker Sandbox ready');

        // 11. i18n / Localization
        const { i18nManager } = await import('./i18n/i18nManager.js');
        await i18nManager.initialize();
        i18nManager.setLocale((process.env.NEXUS_LOCALE as any) || 'en');
        console.log('[Boot] 🌍 i18n ready (' + i18nManager.getLocale() + ')');

        // 12. Daemon Mode
        const { daemonManager } = await import('./daemon/daemonManager.js');
        await daemonManager.initialize();
        if (daemonManager.isRunningAsDaemon()) {
            console.log('[Boot] 👻 Daemon mode active');
        }

        // 13. Register additional channel adapters
        const { EmailAdapter } = await import('./channels/adapters/emailAdapter.js');
        const { WhatsAppAdapter } = await import('./channels/adapters/whatsappAdapter.js');
        const { SmsAdapter } = await import('./channels/adapters/smsAdapter.js');
        channelManager.registerAdapter('email', new EmailAdapter());
        channelManager.registerAdapter('whatsapp', new WhatsAppAdapter());
        channelManager.registerAdapter('sms', new SmsAdapter());
        console.log('[Boot] 📧 Email / WhatsApp / SMS adapters registered');

        // ═══════════════════════════════════════════════════════════════

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

        hybridBridge.start(parseInt(process.env.NEXUS_NERVE_PORT || '3007', 10));

        // --- REGISTER PROTECTED ROUTES ---
        app.use('/api/llm/providers', llmHealthRouter);
        app.use('/api/master', masterBrainRouter);
        
        app.get('/api/marketplace/agents', async (req: any, res: any) => {
            const supabase = await getSupabase();
            const { data } = await supabase.from('marketplace_agents').select('*').eq('is_active', true);
            res.json(data || []);
        });

        app.get('/api/test-sales-dag', async (req: any, res: any) => {
            console.log('[API] 🛠️  Manual Trigger: Sales Follow-Up DAG');
            try {
                const result = await runSalesFollowUpWorkflow();
                res.json(result);
            } catch (err: any) {
                console.error('[API] ❌ DAG Execution Failed:', err.message);
                res.status(500).json({ error: err.message });
            }
        });

        // Protected Routes
        app.use(requireAuth);

        app.post('/api/workflows/ap-resolver', async (req: any, res: any) => {
            const { invoiceFilePath, workflowId, publishToMissionId } = req.body || {};

            if (!invoiceFilePath) {
                return res.status(400).json({ error: 'invoiceFilePath is required' });
            }

            try {
                const result = await runAPResolverWorkflow(invoiceFilePath, { workflowId });

                if (result.status === 'pending_approval' && publishToMissionId) {
                    await eventBus.publish(
                        publishToMissionId,
                        buildAPResolverAwaitingApprovalEvent(result, 'ap_exception_resolver')
                    );
                }

                res.json(result);
            } catch (err: any) {
                console.error('[API] ❌ AP Resolver failed:', err.message);
                res.status(500).json({ error: err.message ?? 'AP resolver failed' });
            }
        });

        app.get('/api/nerve/bridge/status', async (_req: any, res: any) => {
            res.json({
                status: hybridBridge.getStatus(),
                protocol: 'nexus-nerve-v1',
            });
        });

        app.get('/api/skills', async (_req: any, res: any) => {
            const skills = await skillRuntime.listSkills();
            res.json(skills);
        });

        app.post('/api/skills/:skillId/execute', async (req: any, res: any) => {
            const result = await skillRuntime.executeSkill(req.params.skillId, req.body?.params || {}, {
                bypassCache: req.body?.bypassCache === true,
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        });

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

            try {
                // TRIGGER ACTUAL EXECUTION in the native engine
                const rollbackResult = await toolExecutor.undoAction(lastAction);
                
                // Clear the log after successful undo
                await sagaManager.clearAction(lastAction.id);

                res.json({ 
                    status: 'success', 
                    message: `Rolled back: ${lastAction.tool_id}`,
                    detail: rollbackResult
                });
            } catch (err: any) {
                console.error(`[Saga] ❌ Rollback Failed:`, err.message);
                res.status(500).json({ error: `Rollback failed: ${err.message}` });
            }
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

        app.post('/api/compile-agent', async (req: any, res: any) => {
            console.log('[API] 🧠 Request to COMPILE Agent Workflow');
            try {
                const { prompt } = req.body;
                if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

                const { compilePromptToAgent } = await import('./services/AgentCompiler.js');
                const compiledAgent = await compilePromptToAgent(prompt);
                
                // We return it to the UI for "Beautiful" confirmation.
                res.json({ status: "success", data: compiledAgent });
            } catch (error: any) {
                console.error('[API] ❌ Agent Compilation Failed:', error.message);
                res.status(500).json({ error: "Failed to compile agent." });
            }
        });

        app.post('/api/save-agent', async (req: any, res: any) => {
            console.log('[API] 💾 Request to SAVE & ACTIVATE Agent Workflow');
            try {
                const { name, trigger_type, cron_expression, dag_payload } = req.body;
                
                // Use req.userId if available (from auth middleware), otherwise fallback for beta
                const userId = req.userId || 'beta-ceo-001';

                const { agentRegistry } = await import('./services/AgentRegistry.js');
                const savedAgent = await agentRegistry.saveAgent({
                    user_id: userId,
                    name,
                    trigger_type,
                    cron_expression,
                    dag_payload
                });

                res.json({ status: "success", data: savedAgent });
            } catch (error: any) {
                console.error('[API] ❌ Agent Saving Failed:', error.message);
                res.status(500).json({ error: error.message });
            }
        });

        app.post('/api/waitlist', async (req: any, res: any) => {
            const { email } = req.body;
            console.log(`[Beta] 📝 Waitlist request for email: ${email}`);
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required.' });
            }

            try {
                const supabase = await getSupabase();
                const { error } = await supabase
                    .from('waitlist')
                    .upsert([{ 
                        email, 
                        user_id: req.user?.id, 
                        created_at: new Date().toISOString() 
                    }]);

                if (error) throw error;
                res.json({ status: 'success', message: 'You are on the list!' });
            } catch (err: any) {
                console.error('[Beta] ❌ Waitlist Error:', err.message);
                res.status(500).json({ error: 'Could not add to waitlist.' });
            }
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

        // ═════════════════════════════════════════════════════════════════
        // NEW OPENCLAW-INSPIRED API ROUTES
        // ═════════════════════════════════════════════════════════════════

        // --- CHANNEL ROUTES ---
        app.get('/api/channels', async (req: any, res: any) => {
            const channels = channelManager.getActiveChannels();
            res.json(channels);
        });

        app.post('/api/channels/:channelId/send', async (req: any, res: any) => {
            try {
                const { content, threadId } = req.body;
                const result = await channelManager.sendMessage(req.params.channelId, content, { threadId });
                res.json({ success: true, result });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/channels/broadcast', async (req: any, res: any) => {
            const { content, workspaceId } = req.body;
            const results = await channelManager.broadcastMessage(content, { workspaceId });
            res.json(results);
        });

        app.post('/api/channels/pairing/approve', async (req: any, res: any) => {
            const { code } = req.body;
            const success = await channelManager.approvePairing(code);
            res.json({ success });
        });

        // --- SUB-AGENT ROUTES ---
        app.post('/api/subagents/spawn', async (req: any, res: any) => {
            try {
                const { subAgentManager } = await import('./agents/subAgentManager.js');
                const result = await subAgentManager.spawn(req.body);
                res.json(result);
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.get('/api/subagents/:sessionId', async (req: any, res: any) => {
            const { subAgentManager } = await import('./agents/subAgentManager.js');
            const session = await subAgentManager.getSession(req.params.sessionId);
            if (!session) return res.status(404).json({ error: 'Session not found' });
            res.json(session);
        });

        app.get('/api/subagents', async (req: any, res: any) => {
            const { subAgentManager } = await import('./agents/subAgentManager.js');
            const { parentSessionId, status } = req.query;
            const sessions = await subAgentManager.listSessions({ parentSessionId, status });
            res.json(sessions);
        });

        app.post('/api/subagents/:sessionId/steer', async (req: any, res: any) => {
            const { subAgentManager } = await import('./agents/subAgentManager.js');
            const { action } = req.body;
            await subAgentManager.steer(req.params.sessionId, action);
            res.json({ success: true });
        });

        // --- SKILL ROUTES ---
        app.get('/api/skills/v2', async (req: any, res: any) => {
            const { skillManager } = await import('./skills/skillManager.js');
            const skills = skillManager.getSkills();
            res.json(skills);
        });

        app.get('/api/skills/v2/tools', async (req: any, res: any) => {
            const { skillManager } = await import('./skills/skillManager.js');
            const tools = skillManager.getTools();
            res.json(tools);
        });

        app.post('/api/skills/v2/execute', async (req: any, res: any) => {
            try {
                const { skillManager } = await import('./skills/skillManager.js');
                const { toolName, params } = req.body;
                const result = await skillManager.executeTool(toolName, params, { userId: req.user?.id });
                res.json({ success: true, result });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/skills/v2/install', async (req: any, res: any) => {
            try {
                const { skillManager } = await import('./skills/skillManager.js');
                const { source, options } = req.body;
                const skill = await skillManager.installSkill(source, options);
                res.json({ success: true, skill });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        // --- MEMORY ROUTES ---
        app.post('/api/memory/store', async (req: any, res: any) => {
            try {
                const { semanticMemory } = await import('./memory/semanticMemory.js');
                const entry = await semanticMemory.store(req.body);
                res.json({ success: true, entry });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/memory/search', async (req: any, res: any) => {
            try {
                const { semanticMemory } = await import('./memory/semanticMemory.js');
                const results = await semanticMemory.search(req.body);
                res.json(results);
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/memory/recall', async (req: any, res: any) => {
            try {
                const { semanticMemory } = await import('./memory/semanticMemory.js');
                const { query, context } = req.body;
                const memoryContext = await semanticMemory.recall(query, context);
                res.json(memoryContext);
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.get('/api/memory/:id/related', async (req: any, res: any) => {
            const { semanticMemory } = await import('./memory/semanticMemory.js');
            const memories = await semanticMemory.getRelatedMemories(req.params.id, parseInt(req.query.limit || '5'));
            res.json(memories);
        });

        // --- CRON ROUTES ---
        app.get('/api/tasks', async (req: any, res: any) => {
            const { cronManager } = await import('./scheduler/cronManager.js');
            const tasks = await cronManager.getTasks(req.query);
            res.json(tasks);
        });

        app.post('/api/tasks/schedule', async (req: any, res: any) => {
            try {
                const { cronManager } = await import('./scheduler/cronManager.js');
                const task = await cronManager.schedule(req.body);
                res.json({ success: true, task });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/tasks/:taskId/cancel', async (req: any, res: any) => {
            const { cronManager } = await import('./scheduler/cronManager.js');
            const success = await cronManager.cancelTask(req.params.taskId);
            res.json({ success });
        });

        app.post('/api/tasks/:taskId/pause', async (req: any, res: any) => {
            const { cronManager } = await import('./scheduler/cronManager.js');
            const success = await cronManager.pauseTask(req.params.taskId);
            res.json({ success });
        });

        app.post('/api/tasks/:taskId/resume', async (req: any, res: any) => {
            const { cronManager } = await import('./scheduler/cronManager.js');
            const success = await cronManager.resumeTask(req.params.taskId);
            res.json({ success });
        });

        // --- MCP ROUTES ---
        app.get('/api/mcp/connections', async (_req: any, res: any) => {
            const { mcpManager } = await import('./mcp/mcpManager.js');
            const connections = mcpManager.getConnections();
            res.json(connections);
        });

        app.get('/api/mcp/tools', async (_req: any, res: any) => {
            const { mcpManager } = await import('./mcp/mcpManager.js');
            const tools = mcpManager.getAllTools();
            res.json(tools);
        });

        app.post('/api/mcp/connect', async (req: any, res: any) => {
            try {
                const { mcpManager } = await import('./mcp/mcpManager.js');
                const connection = await mcpManager.connectServer(req.body);
                res.json({ success: true, connection });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/mcp/:serverId/disconnect', async (req: any, res: any) => {
            const { mcpManager } = await import('./mcp/mcpManager.js');
            await mcpManager.disconnectServer(req.params.serverId);
            res.json({ success: true });
        });

        app.post('/api/mcp/:serverId/tools/:toolName/call', async (req: any, res: any) => {
            try {
                const { mcpManager } = await import('./mcp/mcpManager.js');
                const result = await mcpManager.callTool(req.params.serverId, req.params.toolName, req.body);
                res.json({ success: true, result });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        // --- CANVAS / LIVE DOCUMENT ROUTES ---
        app.post('/api/canvas/create', async (req: any, res: any) => {
            try {
                const { canvasManager } = await import('./canvas/canvasManager.js');
                const doc = await canvasManager.createDocument(req.body);
                res.json({ success: true, document: doc });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.get('/api/canvas/:id', async (req: any, res: any) => {
            const { canvasManager } = await import('./canvas/canvasManager.js');
            const doc = canvasManager.getDocument(req.params.id);
            if (!doc) return res.status(404).json({ error: 'Document not found' });
            res.json(doc);
        });

        app.get('/api/canvas', async (_req: any, res: any) => {
            const { canvasManager } = await import('./canvas/canvasManager.js');
            res.json(canvasManager.getDocuments());
        });

        app.post('/api/canvas/:id/operation', async (req: any, res: any) => {
            try {
                const { canvasManager } = await import('./canvas/canvasManager.js');
                const doc = await canvasManager.applyOperation(req.params.id, req.body);
                res.json({ success: true, document: doc });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/canvas/:id/generate', async (req: any, res: any) => {
            try {
                const { canvasManager } = await import('./canvas/canvasManager.js');
                const block = await canvasManager.aiGenerateBlock(req.params.id, req.body.prompt, req.user?.id || 'system');
                res.json({ success: true, block });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.get('/api/canvas/:id/render', async (req: any, res: any) => {
            try {
                const { canvasManager } = await import('./canvas/canvasManager.js');
                const html = await canvasManager.renderToHtml(req.params.id);
                res.set('Content-Type', 'text/html').send(html);
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        // --- VOICE / AUDIO ROUTES ---
        app.post('/api/voice/start', async (req: any, res: any) => {
            try {
                const { voiceManager } = await import('./voice/voiceManager.js');
                const session = await voiceManager.startSession(req.body);
                res.json({ success: true, session });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/voice/:id/listen', async (req: any, res: any) => {
            const { voiceManager } = await import('./voice/voiceManager.js');
            await voiceManager.startListening(req.params.id);
            res.json({ success: true, status: 'listening' });
        });

        app.post('/api/voice/:id/stop', async (req: any, res: any) => {
            const { voiceManager } = await import('./voice/voiceManager.js');
            const transcript = await voiceManager.stopListening(req.params.id);
            res.json({ success: true, transcript });
        });

        app.post('/api/voice/:id/process', async (req: any, res: any) => {
            try {
                const { voiceManager } = await import('./voice/voiceManager.js');
                const response = await voiceManager.processTranscript(req.params.id, req.body.transcript);
                res.json({ success: true, response });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/voice/:id/speak', async (req: any, res: any) => {
            const { voiceManager } = await import('./voice/voiceManager.js');
            await voiceManager.speak(req.params.id, req.body.text);
            res.json({ success: true, spoken: true });
        });

        app.get('/api/voice/sessions', async (_req: any, res: any) => {
            const { voiceManager } = await import('./voice/voiceManager.js');
            res.json(voiceManager.getActiveSessions());
        });

        // --- TUI ROUTES ---
        app.get('/api/tui/screens', async (_req: any, res: any) => {
            const { tuiManager } = await import('./tui/tuiManager.js');
            res.json(tuiManager.getScreens().map(s => ({ id: s.id, title: s.title, type: s.type })));
        });

        app.get('/api/tui/render', async (req: any, res: any) => {
            const { tuiManager } = await import('./tui/tuiManager.js');
            const screen = await tuiManager.renderScreen(req.query.screen);
            res.set('Content-Type', 'application/json').send(screen);
        });

        app.get('/api/tui/notifications', async (_req: any, res: any) => {
            const { tuiManager } = await import('./tui/tuiManager.js');
            res.json(tuiManager.getNotifications());
        });

        // --- DOCKER SANDBOX ROUTES ---
        app.post('/api/sandbox/create', async (req: any, res: any) => {
            try {
                const { dockerSandbox } = await import('./sandbox/dockerSandbox.js');
                const instance = await dockerSandbox.createSandbox(req.body);
                res.json({ success: true, sandbox: instance });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/sandbox/:id/exec', async (req: any, res: any) => {
            try {
                const { dockerSandbox } = await import('./sandbox/dockerSandbox.js');
                const result = await dockerSandbox.executeInSandbox(req.params.id, req.body.command);
                res.json({ success: true, result });
            } catch (err: any) {
                res.status(400).json({ error: err.message });
            }
        });

        app.post('/api/sandbox/:id/stop', async (req: any, res: any) => {
            const { dockerSandbox } = await import('./sandbox/dockerSandbox.js');
            await dockerSandbox.stopSandbox(req.params.id);
            res.json({ success: true });
        });

        app.get('/api/sandbox/running', async (_req: any, res: any) => {
            const { dockerSandbox } = await import('./sandbox/dockerSandbox.js');
            res.json(dockerSandbox.getRunningSandboxes());
        });

        // --- I18N / LOCALIZATION ROUTES ---
        app.get('/api/i18n/locales', async (_req: any, res: any) => {
            const { i18nManager } = await import('./i18n/i18nManager.js');
            res.json(i18nManager.getAvailableLocales());
        });

        app.get('/api/i18n/current', async (_req: any, res: any) => {
            const { i18nManager } = await import('./i18n/i18nManager.js');
            res.json({ locale: i18nManager.getLocale(), direction: i18nManager.getTextDirection() });
        });

        app.post('/api/i18n/set', async (req: any, res: any) => {
            const { i18nManager } = await import('./i18n/i18nManager.js');
            i18nManager.setLocale(req.body.locale);
            res.json({ success: true, locale: i18nManager.getLocale() });
        });

        app.get('/api/i18n/translate', async (req: any, res: any) => {
            const { i18nManager } = await import('./i18n/i18nManager.js');
            const text = i18nManager.t(req.query.key, req.query.params ? JSON.parse(req.query.params) : undefined);
            res.json({ key: req.query.key, translation: text });
        });

        // --- DAEMON MODE ROUTES ---
        app.get('/api/daemon/status', async (_req: any, res: any) => {
            const { daemonManager } = await import('./daemon/daemonManager.js');
            const status = daemonManager.getStatus();
            res.json({
                runningAsDaemon: daemonManager.isRunningAsDaemon(),
                launchedAtBoot: daemonManager.wasLaunchedAtBoot(),
                status
            });
        });

        app.post('/api/daemon/start', async (_req: any, res: any) => {
            const { daemonManager } = await import('./daemon/daemonManager.js');
            const success = await daemonManager.startDaemon();
            res.json({ success });
        });

        app.post('/api/daemon/stop', async (_req: any, res: any) => {
            const { daemonManager } = await import('./daemon/daemonManager.js');
            const success = await daemonManager.stopDaemon();
            res.json({ success });
        });

        app.post('/api/daemon/install-launch-agent', async (_req: any, res: any) => {
            const { daemonManager } = await import('./daemon/daemonManager.js');
            const success = await daemonManager.installLaunchAgent();
            res.json({ success });
        });

        app.post('/api/daemon/uninstall-launch-agent', async (_req: any, res: any) => {
            const { daemonManager } = await import('./daemon/daemonManager.js');
            const success = await daemonManager.uninstallLaunchAgent();
            res.json({ success });
        });

        // ═════════════════════════════════════════════════════════════════

        systemStatus = 'ready';
        console.log('✅ [TurboBoot] All heavy services initialized and routes registered.');

    } catch (err: any) {
        console.error('[Boot] ❌ CRITICAL ASYNC FAILURE:', err.message);
        systemStatus = 'degraded';
    }
}

bootstrap();
