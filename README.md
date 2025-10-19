# Google Chat Secret Manager Bot 🔐

A secure Node.js Express API that integrates Google Chat with Google Secret Manager, featuring an approval workflow for accessing secrets.

## Features

- 🔒 **Secure Secret Access**: Request secrets from Google Secret Manager
- ✅ **Approval Workflow**: Designated approvers must authorize secret access
- 💬 **Google Chat Integration**: Interactive cards and private messaging
- 🔑 **Private Delivery**: Secrets are sent privately to requesters
- 📝 **Audit Trail**: All requests are logged with requester and approver information

## Architecture

1. User requests a secret via Google Chat command: `/secret <project-name> <secret-name>`
2. Bot creates an approval card visible to the space/room
3. Authorized approvers can click "Approve" or "Deny"
4. On approval, bot fetches the secret from Secret Manager
5. Secret is sent privately to the requester via direct message

## Prerequisites

- Node.js 16+ and npm
- Google Cloud Platform account
- Google Workspace with Google Chat enabled
- GCP project with Secret Manager API enabled

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 2. Enable Required APIs

Enable the following APIs in your GCP project:

```bash
gcloud services enable chat.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

Or enable them via the [API Library](https://console.cloud.google.com/apis/library):
- Google Chat API
- Secret Manager API

### 3. Create a Service Account

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **"Create Service Account"**
3. Fill in the details:
   - **Name**: `gchat-secret-bot`
   - **Description**: Service account for Google Chat Secret Manager Bot
4. Click **"Create and Continue"**
5. Grant the following roles:
   - `Secret Manager Secret Accessor` (to read secrets)
   - `Chat Bot` (to send messages)
6. Click **"Continue"** and then **"Done"**

### 4. Create Service Account Key

1. Click on the newly created service account
2. Go to the **"Keys"** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **JSON** format
5. Click **"Create"** - the key file will download
6. Rename the file to `service-account-key.json`
7. Move it to your project root directory

⚠️ **Important**: Never commit this file to version control!

### 5. Configure Secret Manager Permissions

For each GCP project containing secrets you want to access:

1. Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager)
2. Select the project
3. For each secret (or at project level):
   - Click the secret name
   - Go to **"Permissions"** tab
   - Click **"Grant Access"**
   - Add your service account email: `gchat-secret-bot@YOUR-PROJECT-ID.iam.gserviceaccount.com`
   - Select role: **"Secret Manager Secret Accessor"**
   - Click **"Save"**

### 6. Create Google Chat App

1. Go to [Google Cloud Console > Google Chat API](https://console.cloud.google.com/apis/api/chat.googleapis.com)
2. Click **"Configuration"** in the left sidebar
3. Fill in the app details:

   **App name**: `Secret Manager Bot`
   
   **Avatar URL**: `https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png`
   
   **Description**: `Secure access to Google Secret Manager with approval workflow`

4. **Functionality**:
   - ☑️ Receive 1:1 messages
   - ☑️ Join spaces and group conversations

5. **Connection settings**:
   - Select **"App URL"**
   - **App URL**: `https://your-domain.com/webhook` (see deployment section below)
   
6. **Slash commands** (optional):
   - Command: `/secret`
   - Description: `Request a secret from Google Secret Manager`

7. **Permissions**:
   - Select **"Specific people and groups in your domain"**
   - Add users/groups who can use the bot

8. Click **"Save"**

### 7. Install the Application

1. Clone this repository:
```bash
git clone <repository-url>
cd gchat-secret-manager-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` file:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
APPROVER_EMAILS=approver1@yourcompany.com,approver2@yourcompany.com
GCP_PROJECT_ID=your-project-id
```

⚠️ **Important**: Add the email addresses of users who can approve secret requests

### 8. Deploy the Application

You need to make your bot accessible via HTTPS. Choose one option:

#### Option A: Use ngrok (for testing)

1. Install [ngrok](https://ngrok.com/)
2. Start your bot locally:
```bash
npm start
```
3. In another terminal, expose it:
```bash
ngrok http 3000
```
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Update your Google Chat app configuration with: `https://abc123.ngrok.io/webhook`

#### Option B: Deploy to Google Cloud Run

1. Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

2. Build and deploy:
```bash
gcloud run deploy gchat-secret-bot \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars APPROVER_EMAILS=approver@company.com
```

3. Update Google Chat app configuration with the Cloud Run URL

#### Option C: Deploy to any hosting service

Deploy to Heroku, AWS, Azure, or any other platform that supports Node.js applications. Make sure to:
- Set environment variables
- Upload service account key securely
- Use HTTPS

### 9. Test the Bot

1. Open Google Chat
2. Search for your bot: **"Secret Manager Bot"**
3. Start a conversation or add it to a space
4. Test with a command:
```
/secret my-project-id database-password
```

## Usage

### Request a Secret

In any space where the bot is present:

```
/secret <project-name> <secret-name>
```

**Example:**
```
/secret production-project api-key
```

### Approval Process

1. Bot posts an interactive card with request details
2. Designated approvers see "Approve" and "Deny" buttons
3. Approver clicks a button
4. On approval:
   - Bot fetches the secret from Secret Manager
   - Sends the secret privately to the requester
   - Updates the card to show approval status

### Get Help

```
help
```

or

```
/secret
```

## Security Considerations

- ✅ Only designated approvers (in `APPROVER_EMAILS`) can approve requests
- ✅ Secrets are sent privately via DM, never in public spaces
- ✅ Service account has minimal required permissions
- ✅ All requests are logged for audit purposes
- ✅ Pending requests are tracked with timestamps
- ⚠️ Store your service account key securely
- ⚠️ Use HTTPS for webhook endpoint
- ⚠️ Consider using a database for production (instead of in-memory storage)

## Troubleshooting

### Bot doesn't respond

1. Check bot logs for errors
2. Verify webhook URL is correct and accessible
3. Ensure Google Chat API is enabled
4. Check service account permissions

### "Error fetching secret"

1. Verify the project name is correct
2. Ensure the secret exists in Secret Manager
3. Confirm service account has `Secret Manager Secret Accessor` role
4. Check service account key is valid

### "Unauthorized" when clicking Approve

1. Verify your email is in the `APPROVER_EMAILS` environment variable
2. Restart the bot after updating environment variables
3. Check for typos in email addresses

### Private message not received

1. Ensure service account has `Chat Bot` role
2. Check that user has started a DM with the bot at least once
3. Verify `googleapis` package is installed correctly

## API Endpoints

- `POST /webhook` - Google Chat webhook handler
- `GET /health` - Health check endpoint

## Development

### Run locally

```bash
npm run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key | Yes |
| `APPROVER_EMAILS` | Comma-separated approver emails | Yes |
| `GCP_PROJECT_ID` | GCP project ID (optional) | No |

## Production Considerations

For production deployment:

1. **Use a database** to store pending requests (Redis, Firestore, PostgreSQL)
2. **Implement request expiration** (e.g., requests expire after 1 hour)
3. **Add rate limiting** to prevent abuse
4. **Enable request verification** from Google Chat
5. **Set up monitoring and alerting**
6. **Use secret rotation** for service account keys
7. **Implement audit logging** to a persistent store
8. **Add request reason field** for better audit trail

## License

MIT

## Support

For issues and questions, please create an issue in the repository.

---

**Built with ❤️ for secure secret management**
