# Nexus OS v6.0 — OpenClaw-Inspired Features

This document describes the powerful new features added to Nexus OS, inspired by the OpenClaw personal AI assistant architecture.

## 🏗️ Architecture Overview

Nexus OS now includes **12 major subsystems** ported from or inspired by OpenClaw:

1. **Multi-Channel Messaging** (Slack, Discord, Telegram, Email, WhatsApp, SMS)
2. **Sub-Agent Spawning System**
3. **Extensible Skills Framework** (20+ bundled skills)
4. **Semantic Memory with Vector Search**
5. **Cron/Task Scheduling**
6. **MCP (Model Context Protocol) Bridge**
7. **Canvas / Live Document System**
8. **Voice / Audio Pipeline** (STT, TTS, Voice Conversations)
9. **TUI (Terminal User Interface)**
10. **Docker Sandbox Lifecycle**
11. **i18n / Localization** (12 languages)
12. **Daemon Mode & Service Management**

---

## 📡 Multi-Channel Messaging System

Connect Nexus OS to multiple communication channels for your AI employee.

### Supported Channels
- **Slack** (webhooks + bot API)
- **Discord** (bot integration)
- **Telegram** (bot integration)
- **Email** (IMAP/SMTP via nodemailer)
- **WhatsApp** (whatsapp-web.js)
- **SMS** (macOS Messages + Twilio fallback)
- **Signal** (signald daemon / libsignal-client)
- **Matrix** (matrix-js-sdk)
- **WebSocket** (real-time web interface)
- **WebChat** (pluggable adapter)

### Security Features
- **DM Pairing**: Unknown senders receive a pairing code for approval
- **Allowlists**: Control which users can interact with your agent
- **Auto-reply modes**: Configure per-channel response behavior

### API Endpoints
```
GET    /api/channels                    List active channels
POST   /api/channels/:id/send           Send message to channel
POST   /api/channels/broadcast          Broadcast to all channels
POST   /api/channels/pairing/approve    Approve a DM pairing request
```

---

## 🤖 Sub-Agent Spawning System

Spawn specialized sub-agents to handle complex tasks in parallel.

### Key Features
- **Hierarchical Agent Trees**: Spawn agents up to configurable depth (default: 3)
- **Context Compaction**: Automatically summarizes long conversations to stay within context limits
- **Lifecycle Management**: Track, pause, resume, and cancel sub-agents
- **Orphan Recovery**: Automatically detects and handles hung agent processes
- **State Persistence**: All agent states stored in Supabase

### Modes
- **embedded**: Runs within the main process
- **harness**: Isolated process
- **sandbox**: Docker/containerized execution

### API Endpoints
```
POST   /api/subagents/spawn             Spawn new sub-agent
GET    /api/subagents/:sessionId        Get agent session details
GET    /api/subagents                   List all sessions
POST   /api/subagents/:id/steer         Pause/Resume/Cancel agent
```

### Example Spawn Request
```json
{
  "name": "ResearchAgent",
  "description": "Research competitor pricing",
  "message": "Find and summarize pricing for top 3 competitors",
  "mode": "embedded",
  "skills": ["web_search", "data_extraction"],
  "parentSessionId": "optional-parent-id"
}
```

---

## 🛠️ Extensible Skills Framework

Plugin-style skill system for adding capabilities to your AI employee.

### Skill Structure
Each skill has:
- **Manifest** (`skill.json`): Metadata, tool definitions, permissions
- **Handlers**: TypeScript/JavaScript/Python execution code
- **Configuration**: Schema-based config with defaults
- **Dependencies**: Other skills, npm packages, system packages

### Permission System
```json
{
  "permissions": {
    "filesystem": ["/workspace/*"],
    "network": true,
    "shell": false,
    "envVars": ["OPENAI_API_KEY"]
  }
}
```

