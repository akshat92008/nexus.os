-- Nexus OS v1 Production Schema
-- User integrations (OAuth tokens, encrypted)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_type TEXT NOT NULL,  -- 'gmail', 'calendar', 'hubspot', 'github', 'notion', 'slack'
  access_token TEXT,  -- encrypted with pgcrypto
  refresh_token TEXT, -- encrypted
  token_expires_at TIMESTAMPTZ,
  account_email TEXT,
  account_name TEXT,
  scopes TEXT[],
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Scheduled tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mission_prompt TEXT NOT NULL,
  schedule_type TEXT NOT NULL, -- 'cron', 'one_time', 'trigger'
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_result JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval history
CREATE TABLE IF NOT EXISTS approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mission_id UUID,
  task_id TEXT,
  task_description TEXT,
  action_type TEXT,
  action_payload JSONB,
  decision TEXT, -- 'approved', 'rejected', 'timeout'
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact contexts (what agent knows about contacts)
CREATE TABLE IF NOT EXISTS contact_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_identifier TEXT NOT NULL, -- email or CRM ID
  contact_name TEXT,
  context_summary TEXT,
  raw_memories JSONB DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_identifier)
);

-- User preferences (auto-learned)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  source TEXT, -- 'learned', 'explicit', 'onboarding'
  confidence FLOAT DEFAULT 1.0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preference_key)
);

-- Audit log (every action Nexus takes)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  mission_id UUID,
  agent_type TEXT, -- 'BUSINESS_AGENT', 'DEV_AGENT', 'SYS_AGENT', 'LIFE_AGENT'
  action_type TEXT NOT NULL,
  params JSONB DEFAULT '{}',
  result JSONB,
  tokens_used INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10, 6),
  approved BOOLEAN DEFAULT FALSE,
  auto_executed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missions (expanded from existing)
CREATE TABLE IF NOT EXISTS missions_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal TEXT NOT NULL,
  agent_type TEXT,
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'running', 'paused', 'completed', 'failed', 'aborted'
  plan JSONB DEFAULT '[]',
  progress JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 6),
  requires_approval BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON user_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_approval_history_mission ON approval_history(mission_id);
CREATE INDEX IF NOT EXISTS idx_contact_contexts_user ON contact_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_missions_user ON missions_v1(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions_v1(status);
