// apps/api/src/ledger.ts
// Credit ledger for agent transaction tracking.
// Tracks AI credit usage per user per agent task.

import { getSupabase } from './storage/supabaseClient.js';
import { logger } from './logger.js';

export interface LedgerTransaction {
  userId: string;
  agentId: string;
  taskName: string;
  taskType: string;
  creditsUsed: number;
  sseStream?: { write: (data: string) => void };
}

class Ledger {
  /**
   * Records a credit transaction for an agent task.
   * Calls the `deduct_user_credits` Supabase RPC.
   * Emits an SSE event if a stream is provided.
   */
  async recordTransaction(
    userId: string,
    agentId: string,
    taskName: string,
    taskType: string,
    creditsUsed: number,
    sseStream?: { write: (data: string) => void }
  ): Promise<boolean> {
    try {
      const supabase = await getSupabase();

      const { data, error } = await supabase.rpc('deduct_user_credits', {
        p_user_id:     userId,
        p_credits:     creditsUsed,
        p_description: `${taskType}: ${taskName} (agent: ${agentId})`,
      });

      if (error) throw error;

      if (data === false) {
        console.warn(`[Ledger] Insufficient credits for user ${userId} — task: ${taskName}`);
        sseStream?.write(
          `data: ${JSON.stringify({ type: 'insufficient_credits', userId, creditsUsed })}\n\n`
        );
        return false;
      }

      // Log to ai_usage_logs for cost tracking
      await supabase.from('ai_usage_logs').insert({
        user_id:           userId,
        task_type:         taskType,
        model_used:        `agent:${agentId}`,
        prompt_tokens:     creditsUsed,
        completion_tokens: 0,
        cost_usd:          creditsUsed * 0.0001, // $0.0001 per credit
      });

      sseStream?.write(
        `data: ${JSON.stringify({ type: 'credits_deducted', userId, creditsUsed })}\n\n`
      );

      return true;
    } catch (err: any) {
      logger.error({ err, userId, agentId, taskName }, '[Ledger] Failed to record transaction');
      return false;
    }
  }

  /**
   * Returns the current credit balance for a user.
   */
  async getBalance(userId: string): Promise<number> {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error || !data) return 0;
      return data.balance ?? 0;
    } catch {
      return 0;
    }
  }
}

export const ledger = new Ledger();
