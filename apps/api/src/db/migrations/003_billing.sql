-- Table: user_credits
CREATE TABLE IF NOT EXISTS "user_credits" (
    user_id      TEXT        PRIMARY KEY,
    balance_usd  NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    tier         TEXT        NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own balance" ON user_credits
    FOR SELECT USING (user_id = auth.uid()::text);

-- Initial credits for new users (Optional: give $1.00 free credit)
-- This can be handled by a trigger or at application level.

-- RPC: Deduct credits safely (Ticket 1 Hardening)
CREATE OR REPLACE FUNCTION deduct_user_credits(p_user_id TEXT, p_amount NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    UPDATE user_credits
    SET balance_usd = balance_usd - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
      AND balance_usd >= p_amount; -- Atomic balance check

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RETURN v_rows_affected > 0;
END;
$$ LANGUAGE plpgsql;
