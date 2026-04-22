#!/bin/bash
# 🚀 Nexus OS — Recovery Bootloader v2
# Bypasses pnpm and uses lightweight API to avoid BullMQ hangs.

echo "🌑 Booting Nexus OS (Recovery Mode v2)..."

# 1. Export standard PATH for Node
export PATH=$PATH:/usr/local/bin

# 2. Kill ghost processes on our ports
lsof -ti:3015,3005 | xargs kill -9 > /dev/null 2>&1

# 3. Start Lite API Sidecar (Port 3005) — No Redis/BullMQ dependencies
echo "🛰️  Starting API Sidecar (Lite Mode)..."
cd apps/api
NODE_ENV=development PORT=3005 ./node_modules/.bin/tsx src/server-lite.ts > api.log 2>&1 &
API_PID=$!
cd ../..

# 4. Start Web Workspace (Port 3015)
echo "🖥️  Starting Web Workspace (Port 3015)..."
cd apps/web
rm -rf .next
./node_modules/.bin/next dev -p 3015 > web.log 2>&1 &
WEB_PID=$!
cd ../..

echo "⏳ Warm-up for 45 seconds (Standard mode is slower but stable)..."
sleep 45

echo "✨ Nexus OS Recovery Boot Successful!"
echo "🌐 URL: http://localhost:3015"
echo "🛰️  API: http://localhost:3005"
echo "-------------------------------------------------------"
echo "Press [Ctrl+C] to exit and shut down."
echo "-------------------------------------------------------"

trap "echo '🛑 Shutting down...'; kill $API_PID $WEB_PID; exit" INT
wait
