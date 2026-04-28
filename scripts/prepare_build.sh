#!/bin/bash

# Nexus OS — Golden Master Build Preparation Pipeline
set -e

echo "🚀 Starting Nexus OS 'Golden Master' Hardening... (BETA v3.2)"

# 1. Ensure icons directory exists
mkdir -p src-tauri/icons

# 2. Sidecar Binary (The Native Nexus API)
echo "📦 Compiling native sidecar binary for M3 architecture..."
mkdir -p src-tauri/binaries

# Compile the native sidecar crate for the HOST architecture
cd src-tauri/nexus-api
cargo build --release

# Detect host architecture for sidecar naming
ARCH=$(uname -m)
if [ "$ARCH" == "arm64" ]; then
    TAURI_ARCH="aarch64-apple-darwin"
else
    TAURI_ARCH="x86_64-apple-darwin"
fi

echo "🎯 Targeted sidecar architecture: $TAURI_ARCH"
cp target/release/nexus-api ../binaries/nexus-api-$TAURI_ARCH

cd ../..

echo "✅ Build assets prepared. Native Nerve is ready for M3."
echo "🚢 Run 'pnpm tauri build' to generate the signed .app bundle."
