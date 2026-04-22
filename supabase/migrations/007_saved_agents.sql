CREATE TABLE IF NOT EXISTS public.saved_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Ties the agent to the specific CEO
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'manual', 'cron', or 'event'
    cron_expression TEXT, -- e.g., '0 9 * * 1' for Monday 9AM
    dag_payload JSONB NOT NULL, -- The compiled WorkflowNodes from the Agent Factory
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Secure it with RLS
ALTER TABLE public.saved_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own agents" 
ON public.saved_agents FOR ALL 
USING (auth.uid()::text = user_id);
