# Nexus OS — The OS Layer for Artificial Intelligence

A multi-agent AI operating system built entirely on free-tier services.

---

## Quick Start (Local)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in your keys
cp .env.example apps/api/.env

# 3. Start both frontend and backend in parallel
pnpm dev
```

Frontend: http://localhost:3000  
API:      http://localhost:3001

---

## Required Free Accounts

| Service | Purpose | Free Tier Link |
|---------|---------|----------------|
| [Upstash](https://upstash.com) | Redis (BullMQ + pub/sub) | 10K commands/day free |
| [Supabase](https://supabase.com) | Database + Auth | 500 MB, 50K MAU free |
| [OpenRouter](https://openrouter.ai) | LLM routing (Llama, DeepSeek, Mistral) | Free models available |
| [Groq](https://console.groq.com) | Fast LLM fallback | Free tier with rate limits |
| [Render](https://render.com) | API hosting | Free tier (spins down after inactivity) |
| [Vercel](https://vercel.com) | Frontend hosting | Free hobby plan |

---

## Environment Variables

See [`.env.example`](.env.example) for every variable with descriptions.

Key variables:

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Upstash ioredis connection string (`rediss://...`) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase `service_role` key (server-only) |
| `SUPABASE_ANON_KEY` | Supabase `anon` key (used by frontend) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `GROQ_API_KEY` | Groq API key |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `PORT` | API port (default: 3001) |

---

## Free Deployment

### Step 1 — Upstash Redis
1. Go to [upstash.com](https://upstash.com) → Create Database → Region: `us-east-1`
2. Copy the **ioredis** connection string (starts with `rediss://`)
3. Save as `REDIS_URL`

### Step 2 — Supabase
1. Go to [supabase.com](https://supabase.com) → New Project
2. Run migrations: `pnpm migrate` (set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` first)
3. Copy **Project URL**, **service_role key**, and **anon key**

### Step 3 — Render (API)
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Render auto-detects `render.yaml` — confirm settings
4. Add all env vars from `.env.example` in the Render dashboard
5. Your API URL will be `https://nexus-api.onrender.com`

> ⚠️ Render free tier spins down after 15 min of inactivity. The `/api/health` endpoint is configured as the health check path to keep it warm.

### Step 4 — Vercel (Frontend)
1. Go to [vercel.com](https://vercel.com) → Import Git Repository
2. Set root directory to `apps/web`
3. Add env var: `NEXT_PUBLIC_API_URL=https://nexus-api.onrender.com`
4. Deploy — your frontend URL will be `https://your-app.vercel.app`
5. Add that URL to `ALLOWED_ORIGINS` on your Render service

---

## Database Migrations

```bash
# Run pending migrations against your Supabase project
pnpm migrate
```

Migration files live in `apps/api/src/db/migrations/`. They run in filename order and are tracked in a `migrations_log` table.

---

## Architecture

```
Browser (Vercel)
    │  POST /api/orchestrate
    ▼
API Server (Render)
    │  Plans DAG → pushes to BullMQ
    ▼
Task Worker (Render)
    │  Executes agents in dependency order
    ├─ OpenRouter / Groq (LLM calls)
    ├─ Supabase (state persistence)
    └─ Redis pub/sub → SSE → Browser (live events)
```

---

## Useful Scripts

```bash
pnpm dev          # Start API + frontend in parallel
pnpm build        # Build all packages
pnpm migrate      # Run DB migrations
pnpm test         # Run unit tests
pnpm typecheck    # TypeScript check (no emit)
pnpm lint         # ESLint
```
