CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  source TEXT NOT NULL, -- 'web_form','email','linkedin','manual','api'
  score INTEGER DEFAULT 0, -- 0-100
  status TEXT DEFAULT 'new', -- 'new','qualified','contacted','replied','booked','lost'
  raw_data JSONB DEFAULT '{}',
  notes TEXT,
  follow_up_count INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE TABLE lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created','scored','emailed','replied','booked','lost'
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'pending', -- 'pending','sent','replied','skipped'
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  message_subject TEXT,
  message_body TEXT,
  draft_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX idx_sequences_scheduled ON follow_up_sequences(scheduled_at) WHERE status='pending';

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_owner_policy" ON leads
  FOR ALL
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);
