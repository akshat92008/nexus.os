CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nexus_state (
  id UUID PRIMARY KEY REFERENCES users(id),
  state JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nexus_missions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  dag_data JSONB,
  goal_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL,
  tool_id TEXT NOT NULL,
  params JSONB,
  undo_params JSONB,
  status TEXT DEFAULT 'pending',
  user_id UUID,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
