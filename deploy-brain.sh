#!/bin/bash
# 🚀 NEXUS BRAIN: INFRASTRUCTURE HARDENING DEPLOYMENT 🚀
# NOTE: All secrets are injected via environment variables.
# Set them in your shell profile (~/.zshrc) or CI/CD pipeline:
#   export OPENROUTER_KEY="sk-or-v1-..."
#   export GROQ_API_KEY="gsk_..."
#   export GEMINI_API_KEY="..."

PROJECT_ID="nexus-493706"
PROJECT_NUMBER="370736307795"
REGION="us-east1"
SERVICE_NAME="nexus-intelligence"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}"

# Validate required secrets
if [ -z "$OPENROUTER_KEY" ] || [ -z "$GROQ_API_KEY" ]; then
    echo "❌ ERROR: Missing required environment variables."
    echo "   Set OPENROUTER_KEY, GROQ_API_KEY, and GEMINI_API_KEY in your shell."
    echo "   Example: export OPENROUTER_KEY='sk-or-v1-...'"
    exit 1
fi

echo "🥪 Preparing for Hardened Two-Step Deployment..."

# 1. Project Configuration
echo "💻 Configuring Project: ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# 2. IAM Hardening
echo "🔑 Granting High-Level Permissions to Service Accounts..."

ACCOUNTS=(
    "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
    "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
)

for ACCOUNT in "${ACCOUNTS[@]}"; do
    echo "🛡️ Securing account: ${ACCOUNT}"
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${ACCOUNT}" \
        --role="roles/artifactregistry.admin" \
        --quiet
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${ACCOUNT}" \
        --role="roles/logging.logWriter" \
        --quiet
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${ACCOUNT}" \
        --role="roles/storage.objectViewer" \
        --quiet
done

# 3. BUILD
echo "🔨 Phase 1: Submitting Build to Cloud Build..."
gcloud builds submit --tag ${IMAGE_NAME} .

# 4. DEPLOY with secrets from environment
echo "🌩️ Phase 2: Deploying Built Image to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --set-env-vars="OPENROUTER_KEY=${OPENROUTER_KEY},GROQ_API_KEY=${GROQ_API_KEY},GEMINI_API_KEY=${GEMINI_API_KEY}"

echo ""
echo "✅ Infrastructure Hardening Complete."
echo "👉 Copy the Service URL and update ui.py if it changed."
