-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table 1: User States (nexus_state)
CREATE TABLE IF NOT EXISTS "nexus_state" (
    id           TEXT        PRIMARY KEY, -- user_id
    state        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: Missions (nexus_missions)
CREATE TABLE IF NOT EXISTS "nexus_missions" (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT        NOT NULL,
    workspace_id TEXT,
    goal         TEXT        NOT NULL,
    goal_type    TEXT,
    dag_data     JSONB,
    status       TEXT        NOT NULL DEFAULT 'queued',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Table 3: Tasks (Supporting table for nexus_missions)
CREATE TABLE IF NOT EXISTS "tasks" (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id         UUID        NOT NULL REFERENCES nexus_missions(id) ON DELETE CASCADE,
    workspace_id       TEXT,
    label              TEXT        NOT NULL,
    agent_type         TEXT        NOT NULL,
    input_payload      JSONB,
    status             TEXT        NOT NULL DEFAULT 'pending',
    parent_task_id     UUID        REFERENCES tasks(id) ON DELETE SET NULL,
    map_reduce_role    TEXT,
    tokens_used        INTEGER     NOT NULL DEFAULT 0,
    output_artifact_id UUID,
    error              TEXT,
    started_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4: Transaction Ledger
CREATE TABLE IF NOT EXISTS "Transaction_Ledger" (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT        NOT NULL,
    agent_id     TEXT        NOT NULL,
    task_type    TEXT        NOT NULL,
    task_label   TEXT        NOT NULL,
    tokens_used  INTEGER     NOT NULL DEFAULT 0,
    fee_usd      NUMERIC(8,4) NOT NULL DEFAULT 0.0100,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: Artifacts
CREATE TABLE IF NOT EXISTS "artifacts" (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id  UUID        NOT NULL REFERENCES nexus_missions(id) ON DELETE CASCADE,
    task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL,
    content     JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 6: Embeddings
CREATE TABLE IF NOT EXISTS "nexus_embeddings" (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT        NOT NULL,
    text        TEXT        NOT NULL,
    embedding   VECTOR(1536),
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 7: Task Dependencies (Supporting)
CREATE TABLE IF NOT EXISTS "task_dependencies" (
    task_id             UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id)
);

-- Table 8: Schedules (Supporting)
CREATE TABLE IF NOT EXISTS "schedules" (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    TEXT        NOT NULL,
    cron_expression TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'active',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nexus_missions_user_id ON nexus_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_missions_created_at ON nexus_missions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_mission_id ON tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_mission_id ON artifacts(mission_id);
CREATE INDEX IF NOT EXISTS idx_nexus_state_id ON nexus_state(id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON "Transaction_Ledger"(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON "Transaction_Ledger"(created_at DESC);

-- RLS Policies
ALTER TABLE nexus_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own state" ON nexus_state
    FOR ALL USING (id = auth.uid()::text);

ALTER TABLE nexus_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own missions" ON nexus_missions
    FOR ALL USING (user_id = auth.uid()::text);

ALTER TABLE "Transaction_Ledger" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own ledger" ON "Transaction_Ledger"
    FOR ALL USING (user_id = auth.uid()::text);

-- RPCs for Atomic Operations
CREATE OR REPLACE FUNCTION create_mission_atomic(
  p_id UUID,
  p_user_id TEXT,
  p_workspace_id TEXT,
  p_goal TEXT,
  p_goal_type TEXT,
  p_dag_data JSONB,
  p_tasks JSONB
) RETURNS UUID AS $$
DECLARE
  v_mission_id UUID;
  v_task JSONB;
BEGIN
  INSERT INTO nexus_missions (id, user_id, workspace_id, goal, goal_type, dag_data)
  VALUES (COALESCE(p_id, gen_random_uuid()), p_user_id, p_workspace_id, p_goal, p_goal_type, p_dag_data)
  RETURNING id INTO v_mission_id;

  IF p_tasks IS NOT NULL THEN
    FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      INSERT INTO tasks (id, mission_id, workspace_id, label, agent_type, input_payload, status)
      VALUES (
        (v_task->>'id')::UUID,
        v_mission_id,
        p_workspace_id,
        v_task->>'label',
        v_task->>'agent_type',
        v_task->'input_payload',
        'pending'
      );
    END LOOP;
  END IF;

  RETURN v_mission_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION complete_task_atomic(
  p_mission_id UUID,
  p_task_id UUID,
  p_type TEXT,
  p_content JSONB,
  p_tokens_used INTEGER,
  p_completed_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_artifact_id UUID;
BEGIN
  -- 1. Insert Artifact
  INSERT INTO artifacts (mission_id, task_id, type, content)
  VALUES (p_mission_id, p_task_id, p_type, p_content)
  RETURNING id INTO v_artifact_id;

  -- 2. Update Task
  UPDATE tasks
  SET status = 'completed',
      tokens_used = p_tokens_used,
      completed_at = p_completed_at,
      output_artifact_id = v_artifact_id
  WHERE id = p_task_id;

  RETURN v_artifact_id;
END;
$$ LANGUAGE plpgsql;
