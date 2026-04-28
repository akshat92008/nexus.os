-- Add unsubscribed status to leads table
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'qualified', 'contacted', 'booked', 'lost', 'unsubscribed'));

-- Ensure unsubscribed leads are never targeted for outreach
-- The application layer must filter status != 'unsubscribed' on all outreach queries
