/**
 * Nexus OS — Nexus State Store (Database-Backed)
 * 
 * Replaces the old local JSON file storage with a durable Supabase/Postgres layer.
 * This eliminates split-brain issues in distributed deployments.
 */

import type {
  AppWindowState,
  NexusInboxEntry,
  OngoingMission,
  ScheduleSnapshot,
  UserStateSnapshot,
  Workspace,
  WorkspaceSection,
  AgentType,
  TypedArtifact,
} from '@nexus-os/types';

// ── Multi-Tenant Supabase Integration ───────────────────────────────────────

let supabaseClient: any = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('[NexusStateStore] Supabase credentials missing (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (err) {
    console.error('[NexusStateStore] Supabase client initialization failed:', err);
    throw err;
  }
}

const DEFAULT_AGENT_IDS = ['researcher-standard', 'analyst-standard'];

function createDefaultUserState(userId: string): UserStateSnapshot {
  return {
    userId,
    activeWorkspaceId: null,
    workspaces: [],
    appWindows: [],
    schedules: [],
    ongoingMissions: [],
    inbox: [],
    installedAgentIds: ['researcher-standard', 'analyst-standard'],
    finances: {
      revenue: 125450,
      expenses: 45230,
      profit: 80220,
      cashPosition: 250000,
      runway: 16.7,
      revenueTrend: [45000, 52000, 48000, 61000, 55000, 67000, 72000, 85000, 92000, 105000, 115000, 125450],
      topRevenueSources: [
        { source: 'E-commerce', amount: 85000 },
        { source: 'Services', amount: 30000 },
        { source: 'Consulting', amount: 10450 },
      ],
      topExpenses: [
        { source: 'Salaries', amount: 30000 },
        { source: 'Software', amount: 10000 },
        { source: 'Marketing', amount: 5230 },
      ],
      records: [],
    },
    timeTracking: {
      activeEntry: null,
      recentEntries: [],
    },
    invoicing: {
      invoices: [],
    },
    calendar: {
      events: [],
    },
    updatedAt: Date.now(),
  };
}

function ensureWorkspaceDefaults(workspace: Workspace): Workspace {
  return {
    ...workspace,
    nextActions: workspace.nextActions ?? [],
    activityLog: workspace.activityLog ?? [],
    metadata: workspace.metadata ?? {},
  };
}

class NexusStateStore {
  // ── User State (UI/Workspace Snapshot) ───────────────────────────────────

  async getUserState(userId: string): Promise<UserStateSnapshot> {
    const client = await getSupabase();
    const { data, error } = await client
      .from('user_states')
      .select('state')
      .eq('id', userId)
      .single();

    if (error || !data?.state) {
      return createDefaultUserState(userId);
    }

    const current = data.state as UserStateSnapshot;
    return {
      ...createDefaultUserState(userId),
      ...current,
      workspaces: (current.workspaces ?? []).map(ensureWorkspaceDefaults),
      updatedAt: current.updatedAt ?? Date.now(),
    };
  }

  async syncUserState(userId: string, patch: Partial<UserStateSnapshot>): Promise<UserStateSnapshot> {
    const client = await getSupabase();
    const currentState = await this.getUserState(userId);

    const nextState: UserStateSnapshot = {
      ...currentState,
      ...patch,
      updatedAt: Date.now(),
    };

    const { error } = await client
      .from('user_states')
      .upsert({ id: userId, state: nextState, updated_at: new Date().toISOString() });

    if (error) throw new Error(`[NexusStateStore] syncUserState failed: ${error.message}`);
    return nextState;
  }

  // ── Missions & Tasks (Durable Execution) ──────────────────────────────────

  async createMission(params: {
    id?: string;
    userId: string;
    workspaceId?: string;
    goal: string;
    goalType?: string;
    dagData?: any;
  }) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('missions')
      .insert({
        id: params.id,
        user_id: params.userId,
        workspace_id: params.workspaceId,
        goal: params.goal,
        goal_type: params.goalType,
        dag_data: params.dagData,
        status: 'queued',
      })
      .select()
      .single();

