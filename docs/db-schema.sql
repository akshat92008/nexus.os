-- Example Supabase schema export
-- Replace with actual schema as needed

CREATE TABLE IF NOT EXISTS nexus_missions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_missions_user_id ON nexus_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON nexus_missions(status);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  mission_id UUID REFERENCES nexus_missions(id),
  label TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_mission_id ON tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Add more tables as needed
