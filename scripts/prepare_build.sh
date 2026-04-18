#!/bin/bash

# Nexus OS — Native Build Preparation Pipeline
set -e

echo "🚀 Starting Nexus OS Production Hardening... (BETA v3.2)"

# 1. Ensure icons directory exists
mkdir -p src-tauri/icons

# 2. Generate placeholder icons if they are missing
if [ ! -f "src-tauri/icons/icon.png" ] || [ ! -s "src-tauri/icons/icon.png" ]; then
    echo "⚠️ Icons missing or invalid. Generating placeholders to allow build..."
    touch src-tauri/icons/32x32.png
    touch src-tauri/icons/128x128.png
    touch src-tauri/icons/128x128@2x.png
    touch src-tauri/icons/icon.icns
    touch src-tauri/icons/icon.ico
    # Create a minimal 1x1 png to satisfy compiler
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" | base64 --decode > src-tauri/icons/icon.png
fi

# 3. Handle the Sidecar Binary (The Native Nexus API)
echo "📦 Compiling native sidecar binary..."
mkdir -p src-tauri/binaries

# Compile the native sidecar crate
# Assuming x86_64 target for now; in CI we would handle both architectures
cd src-tauri/nexus-api
cargo build --release

# Move the binary to the correct location as defined in tauri.conf.json
cp target/release/nexus-api ../binaries/nexus-api-x86_64-apple-darwin

echo "✅ Build assets prepared. Architecture is now shippable."
echo "🚢 Run 'pnpm tauri build' to generate the signed .app bundle."
