# Nexus OS Deployment Guide

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in required values
3. Start infrastructure:
   ```sh
   docker-compose up -d redis supabase-db
   ```
4. Start the API and workers (in separate terminals):
   ```sh
   pnpm --filter apps/api dev
   pnpm --filter apps/api start:worker
   ```

## Production Deployment

- Use Docker Compose or Kubernetes for infra
- Set all required environment variables
- Use a process manager (PM2, Docker, or systemd) for API and workers
- Expose only necessary ports (API, not DB/Redis)
- Use SSL termination at the proxy/load balancer

## Health Checks
- API: `/api/health`
- Master Brain: `/api/master/health`
- Workers: `/health` (if implemented)

## Scaling
- Run multiple API/worker instances behind a load balancer
- All state is in Redis/Supabase for stateless scaling

## Migrations
- Use migration scripts in `/migrations` (if present)
- For Supabase, see `/docs/db-schema.sql`

## Troubleshooting
- Check logs: `docker logs <container>`
- Check health endpoints
- Ensure all env vars are set
