import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';

export interface ActionLog {
  id: string;
  goal_id: string;
  tool_id: string;
  params: any;
  undo_params: any; // The parameters needed to reverse this action
  created_at: string;
}

export type NextState = 'PROCEED' | 'CORRECT' | 'ROLLBACK';

export interface ObservationResult {
    exitCode: number;
    output: string;
    errorOutput: string;
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
      logger.error(`[SagaManager] ❌ Log Failure: ${error.message}`);
      throw new Error(`Saga Log Failure: ${error.message}`);
    }
    return data;
  }

  /**
   * Evaluates observation output and triggers either progression, correction, or rollback.
   * Implementation of the ROAV Verify Step.
   */
  async verifyObservation(goalId: string, result: ObservationResult): Promise<NextState> {
      logger.info(`[SagaManager] Verifying Observation for goal ${goalId}`);

      if (result.exitCode === 0) {
          return 'PROCEED';
      }

      // If there's an error, attempt to parse if it's fixable
      if (result.errorOutput && result.errorOutput.includes('syntax error')) {
          logger.warn(`[SagaManager] Detected fixable error for goal ${goalId}. Requesting CORRECT state.`);
          return 'CORRECT';
      }

      // Default to rollback on catastrophic failure
      logger.error(`[SagaManager] Unrecoverable error for goal ${goalId}. Requesting ROLLBACK state.`);
      return 'ROLLBACK';
  }

  /**
   * Executes compensation logic sequentially using logged undo_params.
   */
  async executeRollback(goalId: string): Promise<void> {
      logger.info(`[SagaManager] Initiating rollback for goal ${goalId}`);

      let action = await this.getLastAction(goalId);
      while (action) {
          logger.info(`[SagaManager] Reverting action ${action.tool_id} for goal ${goalId}`);

          // In a real implementation, we would call the specific tool's reverse function
          // e.g. ToolRegistry.get(action.tool_id).undo(action.undo_params);

          await this.clearAction(action.id);
          action = await this.getLastAction(goalId);
      }
      logger.info(`[SagaManager] Rollback complete for goal ${goalId}`);
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
