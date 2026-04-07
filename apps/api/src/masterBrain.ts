/**
 * Agentic OS — Master Brain V2
 *
 * The central intelligence singleton that persists across ALL requests.
 * Unlike the old per-mission "planner", the Master Brain maintains global
 * awareness — tracking every running workspace, generating unsolicited
 * opportunities, detecting risks, and driving the 24/7 decision loop.
 */

import type { TaskDAG } from '../../../packages/types/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type MissionLifecycleStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'scheduled';

export interface MissionState {
  missionId:    string;
  workspaceId:  string;
  goal:         string;
  goalType:     string;
  status:       MissionLifecycleStatus;
  startedAt:    number;
  completedAt?: number;
  dag?:         TaskDAG;
  artifacts:    Record<string, string>; // taskId → content
  nextActions:  ScoredAction[];
  opportunities: Opportunity[];
  risks:        Risk[];
}

export interface ScoredAction {
  id:          string;
  title:       string;
  description: string;
  type:        'execution' | 'review' | 'escalation' | 'integration';
  priority:    'critical' | 'high' | 'medium' | 'low';
  /** Priority Score = urgency(1-10) × impact(1-10) × feasibility(1-10) / 100 */
  score:       number;
  workspaceId: string;
  createdAt:   number;
  expiresAt?:  number;
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

export interface GlobalBrainState {
  missions:       Map<string, MissionState>;
  globalActions:  ScoredAction[];
  globalOpportunities: Opportunity[];
  globalRisks:    Risk[];
  decisionCycle:  number; // how many decision loops have run
  lastEvaluatedAt: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const POWER_MODEL = 'llama-3.3-70b-versatile';

// ── Priority Scoring System ───────────────────────────────────────────────────

export function scoreAction(params: {
  urgency:     number; // 1-10: how time-sensitive
  impact:      number; // 1-10: business value if executed
  feasibility: number; // 1-10: how likely to succeed
}): number {
  const raw = (params.urgency * params.impact * params.feasibility) / 100;
  return Math.round(raw * 100) / 100; // 2 decimal places
}

function priorityFromScore(score: number): ScoredAction['priority'] {
  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

// ── Master Brain Singleton ────────────────────────────────────────────────────

class MasterBrainV2 {
  private state: GlobalBrainState = {
    missions:            new Map(),
    globalActions:       [],
    globalOpportunities: [],
    globalRisks:         [],
    decisionCycle:       0,
    lastEvaluatedAt:     Date.now(),
  };

  private loopInterval: NodeJS.Timeout | null = null;
  private globalReflectionInterval: NodeJS.Timeout | null = null;

  // ── Mission Lifecycle ───────────────────────────────────────────────────────

  registerMission(missionId: string, workspaceId: string, goal: string, goalType = 'general'): MissionState {
    const state: MissionState = {
      missionId,
      workspaceId,
      goal,
      goalType,
      status:       'queued',
      startedAt:    Date.now(),
      artifacts:    {},
      nextActions:  [],
      opportunities:[],
      risks:        [],
    };
    this.state.missions.set(missionId, state);
    console.log(`[MasterBrain] 🧠 Mission registered: ${missionId} — "${goal.slice(0, 50)}"`);
    return state;
  }

  updateMissionStatus(missionId: string, status: MissionLifecycleStatus, dag?: TaskDAG): void {
    const mission = this.state.missions.get(missionId);
    if (!mission) return;
    mission.status = status;
    if (dag) mission.dag = dag;
    if (status === 'complete') mission.completedAt = Date.now();
  }

  depositArtifact(missionId: string, taskId: string, content: string): void {
    const mission = this.state.missions.get(missionId);
    if (!mission) return;
    mission.artifacts[taskId] = content;
    this.detectOpportunities(mission);
    this.detectRisks(mission);
  }

  pauseMission(missionId: string): void {
    this.updateMissionStatus(missionId, 'paused');
    console.log(`[MasterBrain] ⏸️  Mission paused: ${missionId}`);
  }

  resumeMission(missionId: string): void {
    this.updateMissionStatus(missionId, 'running');
    console.log(`[MasterBrain] ▶️  Mission resumed: ${missionId}`);
  }

  getMissionState(missionId: string): MissionState | undefined {
    return this.state.missions.get(missionId);
  }

  getAllMissions(): MissionState[] {
    return Array.from(this.state.missions.values());
  }

  getActiveMissions(): MissionState[] {
    return this.getAllMissions().filter(m =>
      m.status === 'running' || m.status === 'planning'
    );
  }

  // ── Next Action Scoring ─────────────────────────────────────────────────────

  scoreNextActions(workspaceId: string, rawActions: Array<{
    title: string;
    description: string;
    type: ScoredAction['type'];
    urgency: number;
    impact: number;
    feasibility: number;
  }>): ScoredAction[] {
    const scored: ScoredAction[] = rawActions.map(a => {
      const score = scoreAction({ urgency: a.urgency, impact: a.impact, feasibility: a.feasibility });
      return {
        id:          `action_${crypto.randomUUID().slice(0, 8)}`,
        title:       a.title,
        description: a.description,
        type:        a.type,
        priority:    priorityFromScore(score),
        score,
        workspaceId,
        createdAt:   Date.now(),
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const existingTitles = new Set(this.state.globalActions.map(a => a.title));
    for (const action of scored) {
      if (!existingTitles.has(action.title)) {
        this.state.globalActions.push(action);
        existingTitles.add(action.title);
      }
    }

    this.state.globalActions.sort((a, b) => b.score - a.score);
    this.state.globalActions = this.state.globalActions.slice(0, 50);

    return scored;
  }

  // ── Opportunity Detector ────────────────────────────────────────────────────

  private detectOpportunities(mission: MissionState): void {
    const artifactCount = Object.keys(mission.artifacts).length;
    if (artifactCount < 2) return;

    const otherMissions = this.getAllMissions().filter(
      m => m.missionId !== mission.missionId && m.status === 'complete'
    );

    for (const other of otherMissions) {
      const sameType = other.goalType === mission.goalType;
      if (sameType && !mission.opportunities.find(o => o.sourceWorkspaceId === other.workspaceId)) {
        const opp: Opportunity = {
          id:                  `opp_${crypto.randomUUID().slice(0, 8)}`,
          title:               `Cross-mission insight: Link "${mission.goal.slice(0, 40)}" with "${other.goal.slice(0, 40)}"`,
          description:         `Both missions share patterns. Combining their intelligence could yield higher-value results.`,
          sourceWorkspaceId:   mission.workspaceId,
          relatedWorkspaceIds: [other.workspaceId],
          score:               scoreAction({ urgency: 4, impact: 8, feasibility: 7 }),
          createdAt:           Date.now(),
        };
        mission.opportunities.push(opp);
        this.state.globalOpportunities.push(opp);
      }
    }
  }

  // ── Risk Detector ───────────────────────────────────────────────────────────

  private detectRisks(mission: MissionState): void {
    const now = Date.now();
    const ageMs = now - mission.startedAt;
    if (ageMs > 30 * 60 * 1000 && mission.status === 'running') {
      const existing = mission.risks.find(r => r.title.includes('Stale'));
      if (!existing) {
        mission.risks.push({
          id:          `risk_${crypto.randomUUID().slice(0, 8)}`,
          title:       'Stale Execution Detected',
          description: `Mission "${mission.goal.slice(0, 50)}" has been running for ${Math.round(ageMs / 60000)} minutes without completion.`,
          severity:    'high',
          workspaceId: mission.workspaceId,
          createdAt:   now,
          mitigations: ['Abort and re-run mission', 'Check API rate limits', 'Reduce task complexity'],
        });
      }
    }

    for (const [taskId, content] of Object.entries(mission.artifacts)) {
      if (content.length < 100) {
        const existing = mission.risks.find(r => r.title.includes(taskId));
        if (!existing) {
          mission.risks.push({
            id:          `risk_${crypto.randomUUID().slice(0, 8)}`,
            title:       `Low-Quality Output: ${taskId}`,
            description: `Agent output for task ${taskId} is suspiciously short (${content.length} chars). May indicate a failed execution.`,
            severity:    'medium',
            workspaceId: mission.workspaceId,
            createdAt:   now,
            mitigations: ['Re-run agent with stricter prompt', 'Increase max_tokens', 'Check for API errors'],
          });
        }
      }
    }
  }

  // ── Global Reflection (Autonomous Vision Engine) ────────────────────────────

  private async globalReflection(): Promise<void> {
    console.log('[MasterBrain] 🧠 Performing Global Reflection...');
    const allMissions = this.getAllMissions();

    if (allMissions.length < 2) {
      console.log('[MasterBrain] Not enough missions for meaningful global reflection.');
      return;
    }

    const missionSummaries = allMissions.map(m => ({
      missionId: m.missionId,
      goal: m.goal,
      goalType: m.goalType,
      status: m.status,
      artifacts: Object.values(m.artifacts).map(a => a.slice(0, 200)).join('; '),
    }));

    const prompt = `
      You are the NexusOS Master Brain's Autonomous Vision Engine.
      Your task is to perform a "Global Reflection" across all active and completed missions.
      Summaries: ${JSON.stringify(missionSummaries, null, 2)}
      Respond ONLY with a JSON object:
      {
        "newOpportunities": [
          {
            "title": "...",
            "description": "...",
            "sourceWorkspaceId": "...",
            "relatedWorkspaceIds": ["..."],
            "score": 7.5
          }
        ]
      }
    `;

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: POWER_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.5,
        }),
      });

      if (!res.ok) throw new Error(`Groq API Error: ${res.status}`);
      const data = await res.json() as any;
      const { newOpportunities } = JSON.parse(data.choices[0].message.content) as { newOpportunities: Opportunity[] };

      newOpportunities.forEach(opp => {
        opp.id = `opp_${crypto.randomUUID().slice(0, 8)}`;
        this.state.globalOpportunities.push(opp);
        console.log(`[MasterBrain] ✨ New Cross-Mission Opportunity: ${opp.title}`);
      });
    } catch (err) {
      console.error('[MasterBrain] Global Reflection failed:', err);
    }
  }

