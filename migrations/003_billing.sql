-- Migration: Billing System with Negative Balance Protection
-- Run with: psql -U postgres -d postgres -f migrations/003_billing.sql

CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  balance_usd NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- Safe credit deduction function with negative balance guard
-- Returns TRUE if deduction succeeded, FALSE if insufficient funds
CREATE OR REPLACE FUNCTION deduct_user_credits(p_user_id TEXT, p_amount NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- First check current balance
  SELECT balance_usd INTO current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If user doesn't exist or has insufficient balance, return failure
  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Perform safe deduction only when balance is sufficient
  UPDATE user_credits
  SET
    balance_usd = balance_usd - p_amount,
    updated_at = now()
  WHERE
    user_id = p_user_id
    AND balance_usd >= p_amount; -- Atomic guard condition

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;