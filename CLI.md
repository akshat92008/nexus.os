# Nexus OS CLI — Command Line Interface

Direct command-line access to your AI employee.

## Installation

```bash
npm install -g @nexus-os/cli
# or
npx @nexus-os/cli
```

## Usage

### Onboard (First Time)
```bash
nexus onboard
# Guides you through: API setup, channels, skills, agent preferences
```

### Agent Interaction
```bash
# Quick query
nexus ask "Review the code in ./src and suggest improvements"

# Long-running task (spawns sub-agents)
nexus agent --message "Build a marketing campaign for our product launch" --thinking high

# With specific skills
nexus agent --message "Analyze competitors" --skills web_search,data_analysis
```

### Channel Management
```bash
# Approve a DM pairing request
nexus pairing approve slack ABC123

# Send broadcast
nexus broadcast "System maintenance in 5 minutes"

# List channels
nexus channels list
```

### Task Scheduling
```bash
# Schedule a daily report
nexus task schedule "Daily Standup Report" --cron "0 9 * * 1-5" --agent "Summarize yesterday's progress"

# List scheduled tasks
nexus tasks list

# Pause/resume/cancel
nexus task pause <task-id>
nexus task resume <task-id>
nexus task cancel <task-id>
```

### Memory Commands
```bash
# Search memories
nexus memory search "pricing strategy decisions"

# Store a fact
nexus memory store --type fact "Customer prefers email over phone"

# Recall context
nexus memory recall "What did we discuss about deployment?"
```

### MCP Management
```bash
# Connect an MCP server
nexus mcp connect --name "fs" --command "npx" --args "-y,@modelcontextprotocol/server-filesystem,/workspace"

# List MCP tools
nexus mcp tools

# Call an MCP tool
nexus mcp call fs read_file --params '{"path": "/workspace/README.md"}'
```

### Skill Management
```bash
# List installed skills
nexus skills list

# Install from URL
nexus skills install https://nexus-hub.ai/skills/web-scraper.json

# Execute a skill tool
nexus skills execute web_search --query "AI agent frameworks 2024"
```

### Sub-Agent Management
```bash
# List active agents
nexus agents list

# Spawn a specific agent
nexus agents spawn --name "CodeReviewer" --message "Review PR #42"

# Steer an agent
nexus agents steer <session-id> --action pause
```

### System Status
```bash
# Health check
nexus status

# System diagnostics
nexus doctor

# View logs
nexus logs --follow
```

## Configuration

Config file: `~/.nexus/config.json`

```json
{
  "apiUrl": "http://localhost:3006",
  "defaultAgent": {
    "model": "llama-3.3-70b",
    "thinking": "medium"
  },
  "channels": {
    "default": "slack"
  }
}
```

## Environment Variables

```bash
NEXUS_API_URL=http://localhost:3006
NEXUS_API_KEY=your-key
NEXUS_DEFAULT_MODEL=llama-3.3-70b
NEXUS_LOG_LEVEL=info
```
