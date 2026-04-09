#!/bin/bash
# 🚀 Nexus OS — Instant Desktop Bootloader
# Bypass production builds and run a high-performance "App Window" instantly.

echo "🌑 Booting Nexus OS..."

# Kill any existing processes on our ports
lsof -ti:3000 | xargs kill -9 > /dev/null 2>&1
lsof -ti:3001 | xargs kill -9 > /dev/null 2>&1

# 1. Start the API Sidecar (Background)
echo "🛰️  Starting API Sidecar (logging to apps/api/api.log)..."
pnpm --filter @nexus-os/api dev > apps/api/api.log 2>&1 &
API_PID=$!

# 2. Start the Web Workspace (Background)
echo "🖥️  Starting Web Workspace (logging to apps/web/web.log)..."
pnpm --filter @nexus-os/web dev > apps/web/web.log 2>&1 &
WEB_PID=$!

# 3. Wait for boot
echo "⏳ Warm-up in progress..."
sleep 6

# 4. Launch the App Window
# We use Chrome's --app mode to create a borderless, dedicated window.
# If you use Brave or Edge, we can adjust the command.
if open -Ra "Google Chrome" > /dev/null 2>&1; then
  echo "🎨 Launching Dedicated App Window (Chrome Mode)..."
  open -a "Google Chrome" --args --app=http://localhost:3000
elif open -Ra "Brave Browser" > /dev/null 2>&1; then
  echo "🎨 Launching Dedicated App Window (Brave Mode)..."
  open -a "Brave Browser" --args --app=http://localhost:3000
else
  echo "🌐 Opening in default browser..."
  open http://localhost:3000
fi

echo "✨ Nexus OS is live!"
echo "-------------------------------------------------------"
echo "Press [Ctrl+C] to exit and shut down all system layers."
echo "-------------------------------------------------------"

# Cleanup on exit
trap "echo '🛑 Shutting down...'; kill $API_PID $WEB_PID; exit" INT
wait