  // ── Decision Loop ───────────────────────────────────────────────────────────

  startDecisionLoop(intervalMs = 60_000): void {
    if (this.loopInterval) return;
    console.log(`[MasterBrain] 🔄 Decision loop started (interval: ${intervalMs}ms)`);

    this.loopInterval = setInterval(() => {
      this.state.decisionCycle++;
      this.state.lastEvaluatedAt = Date.now();

      for (const mission of this.getActiveMissions()) {
        this.detectRisks(mission);
        this.detectOpportunities(mission);
      }

      const now = Date.now();
      this.state.globalActions = this.state.globalActions.filter(
        a => !a.expiresAt || a.expiresAt > now
      );

      console.log(
        `[MasterBrain] 🔄 Cycle #${this.state.decisionCycle} — ` +
        `${this.getActiveMissions().length} active missions, ` +
        `${this.state.globalActions.length} queued actions`
      );
    }, intervalMs);
  }

  startGlobalReflection(intervalMs = 3600_000): void {
    if (this.globalReflectionInterval) return;
    console.log(`[MasterBrain] 🌟 Global Reflection started (interval: ${intervalMs}ms)`);
    this.globalReflectionInterval = setInterval(() => this.globalReflection(), intervalMs);
  }

  stopGlobalReflection(): void {
    if (this.globalReflectionInterval) {
      clearInterval(this.globalReflectionInterval);
      this.globalReflectionInterval = null;
      console.log(`[MasterBrain] 🛑 Global Reflection stopped`);
    }
  }

  stopDecisionLoop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
      console.log(`[MasterBrain] ⏹️  Decision loop stopped`);
    }
  }

  // ── State Access ─────────────────────────────────────────────────────────────

  get globalState(): GlobalBrainState {
    return this.state;
  }

  get stats() {
    return {
      totalMissions:   this.state.missions.size,
      activeMissions:  this.getActiveMissions().length,
      queuedActions:   this.state.globalActions.length,
      opportunities:   this.state.globalOpportunities.length,
      decisionCycles:  this.state.decisionCycle,
      lastEvaluatedAt: this.state.lastEvaluatedAt,
    };
  }
}

export const masterBrain = new MasterBrainV2();
masterBrain.startDecisionLoop(60_000);
masterBrain.startGlobalReflection(3600_000);
