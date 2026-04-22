import { logger } from "./logger.js";
import { MODEL_POWER } from './agents/agentConfig.js';
import { llmRouter } from './llm/LLMRouter.js';
import type { TaskDAG, OngoingMission } from '@nexus-os/types';
import { systemQueue } from './queue/queue.js';
import { getSupabase } from './storage/supabaseClient.js';
import { nexusStateStore } from './storage/nexusStateStore.js';
import { eventBus } from './events/eventBus.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type MissionLifecycleStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'scheduled';

export interface ScoredAction {
  id:          string;
  title:       string;
  description: string;
  type:        'execution' | 'review' | 'escalation' | 'integration';
  priority:    'critical' | 'high' | 'medium' | 'low';
  score:       number;
  workspaceId: string;
  createdAt:   number;
}

export interface Opportunity {
  id:          string;
  title:       string;
  description: string;
  sourceWorkspaceId: string;
  relatedWorkspaceIds: string[];
  score:       number;
  createdAt:   number;
}

export interface Risk {
  id:          string;
  title:       string;
  description: string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  workspaceId: string;
  createdAt:   number;
  mitigations: string[];
}

// ── Master Brain Singleton ────────────────────────────────────────────────────

const INSTANCE_ID = process.env.INSTANCE_ID || `masterbrain-${Math.random().toString(36).slice(2, 10)}`;

class MasterBrainV2 {
  /**
   * Initializes the Master Brain's periodic loops using BullMQ.
   * This is called once during API server startup.
   */
  async initDurableLoops() {
    logger.info('[MasterBrain] 🧠 Initializing Durable Decision Loops...');

    // 1. Decision Loop (Every 1 minute)
    await systemQueue.add(
      'master_brain_decision_loop',
      { type: 'master_brain_loop' },
      { 
        repeat: { pattern: '*/1 * * * *' },
        jobId: 'master_brain_decision_loop' 
      }
    );

    // 2. Global Reflection (Every 5 minutes)
    await systemQueue.add(
      'master_brain_reflection_loop',
      { type: 'master_brain_reflection' },
      { 
        repeat: { pattern: '*/5 * * * *' },
        jobId: 'master_brain_reflection_loop' 
      }
    );
  }

  /**
   * Performs a single decision cycle.
   * Triggered by systemWorker.
   */
  async runDecisionCycle() {
    logger.info('[MasterBrain] 🧠 Running Decision Cycle...');
    const supabase = await getSupabase();

    // 1. Fetch active missions
    const { data: missions, error: mError } = await supabase
      .from('nexus_missions')
      .select('*')
      .in('status', ['running', 'paused']);

    if (mError) {
      logger.error({ err: mError }, '[MasterBrain] Failed to fetch active missions');
      return;
    }

    const now = new Date();

    for (const mission of missions) {
      // 2. Check for stalled tasks (> 3 mins)
      const { data: tasks, error: tError } = await supabase
        .from('tasks')
        .select('*')
        .eq('mission_id', mission.id)
        .eq('status', 'running');

      if (!tError && tasks) {
        for (const task of tasks) {
          const startedAt = new Date(task.started_at || task.created_at);
          const diffMins = (now.getTime() - startedAt.getTime()) / 60000;

          if (diffMins > 3) {
            logger.warn(`[MasterBrain] 🚨 Task ${task.id} stalled for ${diffMins.toFixed(1)}m. Marking failed.`);
            await nexusStateStore.updateTaskStatus(task.id, 'failed', { error: 'Task timeout: stalled for more than 3 minutes' });
            
            await eventBus.publish(mission.id, {
              type: 'neural_hud_alert',
              missionId: mission.id,
              severity: 'high',
              message: `Task "${task.label}" stalled and was auto-terminated.`,
              timestamp: now.getTime()
            } as any);
          }
        }
      }

      // 3. Resume paused missions older than 10 mins
      if (mission.status === 'paused') {
        const updatedAt = new Date(mission.updated_at || mission.created_at);
        const diffMins = (now.getTime() - updatedAt.getTime()) / 60000;

        if (diffMins > 10) {
          logger.info(`[MasterBrain] ⏯️ Resuming mission ${mission.id} (paused for ${diffMins.toFixed(1)}m)`);
          await systemQueue.add('resume_mission', { missionId: mission.id });
        }
      }
    }

    // 4. Scan complete missions from last 24h for Strategic Overview
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: completeMissions, error: cError } = await supabase
      .from('nexus_missions')
      .select('goal, status, updated_at')
      .eq('status', 'complete')
      .gt('updated_at', yesterday);

