# Nexus OS — Deployment Checklist

## Before First Deploy

### 1. Supabase Setup
- [ ] Create project at supabase.com
- [ ] Run ALL migrations in `apps/api/src/db/migrations/` in date order
- [ ] Enable Row Level Security is ON for: leads, lead_events, follow_up_sequences, email_approvals, ai_usage_logs, ai_daily_limits
- [ ] Copy SUPABASE_URL and SUPABASE_SERVICE_KEY from Project Settings → API

### 2. Email Provider Setup (pick one)
- **SendGrid:** Create account → Settings → API Keys → Full Access. Verify your sender domain.
- **Resend:** Create account → Domains → Add and verify your domain. Get API key.
- Set EMAIL_FROM_ADDRESS to a real address on your verified domain (e.g., hello@yourdomain.com)

### 3. AI Providers
- [ ] Groq (required): console.groq.com → API Keys
- [ ] OpenRouter (recommended): openrouter.ai → Keys (enables GPT-4o-mini for email drafting)
- [ ] Gemini (optional): aistudio.google.com → Get API Key

### 4. Environment Variables
Copy `apps/api/.env.example` to `apps/api/.env` and fill in all values.
Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL (your backend URL)

### 5. CORS Configuration
Set ALLOWED_ORIGINS to your frontend's exact URL (e.g., https://app.yourdomain.com)
No trailing slash. Comma-separate multiple origins.

### 6. Domain Verification (critical for email delivery)
- Add SPF record: `v=spf1 include:sendgrid.net ~all` 
- Add DKIM records (provided by your email provider)
- Add DMARC record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com` 
- Wait 24-48 hours for DNS propagation before sending emails

### 7. Pre-launch Smoke Test
- [ ] Sign up with a real email → verify email arrives
- [ ] Add one lead manually
- [ ] Click "Score Unqualified Leads" → score appears
- [ ] Click "Draft Follow-up" → email appears in Approval Queue
- [ ] Approve one email → confirm it arrives in your own inbox (test with your own email first)