### Built-in Bundled Skills (20+)
| Skill | Tools | Platform |
|-------|-------|----------|
| `web_search` | DuckDuckGo/Bing search, page fetch | Web |
| `file_manager` | Read, write, list, create | Local FS |
| `github` | PRs, issues, CI runs, code review | gh CLI |
| `notion` | Pages, blocks, databases | Notion API |
| `calendar` | Create, list, delete events | Apple Calendar |
| `browser` | Navigate, screenshot, extract | Puppeteer |
| `apple-notes` | Create, list, get, delete | Apple Notes |
| `apple-reminders` | Create, list, complete | Reminders app |
| `things-mac` | Tasks in Things 3 | Things 3 |
| `imessage` | Send iMessages | Messages app |
| `spotify` | Play, pause, volume, now-playing | Spotify |
| `openai-whisper` | Transcribe, translate audio | OpenAI API |
| `tts` | Speak text (macOS/OpenAI) | say / OpenAI |
| `coding-agent` | Lint, format, analyze, git-diff | Dev tools |
| `healthcheck` | System metrics, processes, disk | macOS CLI |
| `session-logs` | Capture, search, save terminal logs | tmux / Terminal |
| `himalaya` | List, read, send emails | Himalaya CLI |
| `gifgrep` | Search GIFs from Tenor | Tenor API |
| `xurl` | Shorten, expand URLs | TinyURL |
| `nano-pdf` | Extract text, metadata from PDFs | pdf-parse |
| `trello` | Boards, cards, create | Trello API |
| `image-generation` | DALL-E image gen, edit, variations | OpenAI API |
| `music-generation` | AI music generation | Suno (ready) |
| `sonoscli` | Sonos speaker control | SOAP/UPnP |
| `openhue` | Hue lights, scenes, discovery | Philips Hue API |
| `obsidian` | Vault notes read, write, search | Filesystem |
| `web-fetch` | Page fetch, RSS, JSON API | HTTP |
| `gog` | Go game (igo/baduk) board logic | In-memory |
| `macporter` | macOS app open, quit, focus | AppleScript |
| `wacli` | Wi-Fi scan, connect, status | networksetup |
| `blucli` | Bluetooth scan, connect, status | bluetoothctl |
| `camsnap` | Camera snapshot capture | imagesnap |

### API Endpoints
```
GET    /api/skills/v2                   List all installed skills
GET    /api/skills/v2/tools             List all available tools
POST   /api/skills/v2/execute           Execute a tool by name
POST   /api/skills/v2/install           Install skill from URL/file/NPM
```

---

## 🧠 Semantic Memory with Vector Search

Long-term memory system with AI-powered recall.

### Memory Types
- **conversation**: Chat history and interactions
- **fact**: Learned facts and knowledge
- **task**: Completed and pending tasks
- **preference**: User preferences and settings
- **document**: Processed documents and files
- **code**: Code snippets and patterns
- **event**: System events and triggers

### Features
- **Vector Embeddings**: Automatic semantic indexing using OpenAI embeddings
- **Similarity Search**: Find related memories by meaning, not just keywords
- **Auto-Compaction**: Old memories are summarized to save space
- **Contextual Recall**: Smart memory retrieval with relevance scoring
- **Related Memories**: Find memories similar to a given entry
- **Expiration**: Set TTL on temporary memories

### API Endpoints
```
POST   /api/memory/store                Store a new memory
POST   /api/memory/search               Semantic search memories
POST   /api/memory/recall                 Contextual recall with query
GET    /api/memory/:id/related          Find related memories
```

### Example Search
```json
{
  "query": "What did we decide about the pricing strategy?",
  "type": ["conversation", "fact"],
  "limit": 10,
  "similarityThreshold": 0.7
}
```

---

## ⏰ Cron/Task Scheduling System

Autonomous operations through scheduled tasks.

### Task Types
- **mission**: Execute full mission with DAG planning
- **workflow**: Run predefined workflow
- **agent_request**: Send request to agent system
- **skill_execution**: Run a specific skill/tool
- **notification**: Send message via channels
- **cleanup**: Maintenance tasks (memory compaction, etc.)

### Scheduling Options
- **Cron Expression**: Standard cron syntax
- **Interval**: Millisecond-based recurring tasks
- **One-time**: Run once with optional delay
- **Date Range**: Start/end dates with timezone support
- **Max Runs**: Limit total executions

### Features
- **Retry Logic**: Automatic retry with exponential backoff
- **Concurrent Limits**: Prevent resource exhaustion
- **Execution Logs**: Full audit trail of all task runs
- **Task Steering**: Pause, resume, cancel tasks mid-execution
- **Health Monitoring**: Detect and fail stalled tasks

### API Endpoints
```
GET    /api/tasks                       List scheduled tasks
POST   /api/tasks/schedule              Create new scheduled task
POST   /api/tasks/:id/cancel            Cancel a task
POST   /api/tasks/:id/pause             Pause a task
POST   /api/tasks/:id/resume            Resume a task
```

### Example Schedule
```json
{
  "name": "Daily Report",
  "description": "Generate daily activity summary",
  "type": "agent_request",
  "schedule": {
    "cron": "0 9 * * *",
    "timezone": "America/New_York"
  },
  "payload": {
    "action": "generate_daily_report",
    "params": {
      "message": "Summarize today's activities and pending items"
    }
  }
}
```

---

## 🔌 MCP (Model Context Protocol) Bridge

Connect to external MCP servers for extended tool access.

### Supported Transports
- **stdio**: Local command-line MCP servers
- **SSE**: Server-Sent Events connections
- **streamable-http**: HTTP streaming connections

