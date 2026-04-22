import { getSupabase } from '../supabaseClient.js';
import { withRetry } from '../../resilience.js';
import type { PersistenceProvider } from '../persistenceProvider.js';
import type { 
  AgentType, 
  TypedArtifact, 
  ScheduleSnapshot, 
  UserStateSnapshot 
} from '@nexus-os/types';

export class SupabasePersistenceProvider implements PersistenceProvider {
  async createMission(params: any) {
    const client = await getSupabase();
    
    if (params.tasks && params.tasks.length > 0) {
      const { data, error } = await client.rpc('create_mission_atomic', {
        p_id: params.id,
        p_user_id: params.userId,
        p_workspace_id: params.workspaceId,
        p_goal: params.goal,
        p_goal_type: params.goalType,
        p_dag_data: params.dagData,
        p_tasks: params.tasks
      });
      if (error) throw new Error(`[SupabaseProvider] create_mission_atomic failed: ${error.message}`);
      return data;
    }

    const { data, error } = await client
      .from('nexus_missions')
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

    if (error) throw new Error(`[SupabaseProvider] createMission failed: ${error.message}`);
    return data;
  }

  async getMissionById(missionId: string) {
    const client = await getSupabase();
    return withRetry(async () => {
      const { data, error } = await client
        .from('nexus_missions')
        .select('*')
        .eq('id', missionId)
        .single();
      if (error) throw new Error(`[SupabaseProvider] getMissionById failed: ${error.message}`);
      return data;
    }, `DB:getMission:${missionId}`);
  }

  async updateMissionStatus(missionId: string, status: string, completedAt?: string) {
    const client = await getSupabase();
    const update: any = { status, updated_at: new Date().toISOString() };
    if (completedAt) update.completed_at = completedAt;

    const { error } = await client
      .from('nexus_missions')
      .update(update)
      .eq('id', missionId);

    if (error) throw new Error(`[SupabaseProvider] updateMissionStatus failed: ${error.message}`);
  }

  async getActiveMissions() {
    const client = await getSupabase();
    const { data, error } = await client
      .from('nexus_missions')
      .select('id')
      .in('status', ['queued', 'running']);
    if (error) throw new Error(`[SupabaseProvider] getActiveMissions failed: ${error.message}`);
    return data;
  }

  async createTask(params: any) {
    const client = await getSupabase();
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

    if (taskError) throw new Error(`[SupabaseProvider] createTask failed: ${taskError.message}`);

    if (params.dependencies && params.dependencies.length > 0) {
      const deps = params.dependencies.map((depId: string) => ({
        task_id: task.id,
        depends_on_task_id: depId,
      }));
      const { error: depError } = await client.from('task_dependencies').insert(deps);
      if (depError) throw new Error(`[SupabaseProvider] createTask dependencies failed: ${depError.message}`);
    }

    return task;
  }

  async batchCreateTasks(tasks: any[]) {
    const client = await getSupabase();
    const { data: createdTasks, error: taskError } = await client
      .from('tasks')
      .insert(tasks.map(t => ({
        id: t.id,
        mission_id: t.missionId,
        workspace_id: t.workspaceId,
        label: t.label,
        agent_type: t.agentType,
        input_payload: t.inputPayload,
        status: 'pending',
        parent_task_id: t.parentTaskId,
        map_reduce_role: t.mapReduceRole
      })))
      .select();

    if (taskError) throw new Error(`[SupabaseProvider] batchCreateTasks failed: ${taskError.message}`);

    const allDeps: any[] = [];
    tasks.forEach(t => {
      if (t.dependencies && t.dependencies.length > 0) {
        t.dependencies.forEach((depId: string) => {
          allDeps.push({
            task_id: t.id,
            depends_on_task_id: depId,
          });
        });
      }
    });

    if (allDeps.length > 0) {
      const { error: depError } = await client.from('task_dependencies').insert(allDeps);
      if (depError) throw new Error(`[SupabaseProvider] batchCreateTasks dependencies failed: ${depError.message}`);
    }

    return createdTasks;
  }

  async getTask(taskId: string) {
    const client = await getSupabase();
    return withRetry(async () => {
      const { data, error } = await client
        .from('tasks')
        .select('*, task_dependencies(depends_on_task_id)')
        .eq('id', taskId)
        .single();
      if (error) throw new Error(`[SupabaseProvider] getTask failed: ${error.message}`);
      return data;
    }, `DB:getTask:${taskId}`);
  }

