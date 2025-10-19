# Testing Guide

This guide helps you test the Google Chat Secret Manager Bot functionality.

## Prerequisites

- Bot is running (locally or deployed)
- Service account has proper permissions
- Google Chat app is configured
- At least one test secret exists

## Create Test Secrets

### Using gcloud CLI

```bash
# Set your project
export PROJECT_ID="your-project-id"

# Create a test secret
echo -n "TestSecretValue123" | gcloud secrets create test-api-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding test-api-key \
  --project=$PROJECT_ID \
  --member="serviceAccount:gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Using the helper script

```bash
cd examples
chmod +x create-test-secret.sh
./create-test-secret.sh your-project-id test-api-key "MySecretValue"
```

## Test Scenarios

### Test 1: Bot Responds to Commands

**Action:** Send a message to the bot
```
hello
```

**Expected:** Bot responds with usage instructions

---

### Test 2: Help Command

**Action:** Send help command
```
help
```

**Expected:** Bot displays help information with command syntax

---

### Test 3: Request a Secret (Happy Path)

**Action:** Request a valid secret
```
/secret your-project-id test-api-key
```

**Expected:**
1. ✅ Bot displays an approval card
2. ✅ Card shows requester info, project, and secret name
3. ✅ Approve/Deny buttons are visible
4. ✅ Status shows "Pending Approval"

---

### Test 4: Approve Request (Authorized User)

**Prerequisites:** Your email is in `APPROVER_EMAILS`

**Action:** Click the "✅ APPROVE" button

**Expected:**
1. ✅ Card updates to show "Approved" status
2. ✅ Approver's name is displayed
3. ✅ Requester receives a private DM with the secret
4. ✅ DM contains the secret value in a code block

---

### Test 5: Deny Request

**Action:** Click the "❌ DENY" button

**Expected:**
1. ✅ Card updates to show "Denied" status
2. ✅ Denier's name is displayed
3. ✅ No secret is sent
4. ✅ Requester doesn't receive a DM

---

### Test 6: Unauthorized Approval Attempt

**Prerequisites:** Test with a user NOT in `APPROVER_EMAILS`

**Action:** Click "APPROVE" or "DENY"

**Expected:**
1. ✅ Error message: "Unauthorized"
2. ✅ Card doesn't update
3. ✅ Request remains pending

---

### Test 7: Invalid Secret Request

**Action:** Request a non-existent secret
```
/secret your-project-id non-existent-secret
```

**Expected:**
1. ✅ Approval card is displayed
2. ✅ When approved, error message is shown
3. ✅ Error explains the secret doesn't exist or permission is denied

---

### Test 8: Invalid Project Request

**Action:** Request from a non-existent project
```
/secret invalid-project-123 test-secret
```

**Expected:**
1. ✅ Approval card is displayed
2. ✅ When approved, error message indicates project not found

---

### Test 9: Private Message Delivery

**Action:** Approve a secret request

**Expected:**
1. ✅ Requester receives a DM from the bot
2. ✅ DM contains project name and secret name
3. ✅ Secret value is in a code block
4. ✅ Security warning is included

---

### Test 10: Invalid Command

**Action:** Send an invalid command
```
/secret
```

**Expected:**
1. ✅ Bot responds with usage instructions
2. ✅ Explains the correct format

---

### Test 11: Multiple Simultaneous Requests

**Action:** Multiple users request secrets at the same time

**Expected:**
1. ✅ Each request gets its own card
2. ✅ Cards can be approved independently
3. ✅ Each requester gets their respective secret

---

### Test 12: Health Check Endpoint

**Action:** Call the health endpoint
```bash
curl https://your-bot-url/health
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "pendingRequests": 0
}
```

---

## Automated Testing Script

Create a test script to verify basic functionality:

```bash
#!/bin/bash

BOT_URL="https://your-bot-url"

# Test health endpoint
echo "Testing health endpoint..."
curl -s $BOT_URL/health | jq .

# Test webhook endpoint (should return 200)
echo "Testing webhook endpoint..."
curl -X POST $BOT_URL/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MESSAGE",
    "message": {
      "text": "help"
    },
    "user": {
      "name": "users/test",
      "displayName": "Test User",
      "email": "test@example.com"
    },
    "space": {
      "name": "spaces/test"
    }
  }'
```

## Troubleshooting Tests

### Test Fails: Bot Doesn't Respond

**Check:**
- [ ] Bot is running: `curl https://your-bot-url/health`
- [ ] Webhook URL is correct in Google Chat config
- [ ] Check bot logs for errors

### Test Fails: "Error fetching secret"

**Check:**
- [ ] Project ID is correct
- [ ] Secret exists: `gcloud secrets describe SECRET_NAME --project=PROJECT_ID`
- [ ] Service account has access:
```bash
gcloud secrets get-iam-policy SECRET_NAME --project=PROJECT_ID
```

### Test Fails: Private Message Not Received

**Check:**
- [ ] User has initiated a DM with the bot at least once
- [ ] Service account has Chat Bot permissions
- [ ] Check bot logs for "Error sending private message"

### Test Fails: "Unauthorized" for Valid Approver

**Check:**
- [ ] Email matches exactly (case-sensitive)
- [ ] No extra spaces in `APPROVER_EMAILS`
- [ ] Bot was restarted after updating `.env`
- [ ] Check logs: `console.log` will show approver validation

## Test Checklist

Before going to production, verify:

- [ ] All happy path tests pass
- [ ] Error cases are handled gracefully
- [ ] Private messages work correctly
- [ ] Authorization works as expected
- [ ] Multiple concurrent requests work
- [ ] Invalid inputs don't crash the bot
- [ ] Logs are clear and informative
- [ ] Health endpoint responds correctly

## Performance Testing

For production readiness, test:

1. **Load:** 10+ simultaneous secret requests
2. **Response time:** Approval card appears within 2 seconds
3. **Secret delivery:** DM arrives within 5 seconds of approval
4. **Memory:** Bot doesn't leak memory with pending requests

## Security Testing

Verify security measures:

- [ ] Secrets never appear in public spaces
- [ ] Only approvers can approve/deny
- [ ] Service account has minimal permissions
- [ ] API keys/credentials are not logged
- [ ] HTTPS is enforced for webhook

## Monitoring

Set up monitoring for:

- Request volume
- Approval/denial rates
- Error rates
- Response times
- Failed secret fetches

---

**Happy Testing! 🧪**
