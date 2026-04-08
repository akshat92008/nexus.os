import { nexusStateStore } from './storage/nexusStateStore.js';
import { systemQueue } from './queue/queue.js';
import { eventBus } from './events/eventBus.js';
import { getSupabase } from './storage/supabaseClient.js';
import { GROQ_API_URL } from './agents/agentConfig.js';
import type { TaskDAG, OngoingMission } from '@nexus-os/types';

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

class MasterBrainV2 {
  /**
   * Initializes the Master Brain's periodic loops using BullMQ.
   * This is called once during API server startup.
   */
  async initDurableLoops() {
    console.log('[MasterBrain] 🧠 Initializing Durable Decision Loops...');

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
    console.log('[MasterBrain] 🧠 Running Decision Cycle...');
    const supabase = await getSupabase();

    // 1. Fetch active missions
    const { data: missions, error: mError } = await supabase
      .from('nexus_missions')
      .select('*')
      .in('status', ['running', 'paused']);

    if (mError) {
      console.error('[MasterBrain] Failed to fetch active missions:', mError);
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
            console.warn(`[MasterBrain] 🚨 Task ${task.id} stalled for ${diffMins.toFixed(1)}m. Marking failed.`);
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
          console.log(`[MasterBrain] ⏯️ Resuming mission ${mission.id} (paused for ${diffMins.toFixed(1)}m)`);
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
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'You are a strategic system analyzer. Return valid JSON.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (response.ok) {
          const result = await response.json() as any;
          const overview = result.choices?.[0]?.message?.content;
          if (overview) {
            console.log('[MasterBrain] 📈 Strategic Overview:', overview);
            // Optionally store this in a global state or emit event
          }
        }
      } catch (err) {
        console.error('[MasterBrain] Groq analysis failed:', err);
      }
    }
  }

  /**
   * Performs global reflection across all missions.
   * Triggered by systemWorker.
   */
  async runGlobalReflection() {
    console.log('[MasterBrain] 🧠 Running Global Reflection...');
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
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile', temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'You are a strategic AI analyst. Return valid JSON only.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (!response.ok) continue;
        const result = await response.json() as any;
        const reflection = JSON.parse(result.choices?.[0]?.message?.content ?? '{}');

        await supabase.from('nexus_state')
          .upsert({ id: userId, state: { globalReflection: reflection }, updated_at: new Date().toISOString() }, { onConflict: 'id' });

        const criticalRisks = (reflection.risks ?? []).filter((r: any) => r.severity === 'critical');
        for (const risk of criticalRisks) {
          await eventBus.publish(userId, { type: 'neural_hud_alert', severity: 'critical', message: `Strategic Risk: ${risk.title}`, timestamp: Date.now() } as any);
        }
      } catch (err) {
        console.error(`[MasterBrain] Reflection failed for user ${userId}:`, err);
      }
    }
  }
}

export const masterBrain = new MasterBrainV2();
