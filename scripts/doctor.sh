#!/bin/bash
# 🩺 Nexus OS Doctor — Diagnostic Tool

echo "🩺 Nexus OS System Report"
echo "========================="

# 1. Environment Check
if [ -f "apps/api/.env" ]; then
    echo "✅ API environment present (apps/api/.env)"
else
    echo "❌ API environment MISSING! (Expected apps/api/.env)"
fi

if [ -f "apps/web/.env.local" ]; then
    echo "✅ Web environment present (apps/web/.env.local)"
else
    echo "❌ Web environment MISSING! (Expected apps/web/.env.local)"
fi

# 2. Dependencies Check
if [ ! -d "node_modules" ]; then
    echo "⚠️  Global node_modules missing. (pnpm install required)"
else
    echo "✅ Global node_modules present"
fi

# 3. Port Check
PORTS=(3000 3001 3006 5173)
for port in "${PORTS[@]}"; do
    PID=$(lsof -ti:$port)
    if [ -n "$PID" ]; then
        echo "⚠️  Port $port is BUSY (PID: $PID)"
    else
        echo "✅ Port $port is free"
    fi
done

# 4. Tooling Check
# Note: Path might vary in shell environments
if command -v pnpm >/dev/null 2>&1; then
    echo "✅ pnpm: $(pnpm -v)"
else
    echo "⚠️  pnpm not in current PATH (but might work via run_command)"
fi

echo "========================="
echo "Diagnostic complete."
