# Nexus OS

The OS Layer for Artificial Intelligence.

## Setup
1. Clone the repository.
2. Install dependencies: `pnpm install`
3. Build the project: `pnpm build`
4. Start locally: `pnpm dev`

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `OPENROUTER_API_KEY`
- `REDIS_URL`
- `PORT` (default 3001)

## Deployment

### Vercel (Frontend)
- Framework Preset: Next.js
- Root Directory: `apps/web` (or root if monorepo detection is on)

### Render (API & Workers)
- Environment: Node.js
- Build Command: `pnpm install && pnpm build`
- Start Command (API): `node apps/api/dist/index.js`
- Start Command (Worker): `node apps/api/dist/workers/taskWorker.js`

## Test API Request
```bash
curl -X GET http://localhost:3001/api/ready
```

### Free Infrastructure Setup
Before running locally, you must set up two free cloud dependencies:
1. **Upstash Redis:** Create a free database at Upstash. Copy the URL and add it to your `.env` as `REDIS_URL`.
2. **Supabase:** Create a free project. Copy your connection string and keys to `.env`. 
3. **Database Migrations:** Run `pnpm migrate` (or your chosen package manager) to apply the 3 required database migrations. Without this, you will get "relation nexus_missions does not exist" errors.
