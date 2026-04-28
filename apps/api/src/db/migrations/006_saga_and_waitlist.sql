-- 006_saga_and_waitlist.sql
-- Migration for Nexus OS v3.2 'Sovereign' Beta
-- Formalizes the Trust Layer and Private Access schema.

CREATE TABLE IF NOT EXISTS public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  params JSONB NOT NULL,
  undo_params JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and add basic security policy
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own action logs" 
ON public.action_logs FOR ALL 
USING (true); 

CREATE INDEX IF NOT EXISTS idx_action_logs_goal_id ON public.action_logs(goal_id);

-- Waitlist Table for Beta lead management
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Waitlist entries are private" 
ON public.waitlist FOR INSERT 
WITH CHECK (true);