    if (error) throw new Error(`[NexusStateStore] createMission failed: ${error.message}`);
    return data;
  }

  async updateMissionStatus(missionId: string, status: string, completedAt?: string) {
    const client = await getSupabase();
    const update: any = { status, updated_at: new Date().toISOString() };
    if (completedAt) update.completed_at = completedAt;

    const { error } = await client
      .from('missions')
      .update(update)
      .eq('id', missionId);

    if (error) throw new Error(`[NexusStateStore] updateMissionStatus failed: ${error.message}`);
  }

  async createTask(params: {
    id?: string;
    missionId: string;
    workspaceId?: string;
    label: string;
    agentType: AgentType;
    inputPayload: any;
    dependencies?: string[];
  }) {
    const client = await getSupabase();
    
    // 1. Create Task
    const { data: task, error: taskError } = await client
      .from('tasks')
      .insert({
        id: params.id,
        mission_id: params.missionId,
        workspace_id: params.workspaceId,
        label: params.label,
        agent_type: params.agentType,
        input_payload: params.inputPayload,
        status: 'pending',
      })
      .select()
      .single();

    if (taskError) throw new Error(`[NexusStateStore] createTask failed: ${taskError.message}`);

    // 2. Create Dependencies
    if (params.dependencies && params.dependencies.length > 0) {
      const deps = params.dependencies.map(depId => ({
        task_id: task.id,
        depends_on_task_id: depId,
      }));
      const { error: depError } = await client.from('task_dependencies').insert(deps);
      if (depError) throw new Error(`[NexusStateStore] createTask dependencies failed: ${depError.message}`);
    }

    return task;
  }

  async updateTaskStatus(taskId: string, status: string, result?: { artifactId?: string; tokensUsed?: number; error?: string }) {
    const client = await getSupabase();
    const update: any = { status };
    
    if (status === 'running') update.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') update.completed_at = new Date().toISOString();
    if (result?.artifactId) update.output_artifact_id = result.artifactId;
    if (result?.tokensUsed) update.tokens_used = result.tokensUsed;
    if (result?.error) update.error = result.error;

    const { error } = await client
      .from('tasks')
      .update(update)
      .eq('id', taskId);

    if (error) throw new Error(`[NexusStateStore] updateTaskStatus failed: ${error.message}`);
  }

  async storeArtifact(params: {
    missionId: string;
    taskId: string;
    type: string;
    content: TypedArtifact;
  }) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('artifacts')
      .insert({
        mission_id: params.missionId,
        task_id: params.taskId,
        type: params.type,
        content: params.content,
      })
      .select()
      .single();

    if (error) throw new Error(`[NexusStateStore] storeArtifact failed: ${error.message}`);
    return data;
  }

  async fetchArtifactsByContext(missionId: string, taskIds: string[]) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('artifacts')
      .select('*')
      .eq('mission_id', missionId)
      .in('task_id', taskIds);

    if (error) throw new Error(`[NexusStateStore] fetchArtifactsByContext failed: ${error.message}`);
    return data;
  }

  async getTask(taskId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*, task_dependencies(depends_on_task_id)')
      .eq('id', taskId)
      .single();

    if (error) throw new Error(`[NexusStateStore] getTask failed: ${error.message}`);
    return data;
  }

  async getMissionTasks(missionId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*, task_dependencies(depends_on_task_id)')
      .eq('mission_id', missionId);

    if (error) throw new Error(`[NexusStateStore] getMissionTasks failed: ${error.message}`);
    return data;
  }

  // ── Schedules ─────────────────────────────────────────────────────────────

  async upsertSchedule(userId: string, schedule: ScheduleSnapshot): Promise<UserStateSnapshot> {
    const client = await getSupabase();
    
    // 1. Update schedules table for periodic job scanning
    await client
      .from('schedules')
      .upsert({
        id: schedule.scheduleId,
        workspace_id: schedule.workspaceId,
        cron_expression: schedule.cron,
        status: 'active',
        updated_at: new Date().toISOString()
      });

    // 2. Update user state snapshot
    return this.mutateUserState(userId, (state) => {
      const idx = state.schedules.findIndex(s => s.scheduleId === schedule.scheduleId);
      if (idx >= 0) state.schedules[idx] = schedule;
      else state.schedules.unshift(schedule);
    });
  }

  async listAllSchedules() {
    const client = await getSupabase();
    const { data, error } = await client.from('schedules').select('*');
    if (error) throw new Error(`[NexusStateStore] listAllSchedules failed: ${error.message}`);
    return data;
  }

  // ── Helper: Mutate User State ───────────────────────────────────────────

  private async mutateUserState(userId: string, mutator: (state: UserStateSnapshot) => void): Promise<UserStateSnapshot> {
    const state = await this.getUserState(userId);
    mutator(state);
    return this.syncUserState(userId, state);
  }

  // ── Compatibility Layer (to avoid breaking existing code immediately) ─────

  async upsertWorkspace(userId: string, workspace: Workspace) {
    return this.mutateUserState(userId, (state) => {
      const idx = state.workspaces.findIndex(w => w.id === workspace.id);
      if (idx >= 0) state.workspaces[idx] = ensureWorkspaceDefaults(workspace);
      else state.workspaces.unshift(ensureWorkspaceDefaults(workspace));
    });
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    return this.mutateUserState(userId, (state) => {
      state.workspaces = state.workspaces.filter(w => w.id !== workspaceId);
      state.appWindows = state.appWindows.filter(w => w.workspaceId !== workspaceId);
      state.schedules = state.schedules.filter(s => s.workspaceId !== workspaceId);
      state.ongoingMissions = state.ongoingMissions.filter(m => m.workspaceId !== workspaceId);
      if (state.activeWorkspaceId === workspaceId) {
        state.activeWorkspaceId = state.appWindows[0]?.workspaceId ?? state.workspaces[0]?.id ?? null;
      }
    });
  }
}

export const nexusStateStore = new NexusStateStore();
