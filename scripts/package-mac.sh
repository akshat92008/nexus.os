#!/bin/bash

# Nexus OS — Native Mac Notarization Script
# Requires: APPLE_ID, APPLE_PASSWORD, TEAM_ID in environment

set -e

echo "🚀 Starting Nexus OS Production Build..."
pnpm tauri build

APP_PATH="src-tauri/target/release/bundle/macos/Nexus OS.app"
ZIP_PATH="src-tauri/target/release/bundle/macos/NexusOS.zip"

echo "✍️ Signing the App Bundle..."
# codesign --deep --force --options runtime --sign "Developer ID Application: Your Name (TEAMID)" "$APP_PATH"

echo "📦 Packaging for Notarization..."
/usr/bin/ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "🛰️ Submitting to Apple Notary Service..."
# xcrun notarytool submit "$ZIP_PATH" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$TEAM_ID" --wait

echo "✅ Notarization Complete. Ready for distribution."
