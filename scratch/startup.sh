#!/bin/bash
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin
export PNPM_HOME=$PWD/scratch/pnpm
export XDG_DATA_HOME=$PWD/scratch/data
export XDG_CACHE_HOME=$PWD/scratch/cache
mkdir -p $PNPM_HOME $XDG_DATA_HOME $XDG_CACHE_HOME

echo "Starting API..."
pnpm --filter @nexus-os/api dev > scratch/api.log 2>&1 &
echo $! > scratch/api.pid

echo "Starting Web..."
pnpm --filter @nexus-os/web dev > scratch/web.log 2>&1 &
echo $! > scratch/web.pid

echo "Waiting for ports..."
sleep 15

echo "Starting Tunnels..."
# Tunnel API
npx -y localtunnel --port 3006 > scratch/api-tunnel.log 2>&1 &
# Tunnel Web
npx -y localtunnel --port 3000 > scratch/web-tunnel.log 2>&1 &

sleep 5
API_URL=$(grep -o 'https://[^ ]*' scratch/api-tunnel.log)
WEB_URL=$(grep -o 'https://[^ ]*' scratch/web-tunnel.log)

echo "--- DEPLOYMENT READY ---"
echo "Web URL: $WEB_URL"
echo "API URL: $API_URL"
