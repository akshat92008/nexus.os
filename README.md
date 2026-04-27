# Nexus OS

Nexus OS is a multi-surface agent runtime: a Node/Express API, a Next.js dashboard, and a Tauri desktop shell with macOS GUI control primitives.

## 5-Minute Quickstart
1. Copy `.env.example` to `.env`.
2. For local-only development, set:
   `STORAGE_STRATEGY=local`
   `GROQ_API_KEY=<any non-empty placeholder for boot, or a real key for LLM features>`
3. Start Redis:
   ```bash
   docker compose up redis -d
   ```
4. Start the API:
   ```bash
   cd apps/api
   npm run dev
   ```
5. Start the web app:
   ```bash
   cd apps/web
   npm run dev
   ```

Default local URLs:
- API: `http://localhost:3006`
- Web: `http://localhost:3015`

## Local Modes
- `STORAGE_STRATEGY=supabase`: uses Supabase/Postgres for missions, memory, and user state.
- `STORAGE_STRATEGY=local`: skips cloud persistence and uses degraded/local behavior where available.

## Key API Surfaces
- `POST /api/missions`
- `GET /api/missions/:id/stream`
- `POST /api/skills/v2/execute`
- `POST /api/memory/store`
- `POST /api/memory/search`
- `GET /api/channels`
- `POST /api/rollback`

## Desktop Build
```bash
pnpm tauri dev
```

```bash
pnpm tauri build
```
