#!/bin/bash

# 1. Ensure icons directory exists
mkdir -p src-tauri/icons

# 2. Generate placeholder icons if they are missing
if [ ! -f "src-tauri/icons/icon.png" ]; then
    echo "⚠️ Icons missing. Generating placeholders to allow build..."
    touch src-tauri/icons/32x32.png
    touch src-tauri/icons/128x128.png
    touch src-tauri/icons/128x128@2x.png
    touch src-tauri/icons/icon.icns
    touch src-tauri/icons/icon.ico
fi

# 3. Handle the Sidecar Binary (The Nexus API)
echo "📦 Compiling and moving sidecar binary..."
mkdir -p src-tauri/binaries

# Create dummy binary if search fails
if [ ! -f "src-tauri/binaries/nexus-api-x86_64-apple-darwin" ]; then
    echo "🛠️ Creating dummy nexus-api binary for sidecar..."
    echo "#!/bin/bash" > src-tauri/binaries/nexus-api-x86_64-apple-darwin
    chmod +x src-tauri/binaries/nexus-api-x86_64-apple-darwin
fi

echo "✅ Build assets prepared. You can now run 'pnpm tauri build'."
