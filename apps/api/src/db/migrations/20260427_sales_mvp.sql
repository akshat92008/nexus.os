-- ============================================
-- NEXUS SALES MVP — email_approvals table
-- Replaces in-memory approval queue
-- ============================================

CREATE TABLE IF NOT EXISTS email_approvals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_pending
  ON email_approvals(user_id, status) WHERE status = 'pending';

ALTER TABLE email_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY approvals_owner ON email_approvals
  FOR ALL USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- Add approval_id column to follow_up_sequences if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follow_up_sequences' AND column_name = 'approval_id'
  ) THEN
    ALTER TABLE follow_up_sequences ADD COLUMN approval_id TEXT REFERENCES email_approvals(id);
  END IF;
END $$;

-- ============================================
-- P0-5: RLS for lead_events and follow_up_sequences
-- ============================================

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_events_owner ON lead_events
  FOR ALL USING (
    lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()::uuid)
  );

ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY sequences_owner ON follow_up_sequences
  FOR ALL USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);
