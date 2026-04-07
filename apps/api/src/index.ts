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

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { planMission }      from './missionPlanner.js';
import { orchestrateDAG, executeSingleAction } from './orchestrator.js';
import { TaskRegistry }     from './taskRegistry.js';
import { MissionMemory }    from './missionMemory.js';
import { globalGovernor }   from './rateLimitGovernor.js';
import { MCPBridge }        from './mcpBridge.js';
import { ledger }           from './ledger.js';
import { masterBrain }      from './masterBrain.js';
import { schedulerEngine }  from './scheduler.js';
import { nexusStateStore }  from './storage/nexusStateStore.js';
import { approvalGuard }   from './ApprovalGuard.js';
import {
  executeIntegration,
  listTools,
  listPendingApprovals,
  resolveApproval,
  initWorkspacePermissions,
  grantPermission,
} from './integrationManager.js';
import { nexusFS }         from './storage/nexusFS.js';
import type {
  ApplicationWindowType,
  OrchestrateRequest,
  ExportFormat,
  GoalType,
  UserStateSnapshot,
  AgentType,
  TaskDAG,
} from '../../../packages/types/index.js';

dotenv.config();


// ── App Setup ──────────────────────────────────────────────────────────────

const app: express.Express = express();
const PORT = parseInt(process.env.PORT ?? '3001');

// Session-scoped Mission Objects (Memory or Bridges) keyed by sessionId
const sessions = new Map<string, MissionMemory | MCPBridge>();


// --- Session Guard: track active AbortControllers per user ---
const activeUserTasks = new Map<string, AbortController>();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '1mb' }));

void (async () => {
  const [persistedSchedules, persistedMissions] = await Promise.all([
    nexusStateStore.listAllSchedules(),
    nexusStateStore.listAllOngoingMissions(),
  ]);

  // Restore Schedules
  for (const { userId, schedule } of persistedSchedules) {
    if (!schedule.intervalMs || !schedule.createdAt || !schedule.triggerType) continue;

    schedulerEngine.restoreSchedule({
      scheduleId: schedule.scheduleId,
      workspaceId: schedule.workspaceId,
      goal: schedule.goal,
      userId,
      triggerType: schedule.triggerType as any,
      frequency: schedule.frequency as any,
      intervalMs: schedule.intervalMs,
      lastRun: schedule.lastRun,
      nextRun: schedule.nextRun,
      enabled: schedule.enabled,
      createdAt: schedule.createdAt,
      runCount: schedule.runCount,
      maxRuns: schedule.maxRuns,
    });
  }

  // Restore Master Brain Missions
  for (const { userId, mission } of persistedMissions) {
    masterBrain.registerMission(
      mission.id, 
      mission.workspaceId, 
      userId, 
      mission.goal
    );
    masterBrain.updateMissionStatus(
      mission.id, 
      mission.status === 'active' ? 'running' : 'paused'
    );
  }
})();

// ── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  const body = {
    status:             'ok' as const,
    version:            '2.0.0',
    engine:             'Agentic OS — Master Brain V2 + Continuous Execution Engine',
    groqKeyPresent:     !!process.env.GROQ_API_KEY,
    supabaseConnected:  !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    masterBrain:        masterBrain.stats,
    governor:           globalGovernor.stats,
    scheduler:          schedulerEngine.stats,
    timestamp:          new Date().toISOString(),
  };
  res.json(body);
});

// ── Persisted User State API ───────────────────────────────────────────────

app.get('/api/state/:userId', async (req: Request, res: Response) => {
  const state = await nexusStateStore.getUserState(req.params.userId);
  res.json(state);
});

app.put('/api/state/:userId', async (req: Request, res: Response) => {
  const state = await nexusStateStore.syncUserState(
    req.params.userId,
    req.body as Partial<UserStateSnapshot>
  );
  res.json({ success: true, state });
});

app.get('/api/workspaces', async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: 'Missing userId query parameter.' });
    return;
  }

  const state = await nexusStateStore.getUserState(userId);
  res.json({ workspaces: state.workspaces, activeWorkspaceId: state.activeWorkspaceId });
});

