#!/bin/bash
# 🛰️ Nexus OS — Lean API Launcher
# Perfect for 8GB RAM machines. Starts only the backend brain.

echo "🌑 Starting Nexus OS API Brain..."

# Clean up old processes
lsof -ti:3001 | xargs kill -9 > /dev/null 2>&1

# Move to API directory
cd apps/api

# Start API with strict memory limit
export NODE_OPTIONS="--max-old-space-size=512"

echo "🧠 API is booting..."
pnpm exec tsx src/index.ts
