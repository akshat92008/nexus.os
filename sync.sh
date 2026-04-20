#!/bin/bash
# 🚀 Nexus OS — Auto-Sync Tool
# Stages, commits, and pushes to GitHub in one go.

echo "🔍 Scanning for changes..."

# Check if we are in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "❌ Error: Not a git repository."
  exit 1
fi

# 1. Check if there are changes
if [[ -z $(git status -s) ]]; then
  echo "✅ No changes to sync. Everything is up to date."
  exit 0
fi

# 2. Add everything
echo "📦 Staging updates..."
git add .

# 3. Create a commit message with a timestamp
# If the user passed a message, use it. Otherwise use a timestamp.
if [ -z "$1" ]; then
  MESSAGE="Nexus OS Update: $(date +'%Y-%m-%d %H:%M:%S')"
else
  MESSAGE="$1"
fi

echo "✍️  Committing: $MESSAGE"
git commit -m "$MESSAGE"

# 4. Detect branch and push
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "☁️  Pushing to GitHub [$BRANCH]..."

if git push origin "$BRANCH"; then
  echo "✨ Sync complete! Vercel is now updating your website in the background."
else
  echo "❌ Error: Push failed. Check your internet connection or GitHub credentials."
  exit 1
fi
