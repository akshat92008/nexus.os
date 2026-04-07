# ⬡ Nexus OS — The OS Layer for Artificial Intelligence

> *Users don't chat with bots. They manage an agentic workspace where parallel AI workers execute sub-tasks, pass artifacts via the Model Context Protocol, and output final results into a universal file system.*

---

## Architecture

```
nexus-os/                          ← pnpm monorepo root
├── packages/
│   └── types/                     ← Shared TypeScript contract (SSE union, Artifact, LedgerRow…)
│       └── index.ts
└── apps/
    ├── api/                       ← Node.js / Express backend (port 3001)
    │   └── src/
    │       ├── index.ts           ← Server entry, SSE routes, export route
    │       ├── semanticRouter.ts  ← Pillar 2 · Goal → JSON plan via Groq llama-3.3-70b
    │       ├── agentManager.ts    ← Pillar 2 · Promise.all parallel + sequential orchestration
    │       ├── mcpBridge.ts       ← Pillar 3 · Cross-agent artifact store + export hooks
    │       └── ledger.ts          ← Pillar 4 · $0.01 micro-toll → Supabase Transaction_Ledger
    └── web/                       ← Next.js 14 App Router frontend (port 3000)
        ├── app/
        │   ├── layout.tsx         ← Root layout (fonts, metadata)
        │   ├── page.tsx           ← Mounts <Workspace />
        │   └── globals.css        ← Nexus OS design system
        ├── components/
        │   ├── workspace/
        │   │   ├── Workspace.tsx           ← Pillar 1 · OS desktop canvas
        │   │   ├── UniversalCommandBar.tsx ← Pillar 1 · /execute command palette
        │   │   ├── TaskManagerWidget.tsx   ← Pillar 1 · Live agent status sidebar
        │   │   ├── TokenROIWidget.tsx      ← Pillar 1 · Real-time cost savings
        │   │   └── ArtifactViewer.tsx      ← OS "window" for full artifact content
        │   └── shared/
        │       └── EventLog.tsx            ← SSE terminal stream panel
        ├── store/
        │   └── nexusStore.ts      ← Zustand global state (all SSE → state mutations)
        ├── hooks/
        │   └── useNexusSSE.ts     ← Fetch-based SSE streaming hook
        └── lib/
            └── exportArtifact.ts  ← Browser download trigger for export API
```

---

## The Four Pillars

### Pillar 1 — OS Desktop Interface
The `Workspace.tsx` is NOT a chat window. It's a three-panel OS desktop:
- **Left canvas**: `UniversalCommandBar` with `/execute` prefix + example goals carousel
- **Right sidebar**: `TaskManagerWidget` (live agent cards) + `TokenROIWidget` + `EventLog`
- **Overlay window**: `ArtifactViewer` opens as a floating OS window when an agent card is clicked

### Pillar 2 — Semantic Router & Dispatcher
`semanticRouter.ts` calls **Groq llama-3.3-70b-versatile** with a strict JSON-only system prompt to decompose the user's goal into parallel + sequential sub-tasks. Includes retry logic with exponential back-off.

`agentManager.ts` uses **`Promise.all()`** for Phase 1 (parallel) and a sequential for-loop for Phase 2. Each agent calls **Groq llama-3.1-8b-instant** with a type-specific persona prompt.

### Pillar 3 — Universal File System & MCP Bridge
`mcpBridge.ts` is a keyed `Map<agentId, Artifact>` store. Parallel agents deposit artifacts; sequential agents call `retrieveAll()` to get the full context. An `export()` method generates Markdown, JSON, or PDF-ready HTML from all artifacts in the session.

### Pillar 4 — Micro-Monetization Ledger
`ledger.ts` records `$0.01` per routing event into Supabase's `Transaction_Ledger` table (with an in-memory fallback for local dev). Every write fires a `ledger_update` SSE event, which the `TokenROIWidget` uses to update the running fee counter in real time.

---

## SSE Event Protocol

Every event emitted by the server is a member of the `NexusSSEEvent` union:

| Event                | When fired                                      |
|---------------------|-------------------------------------------------|
| `connected`          | SSE stream opens                                |
| `plan_ready`         | Semantic router returns plan                    |
| `agent_spawn`        | An agent process begins                         |
| `agent_working`      | Agent calls Groq API                            |
| `artifact_deposited` | Agent completes, deposits to MCP bridge         |
| `handoff`            | Parallel → sequential phase transition          |
| `ledger_update`      | Micro-toll recorded, cumulative fee updated     |
| `done`               | All agents complete, session closed             |
| `error`              | Any unhandled exception                         |

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm i -g pnpm`)
- [Groq API key](https://console.groq.com) (free tier is sufficient)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
# API config
cp .env.example apps/api/.env
# → Set GROQ_API_KEY

# Frontend config
cp .env.example apps/web/.env.local
# → Set NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Run the full stack

```bash
pnpm dev
# API → http://localhost:3001
# Web → http://localhost:3000
```

---

## API Endpoints

| Method | Path                            | Description                              |
|--------|---------------------------------|------------------------------------------|
| `POST` | `/api/orchestrate`              | SSE stream — run an agentic orchestration |
| `GET`  | `/api/ledger/:userId`           | Ledger summary for a user                |
| `GET`  | `/api/export/:sessionId?format` | Download merged artifact (md/json/pdf)   |
| `GET`  | `/api/health`                   | System health check                      |

### POST /api/orchestrate

**Request body:**
```json
{ "goal": "Research market trends and draft a competitive analysis memo", "userId": "user_abc123" }
```

**SSE stream (text/event-stream):**
```
data: {"type":"connected","message":"Nexus OS online...","sessionId":"..."}
data: {"type":"plan_ready","parallelCount":3,"sequentialCount":1,...}
data: {"type":"agent_spawn","taskId":"market_scan_01","agentType":"researcher","mode":"parallel"}
data: {"type":"agent_working","taskId":"market_scan_01",...}
data: {"type":"artifact_deposited","agentId":"market_scan_01","tokensUsed":412,...}
data: {"type":"ledger_update","feeUsd":0.01,"cumulativeFeeUsd":0.01,...}
data: {"type":"done","totalAgents":4,"totalFeeUsd":0.04,"durationMs":3241}
```

---

## Supabase DDL

Run this once in your Supabase SQL editor before enabling the ledger:

```sql
CREATE TABLE IF NOT EXISTS "Transaction_Ledger" (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT         NOT NULL,
  agent_id     TEXT         NOT NULL,
  task_type    TEXT         NOT NULL,
  task_label   TEXT         NOT NULL,
  tokens_used  INTEGER      NOT NULL DEFAULT 0,
  fee_usd      NUMERIC(8,4) NOT NULL DEFAULT 0.0100,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ON "Transaction_Ledger" (user_id);
CREATE INDEX ON "Transaction_Ledger" (created_at DESC);
```

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | Next.js 14 (App Router), React 18, Tailwind CSS   |
| Animation  | Framer Motion 11                                  |
| State      | Zustand 4 with `subscribeWithSelector`            |
| Backend    | Node.js, Express 4, Server-Sent Events            |
| Router LLM | Groq `llama-3.3-70b-versatile` (fast JSON routing)|
| Agent LLM  | Groq `llama-3.1-8b-instant` (parallel execution)  |
| Database   | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Monorepo   | pnpm workspaces                                   |
| Types      | TypeScript 5.5, shared `@nexus-os/types` package  |

---

*Built with the Nexus OS Principal Architecture spec — V1 Core System.*
