#!/bin/bash
# 🏗️ Nexus OS Desktop Builder
# Automates the bundling of API sidecars and the Tauri core build.

set -e

echo "🚀 Starting Nexus OS Desktop Build..."

# 1. Build Frontend
echo "📦 Building Frontend (Web)..."
pnpm --filter @nexus-os/web build

# 2. Build API & Sidecar Bundle
echo "📂 Bundling API Sidecar..."
pnpm --filter @nexus-os/api build
node apps/api/scripts/bundle-sidecar.js

# 3. Detect Platform & Generate Sidecar Binary
# Tauri requires sidecar binaries to follow the naming convention: 
# <binary-name>-<target-triple>
ARCH=$(uname -m)
OS_TYPE=$(uname -s)
TARGET_TRIPLE=""

if [[ "$OS_TYPE" == "Darwin" ]]; then
    if [[ "$ARCH" == "arm64" ]]; then
        TARGET_TRIPLE="aarch64-apple-darwin"
    else
        TARGET_TRIPLE="x86_64-apple-darwin"
    fi
elif [[ "$OS_TYPE" == "Linux" ]]; then
    TARGET_TRIPLE="x86_64-unknown-linux-gnu"
else
    echo "❌ Unsupported OS type: $OS_TYPE"
    exit 1
fi

BIN_NAME="nexus-api-$TARGET_TRIPLE"
mkdir -p src-tauri/binaries

echo "🔨 Generating binary for $TARGET_TRIPLE..."
# We use pkg to create the standalone binary. You must have 'pkg' installed: npm install -g pkg
if ! command -v pkg &> /dev/null; then
    echo "⚠️ 'pkg' tool not found. Attempting to install locally..."
    pnpm add -D pkg
fi

# Bundle the packed API into a standalone executable
npx pkg apps/api/dist/nexus-api-bundle.cjs \
    --targets node18-macos-$ARCH \
    --output src-tauri/binaries/$BIN_NAME

echo "✅ Sidecar binary prepared: src-tauri/binaries/$BIN_NAME"

# 4. Final Tauri Build
echo "🏗️ Executing Final Tauri Build..."
if ! command -v tauri &> /dev/null; then
    echo "⚠️ 'tauri' CLI not found. Using pnpm tauri..."
    pnpm tauri build
else
    tauri build
fi

echo "🎉 Build Complete! Checkout src-tauri/target/release/bundle/ for your installer."
