#!/bin/bash
# ☢️  NEXUS OS — NUCLEAR RESET & DEBUG
# Use this when everything feels "stuck."

echo "🧹 Phase 1: Cleaning the environment..."

# 1. Kill EVERY Node/Next/Tauri process
echo "💀 Killing all Node/Next processes..."
killall -9 node > /dev/null 2>&1
killall -9 next-router-worker > /dev/null 2>&1
lsof -ti:3000,3001 | xargs kill -9 > /dev/null 2>&1

# 2. Wipe Caches
echo "🧼 Wiping build caches..."
rm -rf apps/web/.next
rm -rf apps/api/dist

echo "⚙️  Phase 2: Starting System Layers in FOREGROUND..."

# 3. Limit Node Memory to 1.5GB (Strict limit for 8GB RAM)
export NODE_OPTIONS="--max-old-space-size=1536"

# 4. Start API Sidecar (Static Mode, no heavy watching)
echo "🛰️  Booting API Sidecar (Static Mode)..."
(cd apps/api && pnpm exec tsx src/index.ts) &
API_PID=$!

# 5. Wait for API to be healthy
echo "⏳ Waiting for API to stabilize..."
sleep 10

# 6. Start Web Workspace in FOREGROUND
echo "🖥️  Booting Web Workspace (Turbo Mode)..."
echo "-------------------------------------------------------"
echo "ATTENTION: We are now starting the heaviest part."
echo "Please do NOT switch windows—let the M3 focus on this."
echo "-------------------------------------------------------"
pnpm --filter @nexus-os/web dev

# Cleanup
trap "echo '🛑 Shutting down...'; kill $API_PID; exit" INT
wait
