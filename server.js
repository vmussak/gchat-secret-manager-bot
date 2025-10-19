require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Initialize Google Cloud clients
const secretManagerClient = new SecretManagerServiceClient();
const chat = google.chat('v1');

// In-memory storage for pending approval requests
// In production, use a database like Redis, Firestore, or PostgreSQL
const pendingRequests = new Map();

// Approver emails from environment variable
const APPROVER_EMAILS = process.env.APPROVER_EMAILS?.split(',').map(email => email.trim()) || [];

/**
 * Main webhook handler for Google Chat
 */
app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));

  try {
    const event = req.body;
    
    // Handle different event types
    if (event.type === 'ADDED_TO_SPACE') {
      return res.json(handleAddedToSpace(event));
    }

    if (event.type === 'REMOVED_FROM_SPACE') {
      console.log('Bot removed from space');
      return res.json({});
    }

    if (event.type === 'MESSAGE') {
      return res.json(await handleMessage(event));
    }

    if (event.type === 'CARD_CLICKED') {
      return res.json(await handleCardClick(event));
    }

    // Unknown event type
    res.json({});
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      text: `Error: ${error.message}`
    });
  }
});

/**
 * Handle bot being added to a space
 */
function handleAddedToSpace(event) {
  return {
    text: `👋 Hello! I'm the Secret Manager Bot.

To request a secret, use the command:
\`/secret <project-name> <secret-name>\`

Example: \`/secret my-project database-password\`

Approvers will be notified and can approve your request. Once approved, you'll receive the secret privately.`
  };
}

/**
 * Handle incoming messages
 */
async function handleMessage(event) {
  const message = event.message.text.trim();
  const sender = event.user;
  const spaceName = event.space.name;
  const threadName = event.message.thread?.name;

  console.log(`Message from ${sender.email}: ${message}`);

  // Check if message is a secret request
  const secretRequestRegex = /^\/secret\s+(\S+)\s+(\S+)/i;
  const match = message.match(secretRequestRegex);

  if (match) {
    const projectName = match[1];
    const secretName = match[2];

    return createApprovalCard(sender, spaceName, threadName, projectName, secretName);
  }

  // Help message
  if (message.toLowerCase().includes('help') || message === '/secret') {
    return {
      text: `📚 **Secret Manager Bot Help**

**Request a secret:**
\`/secret <project-name> <secret-name>\`

Example: \`/secret my-gcp-project api-key\`

Authorized approvers will receive a notification and can approve your request. Once approved, you'll receive the secret in a private message.`
    };
  }

  return {
    text: 'Unknown command. Use `/secret <project-name> <secret-name>` to request a secret, or type "help" for more information.'
  };
}

/**
 * Create approval card for secret request
 */
function createApprovalCard(requester, spaceName, threadName, projectName, secretName) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store pending request
  pendingRequests.set(requestId, {
    requester: requester,
    spaceName: spaceName,
    threadName: threadName,
    projectName: projectName,
    secretName: secretName,
    timestamp: new Date().toISOString()
  });

  console.log(`Created approval request ${requestId} for ${requester.email}`);

  return {
    cards: [{
      header: {
        title: '🔐 Secret Access Request',
        subtitle: `Requested by ${requester.displayName || requester.email}`,
        imageUrl: 'https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png'
      },
      sections: [{
        widgets: [
          {
            keyValue: {
              topLabel: 'Project',
              content: projectName,
              contentMultiline: false,
              icon: 'BOOKMARK'
            }
          },
          {
            keyValue: {
              topLabel: 'Secret Name',
              content: secretName,
              contentMultiline: false,
              icon: 'KEY'
            }
          },
          {
            keyValue: {
              topLabel: 'Requester',
              content: requester.email,
              contentMultiline: false,
              icon: 'PERSON'
            }
          },
          {
            keyValue: {
              topLabel: 'Status',
              content: '⏳ Pending Approval',
              contentMultiline: false
            }
          },
          {
            buttons: [
              {
                textButton: {
                  text: '✅ APPROVE',
                  onClick: {
                    action: {
                      actionMethodName: 'approve',
                      parameters: [{
                        key: 'requestId',
                        value: requestId
                      }]
                    }
                  }
                }
              },
              {
                textButton: {
                  text: '❌ DENY',
                  onClick: {
                    action: {
                      actionMethodName: 'deny',
                      parameters: [{
                        key: 'requestId',
                        value: requestId
                      }]
                    }
                  }
                }
              }
            ]
          }
        ]
      }]
    }]
  };
}

/**
 * Handle card button clicks
 */
