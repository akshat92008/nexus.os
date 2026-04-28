-- ═══════════════════════════════════════════════════
-- NEXUS OS — SALES AI EMPLOYEE COMPLETE SCHEMA
-- ═══════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Core leads table ──────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  email              TEXT NOT NULL,
  name               TEXT,
  company            TEXT,
  role               TEXT,
  source             TEXT NOT NULL DEFAULT 'manual',
  score              INTEGER DEFAULT 0,
  status             TEXT DEFAULT 'new',
  notes              TEXT,
  raw_data           JSONB DEFAULT '{}',
  follow_up_count    INTEGER DEFAULT 0,
  last_contacted_at  TIMESTAMPTZ,
  booked_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_leads_user_status ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(user_id, source);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_owner ON leads;
CREATE POLICY leads_owner ON leads
  FOR ALL USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- ── Lead events (audit trail) ──────────────────────
CREATE TABLE IF NOT EXISTS lead_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type);

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_events_owner ON lead_events;
CREATE POLICY lead_events_owner ON lead_events
  FOR ALL USING (
    lead_id IN (SELECT id FROM leads WHERE user_id = auth.uid()::uuid)
  );

-- ── Follow-up sequences ────────────────────────────
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,
  step             INTEGER NOT NULL DEFAULT 1,
  status           TEXT DEFAULT 'pending',
  message_subject  TEXT,
  message_body     TEXT,
  approval_id      TEXT,
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequences_lead ON follow_up_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_sequences_pending ON follow_up_sequences(user_id, status)
  WHERE status = 'pending';

ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sequences_owner ON follow_up_sequences;
CREATE POLICY sequences_owner ON follow_up_sequences
  FOR ALL USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- ── Email approval queue ───────────────────────────
CREATE TABLE IF NOT EXISTS email_approvals (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL,
  lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  step        INTEGER DEFAULT 1,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_pending
  ON email_approvals(user_id, status) WHERE status = 'pending';

ALTER TABLE email_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approvals_owner ON email_approvals;
CREATE POLICY approvals_owner ON email_approvals
  FOR ALL USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- ── Trigger: auto-update leads.updated_at ─────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
