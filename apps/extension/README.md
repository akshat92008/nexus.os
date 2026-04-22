# Nexus OS Browser Extension

Chrome/Firefox/Edge extension that bridges your browser to Nexus OS.

## Features
- **Send current page** to Nexus OS for AI analysis (Cmd+Shift+N)
- **Ask questions** about the current page (Cmd+Shift+A)
- **Control browser** via Nexus OS skill commands
- **Highlight, click, fill** elements via remote automation

## Installation

### Chrome (Developer Mode)
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this `apps/extension/` folder

### Firefox
1. Open `about:debugging`
2. Click "This Firefox" → "Load Temporary Add-on"
3. Select `manifest.json`

## Usage
Once Nexus OS is running (`pnpm dev` in `apps/api`), the extension will auto-connect.

### Shortcuts
- `Cmd+Shift+N` — Send current page to Nexus OS
- `Cmd+Shift+A` — Ask Nexus OS about current page

### Popup Actions
- Send Page to Nexus → Stores page text in memory, triggers analysis
- Ask About This Page → Sends question + page context to master brain
- Open Dashboard → Opens Nexus OS web interface in new tab

## API Integration
The extension communicates with Nexus OS API at `http://localhost:3006`:

```
POST /api/skills/v2/execute  (browser_extract, browser_navigate)
POST /api/missions/quick    (analyze page content)
```

## Security
- Only connects to `localhost` — no external network access
- Page data is sent only on explicit user action
- No persistent storage of browsing history
