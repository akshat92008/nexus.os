import { getSupabase } from '../storage/supabaseClient.js';

export interface ActionLog {
  id: string;
  goal_id: string;
  tool_id: string;
  params: any;
  undo_params: any; // The parameters needed to reverse this action
  created_at: string;
}

export class SagaManager {
  /**
   * Logs an action before it is executed.
   */
  async logAction(goalId: string, toolId: string, params: any, undoParams: any) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('action_logs')
      .insert([{ 
        goal_id: goalId, 
        tool_id: toolId, 
        params: params, 
        undo_params: undoParams,
        created_at: new Date().toISOString() 
      }]);
    
    if (error) {
      console.error(`[SagaManager] ❌ Log Failure: ${error.message}`);
      throw new Error(`Saga Log Failure: ${error.message}`);
    }
    return data;
  }

  /**
   * Retrieves the last action for a specific goal to perform a rollback.
   */
  async getLastAction(goalId: string): Promise<ActionLog | null> {
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
  }

  /**
   * Removes the log after a successful rollback.
   */
  async clearAction(actionId: string) {
    const supabase = await getSupabase();
    await supabase.from('action_logs').delete().eq('id', actionId);
  }
}

export const sagaManager = new SagaManager();
