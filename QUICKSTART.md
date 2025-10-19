# Quick Start Guide

Get your Google Chat Secret Manager Bot running in 15 minutes!

## Prerequisites Checklist

- [ ] Node.js 16+ installed
- [ ] Google Cloud Platform account
- [ ] Google Workspace with Google Chat access
- [ ] GCP project created

## Step-by-Step Setup

### 1. Enable APIs (2 minutes)

```bash
# Set your project
gcloud config set project YOUR-PROJECT-ID

# Enable required APIs
gcloud services enable chat.googleapis.com secretmanager.googleapis.com
```

### 2. Create Service Account (3 minutes)

```bash
# Create service account
gcloud iam service-accounts create gchat-secret-bot \
  --display-name="Google Chat Secret Manager Bot"

# Get your project ID
export PROJECT_ID=$(gcloud config get-value project)

# Grant Secret Manager access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Create and download key
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com
```

### 3. Install Application (2 minutes)

```bash
# Clone and install
cd gchat-secret-manager-bot
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
APPROVER_EMAILS=your-email@company.com,approver@company.com
GCP_PROJECT_ID=your-project-id
```

### 4. Test Locally with ngrok (3 minutes)

Terminal 1:
```bash
npm start
```

Terminal 2:
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Configure Google Chat App (5 minutes)

1. Go to: https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat
2. Click **"Configuration"**
3. Fill in:
   - **App name**: Secret Manager Bot
   - **Avatar URL**: `https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png`
   - **Description**: Secure secret access with approval
   - **Functionality**: Check both options
   - **Connection settings**: App URL → Your ngrok URL + `/webhook`
   - **Permissions**: Specific people and groups

4. Click **"Save"**

### 6. Test It! (1 minute)

1. Open Google Chat
2. Search for "Secret Manager Bot"
3. Send: `/secret my-project my-secret`
4. Click Approve (if you're an approver)
5. Check your DM for the secret!

## Common Issues

**Bot doesn't respond:**
- Check if webhook URL is accessible: `curl https://your-ngrok-url/webhook`
- Verify logs in your terminal

**Can't approve:**
- Your email must be in `APPROVER_EMAILS`
- Restart the bot after changing `.env`

**Secret not found:**
- Verify project name and secret name
- Check service account has `Secret Manager Secret Accessor` role

## Next Steps

- [ ] Deploy to Cloud Run for production (see README.md)
- [ ] Add more approvers to `.env`
- [ ] Test with your team
- [ ] Set up monitoring

## Need Help?

See the full [README.md](./README.md) for detailed documentation.
