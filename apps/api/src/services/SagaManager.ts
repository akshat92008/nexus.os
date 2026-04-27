import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';

export interface ActionLog {
  id: string;
  goal_id: string;
  tool_id: string;
  params: any;
  undo_params: any; // The parameters needed to reverse this action
  created_at: string;
  user_id?: string;
  status?: string;
  approved_at?: string;
  rejected_at?: string;
}

export class SagaManager {
  private localActions = new Map<string, ActionLog[]>();

  /**
   * Logs an action before it is executed.
   */
  async logAction(goalId: string, toolId: string, params: any, undoParams: any) {
    const action: ActionLog = {
      id: randomUUID(),
      goal_id: goalId,
      tool_id: toolId,
      params,
      undo_params: undoParams,
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('action_logs')
        .insert([{
          goal_id: goalId,
          tool_id: toolId,
          params,
          undo_params: undoParams,
          created_at: action.created_at,
        }]);

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      logger.warn({ err: error.message, goalId, toolId }, '[SagaManager] Falling back to in-memory saga log');
      const actions = this.localActions.get(goalId) ?? [];
      actions.push(action);
      this.localActions.set(goalId, actions);
      return action;
    }
  }

  /**
   * Retrieves the last action for a specific goal to perform a rollback.
   */
  async getLastAction(goalId: string): Promise<ActionLog | null> {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;
      return data as ActionLog;
    } catch {
      const actions = this.localActions.get(goalId) ?? [];
      return actions[actions.length - 1] ?? null;
    }
  }

  /**
   * Removes the log after a successful rollback.
   */
  async clearAction(actionId: string) {
    try {
      const supabase = await getSupabase();
      await supabase.from('action_logs').delete().eq('id', actionId);
    } catch {
      for (const [goalId, actions] of this.localActions.entries()) {
        const filtered = actions.filter((action) => action.id !== actionId);
        if (filtered.length !== actions.length) {
          this.localActions.set(goalId, filtered);
        }
      }
    }
  }

  /**
   * Get pending approval actions for a user.
   */
  async getPendingActions(userId: string): Promise<ActionLog[]> {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as ActionLog[];
    } catch {
      return Array.from(this.localActions.values())
        .flat()
        .filter((action) => action.user_id === userId && action.status !== 'approved' && action.status !== 'rejected');
    }
  }

  /**
   * Mark an action as approved.
   */
  async approveAction(goalId: string, actionId: string): Promise<void> {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from('action_logs')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', actionId)
        .eq('goal_id', goalId);
      if (error) throw new Error(error.message);
    } catch {
      const actions = this.localActions.get(goalId) ?? [];
      const action = actions.find((entry) => entry.id === actionId);
      if (action) {
        action.status = 'approved';
        action.approved_at = new Date().toISOString();
      }
    }
  }

  /**
   * Mark an action as rejected.
   */
  async rejectAction(goalId: string, actionId: string): Promise<void> {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from('action_logs')
        .update({ status: 'rejected', rejected_at: new Date().toISOString() })
        .eq('id', actionId)
        .eq('goal_id', goalId);
      if (error) throw new Error(error.message);
    } catch {
      const actions = this.localActions.get(goalId) ?? [];
      const action = actions.find((entry) => entry.id === actionId);
      if (action) {
        action.status = 'rejected';
        action.rejected_at = new Date().toISOString();
      }
    }
  }
}

export const sagaManager = new SagaManager();
