#!/bin/bash
# 🚀 NEXUS BRAIN: INFRASTRUCTURE HARDENING DEPLOYMENT 🚀

PROJECT_ID="nexus-493706"
PROJECT_NUMBER="370736307795"
REGION="us-east1"
SERVICE_NAME="nexus-intelligence"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}"

echo "📦 Preparing for Hardened Two-Step Deployment..."

# 1. Project Configuration
echo "🔌 Configuring Project: ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# 2. IAM Hardening (Fixing the 403, Push, and Log issues)
echo "🔑 Granting High-Level Permissions to Service Accounts..."

# Target BOTH accounts to be absolutely sure
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

# 3. Step 1: BUILD (Explicitly using gcloud builds submit for detailed logs)
echo "🔨 Phase 1: Submitting Build to Cloud Build..."
gcloud builds submit --tag ${IMAGE_NAME} .

# 4. Step 2: DEPLOY (Launching the built image)
echo "🌩️ Phase 2: Deploying Built Image to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated

echo ""
echo "✅ Infrastructure Hardening Complete."
echo "👉 If the build failed, the error is now visible in your terminal above."
echo "👉 If it succeeded, copy the Service URL and update ui.py."