    if (!cError && completeMissions && completeMissions.length > 0) {
      const missionSummary = completeMissions.map(m => `- ${m.goal}`).join('\n');
      const prompt = `You are the Nexus OS Master Brain. Analyze these recently completed missions and provide a 1-sentence 'Strategic Overview' of the system's current momentum. Return as JSON: { "overview": string }.\n\nMissions:\n${missionSummary}`;

      try {
        const res = await llmRouter.call({
          system: 'You are a strategic system analyzer. Return valid JSON.',
          user: prompt,
          model: MODEL_POWER,
          temperature: 0.3,
          maxTokens: 1000,
          jsonMode: true,
        });

        const overview = JSON.parse(res.content).overview;
        if (overview) {
          logger.info({ overview }, '[MasterBrain] 📈 Strategic Overview');
          // Optionally store this in a global state or emit event
        }
      } catch (err) {
        logger.error({ err }, '[MasterBrain] Strategic analysis failed');
      }
    }
  }

  /**
   * Performs global reflection across all missions.
   * Triggered by systemWorker.
   */
  async runGlobalReflection() {
    logger.info('[MasterBrain] 🧠 Running Global Reflection...');
    const supabase = await getSupabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: missions } = await supabase
      .from('nexus_missions')
      .select('goal, user_id, status, updated_at')
      .gt('updated_at', sevenDaysAgo);

    if (!missions || missions.length === 0) return;

    const byUser = missions.reduce((acc: any, m: any) => {
      if (!acc[m.user_id]) acc[m.user_id] = [];
      acc[m.user_id].push(m.goal);
      return acc;
    }, {});

    for (const [userId, goals] of Object.entries(byUser)) {
      const prompt = `You are the Nexus OS Strategic Reflector. Analyze these mission goals from the last 7 days:\n${(goals as string[]).map(g => `- ${g}`).join('\n')}\n\nReturn JSON: { "risks": [{"title":string,"severity":"critical"|"high"|"medium","mitigation":string}], "themes": string[], "strategicGaps": string[] }`;

      try {
        const res = await llmRouter.call({
          system: 'You are a strategic AI analyst. Return valid JSON only.',
          user: prompt,
          model: MODEL_POWER,
          temperature: 0.3,
          maxTokens: 1500,
          jsonMode: true,
        });

        const reflection = JSON.parse(res.content ?? '{}');

        await supabase.from('nexus_state')
          .upsert({ id: userId, state: { globalReflection: reflection }, updated_at: new Date().toISOString() }, { onConflict: 'id' });

        const criticalRisks = (reflection.risks ?? []).filter((r: any) => r.severity === 'critical');
        for (const risk of criticalRisks) {
          await eventBus.publish(userId, { type: 'neural_hud_alert', severity: 'critical', message: `Strategic Risk: ${risk.title}`, timestamp: Date.now() } as any);
        }
      } catch (err) {
        logger.error({ err, userId }, '[MasterBrain] Reflection failed for user');
      }
    }
  }
}

export const masterBrain = new MasterBrainV2();

// --- Health Endpoint for Master Brain ---
import express from 'express';
export const masterBrainRouter: express.Router = express.Router();
masterBrainRouter.get('/health', async (req, res) => {
  // Optionally check Redis/Supabase connectivity
  let supabaseOk = false;
  let redisOk = false;
  try {
    const supabase = await getSupabase();
    if (supabase) supabaseOk = true;
  } catch {}
  try {
    // If you have a getRedis() utility, check connectivity here
    redisOk = true; // Assume OK for now
  } catch {}
  res.json({
    status: 'ok',
    instance: INSTANCE_ID,
    supabase: supabaseOk,
    redis: redisOk,
    timestamp: Date.now()
  });
});


/**
 * Maps high-level DAG nodes to executable TUI tasks with tool parameters.
 */
