#!/bin/bash
# 🔍 Nexus OS — Local Environment Diagnostic
# Verifies LLM connectivity, infrastructure, and dependency health.

echo "🔍 Starting Nexus OS Local Health Check..."

# --- 1. DEPENDENCY CHECK ---
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules missing. (Run: pnpm install)"
else
    echo "✅ node_modules found."
fi

# --- 2. ENVIRONMENT CHECK ---
ENV_FILE="apps/api/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ apps/api/.env missing. (Copy .env.example and populate)"
    exit 1
else
    echo "✅ apps/api/.env found."
fi

# Load env variables (simple parsing)
source_env() {
  export $(grep -v '^#' "$ENV_FILE" | xargs)
}
source_env

# --- 3. INFRASTRUCTURE CHECK ---
echo "⚙️  Checking Infrastructure..."

# Redis
if command -v redis-cli > /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis: Online"
    else
        echo "❌ Redis: Offline (Is Docker running?)"
    fi
else
    # Try direct port check
    if (echo >/dev/tcp/localhost/6379) &>/dev/null; then
        echo "✅ Redis: Online (Port 6379 listening)"
    else
        echo "❌ Redis: Offline"
    fi
fi

# Database (Postgres)
if (echo >/dev/tcp/localhost/5432) &>/dev/null; then
    echo "✅ Database: Online (Port 5432 listening)"
else
    echo "❌ Database: Offline (Expected port 5432)"
fi

# --- 4. AI CONNECTIVITY CHECK ---
echo "🤖 Checking AI Reasoning Bridges..."

# Groq
if [ -n "$GROQ_API_KEY" ] && [[ "$GROQ_API_KEY" != "gsk_..." ]]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://api.groq.com/openai/v1/chat/completions \
      -H "Authorization: Bearer $GROQ_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"model":"llama3-8b-8192", "messages":[{"role":"user","content":"ping"}]}')
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo "✅ Groq API: Connection Successful"
    elif [ "$HTTP_CODE" == "401" ]; then
        echo "❌ Groq API: Invalid Key (401)"
    else
        echo "⚠️  Groq API: Failed (HTTP $HTTP_CODE)"
    fi
else
    echo "⚪ Groq API: Key not set in .env"
fi

# OpenRouter
if [ -n "$OPENROUTER_API_KEY" ] && [[ "$OPENROUTER_API_KEY" != "sk-or-..." ]]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://openrouter.ai/api/v1/chat/completions \
      -H "Authorization: Bearer $OPENROUTER_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"model":"openrouter/auto", "messages":[{"role":"user","content":"ping"}]}')
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo "✅ OpenRouter API: Connection Successful"
    else
        echo "⚠️  OpenRouter API: Check connection/key (HTTP $HTTP_CODE)"
    fi
else
    echo "⚪ OpenRouter API: Key not set in .env"
fi

echo "------------------------------------------------"
echo "Check complete. If Redis/DB are Offline, run:"
echo "docker-compose up -d"
echo "------------------------------------------------"