async function handleCardClick(event) {
  const action = event.action.actionMethodName;
  const requestId = event.action.parameters.find(p => p.key === 'requestId')?.value;
  const approver = event.user;

  console.log(`Card click: ${action} by ${approver.email} for request ${requestId}`);

  // Check if approver is authorized
  if (!APPROVER_EMAILS.includes(approver.email)) {
    return {
      actionResponse: {
        type: 'UPDATE_MESSAGE',
        updatedWidget: {
          suggestions: {
            items: [{
              text: `❌ Unauthorized: ${approver.email} is not in the approver list.`
            }]
          }
        }
      }
    };
  }

  // Get pending request
  const request = pendingRequests.get(requestId);
  if (!request) {
    return {
      text: '❌ Request not found or already processed.'
    };
  }

  if (action === 'approve') {
    return await handleApproval(request, requestId, approver, event.space.name);
  } else if (action === 'deny') {
    return handleDenial(request, requestId, approver);
  }

  return { text: 'Unknown action.' };
}

/**
 * Handle approval and send secret to requester
 */
async function handleApproval(request, requestId, approver, spaceName) {
  try {
    // Fetch secret from Secret Manager
    const secretPath = `projects/${request.projectName}/secrets/${request.secretName}/versions/latest`;
    console.log(`Fetching secret: ${secretPath}`);
    
    const [version] = await secretManagerClient.accessSecretVersion({
      name: secretPath
    });

    const secretValue = version.payload.data.toString('utf8');

    // Send secret privately to requester
    await sendPrivateMessage(request.requester.name, secretValue, request.projectName, request.secretName);

    // Remove from pending requests
    pendingRequests.delete(requestId);

    // Update card to show approval
    return {
      actionResponse: {
        type: 'UPDATE_MESSAGE'
      },
      cards: [{
        header: {
          title: '✅ Secret Access Approved',
          subtitle: `Approved by ${approver.displayName || approver.email}`,
          imageUrl: 'https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png'
        },
        sections: [{
          widgets: [
            {
              keyValue: {
                topLabel: 'Project',
                content: request.projectName,
                icon: 'BOOKMARK'
              }
            },
            {
              keyValue: {
                topLabel: 'Secret Name',
                content: request.secretName,
                icon: 'KEY'
              }
            },
            {
              keyValue: {
                topLabel: 'Requester',
                content: request.requester.email,
                icon: 'PERSON'
              }
            },
            {
              keyValue: {
                topLabel: 'Status',
                content: '✅ Approved and sent privately',
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Approved By',
                content: approver.email,
                contentMultiline: false,
                icon: 'PERSON'
              }
            }
          ]
        }]
      }]
    };
  } catch (error) {
    console.error('Error fetching secret:', error);
    pendingRequests.delete(requestId);
    
    return {
      text: `❌ Error fetching secret: ${error.message}\n\nPlease ensure:\n- The project name is correct\n- The secret exists\n- The service account has Secret Manager Secret Accessor role`
    };
  }
}

/**
 * Handle denial
 */
function handleDenial(request, requestId, approver) {
  pendingRequests.delete(requestId);

  return {
    actionResponse: {
      type: 'UPDATE_MESSAGE'
    },
    cards: [{
      header: {
        title: '❌ Secret Access Denied',
        subtitle: `Denied by ${approver.displayName || approver.email}`,
        imageUrl: 'https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png'
      },
      sections: [{
        widgets: [
          {
            keyValue: {
              topLabel: 'Project',
              content: request.projectName,
              icon: 'BOOKMARK'
            }
          },
          {
            keyValue: {
              topLabel: 'Secret Name',
              content: request.secretName,
              icon: 'KEY'
            }
          },
          {
            keyValue: {
              topLabel: 'Requester',
              content: request.requester.email,
              icon: 'PERSON'
            }
          },
          {
            keyValue: {
              topLabel: 'Status',
              content: '❌ Access Denied',
              contentMultiline: false
            }
          },
          {
            keyValue: {
              topLabel: 'Denied By',
              content: approver.email,
              contentMultiline: false,
              icon: 'PERSON'
            }
          }
        ]
      }]
    }]
  };
}

/**
 * Send private message to user with secret
 */
async function sendPrivateMessage(userName, secretValue, projectName, secretName) {
  try {
    // Get auth client
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/chat.bot']
    });

    const authClient = await auth.getClient();

    // Create DM space with user
    const message = {
      text: `🔐 **Secret Delivered**\n\n` +
            `**Project:** ${projectName}\n` +
            `**Secret:** ${secretName}\n\n` +
            `\`\`\`\n${secretValue}\n\`\`\`\n\n` +
            `⚠️ **Important:** Please store this secret securely and delete this message after copying it.`
    };

    await chat.spaces.messages.create({
      auth: authClient,
      parent: userName,
      requestBody: message
    });

    console.log(`Private message sent to ${userName}`);
  } catch (error) {
    console.error('Error sending private message:', error);
    throw error;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pendingRequests: pendingRequests.size
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`🚀 Secret Manager Bot listening on port ${PORT}`);
  console.log(`📝 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`👥 Approvers: ${APPROVER_EMAILS.join(', ')}`);
});