### Features
- **Dynamic Tool Discovery**: Automatically lists available tools from MCP servers
- **Tool Invocation**: Call MCP tools through Nexus OS API
- **Resource Access**: Read resources exposed by MCP servers
- **Real-time Updates**: Subscribes to tool and resource changes
- **Multiple Servers**: Connect to unlimited MCP servers simultaneously

### API Endpoints
```
GET    /api/mcp/connections             List MCP connections
GET    /api/mcp/tools                   List all MCP tools
POST   /api/mcp/connect                 Connect new MCP server
POST   /api/mcp/:id/disconnect          Disconnect MCP server
POST   /api/mcp/:id/tools/:name/call    Call an MCP tool
```

### Example Connection
```json
{
  "name": "Filesystem MCP",
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
  "capabilities": {
    "tools": true,
    "resources": true
  }
}
```

---

## 🎨 Canvas / Live Document System

Real-time collaborative documents with AI-powered block generation.

### Features
- **Document Types**: Whiteboard, Code, Markdown, Diagram, Spreadsheet, Mixed
- **Block Operations**: Insert, Update, Delete, Move, Resize, Style
- **AI Generation**: Generate content blocks from natural language prompts
- **Real-time Sync**: Live updates via Event Bus
- **HTML Export**: Render any document as a web page

### API Endpoints
```
POST   /api/canvas/create               Create a new canvas document
GET    /api/canvas/:id                  Get document by ID
GET    /api/canvas                      List all documents
POST   /api/canvas/:id/operation        Apply an operation (insert/update/delete/move/resize/style)
POST   /api/canvas/:id/generate         AI-generate a content block
GET    /api/canvas/:id/render           Render document as HTML
```

---

## 🎙️ Voice / Audio Pipeline

Real-time voice conversations: speech-to-text, text-to-speech, and voice chat sessions.

### Features
- **Session Modes**: Push-to-talk, Continuous listening, Wake-word activation
- **STT**: OpenAI Whisper API or local Whisper.cpp
- **TTS**: macOS `say`, OpenAI TTS, or ElevenLabs
- **Auto-Reply**: Automatically respond to voice input
- **Language Support**: Multi-language transcription

### API Endpoints
```
POST   /api/voice/start                 Start a voice session
POST   /api/voice/:id/listen            Start listening for audio
POST   /api/voice/:id/stop              Stop listening, get transcript
POST   /api/voice/:id/process           Process transcript with AI
POST   /api/voice/:id/speak             Text-to-speech output
GET    /api/voice/sessions              List active voice sessions
```

---

## 🖥️ TUI (Terminal User Interface)

In-terminal control interface for managing the entire system without a browser.

### Features
- **Screens**: Dashboard, Agents, Missions, Skills, Memory, Channels, Logs
- **Real-time Notifications**: Agent spawn, channel messages, mission completion
- **Hotkeys**: Keyboard shortcuts for every action
- **Live Updates**: Auto-refreshing data with configurable intervals

### CLI Commands
```bash
nexus tui screens          # List available screens
nexus tui render [screen]  # Render a screen
nexus tui notifications    # Show recent notifications
nexus tui toggle           # Toggle TUI on/off
```

---

## 📦 Docker Sandbox Lifecycle

Isolated execution environment for untrusted skills and code.

### Features
- **Containerized Execution**: Run skills in Docker containers with resource limits
- **Memory/CPU Limits**: Per-sandbox resource constraints
- **Network Isolation**: Optional network access control
- **Volume Mounts**: Secure file sharing between host and sandbox
- **Process Fallback**: Runs in subprocess when Docker is unavailable

### API Endpoints
```
POST   /api/sandbox/create              Create new sandbox
POST   /api/sandbox/:id/exec          Execute command in sandbox
GET    /api/sandbox/running            List running sandboxes
POST   /api/sandbox/:id/stop           Stop sandbox
```

---

## 🌍 i18n / Localization

Multi-language support with 12 built-in locales.

### Supported Locales
| Locale | Language | Direction |
|--------|----------|-----------|
| en     | English  | LTR       |
| es     | Spanish  | LTR       |
| fr     | French   | LTR       |
| de     | German   | LTR       |
| it     | Italian  | LTR       |
| pt     | Portuguese | LTR     |
| ja     | Japanese | LTR       |
| ko     | Korean   | LTR       |
| zh     | Chinese  | LTR       |
| ar     | Arabic   | RTL       |
| hi     | Hindi    | LTR       |
| ru     | Russian  | LTR       |

### API Endpoints
```
GET    /api/i18n/locales                List available locales
GET    /api/i18n/current                Get current locale
POST   /api/i18n/set                    Set locale
GET    /api/i18n/translate              Translate a key
```

---

## 👻 Daemon Mode & Service Management

