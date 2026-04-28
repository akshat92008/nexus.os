-- Usage Logs Table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    task_type TEXT NOT NULL,
    model_used TEXT NOT NULL,
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    cost_usd NUMERIC(10, 6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast cost aggregation
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at);

-- Daily Limits Table
CREATE TABLE IF NOT EXISTS ai_daily_limits (
    user_id UUID PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_count INT DEFAULT 0,
    minute_count INT DEFAULT 0,
    last_request_time TIMESTAMPTZ DEFAULT now()
);

-- Atomic Rate Limiting RPC
CREATE OR REPLACE FUNCTION check_and_increment_ai_limit(
    p_user_id UUID, 
    p_daily_limit INT, 
    p_minute_limit INT
) RETURNS JSONB AS $$
DECLARE
    v_record ai_daily_limits%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Lock the row for this user to prevent concurrent race conditions
    SELECT * INTO v_record FROM ai_daily_limits WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        -- First time user
        INSERT INTO ai_daily_limits (user_id, date, daily_count, minute_count, last_request_time)
        VALUES (p_user_id, v_today, 1, 1, v_now);
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Reset counters if it's a new day
    IF v_record.date <> v_today THEN
        UPDATE ai_daily_limits 
        SET date = v_today, daily_count = 1, minute_count = 1, last_request_time = v_now
        WHERE user_id = p_user_id;
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Check Daily Limit
    IF v_record.daily_count >= p_daily_limit THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Daily AI limit reached. Upgrade your plan.');
    END IF;

    -- Reset minute counter if > 60 seconds have passed
    IF EXTRACT(EPOCH FROM (v_now - v_record.last_request_time)) > 60 THEN
        UPDATE ai_daily_limits 
        SET daily_count = daily_count + 1, minute_count = 1, last_request_time = v_now
        WHERE user_id = p_user_id;
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Check Minute Limit
    IF v_record.minute_count >= p_minute_limit THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Too many requests per minute. Please slow down.');
    END IF;

    -- Increment limits
    UPDATE ai_daily_limits 
    SET daily_count = daily_count + 1, minute_count = minute_count + 1, last_request_time = v_now
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql;
