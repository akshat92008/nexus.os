-- Migration 005: Add credit top-up function (called by Stripe webhook)
CREATE OR REPLACE FUNCTION add_user_credits(p_user_id TEXT, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance_usd, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance_usd = user_credits.balance_usd + p_amount,
    updated_at  = now();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