  async getMissionTasks(missionId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*, task_dependencies(depends_on_task_id)')
      .eq('mission_id', missionId);
    if (error) throw new Error(`[SupabaseProvider] getMissionTasks failed: ${error.message}`);
    return data;
  }

  async getTaskStatuses(taskIds: string[]) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('id, status')
      .in('id', taskIds);
    if (error) throw new Error(`[SupabaseProvider] getTaskStatuses failed: ${error.message}`);
    return data;
  }

  async getDependentTasks(taskId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('task_dependencies')
      .select('task_id, tasks!inner(*, task_dependencies(depends_on_task_id))')
      .eq('depends_on_task_id', taskId);
    if (error) throw new Error(`[SupabaseProvider] getDependentTasks failed: ${error.message}`);
    return data.map((d: any) => d.tasks);
  }

  async updateTaskStatus(taskId: string, status: string, result?: any) {
    const client = await getSupabase();
    const update: any = { status };
    if (status === 'running') update.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') update.completed_at = new Date().toISOString();
    if (result?.artifactId) update.output_artifact_id = result.artifactId;
    if (result?.tokensUsed) update.tokens_used = result.tokensUsed;
    if (result?.error) update.error = result.error;

    const query = client.from('tasks').update(update).eq('id', taskId);
    if (status === 'queued') query.eq('status', 'pending');
    else if (status === 'running') query.in('status', ['queued', 'running']);

    const { data, error } = await query.select('id');
    if (error) throw new Error(`[SupabaseProvider] updateTaskStatus failed: ${error.message}`);
    return data && data.length > 0;
  }

  async updateTaskCheckpoint(taskId: string, checkpoint: any) {
    const client = await getSupabase();
    const { error } = await client
      .from('tasks')
      .update({ 
        input_payload: { 
          _checkpoint: { ...checkpoint, updatedAt: new Date().toISOString() }
        }
      })
      .eq('id', taskId);
    if (error) throw new Error(`[SupabaseProvider] updateTaskCheckpoint failed: ${error.message}`);
  }

  async completeTaskAtomic(params: any) {
    const client = await getSupabase();
    const { data, error } = await client.rpc('complete_task_atomic', {
      p_mission_id: params.missionId,
      p_task_id: params.taskId,
      p_type: params.type,
      p_content: params.content,
      p_tokens_used: params.tokensUsed,
      p_completed_at: new Date().toISOString()
    });
    if (error) throw new Error(`[SupabaseProvider] complete_task_atomic failed: ${error.message}`);
    return data;
  }

  async storeArtifact(params: any) {
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
    if (error) throw new Error(`[SupabaseProvider] storeArtifact failed: ${error.message}`);
    return data;
  }

  async fetchArtifactsByContext(missionId: string, taskIds: string[]) {
    const client = await getSupabase();
    return withRetry(async () => {
      const { data, error } = await client
        .from('artifacts')
        .select('*')
        .eq('mission_id', missionId)
        .in('task_id', taskIds);
      if (error) throw new Error(`[SupabaseProvider] fetchArtifactsByContext failed: ${error.message}`);
      return data;
    }, `DB:fetchArtByCtx:${missionId}`);
  }

  async getUserState(userId: string) {
    const client = await getSupabase();
    return withRetry(async () => {
      const { data, error } = await client
        .from('nexus_state')
        .select('state')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.state || null;
    }, `DB:getUserState:${userId}`);
  }

  async upsertUserState(userId: string, state: UserStateSnapshot) {
    const client = await getSupabase();
    await withRetry(async () => {
      const { error } = await client
        .from('nexus_state')
        .upsert({ id: userId, state, updated_at: new Date().toISOString() });
      if (error) throw error;
    }, `DB:syncUserState:${userId}`);
  }

  async upsertSchedule(userId: string, schedule: ScheduleSnapshot) {
    const client = await getSupabase();
    await client
      .from('schedules')
      .upsert({
        id: schedule.scheduleId,
        workspace_id: schedule.workspaceId,
        cron_expression: schedule.cron,
        status: 'active',
        updated_at: new Date().toISOString()
      });
  }

  async listAllSchedules() {
    const client = await getSupabase();
    const { data, error } = await client.from('schedules').select('*');
    if (error) throw new Error(`[SupabaseProvider] listAllSchedules failed: ${error.message}`);
    return data;
  }
}
