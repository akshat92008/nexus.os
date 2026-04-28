// apps/api/src/core/aiProxy/tracking/usage.ts
import { getSupabase } from '../../../storage/supabaseClient.js';
import { MODEL_PRICING } from '../config/models.js';
import { logger } from '../../../logger.js';

export function calculateCost(
  modelIdentifier: string, 
  promptTokens: number, 
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[modelIdentifier];
  if (!pricing) return 0;
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

export async function logUsage(
  userId: string,
  taskType: string,
  modelUsed: string,
  promptTokens: number,
  completionTokens: number,
  costUsd: number
): Promise<void> {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from('ai_usage_logs').insert({
        user_id: userId,
        task_type: taskType,
        model_used: modelUsed,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        created_at: new Date().toISOString(),
      });
      
      if (error) throw error;
      return; // Success
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        // Log to console as last resort so spend is at least in server logs
        logger.error({
          userId, taskType, modelUsed, costUsd, err: err.message
        }, '[UsageLog] CRITICAL: Failed to record AI cost after 3 attempts. Revenue data gap!');
        return; // Don't throw — usage logging failure must never break the user's action
      }
      await new Promise(r => setTimeout(r, attempt * 500)); // exponential backoff
    }
  }
}

// Legacy function - kept for backward compatibility with retry logic
export async function logUsageAndCalculateCost(params: {
  userId: string;
  taskType: string;
  modelIdentifier: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<number> {
  const costUsd = calculateCost(params.modelIdentifier, params.promptTokens, params.completionTokens);
  
  // Don't await — usage logging should not block the response, but still use retry logic
  logUsage(params.userId, params.taskType, params.modelIdentifier, params.promptTokens, params.completionTokens, costUsd)
    .catch(err => logger.error({ err }, '[logUsageAndCalculateCost] Usage logging failed'));
  
  return costUsd;
}

export async function getUserAICost(userId: string): Promise<number> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('cost_usd')
    .eq('user_id', userId);

  if (error) throw error;
  return (data as any[]).reduce((sum, row) => sum + Number(row.cost_usd), 0);
}
