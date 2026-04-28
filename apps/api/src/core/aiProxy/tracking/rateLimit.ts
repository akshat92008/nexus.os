// apps/api/src/core/aiProxy/tracking/rateLimit.ts
import { getSupabase } from '../../../storage/supabaseClient.js';

export async function checkRateLimit(userId: string): Promise<void> {
  const supabase = await getSupabase();
  // Business rules: 50 requests per day, 10 per minute
  const { data, error } = await supabase.rpc('check_and_increment_ai_limit', {
    p_user_id: userId,
    p_daily_limit: 50,
    p_minute_limit: 10
  });

  if (error) throw new Error('Failed to verify rate limits.');
  
  if (!data.allowed) {
    throw new Error(data.reason); // Handled by facade to return 429 safely
  }
}
