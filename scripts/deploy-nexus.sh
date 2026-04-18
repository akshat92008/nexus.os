#!/bin/bash

# Nexus OS Cloud Deployment Script (Existing Project)
# This script deploys the API and Web services to Google Cloud Run.

set -e # Exit on error

# --- Configuration ---
PROJECT_ID=${GCP_PROJECT_ID:-"ai-decision-machine"}
REGION=${GCP_REGION:-"us-central1"}
API_SERVICE_NAME="nexus-api"
WEB_SERVICE_NAME="nexus-web"
REPOSITORY_NAME="nexus-repo"

# --- Validation ---
if [ "$PROJECT_ID" == "your-project-id" ]; then
    echo "Error: Please set GCP_PROJECT_ID environment variable."
    exit 1
fi

echo "🚀 Starting Nexus OS deployment to project: $PROJECT_ID"

# 1. Set the project
gcloud config set project "$PROJECT_ID"

# 2. Enable necessary APIs
echo "Enabling Google Cloud APIs..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

# 3. Ensure Artifact Registry exists
if ! gcloud artifacts repositories describe "$REPOSITORY_NAME" --location="$REGION" &> /dev/null; then
    echo "Creating Artifact Registry: $REPOSITORY_NAME"
    gcloud artifacts repositories create "$REPOSITORY_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Nexus OS Container Registry"
fi

# 4. Configure Docker
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# --- Deployment Phase 1: API ---
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$API_SERVICE_NAME:latest"

echo "📦 Building and pushing API image..."
# gcloud builds submit doesn't have --file, so we copy the Dockerfile to root temporarily
cp apps/api/Dockerfile.production Dockerfile
gcloud builds submit --tag "$API_IMAGE" .
rm Dockerfile

echo "🚢 Deploying API to Cloud Run..."
gcloud run deploy "$API_SERVICE_NAME" \
    --image "$API_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 3001 \
    --set-env-vars="NODE_ENV=production,REDIS_URL=${REDIS_URL},SUPABASE_URL=${SUPABASE_URL},SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY},GROQ_API_KEY=${GROQ_API_KEY},OPENROUTER_API_KEY=${OPENROUTER_API_KEY},GEMINI_API_KEY=${GEMINI_API_KEY},CEREBRAS_API_KEY=${CEREBRAS_API_KEY},JWT_SECRET=${JWT_SECRET:-dev-emergency-secret}"

# Get the API URL
API_URL=$(gcloud run services describe "$API_SERVICE_NAME" --region "$REGION" --format 'value(status.url)' | tr -d '\n\r ')
echo "✅ API is live at: $API_URL"

# --- Deployment Phase 2: Web ---
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$WEB_SERVICE_NAME:latest"

echo "📦 Building and pushing Web image..."
# Again, copy Dockerfile to root temporarily
cp apps/web/Dockerfile Dockerfile

# Inject the keys directly into the Dockerfile from environment variables
sed -i '' "s|ARG NEXT_PUBLIC_API_URL|ARG NEXT_PUBLIC_API_URL=$API_URL|g" Dockerfile
sed -i '' "s|ARG NEXT_PUBLIC_SUPABASE_URL|ARG NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL|g" Dockerfile
sed -i '' "s|ARG NEXT_PUBLIC_SUPABASE_ANON_KEY|ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|g" Dockerfile

gcloud builds submit --tag "$WEB_IMAGE" .
rm Dockerfile

echo "🚢 Deploying Web to Cloud Run..."
gcloud run deploy "$WEB_SERVICE_NAME" \
    --image "$WEB_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 3000 \
    --set-env-vars="NEXT_PUBLIC_API_URL=$API_URL,NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"

WEB_URL=$(gcloud run services describe "$WEB_SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo "--------------------------------------------------"
echo "🎉 Nexus OS Deployment Complete!"
echo "API URL: $API_URL"
echo "Web URL: $WEB_URL"
echo "--------------------------------------------------"
