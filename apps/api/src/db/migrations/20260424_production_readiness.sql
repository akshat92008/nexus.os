CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_draft_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_provider_draft_id ON email_drafts(provider_draft_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
