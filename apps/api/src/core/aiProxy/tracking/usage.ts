// apps/api/src/core/aiProxy/tracking/usage.ts
import { getSupabase } from '../../../storage/supabaseClient.js';
import { MODEL_PRICING } from '../config/models.js';

export async function logUsageAndCalculateCost(params: {
  userId: string;
  taskType: string;
  modelIdentifier: string; // e.g., 'groq:llama3-8b-8192'
  promptTokens: number;
  completionTokens: number;
}): Promise<number> {
  
  const pricing = MODEL_PRICING[params.modelIdentifier] || { input: 0.5, output: 0.5 }; // Fallback
  
  const costUsd = 
    (params.promptTokens * (pricing.input / 1_000_000)) + 
    (params.completionTokens * (pricing.output / 1_000_000));

  // Non-blocking DB insert (fire and forget to keep latency low)
  getSupabase().then(supabase => {
    supabase.from('ai_usage_logs').insert({
      user_id: params.userId,
      task_type: params.taskType,
      model_used: params.modelIdentifier,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      cost_usd: costUsd
    }).then(({ error }: { error: any }) => {
      if (error) console.error('Failed to log AI usage:', error);
    });
  });

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