app.post('/api/workspaces', async (req: Request, res: Response) => {
  const {
    userId,
    title,
    goalType = 'general',
    windowType = 'general',
  } = req.body as {
    userId?: string;
    title?: string;
    goalType?: GoalType;
    windowType?: ApplicationWindowType;
  };

  if (!userId || !title) {
    res.status(400).json({ error: 'Missing userId or title.' });
    return;
  }

  const result = await nexusStateStore.createWorkspaceWindow({
    userId,
    title,
    goalType,
    windowType,
  });

  res.json({ success: true, workspace: result.workspace, window: result.window, state: result.state });
});

app.delete('/api/workspaces/:workspaceId', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string | undefined) ?? req.body?.userId;
  if (!userId) {
    res.status(400).json({ error: 'Missing userId.' });
    return;
  }

  const state = await nexusStateStore.deleteWorkspace(userId, req.params.workspaceId);
  res.json({ success: true, state });
});

app.post('/api/agents/install', async (req: Request, res: Response) => {
  const { userId, agentId } = req.body as { userId?: string; agentId?: string };

  if (!userId || !agentId) {
    res.status(400).json({ error: 'Missing userId or agentId.' });
    return;
  }

  const state = await nexusStateStore.installAgent(userId, agentId);
  res.json({ success: true, installedAgentIds: state.installedAgentIds });
});

app.get('/api/brain/stats', (_req: Request, res: Response) => {
  res.json(masterBrain.stats);
});

app.get('/api/agents', (_req: Request, res: Response) => {
  const { AGENT_REGISTRY } = require('./agents/agentRegistry.js');
  res.json({ agents: Object.values(AGENT_REGISTRY) });
});


app.post('/api/agents/spawn', async (req: Request, res: Response) => {
  const { agentType, goal, userId = 'user_anonymous', workspaceId } = req.body as {
    agentType: AgentType;
    goal: string;
    userId: string;
    workspaceId: string;
  };

  if (!agentType || !goal || !workspaceId) {
    res.status(400).json({ error: 'Missing agentType, goal, or workspaceId.' });
    return;
  }

  console.log(`[Server] 🦾 Spawning ad-hoc agent: ${agentType} for workspace: ${workspaceId}`);

  // Create a minimal DAG for a single agent execution
  const missionId = crypto.randomUUID();
  const dag: TaskDAG = {
    missionId,
    goal,
    goalType: 'general',
    successCriteria: [`Execute specialized ${agentType} task`],
    nodes: [
      {
        id: `adhoc_${agentType}_${Date.now()}`,
        label: `Autonomous ${agentType} execution for: ${goal}`,
        agentType,
        dependencies: [],
        priority: 'high',
        maxRetries: 1,
        expectedOutput: { format: 'prose' },
        contextFields: [],
        goalAlignment: 1.0,
      }
    ],
    estimatedWaves: 1
  };

  // Register with Master Brain
  masterBrain.registerMission(missionId, workspaceId, userId, goal);
  masterBrain.updateMissionStatus(missionId, 'running', dag);

  // We don't stream here, we just return the missionId.
  // The client will pick up the events via the global SSE stream if they are subscribed.
  res.json({ success: true, missionId });
});

// ── SSE Orchestration ──────────────────────────────────────────────────────

