-- Migration: Row Level Security & Hardened Logic
-- Target Table: user_credits

-- 1. Enable RLS on the table
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean start
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
DROP POLICY IF EXISTS "Only service role can update credits" ON user_credits;

-- 3. Policy: Authenticated users can see their own balance
CREATE POLICY "Users can view their own credits"
ON user_credits
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- 4. Policy: Restrict modifications to the service_role (authorized backend)
-- This blocks malicious users from calling .update() on their credits from the browser.
CREATE POLICY "Only service role can update credits"
ON user_credits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Reinforce safe credit deduction function
-- This replaces the existing implementation to ensure the atomic guard is present.
CREATE OR REPLACE FUNCTION deduct_user_credits(p_user_id TEXT, p_amount NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- Row-level lock (FOR UPDATE)
  SELECT balance_usd INTO current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE user_credits
  SET 
    balance_usd = balance_usd - p_amount,
    updated_at = now()
  WHERE user_id = p_user_id
    AND balance_usd >= p_amount; -- Final atomic guard

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
