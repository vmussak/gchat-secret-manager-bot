#!/bin/bash

# Script to deploy the bot to Google Cloud Run
# Usage: ./deploy-cloud-run.sh

set -e

# Configuration
SERVICE_NAME="gchat-secret-manager-bot"
REGION="us-central1"
PROJECT_ID=$(gcloud config get-value project)

echo "🚀 Deploying $SERVICE_NAME to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if APPROVER_EMAILS is set
if [ -z "$APPROVER_EMAILS" ]; then
  echo "⚠️  APPROVER_EMAILS environment variable not set"
  echo "Please set it before deploying:"
  echo 'export APPROVER_EMAILS="approver1@company.com,approver2@company.com"'
  echo ""
  read -p "Enter approver emails (comma-separated): " APPROVER_EMAILS
fi

echo "Approvers: $APPROVER_EMAILS"
echo ""

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "APPROVER_EMAILS=$APPROVER_EMAILS" \
  --service-account "gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo ""
echo "Service URL: $SERVICE_URL"
echo "Webhook URL: ${SERVICE_URL}/webhook"
echo ""
echo "📝 Next steps:"
echo "1. Update your Google Chat app configuration"
echo "2. Set the App URL to: ${SERVICE_URL}/webhook"
echo "3. Test with: /secret $PROJECT_ID test-secret"
