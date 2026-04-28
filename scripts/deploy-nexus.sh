#!/bin/bash

# Nexus OS Cloud Deployment Script (Existing Project)
# This script deploys the API and Web services to Google Cloud Run.

set -e # Exit on error

# --- Configuration ---
PROJECT_ID=${GCP_PROJECT_ID:-"nexus-493706"}
REGION=${GCP_REGION:-"us-central1"}
API_SERVICE_NAME="nexus-api"
WEB_SERVICE_NAME="nexus-web"
REPOSITORY_NAME="nexus-repo"

# --- Validation ---
if [ -f "apps/api/.env" ]; then
    echo "🔑 Loading environment from apps/api/.env..."
    export $(grep -v '^#' apps/api/.env | xargs)
fi
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

# --- Deployment Phase 1: Building Images (Parallel) ---
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$API_SERVICE_NAME:latest"
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$WEB_SERVICE_NAME:latest"

echo "📦 Building images in parallel..."

# 1. Build API
(
    echo "🏗️  Starting API Build..."
    docker build -t "$API_IMAGE" -f apps/api/Dockerfile.production .
    docker push "$API_IMAGE"
    echo "✅ API Image ready."
) &
API_PID=$!

# 2. Build Web
(
    echo "🏗️  Starting Web Build..."
    # Inject API URL for the web build
    # In local docker build, we can use --build-arg
    docker build -t "$WEB_IMAGE" \
        --build-arg NEXT_PUBLIC_API_URL="https://nexus-api-z5eeurxruq-uc.a.run.app" \
        --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
        --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
        -f apps/web/Dockerfile .
    docker push "$WEB_IMAGE"
    echo "✅ Web Image ready."
) &
WEB_PID=$!

wait $API_PID $WEB_PID
echo "📦 All images pushed to Registry."

# --- Deployment Phase 2: Cloud Run Deploy ---
echo "🚢 Deploying services to Cloud Run..."

gcloud run deploy "$API_SERVICE_NAME" \
    --image "$API_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 3001 \
    --set-env-vars="NODE_ENV=production,REDIS_URL=${REDIS_URL},SUPABASE_URL=${SUPABASE_URL},SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY},GROQ_API_KEY=${GROQ_API_KEY},OPENROUTER_API_KEY=${OPENROUTER_API_KEY},GEMINI_API_KEY=${GEMINI_API_KEY},CEREBRAS_API_KEY=${CEREBRAS_API_KEY},JWT_SECRET=${JWT_SECRET:-dev-emergency-secret}" &

gcloud run deploy "$WEB_SERVICE_NAME" \
    --image "$WEB_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 3000 \
    --set-env-vars="NEXT_PUBLIC_API_URL=https://nexus-api-z5eeurxruq-uc.a.run.app,NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" &

wait

WEB_URL=$(gcloud run services describe "$WEB_SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo "--------------------------------------------------"
echo "🎉 Nexus OS Deployment Complete!"
echo "API URL: $API_URL"
echo "Web URL: $WEB_URL"
echo "--------------------------------------------------"
