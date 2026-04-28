#!/bin/bash
# 🚀 Nexus OS — Turbo Launcher
# Optimized for local-first, zero-latency development on macOS.

echo "🌑 Booting Nexus OS in TURBO mode..."

# 1. SETUP ENVIRONMENT
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin"
export STORAGE_STRATEGY="local"
export PORT=3006
export NODE_ENV="development"

echo "🛠️  Persistence Strategy: LOCAL (nexus-state.json)"

# 2. CHECK FOR BUILD
# If dist is older than 5 minutes, it's probably stale. Fallback to tsx.
DIST_TIME=$(stat -f "%m" apps/api/dist/index.js 2>/dev/null || echo 0)
NOW=$(date +%s)
AGE=$((NOW - DIST_TIME))

if [ $AGE -gt 300 ] || [ ! -d "apps/api/dist" ]; then
    echo "⚠️  API 'dist' is stale or missing ($AGE seconds old). Using 'tsx' for fresh startup..."
    MODE="tsx"
else
    MODE="node"
fi

# 3. START API SIDECAR
echo "🛰️  Starting API Sidecar (Port $PORT) via $MODE..."
if [ "$MODE" == "node" ]; then
    node apps/api/dist/index.js > apps/api/api.log 2>&1 &
else
    npx -y tsx apps/api/src/index.ts > apps/api/api.log 2>&1 &
fi
API_PID=$!

# 4. START WEB WORKSPACE
echo "🖥️  Starting Web Workspace (Port 3000)..."
# Use a lighter dev server or just open if already running
# For simplicity, we trigger pnpm dev for web but with local strategy
STORAGE_STRATEGY=local npx -y pnpm --filter @nexus-os/web dev > apps/web/web.log 2>&1 &
WEB_PID=$!

# 5. HEALTH CHECK
echo "⏳ Waiting for API..."
until $(curl --output /dev/null --silent --head --fail http://localhost:$PORT/api/health); do
    printf '.'
    sleep 0.5
done
echo -e "\n✅ Local API is LIVE!"

# 6. LAUNCH
open http://localhost:3000

echo "-------------------------------------------------------"
echo "✨ Nexus OS is running in LOCAL-FIRST mode."
echo "No cloud handshakes, no firewall delays."
echo "Press [Ctrl+C] to shut down."
echo "-------------------------------------------------------"

trap "kill $API_PID $WEB_PID; exit" INT
wait
