-- FIX: Add Row Level Security to ai_usage_logs (was missing from original migration)
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_owner ON ai_usage_logs;
CREATE POLICY usage_owner ON ai_usage_logs
  FOR ALL 
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- Also add RLS to ai_daily_limits (same oversight)
ALTER TABLE ai_daily_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS limits_owner ON ai_daily_limits;
CREATE POLICY limits_owner ON ai_daily_limits
  FOR ALL 
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);
