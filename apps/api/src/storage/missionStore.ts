/**
 * Nexus OS — Mission & Task Store
 *
 * Handles the durable persistence of complex multi-agent missions,
 * individual tasks, and the resulting artifacts.
 */

import type { AgentType, TypedArtifact, ScheduleSnapshot } from '@nexus-os/types';
import { getSupabase } from './supabaseClient.js';
import { userStateStore } from './userStateStore.js';

export class MissionStore {
  async createMission(params: {
    id?: string;
    userId: string;
    workspaceId?: string;
    goal: string;
    goalType?: string;
    dagData?: any;
    tasks?: any[];
  }) {
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
      if (error) throw new Error(`[MissionStore] create_mission_atomic failed: ${error.message}`);
      return data;
    }

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

    if (error) throw new Error(`[MissionStore] createMission failed: ${error.message}`);
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

    if (error) throw new Error(`[MissionStore] updateMissionStatus failed: ${error.message}`);
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

    if (taskError) throw new Error(`[MissionStore] createTask failed: ${taskError.message}`);

    // 2. Create Dependencies
    if (params.dependencies && params.dependencies.length > 0) {
      const deps = params.dependencies.map(depId => ({
        task_id: task.id,
        depends_on_task_id: depId,
      }));
      const { error: depError } = await client.from('task_dependencies').insert(deps);
      if (depError) throw new Error(`[MissionStore] createTask dependencies failed: ${depError.message}`);
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

    // 🚨 FIX 1: DAG RACE CONDITION (DOUBLE ENQUEUE)
    // Use atomic status check as a distributed lock
    const query = client
      .from('tasks')
      .update(update)
      .eq('id', taskId);

    if (status === 'queued') {
      query.eq('status', 'pending');
    } else if (status === 'running') {
      // 🚨 HARDEN 1 & 3: Allow claiming from 'queued' or 'running' (for retries)
      query.in('status', ['queued', 'running']);
    }

    const { data, error } = await query.select('id');

    if (error) throw new Error(`[MissionStore] updateTaskStatus failed: ${error.message}`);
    
    // Return boolean indicating if update actually happened
    return data && data.length > 0;
  }

  async completeTaskAtomics(params: {
    missionId: string;
    taskId: string;
    type: string;
    content: TypedArtifact;
    tokensUsed: number;
  }) {
    const client = await getSupabase();
    
    // 🚨 FIX 3: TRUE ATOMIC COMPLETION (Transaction-like RPC)
    const { data, error } = await client.rpc('complete_task_atomic', {
      p_mission_id: params.missionId,
      p_task_id: params.taskId,
      p_type: params.type,
      p_content: params.content,
      p_tokens_used: params.tokensUsed,
      p_completed_at: new Date().toISOString()
    });

    if (error) {
      // Fallback only if RPC is missing or fatal error occurs
      console.error('[MissionStore] atomic completion failed, falling back to sequential...', error);
      const artifact = await this.storeArtifact(params);
      const updated = await this.updateTaskStatus(params.taskId, 'completed', {
        artifactId: artifact.id,
        tokensUsed: params.tokensUsed
      });
      if (!updated) throw new Error(`[MissionStore] atomic completion failed: task ${params.taskId} already completed or not running`);
      return artifact;
    }
    return data;
  }

  async updateTaskCheckpoint(taskId: string, checkpoint: { 
    step: string; 
    data?: any; 
    tokensUsed?: number;
  }) {
    const client = await getSupabase();
    const { error } = await client
      .from('tasks')
      .update({ 
        input_payload: { 
          _checkpoint: {
            ...checkpoint,
            updatedAt: new Date().toISOString()
          }
        }
      })
      .eq('id', taskId);

    if (error) throw new Error(`[MissionStore] updateTaskCheckpoint failed: ${error.message}`);
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

    if (error) throw new Error(`[MissionStore] storeArtifact failed: ${error.message}`);
    return data;
  }

  async fetchArtifactsByContext(missionId: string, taskIds: string[]) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('artifacts')
      .select('*')
      .eq('mission_id', missionId)
      .in('task_id', taskIds);

    if (error) throw new Error(`[MissionStore] fetchArtifactsByContext failed: ${error.message}`);
    return data;
  }

  async getTask(taskId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*, task_dependencies(depends_on_task_id)')
      .eq('id', taskId)
      .single();

    if (error) throw new Error(`[MissionStore] getTask failed: ${error.message}`);
    return data;
  }

  async getMissionById(missionId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .single();

    if (error) throw new Error(`[MissionStore] getMissionById failed: ${error.message}`);
    return data;
  }

  async getMissionTasks(missionId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('tasks')
      .select('*, task_dependencies(depends_on_task_id)')
      .eq('mission_id', missionId);

    if (error) throw new Error(`[MissionStore] getMissionTasks failed: ${error.message}`);
    return data;
  }

  // 🚨 FIX 4: Optimized dependent task fetching
  async getDependentTasks(taskId: string) {
    const client = await getSupabase();
    const { data, error } = await client
      .from('task_dependencies')
      .select('task_id, tasks!inner(*, task_dependencies(depends_on_task_id))')
      .eq('depends_on_task_id', taskId);

    if (error) throw new Error(`[MissionStore] getDependentTasks failed: ${error.message}`);
    return data.map((d: any) => d.tasks);
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

    return userStateStore.mutateUserState(userId, (state) => {
      const idx = state.schedules.findIndex(s => s.scheduleId === schedule.scheduleId);
      if (idx >= 0) state.schedules[idx] = schedule;
      else state.schedules.unshift(schedule);
    });
  }

  async listAllSchedules() {
    const client = await getSupabase();
    const { data, error } = await client.from('schedules').select('*');
    if (error) throw new Error(`[MissionStore] listAllSchedules failed: ${error.message}`);
    return data;
  }
}

export const missionStore = new MissionStore();
