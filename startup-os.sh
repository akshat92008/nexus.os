#!/bin/bash
# 🚀 NEXUS OS v2.0 MASTER STARTUP (CLOUD-NATIVE) 🚀
echo "🌌 Connecting to Cloud Intelligence..."

# Load environment variables
if [ -f "apps/api/.env" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ "$line" =~ ^$ ]] && continue
        export "$line"
    done < "apps/api/.env"
fi

# Ensure port 3006 is clear
lsof -ti:3006 | xargs kill -9 > /dev/null 2>&1
sleep 1

# 1. Launch API (Static Mode) in background
echo "🚀 Starting API in Watch Mode..."
/usr/local/bin/pnpm dev:api > .api_log 2>&1 &
API_PID=$!

# 2. Launch Instant Portal (Tunnel) in background
echo "🌐 Opening Instant Portal..."
bash scripts/portal.sh &
PORTAL_PID=$!

# 3. Launch the Cyber-Shell UI (Foreground)
echo "🖥️  Launching HUD..."
./nexus_env/bin/python3 Code/ui.py

# Cleanup on exit
kill $API_PID $PORTAL_PID
rm .api_log
