#!/bin/bash
# 🛰️ NEXUS OS — Instant Portal (Localtunnel)
# Exposes the local API (Port 3001) to a public URL for zero-deploy development.

PORT=3006
SUBDOMAIN="nexus-os-dev-$RANDOM" # Use a random subdomain to avoid collisions

echo "🌐 Initializing Instant Portal on port $PORT..."

# Use npx to run localtunnel without installation
# We pipe the output to a temp file so we can extract the URL
npx localtunnel --port $PORT --subdomain $SUBDOMAIN > .portal_url 2>&1 &
TUNNEL_PID=$!

# Wait for the URL to be generated (max 10 seconds for ultra-fast boot)
timeout=10
while [ $timeout -gt 0 ]; do
    URL=$(grep -o 'https://[^ ]*' .portal_url | head -n 1)
    if [ -n "$URL" ]; then
        break
    fi
    echo "⏳ Initializing Portal... ($timeout s remaining)"
    sleep 1
    ((timeout-=1))
done

if [ -n "$URL" ]; then
    echo "✨ Portal LIVE: $URL"
    echo "$URL" > .current_portal_url
else
    echo "❌ Portal initialization FAILED after 30s."
    echo "💡 FALLBACK: Your API is internally running on http://localhost:$PORT"
    echo "🔗 You can still use the TUI; it is configured to talk to localhost."
    echo "👉 Check .portal_url for potential 'npx' or network errors."
fi

# Keep the script running to manage the tunnel
# If this script is killed, the tunnel dies.
trap "kill $TUNNEL_PID; rm .portal_url .current_portal_url; exit" SIGINT SIGTERM
wait $TUNNEL_PID