Run Nexus OS as a background service with auto-restart and health monitoring.

### Features
- **LaunchAgent Integration**: macOS auto-start on boot
- **Health Monitoring**: CPU, memory, uptime tracking
- **Memory Leak Detection**: Automatic warnings on high usage
- **Graceful Shutdown**: Clean exit with event notification
- **Process Forking**: Detach from terminal

### CLI Commands
```bash
nexus daemon status                  # Show daemon status
nexus daemon start                   # Start daemon mode
nexus daemon stop                    # Stop daemon
nexus daemon install-launch-agent    # Install macOS LaunchAgent
nexus daemon uninstall-launch-agent  # Remove LaunchAgent
```

---

## 🚀 Getting Started

### 1. Database Setup
Run the migration in Supabase SQL Editor:
```bash
# File: apps/api/src/db/migrations/20250422_openclaw_features.sql
```

### 2. Install Dependencies
```bash
# Core dependencies (already in package.json)
# form-data, puppeteer, pdf-parse

# Optional: channel-specific
pnpm add @slack/bolt    # Slack
pnpm add discord.js     # Discord
pnpm add telegraf       # Telegram
```

### 3. Configure Environment
```env
# Channel credentials (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
DISCORD_BOT_TOKEN=...
TELEGRAM_BOT_TOKEN=...

# Email (optional)
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_USERNAME=...
EMAIL_PASSWORD=...

# OpenAI (embeddings, image gen, TTS, Whisper)
OPENAI_API_KEY=sk-...

# Notion
NOTION_API_KEY=ntn_...

# Trello
TRELLO_API_KEY=...
TRELLO_TOKEN=...

# Hue Smart Home
HUE_BRIDGE_IP=192.168.1.xxx
HUE_API_KEY=...

# MCP servers (optional)
MCP_SERVER_PATH=/path/to/mcp/servers

# Locale (default: en)
NEXUS_LOCALE=en
```

### 4. Start the API
```bash
cd apps/api
pnpm dev
```

### 5. Use the APIs
All new endpoints are available at `http://localhost:3006/api/`

---

## 🔒 Security Considerations

- All new systems require CEO authorization for power-lane operations
- Skill permissions are enforced at runtime (filesystem, network, shell, envVars)
- Channel DM pairing prevents unauthorized access
- Sub-agent depth limits prevent runaway spawning
- MCP servers run in restricted contexts
- Docker sandboxes isolate untrusted code execution

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Nexus OS v6.0                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Channels │  │ SubAgents│  │  Skills  │  │ Canvas │ │
│  │(Slack,   │  │(Spawning)│  │(24      │  │(Live  │ │
│  │Discord,   │  │          │  │Bundled) │  │Docs)  │ │
│  │Telegram,  │  │          │  │          │  │       │ │
│  │Email,     │  │          │  │          │  │       │ │
│  │WhatsApp,  │  │          │  │          │  │       │ │
│  │SMS)      │  │          │  │          │  │       │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬─────┘ │
│       │             │           │             │        │
│  ┌────┴─────┐  ┌────┴─────┐  ┌┴─────────┐  ┌┴──────┐ │
│  │  Memory  │  │   Cron   │  │  MCP     │  │ Voice │ │
│  │(Semantic│  │(Scheduler│  │(Bridge   │  │(STT/  │ │
│  │ Search)  │  │          │  │          │  │ TTS)  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬─────┘ │
│       │             │           │             │        │
│  ┌────┴─────┐  ┌────┴─────┐  ┌┴─────────┐  ┌┴──────┐ │
│  │   TUI    │  │  Docker  │  │  i18n    │  │Daemon │ │
│  │(Terminal│  │(Sandbox  │  │(12      │  │(Svc   │ │
│  │   UI)   │  │ Lifecycle)│  │Locales)  │  │ Mgmt)│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬─────┘ │
│       │             │           │             │        │
│  ┌────┴─────────────┴───────────┴─────────────┴──────┐ │
│  │        Master Brain / LLM Router / Orchestrator    │ │
│  │                ApprovalGuard / Saga                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │      Event Bus / WebSocket / Redis / Supabase      │  │
│  │      Tauri (Native Nerve) / React (Cyber Shell)    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔮 Future Enhancements

Planned features for upcoming releases:

- **Mobile Apps**: iOS/Android companion apps
- **Teams / IRC Channels**: Enterprise messaging integrations
- **Self-Hosting**: Fully local deployment without cloud dependencies
- **Advanced Workflow Builder**: Visual drag-and-drop automation designer
- **Plugin Marketplace**: Community skill sharing and installation
- **Multi-Agent Orchestration**: Swarm intelligence for complex tasks

---

*Nexus OS — Empowering the next generation of autonomous computing.*
