#!/bin/bash

# Script to create a test secret in Google Secret Manager
# Usage: ./create-test-secret.sh [project-id] [secret-name] [secret-value]

set -e

PROJECT_ID=${1:-$(gcloud config get-value project)}
SECRET_NAME=${2:-"test-secret"}
SECRET_VALUE=${3:-"MyTestSecretValue123"}

echo "Creating secret in project: $PROJECT_ID"
echo "Secret name: $SECRET_NAME"

# Create the secret
echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-

echo "✅ Secret created successfully!"
echo ""
echo "To grant access to your service account:"
echo "gcloud secrets add-iam-policy-binding $SECRET_NAME \\"
echo "  --project=$PROJECT_ID \\"
echo "  --member='serviceAccount:gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com' \\"
echo "  --role='roles/secretmanager.secretAccessor'"
echo ""
echo "Test command in Google Chat:"
echo "/secret $PROJECT_ID $SECRET_NAME"
