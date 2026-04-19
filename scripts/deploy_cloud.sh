#!/bin/bash
# Nexus OS — Cloud Brain Deployer
set -e

# 1. Configuration
PROJECT_ID="nexus-493706"

echo "🚀 Starting Nexus Brain Deployment for Project: $PROJECT_ID"
echo "📦 Optimizing and preparing cloud archive..."
echo "💡 (Total archive should be < 5MB if correctly optimized)"

# 2. Build and Push to Cloud Build (Running from root context)
# Validates that we are in the monorepo root
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo "❌ ERROR: deploy_cloud.sh must be run from the repository root."
    exit 1
fi

gcloud builds submit --config cloudbuild.yaml .

# 3. Final Verification
echo "✅ Deployment complete!"
SERVICE_URL=$(gcloud run services describe nexus-brain --platform managed --region us-central1 --format 'value(status.url)')
echo "🌐 Your Cloud Brain is now live at: $SERVICE_URL"
echo ""
echo "💡 To use this in your Dashboard, set your environment variable:"
echo "export NEXT_PUBLIC_API_URL=$SERVICE_URL"