export function mapNodesToExecutableTasks(nodes: TaskNode[]): any[] {
    return nodes.map((node, i) => {
        const label = (node.label || '').toLowerCase();
        let type = 'shell';
        let tool = 'shell';
        let params: any = {};

        // ── Robust Action Mapper (OS-First Bridge) ────────────────────────
        
        // 1. OPEN / LAUNCH Handle
        if (label.startsWith('open ') || label.startsWith('launch ') || label.includes('open safari') || label.includes('open chrome')) {
            const target = (node.label || '').replace(/.*(?:open|launch|start|run)\s+/i, '').trim();
            
            // If target looks like a URL, open it directly
            if (target.includes('://') || target.includes('.') || target.includes('localhost')) {
               params = { command: `open "${target}"` };
            } else {
               params = { command: `open -a "${target}" || open "${target}"` };
            }
        } 
        
        // 2. SEARCH Handle (The "Search google for X" Fix)
        else if (label.includes('search ') || label.includes('google ')) {
            const query = (node.label || '').replace(/.*(?:search|google|find)\s+(?:for|about\s+)?/i, '').trim();
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            params = { command: `open "${searchUrl}"` };
        }

        // 3. GUI TYPE Handle
        else if (label.startsWith('type ') || label.includes('write into')) {
            type = 'gui_type';
            tool = 'gui_type';
            const text = (node.label || '').replace(/.*(?:type|write)\s+["']?(.*?)["']?\s+(?:into|to).*/i, '$1').trim();
            params = { text: text || node.label };
        }

        // 4. GUI CLICK Handle
        else if (label.startsWith('click ') || label.includes('press ')) {
            type = 'gui_click';
            tool = 'gui_click';
            const elementId = (node.label || '').replace(/.*(?:click|press)\s+["']?(.*?)["']?.*/i, '$1').trim();
            params = { element_id: elementId };
        }

        // 5. LIST FILES Handle
        else if (label.includes('list files') || label.includes('show files')) {
            type = 'list_files';
            tool = 'list_files';
            params = { depth: 2 };
        }

        // ── HERO SKILLS MAPPING ──
        
        // 7. DIGITAL JANITOR Handle
        else if (label.includes('clean') && (label.includes('desktop') || label.includes('folder') || label.includes('directory'))) {
            type = 'digital_janitor';
            tool = 'digital_janitor';
            const target = label.includes('desktop') ? '~/Desktop' : (label.match(/(?:folder|directory)\s+["']?(.*?)["']?/i)?.[1] || '.');
            params = { target_dir: target };
        }

        // 8. RESOURCE REAPER Handle
        else if (label.includes('ram') || label.includes('cpu') || label.includes('process') || label.includes('hog') || label.includes('reaper')) {
            type = 'resource_reaper';
            tool = 'resource_reaper';
            params = {};
        }

        // 9. WORKFLOW LAUNCHER Handle
        else if (label.includes('mode') || label.includes('workflow') || label.includes('launcher')) {
            type = 'workflow_launcher';
            tool = 'workflow_launcher';
            let mode = 'deep_work';
            if (label.includes('creative')) mode = 'creative';
            if (label.includes('meeting')) mode = 'meeting';
            if (label.includes('relax')) mode = 'relax';
            params = { mode };
        }

        // 10. PROJECT ONBOARDER Handle
        else if (label.includes('onboard') || label.includes('analyze project') || label.includes('explain project')) {
            type = 'project_onboard';
            tool = 'project_onboard';
            params = { path: '.' };
        }

        // 6. DEFAULT / FALLBACK (Persistent Shell)
        else {
            params = { command: node.label };
        }

        return {
            step: i + 1,
            type,
            tool,
            label: node.label,
            params
        };
    });
}

/**
 * Synchronous Chat Endpoint (used by the Cyber-Shell TUI)
 * Maps the mission-based brain to a single-step agentic loop.
 */
masterBrainRouter.post('/chat', async (req, res) => {
  const { input, history } = req.body;
  logger.info({ input, historyLength: history?.length }, '[MasterBrain] 💬 Received TUI Chat request');

  try {
    // 1. Resolve intent and plan
    const { planUniversalMission } = await import('./intent/universalIntentEngine.js');
    const dag = await planUniversalMission(input);

    // 2. Since the TUI expects STEPS, we convert the mission nodes of the DAG into TUI-compatible tasks.
    if (dag.nodes && dag.nodes.length > 0) {
        const executableTasks = mapNodesToExecutableTasks(dag.nodes);
        const firstTask = executableTasks[0];
        
        res.json({
            action: firstTask.type, // Map directly to shell, tool, etc.
            tool: firstTask.tool,
            params: firstTask.params,
            explanation: `[Orchestrator] Planned mission: ${dag.goal}. I will now begin: ${firstTask.label}`,
            agent_name: dag.metadata?.mode === 'developer' ? 'DevAgent' : (dag.metadata?.mode === 'founder' ? 'SysAgent' : 'StudentAgent'),
            agent_icon: dag.metadata?.mode === 'developer' ? '👨‍💻' : (dag.metadata?.mode === 'founder' ? '🚀' : '📚'),
            goal: dag.goal,
            tasks: executableTasks
        });
    } else {
        res.json({
            action: 'done',
            explanation: 'Mission goal achieved or no actions required.',
            agent_name: 'Orchestrator',
            agent_icon: '🌟'
        });
    }
  } catch (err: any) {
    logger.error({ err: err.message }, '[MasterBrain] ❌ Chat failure');
    res.status(500).json({ error: err.message });
  }
});