app.post('/api/orchestrate', async (req: Request, res: Response) => {
  const { goal, userId = 'user_anonymous' } = req.body as Partial<OrchestrateRequest>;

  if (!goal || typeof goal !== 'string' || goal.trim().length < 5) {
    res.status(400).json({ error: 'Missing or too-short "goal" field.' });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
    return;
  }

  // --- BRAIN: Session Guard (Kill Zombies) ---
  const existingTask = activeUserTasks.get(userId);
  if (existingTask) {
    console.warn(`[Server] 🛡️ Killing older zombie session for user: ${userId}`);
    existingTask.abort(); 
  }

  const taskController = new AbortController();
  activeUserTasks.set(userId, taskController);
  // -------------------------------------------

  // Open SSE stream
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.setTimeout(0); // DISABLE SOCKET TIMEOUTS
  res.flushHeaders();

  const sessionId    = crypto.randomUUID();
  const mcpBridge    = new MCPBridge();
  sessions.set(sessionId, mcpBridge);

  let socketAborted = false;

  // ── Connection Warming ──────────────────────────────────────────────────
  res.write(`: burst ${' '.repeat(1024)}\n\n`);

  const ping = setInterval(() => {
    if (!socketAborted && !taskController.signal.aborted) {
      // Send a visible event so the frontend watchdog stays satisfied
      res.write(`data: ${JSON.stringify({ type: 'connected', message: 'ping', sessionId })}\n\n`);
    }
  }, 1800);

  req.on('close', () => {
    socketAborted = true;
    // We DON'T abort the taskController here because we want tasks to persist in BG
    console.log(`[Server] 🔌 Socket closed (Session: ${sessionId}). Task continues in background.`);
  });

  const isTaskAborted = () => taskController.signal.aborted;

  const emit = (event: object) => {
    if (!socketAborted && !isTaskAborted()) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  try {
    console.log(`\n[Server] 🚀 Orchestration — userId: "${userId}" session: "${sessionId}"`);
    console.log(`[Server] Goal: "${goal.slice(0, 120)}"`);

    emit({ type: 'connected', message: 'Agentic OS online. Master Brain activated...', sessionId });

    // Register mission with Master Brain
    const missionId = crypto.randomUUID();
    masterBrain.registerMission(missionId, sessionId, userId, goal);
    masterBrain.updateMissionStatus(missionId, 'planning');

    // Initialize workspace permissions for integration OS
    initWorkspacePermissions(sessionId);

    const mode = (req.body as any).mode || 'founder';

    // ── V2 TaskDAG Planning ───────────────────────────────────────────────
    emit({ 
      type: 'agent_spawn', 
      taskId: 'planner', 
      taskLabel: 'Master Brain', 
      agentType: 'summarizer',
      mode: 'parallel' 
    });

    const statusMessage = mode === 'student' 
      ? 'Understanding your topic...' 
      : 'Analyzing goal & recruiting specialists...';

    emit({ type: 'agent_working', taskId: 'planner', taskLabel: 'Master Brain', message: statusMessage });

    let dag;
    if (mode === 'student') {
      try {
        const { parseStudentIntent } = await import('./intent/studentIntentParser.js');
        const { mapIntentToTasks }   = await import('./intent/studentTaskMapper.js');
        
        const intent = parseStudentIntent(goal);
        const nodes  = mapIntentToTasks(intent);
        
        dag = {
          missionId: crypto.randomUUID(),
          goal,
          goalType: 'research' as GoalType,
          successCriteria: [`Develop mastery of ${intent.subject || 'topic'}`],
          nodes,
          estimatedWaves: 3,
          isStudentMode: true,
        };
      } catch (err) {
        console.error('[Server] ❌ Student Mode Planning Failed:', err);
        throw new Error(`Failed to generate student plan: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } else {
      const { planUniversalMission } = await import('./intent/universalIntentEngine.js');
      dag = await planUniversalMission(goal, mode);
    }


    // EVEN IF SOCKET ABORTED, we continue to orchestrate unless the TASK is aborted (Session Guard kill)
    console.log(`[Server] ✅ DAG generated (${dag.nodes.length} tasks). Starting Waves...`);

    // Initialize V2 state components
    const registry = new TaskRegistry(dag.missionId);
    const memory   = new MissionMemory(sessionId, goal);
    const governor = globalGovernor;

    // Register session for exports
    sessions.set(sessionId, memory);


    // IMPORTANT: We pass 'isTaskAborted' to orchestrateDAG so it only writes to 'res' if !isTaskAborted()
    await orchestrateDAG({
      dag: dag as any,
      registry,
      memory,
      governor,
      userId,
      sessionId,
      res,
      isAborted: isTaskAborted,
    });
    
    // Notify master brain when done
    masterBrain.updateMissionStatus(missionId, 'complete');
    activeUserTasks.delete(userId); // Task finished naturally
    clearInterval(ping);


  } catch (err) {
    activeUserTasks.delete(userId);
    clearInterval(ping);
    
    if (taskController.signal.aborted) {
      console.log(`[Server] 🛡️ Task for ${userId} was gracefully terminated by Session Guard.`);
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error('[Server] ❌ Orchestration error:', message);
    if (!socketAborted) emit({ type: 'error', message });
  } finally {
    if (!socketAborted && !taskController.signal.aborted) res.end();
    // Keep session alive for 1 hour to support reconnects and exports
    setTimeout(() => sessions.delete(sessionId), 60 * 60 * 1000);
  }
});

// ── Single Action Execution (Integration Layer) ───────────────────────────

app.post('/api/execute-action', async (req: Request, res: Response) => {
  const { actionId, workspaceId, userId = 'user_anonymous' } = req.body;

  if (!actionId || !workspaceId) {
    res.status(400).json({ error: 'Missing actionId or workspaceId.' });
    return;
  }

  const taskController = new AbortController();
  activeUserTasks.set(userId, taskController);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const isTaskAborted = () => taskController.signal.aborted;

  req.on('close', () => {
    taskController.abort();
    activeUserTasks.delete(userId);
  });

  try {
    await executeSingleAction(actionId, workspaceId, userId, res, isTaskAborted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
  } finally {
    res.end();
    activeUserTasks.delete(userId);
  }
});


// ── Ledger API ─────────────────────────────────────────────────────────────

app.get('/api/ledger/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const summary = ledger.getSummary(userId);
  res.json(summary);
});

// ── Master Brain API ──────────────────────────────────────────────────────

app.get('/api/brain/stats', (_req: Request, res: Response) => {
  res.json(masterBrain.stats);
});

// ── HITL Approval API ──────────────────────────────────────────────────────

app.post('/api/approve-task', (req: Request, res: Response) => {
  const { sessionId, taskId, approved } = req.body;
  
  if (!sessionId || !taskId || approved === undefined) {
    res.status(400).json({ error: 'Missing required fields: sessionId, taskId, approved' });
    return;
  }

  const success = approvalGuard.resolve(sessionId, taskId, !!approved);
  
  if (success) {
    res.json({ success: true, message: `Task ${taskId} in session ${sessionId} was ${approved ? 'approved' : 'rejected'}.` });
  } else {
    res.status(404).json({ error: `No pending approval found for task ${taskId} in session ${sessionId}.` });
  }
});

app.get('/api/brain/missions', (_req: Request, res: Response) => {
  const missions = masterBrain.getAllMissions().map(m => ({
    missionId:   m.missionId,
    workspaceId: m.workspaceId,
    goal:        m.goal,
    status:      m.status,
    startedAt:   m.startedAt,
    completedAt: m.completedAt,
    nextActions: m.nextActions.length,
    risks:       m.risks.length,
  }));
  res.json({ missions });
});

// ── Scheduler API ──────────────────────────────────────────────────────────

app.get('/api/schedules', async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;

  if (!userId) {
    res.json({ schedules: schedulerEngine.listSchedules(), stats: schedulerEngine.stats });
    return;
  }

  const state = await nexusStateStore.getUserState(userId);
  res.json({ schedules: state.schedules, stats: schedulerEngine.stats });
});

app.post('/api/schedule', async (req: Request, res: Response) => {
  const { workspaceId, goal, userId, frequency, maxRuns } = req.body;
  if (!workspaceId || !goal || !userId || !frequency) {
    res.status(400).json({ error: 'Missing required fields: workspaceId, goal, userId, frequency' });
    return;
  }
  const config = schedulerEngine.scheduleWorkspace({ workspaceId, goal, userId, frequency, maxRuns });
  await nexusStateStore.upsertSchedule(userId, config);
  res.json({ success: true, schedule: config });
});

app.delete('/api/schedule/:scheduleId', async (req: Request, res: Response) => {
  const { scheduleId } = req.params;
  const userId = (req.query.userId as string | undefined) ?? req.body?.userId;
  const removed = schedulerEngine.cancelSchedule(scheduleId);
  if (removed && userId) {
    await nexusStateStore.removeSchedule(userId, scheduleId);
  }
  res.json({ success: removed });
});

app.post('/api/schedule/:scheduleId/pause', async (req: Request, res: Response) => {
  const userId = req.body?.userId as string | undefined;
  schedulerEngine.pauseSchedule(req.params.scheduleId);
  if (userId) {
    const schedule = schedulerEngine.getSchedule(req.params.scheduleId);
    if (schedule) await nexusStateStore.upsertSchedule(userId, schedule);
  }
  res.json({ success: true });
});

app.post('/api/schedule/:scheduleId/resume', async (req: Request, res: Response) => {
  const userId = req.body?.userId as string | undefined;
  schedulerEngine.resumeSchedule(req.params.scheduleId);
  if (userId) {
    const schedule = schedulerEngine.getSchedule(req.params.scheduleId);
    if (schedule) await nexusStateStore.upsertSchedule(userId, schedule);
  }
  res.json({ success: true });
});

// ── Integration / Tool OS API ──────────────────────────────────────────────

app.get('/api/tools', (_req: Request, res: Response) => {
  res.json({ tools: listTools().map(t => ({ id: t.id, name: t.name, category: t.category, riskLevel: t.riskLevel, requiresApproval: t.requiresApproval })) });
});

app.post('/api/tools/execute', async (req: Request, res: Response) => {
  const { toolId, params, workspaceId, skipApproval } = req.body;
  if (!toolId || !workspaceId) {
    res.status(400).json({ error: 'Missing toolId or workspaceId.' });
    return;
  }
  const result = await executeIntegration(toolId, params ?? {}, workspaceId, skipApproval ?? false);
  res.json(result);
});

app.post('/api/tools/grant', (req: Request, res: Response) => {
  const { workspaceId, toolId } = req.body;
  if (!workspaceId || !toolId) { res.status(400).json({ error: 'Missing workspaceId or toolId.' }); return; }
  grantPermission(workspaceId, toolId);
  res.json({ success: true });
});

app.get('/api/approvals', (req: Request, res: Response) => {
  const { workspaceId } = req.query;
  res.json({ approvals: listPendingApprovals(workspaceId as string | undefined) });
});

app.post('/api/approvals/:approvalId/resolve', (req: Request, res: Response) => {
  const { approved } = req.body;
  const resolved = resolveApproval(req.params.approvalId, !!approved);
  res.json({ success: resolved });
});


// ── Mission Control & Observability ────────────────────────────────────────

app.post('/api/mission/:sessionId/approve', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { taskId, approved } = req.body;

  if (!taskId) {
    res.status(400).json({ error: 'Missing taskId.' });
    return;
  }

  const resolved = approvalGuard.resolve(sessionId, taskId, !!approved);
  res.json({ success: resolved });
});

app.get('/api/mission/:sessionId/graph', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const memory = sessions.get(sessionId);

  if (!memory || !(memory instanceof MissionMemory)) {
    res.status(404).json({ error: `Mission session "${sessionId}" not found or has no graph data.` });
    return;
  }

  res.json(memory.toGraphData());
});


app.get('/api/export/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const format = (req.query.format as ExportFormat) ?? 'markdown';

  const bridge = sessions.get(sessionId);

  if (!bridge) {
    res.status(404).json({ error: `Session "${sessionId}" not found or expired.` });
    return;
  }

  try {
    const { content, mimeType, filename } = bridge.export(format);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Server] ❌ Export failed for session ${sessionId}:`, message);
    res.status(500).json({ error: `Export failed: ${message}` });
  }
});
// ── NexusFS (Smart File System) API ───────────────────────────────────────

app.get('/api/fs/list', (req: Request, res: Response) => {
  const { parentId = 'root' } = req.query;
  const files   = nexusFS.getFiles(parentId as string);
  const folders = nexusFS.getFolders(parentId as string);
  res.json({ files, folders });
});

app.post('/api/fs/upload', async (req: Request, res: Response) => {
  const { name, content, parentId = 'root', userId = 'user_anonymous', mimeType } = req.body;
  
  if (!name || !content) {
    res.status(400).json({ error: 'Missing name or content for upload.' });
    return;
  }

  try {
    const file = await nexusFS.uploadFile(name, content, parentId, userId, mimeType || 'text/plain');
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/fs/search', (req: Request, res: Response) => {
  const { q = '' } = req.query;
  const results = nexusFS.searchFiles(q as string);
  res.json({ results });
});

// ── Boot ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const groqStatus     = process.env.GROQ_API_KEY ? '✅ Configured' : '❌ MISSING';
  const supabaseStatus = process.env.SUPABASE_URL ? '✅ Configured' : '⚠️  Using in-memory fallback';

  console.log(`\n⬡  Agentic OS v2.0 (Founder Edition) → http://localhost:${PORT}`);
  console.log(`   Master Brain:    ✅ Online (Decision Loop Active)`);
  console.log(`   Scheduler:       ✅ Online (Tick: 30s)`);
  console.log(`   Integration OS:  ✅ Online (6 tools registered)`);
  console.log(`   Groq API Key:    ${groqStatus}`);
  console.log(`   Supabase:        ${supabaseStatus}`);
  console.log(`   CORS Origin:     ${process.env.CORS_ORIGIN ?? '*'}\n`);
});


export { app };
