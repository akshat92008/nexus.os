# Contributing to Nexus OS

## Setup
1. Clone the repo
2. Run `pnpm install`
3. Copy `.env.example` to `.env` and fill in required values
4. Start infra: `docker-compose up -d redis supabase-db`
5. Start API: `pnpm --filter apps/api dev`

## Code Style
- Use Prettier and ESLint (run `pnpm lint`)
- TypeScript for all new code
- Write clear, concise comments

## Pull Requests
- Fork and branch from `main`
- Write descriptive PR titles and summaries
- Reference issues if applicable
- Ensure all tests pass and coverage is >80% for critical paths

## Testing
- Add/modify tests in `/tests` or `/src/__tests__/`
- Run `pnpm test` before PR

## Architecture
- See `/docs/architecture.md` for system overview
- For major changes, add/update an ADR in `/docs/adr/`

## Marketplace
### Adding a New Marketplace Agent
Since v3.0, the marketplace catalog is stored in the database. To add a new agent:
1. Create a new SQL migration in `apps/api/src/db/migrations/` (e.g., `005_add_my_agent.sql`).
2. Insert your agent data into the `marketplace_agents` table.
3. Run the migration script: `pnpm --filter @nexus-os/api migrate`.
4. The API will pick up the new agent within 60 seconds (due to Redis caching).
5. Open a PR with your agent's system prompt and tools in `apps/api/src/agents/`.

## Communication
- Use GitHub Issues/Discussions for questions and proposals
