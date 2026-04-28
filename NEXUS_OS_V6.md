# Nexus OS v6.0 — AI Employee Architecture

**Nexus OS v6.0** is a fully autonomous, multi-channel AI employee system, inspired by OpenClaw's powerful architecture.

---

## 📦 What Was Built

### 1. Multi-Channel Messaging (`/apps/api/src/channels/`)
| File | Purpose |
|------|---------|
| `channelManager.ts` | Central coordinator for all channels |
| `adapters/slackAdapter.ts` | Slack integration via Bolt |
| `adapters/discordAdapter.ts` | Discord.js bot integration |
| `adapters/telegramAdapter.ts` | Telegraf bot integration |

**Features:**
- DM pairing for security
- Allowlist management
- Broadcast messaging
- Thread support

### 2. Sub-Agent Spawning (`/apps/api/src/agents/subAgentManager.ts`)
| Feature | Implementation |
|---------|---------------|
| Hierarchical agents | Configurable depth limits (default: 3) |
| Context compaction | Auto-summarization at token limits |
| Lifecycle management | Spawn → Run → Pause/Resume/Cancel → Complete |
| Orphan recovery | Detects hung agents, auto-restarts |
| State persistence | Supabase-backed session storage |

### 3. Skills System (`/apps/api/src/skills/`)
| Component | Files |
|-----------|-------|
| Manager | `skillManager.ts` |
| Bundled Skills | `bundled/web_search/`, `bundled/file_manager/` |

**Bundled Skills:**
- **web_search**: DuckDuckGo/Bing search, page fetching
- **file_manager**: Read, write, list, create files/folders

### 4. Semantic Memory (`/apps/api/src/memory/semanticMemory.ts`)
| Feature | Tech |
|---------|------|
| Vector storage | Supabase pgvector extension |
| Embeddings | OpenAI text-embedding-3-small |
| Similarity search | Cosine similarity with threshold |
| Auto-compaction | Summarizes old memories |

### 5. Cron/Scheduler (`/apps/api/src/scheduler/cronManager.ts`)
| Feature | Description |
|---------|-------------|
| Task types | mission, workflow, agent_request, skill_execution, notification, cleanup |
| Scheduling | Cron expressions, intervals, one-time |
| Lifecycle | scheduled → running → completed/failed |
| Steering | Pause, resume, cancel tasks at runtime |

### 6. MCP Bridge (`/apps/api/src/mcp/mcpManager.ts`)
| Feature | Description |
|---------|-------------|
| Transports | stdio, sse, streamable-http |
| Tool discovery | Auto-fetches from MCP servers |
| Resource access | Read resources from MCP servers |
| Dynamic updates | Subscribes to tool/resource changes |

---

## 🔌 API Endpoints

### Channels
```
GET    /api/channels                    List active channels
POST   /api/channels/:id/send           Send message
POST   /api/channels/broadcast          Broadcast to all
POST   /api/channels/pairing/approve    Approve pairing
```

### Sub-Agents
```
POST   /api/subagents/spawn             Spawn new agent
GET    /api/subagents                   List sessions
GET    /api/subagents/:id               Get session
POST   /api/subagents/:id/steer         Pause/Resume/Cancel
```

### Skills
```
GET    /api/skills/v2                   List skills
GET    /api/skills/v2/tools             List tools
POST   /api/skills/v2/execute           Execute tool
POST   /api/skills/v2/install           Install skill
```

### Memory
```
POST   /api/memory/store                Store memory
POST   /api/memory/search               Semantic search
POST   /api/memory/recall               Contextual recall
GET    /api/memory/:id/related          Related memories
```

### Tasks
```
GET    /api/tasks                       List scheduled tasks
POST   /api/tasks/schedule              Schedule task
POST   /api/tasks/:id/cancel            Cancel task
POST   /api/tasks/:id/pause             Pause task
POST   /api/tasks/:id/resume            Resume task
```

### MCP
```
GET    /api/mcp/connections             List connections
GET    /api/mcp/tools                   List all MCP tools
POST   /api/mcp/connect                 Connect server
POST   /api/mcp/:id/disconnect          Disconnect
POST   /api/mcp/:id/tools/:name/call    Call tool
```

---

## 🚀 Quick Start

### 1. Database Setup
Run `/apps/api/src/db/migrations/20250422_openclaw_features.sql` in Supabase.

### 2. Environment Variables
```bash
# Required
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=

# Optional - Channels
SLACK_BOT_TOKEN=
DISCORD_BOT_TOKEN=
TELEGRAM_BOT_TOKEN=

# Optional - Memory
OPENAI_API_KEY=  # For embeddings
```

### 3. Start API
```bash
cd apps/api
pnpm install
pnpm dev
```

### 4. Use CLI
```bash
cd packages/cli
pnpm install
pnpm build

# First time setup
./dist/index.js onboard

# Ask your AI employee
./dist/index.js ask "What files are in my workspace?"

# Check status
./dist/index.js status
```

---

## 📁 Project Structure

```
nexus-os/
├── apps/
│   └── api/
│       └── src/
│           ├── channels/           # Multi-channel messaging
│           │   ├── channelManager.ts
│           │   └── adapters/
│           ├── agents/             # Sub-agent spawning
│           │   └── subAgentManager.ts
│           ├── skills/             # Skills system
│           │   ├── skillManager.ts
│           │   └── bundled/        # Built-in skills
│           ├── memory/             # Semantic memory
│           │   └── semanticMemory.ts
│           ├── scheduler/            # Cron tasks
│           │   └── cronManager.ts
│           ├── mcp/                # MCP bridge
│           │   └── mcpManager.ts
│           └── db/migrations/      # Database migrations
├── packages/
│   └── cli/                        # Command-line interface
│       └── src/index.ts
├── OPENCLAW_FEATURES.md            # Feature documentation
├── CLI.md                          # CLI documentation
└── NEXUS_OS_V6.md                  # This file
```

---

## 🔮 Next Steps

To make the AI employee fully operational:

1. **Add more bundled skills**
   - code_analyzer: Lint, review, refactor code
   - git_manager: Commit, branch, PR operations
   - api_integrations: GitHub, Notion, Slack APIs

2. **Build frontend components**
   - Channel management UI
   - Agent monitoring dashboard
   - Memory browser with search
   - Task scheduler interface

3. **Add voice capabilities**
   - Real-time voice conversations
   - Voice memo processing

4. **Enhance security**
   - CEO authorization for dangerous operations
   - Audit logging for all agent actions

---

**Built for autonomous AI employees. Powered by Nexus OS.**
