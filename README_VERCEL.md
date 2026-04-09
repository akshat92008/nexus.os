# Deploying Nexus OS on Vercel

Nexus OS is designed for durable execution using BullMQ. Vercel is great for static frontends and serverless APIs, but it **cannot** run the long-lived worker processes required for agentic execution.

## Recommended Architecture

To run Nexus OS in production as a website:

1.  **Frontend (`apps/web`)**: Deploy on Vercel.
2.  **API (`apps/api`)**: Deploy on Vercel as a serverless function (for planning and management).
3.  **Workers (`apps/api/src/workers`)**: Deploy on a long-running platform like **Railway**, **Render**, or **Fly.io**.

## Steps to Deploy

### 1. Set Up Database and Queue
-   **PostgreSQL**: Use Supabase (already configured in the project).
-   **Redis**: Use Upstash (serverless-friendly) for BullMQ.

### 2. Deploy the Monorepo to Vercel
Connect your repository to Vercel. Vercel will automatically detect the pnpm monorepo.
-   **Root Directory**: Leave as default (`/`).
-   **Build Command**: `pnpm build`
-   **Output Directory**: Vercel will detect Next.js output for `apps/web`.

### 3. Configure Environment Variables on Vercel
Add the following variables to your Vercel project:

-   `NEXT_PUBLIC_API_URL`: The URL of your **Render API** (e.g., `https://nexus-api.onrender.com`).
-   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
-   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
-   `GROQ_API_KEY`: Your Groq API key.
-   `SUPABASE_URL`: Your Supabase URL.
-   `SUPABASE_SERVICE_KEY`: Your Supabase Service Key.
-   `REDIS_URL`: Your Upstash Redis URL (must be `rediss://` for TLS).
-   `E2B_API_KEY`: Your E2B API key.

> [!IMPORTANT]
> When deploying to Vercel, the **`NEXT_PUBLIC_API_URL` must point to your Render API URL**, NOT a Vercel URL.
> BullMQ workers cannot run on Vercel — the API and workers must remain on Render or Railway for proper task orchestration.

### 4. Deploy the Workers (Crucial)
Since Vercel will kill serverless functions after execution, the missions will never progress unless you have workers running elsewhere.

To deploy workers on Railway/Render:
1.  Connect the same repository.
2.  Set the start command to: `pnpm --filter @nexus-os/api start` (this runs both API and workers if not on Vercel).
3.  Ensure all environment variables match those on Vercel.

## Why this is necessary?
Nexus OS uses a "Durable" architecture. When you start a mission, it's placed in a Redis queue. Workers pick up tasks and run them in sandboxes. If you only deploy the API on Vercel, the planning part will work (the "brain"), but the execution part (the "hands") won't start because Vercel doesn't allow background processes to stay alive.
