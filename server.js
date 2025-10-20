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
      text: `Erro: ${error.message}`
    });
  }
});

/**
 * Handle bot being added to a space
 */
function handleAddedToSpace(event) {
  return {
    text: `👋 Olá! Sou o Bot de Gerenciamento de Secrets.

Para solicitar um secret, use o comando:
\`/secret <nome-do-projeto> <nome-do-secret> [versão]\`

Exemplos:
\`/secret meu-projeto senha-database\` (versão 'latest')
\`/secret meu-projeto senha-database 3\` (versão específica)

Os aprovadores serão notificados e poderão aprovar sua solicitação. Após aprovado, você receberá o secret de forma privada.`
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
  const secretRequestRegex = /^\/secret\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i;
  const match = message.match(secretRequestRegex);

  if (match) {
    const projectName = match[1];
    const secretName = match[2];
    const secretVersion = match[3] || 'latest';

    return createApprovalCard(sender, spaceName, threadName, projectName, secretName, secretVersion);
  }

  // Help message
  if (message.toLowerCase().includes('help') || message === '/secret') {
    return {
      text: `📚 **Ajuda do Bot de Gerenciamento de Secrets**

**Solicitar um secret:**
\`/secret <nome-do-projeto> <nome-do-secret> [versão]\`

Exemplos:
\`/secret meu-projeto-gcp chave-api\` (usa versão 'latest')
\`/secret meu-projeto-gcp chave-api 5\` (usa versão específica)

Aprovadores autorizados receberão uma notificação e poderão aprovar sua solicitação. Após aprovado, você receberá o secret em uma mensagem privada.`
    };
  }

  return {
    text: 'Comando desconhecido. Use `/secret <nome-do-projeto> <nome-do-secret> [versão]` para solicitar um secret, ou digite "help" para mais informações.'
  };
}

/**
 * Create approval card for secret request
 */
function createApprovalCard(requester, spaceName, threadName, projectName, secretName, secretVersion = 'latest') {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store pending request
  pendingRequests.set(requestId, {
    requester: requester,
    spaceName: spaceName,
    threadName: threadName,
    projectName: projectName,
    secretName: secretName,
    secretVersion: secretVersion,
    timestamp: new Date().toISOString()
  });

  console.log(`Created approval request ${requestId} for ${requester.email}`);

  return {
    cards: [{
      header: {
        title: '🔐 Solicitação de Acesso ao Secret',
        subtitle: `Solicitado por ${requester.displayName || requester.email}`,
        imageUrl: 'https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png'
      },
      sections: [{
        widgets: [
          {
            keyValue: {
              topLabel: 'Projeto',
              content: projectName,
              contentMultiline: false,
              icon: 'BOOKMARK'
            }
          },
          {
            keyValue: {
              topLabel: 'Nome do Secret',
              content: secretName,
              contentMultiline: false,
              icon: 'KEY'
            }
          },
          {
            keyValue: {
              topLabel: 'Versão',
              content: secretVersion,
              contentMultiline: false,
              icon: 'DESCRIPTION'
            }
          },
          {
            keyValue: {
              topLabel: 'Solicitante',
              content: requester.email,
              contentMultiline: false,
              icon: 'PERSON'
            }
          },
          {
            keyValue: {
              topLabel: 'Status',
              content: '⏳ Aguardando Aprovação',
              contentMultiline: false
            }
          },
          {
            buttons: [
              {
                textButton: {
                  text: '✅ APROVAR',
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
                  text: '❌ NEGAR',
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
              text: `❌ Não autorizado: ${approver.email} não está na lista de aprovadores.`
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
      text: '❌ Solicitação não encontrada ou já processada.'
    };
  }

  if (action === 'approve') {
    return await handleApproval(request, requestId, approver, event.space.name);
  } else if (action === 'deny') {
    return handleDenial(request, requestId, approver);
  }

  return { text: 'Ação desconhecida.' };
}

/**
 * Handle approval and send secret to requester
 */
async function handleApproval(request, requestId, approver, spaceName) {
  try {
    // Fetch secret from Secret Manager
    const secretPath = `projects/${request.projectName}/secrets/${request.secretName}/versions/${request.secretVersion}`;
    console.log(`Fetching secret: ${secretPath}`);
    
    const [version] = await secretManagerClient.accessSecretVersion({
      name: secretPath
    });

    const secretValue = version.payload.data.toString('utf8');

    // Send secret privately to requester
    await sendPrivateMessage(request.requester.name, secretValue, request.projectName, request.secretName, request.secretVersion);

    // Remove from pending requests
    pendingRequests.delete(requestId);

    // Update card to show approval
    return {
      actionResponse: {
        type: 'UPDATE_MESSAGE'
      },
      cards: [{
        header: {
          title: '✅ Acesso ao Secret Aprovado',
          subtitle: `Aprovado por ${approver.displayName || approver.email}`,
          imageUrl: 'https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png'
        },
        sections: [{
          widgets: [
            {
              keyValue: {
                topLabel: 'Projeto',
                content: request.projectName,
                icon: 'BOOKMARK'
              }
            },
            {
              keyValue: {
                topLabel: 'Nome do Secret',
                content: request.secretName,
                icon: 'KEY'
              }
            },
            {
              keyValue: {
                topLabel: 'Versão',
                content: request.secretVersion,
                icon: 'DESCRIPTION'
              }
            },
            {
              keyValue: {
                topLabel: 'Solicitante',
                content: request.requester.email,
                icon: 'PERSON'
              }
            },
            {
              keyValue: {
                topLabel: 'Status',
                content: '✅ Aprovado e enviado privadamente',
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Aprovado Por',
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
      text: `❌ Erro ao buscar secret: ${error.message}\n\nPor favor, certifique-se de que:\n- O nome do projeto está correto\n- O secret existe\n- A conta de serviço tem a role Secret Manager Secret Accessor`
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
        title: '❌ Acesso ao Secret Negado',
        subtitle: `Negado por ${approver.displayName || approver.email}`,
        imageUrl: 'https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png'
      },
      sections: [{
        widgets: [
          {
            keyValue: {
              topLabel: 'Projeto',
              content: request.projectName,
              icon: 'BOOKMARK'
            }
          },
          {
            keyValue: {
              topLabel: 'Nome do Secret',
              content: request.secretName,
              icon: 'KEY'
            }
          },
          {
            keyValue: {
              topLabel: 'Versão',
              content: request.secretVersion,
              icon: 'DESCRIPTION'
            }
          },
          {
            keyValue: {
              topLabel: 'Solicitante',
              content: request.requester.email,
              icon: 'PERSON'
            }
          },
          {
            keyValue: {
              topLabel: 'Status',
              content: '❌ Acesso Negado',
              contentMultiline: false
            }
          },
          {
            keyValue: {
              topLabel: 'Negado Por',
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
async function sendPrivateMessage(userName, secretValue, projectName, secretName, secretVersion = 'latest') {
  try {
    // Get auth client
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/chat.bot']
    });

    const authClient = await auth.getClient();

    // Create DM space with user
    const message = {
      text: `🔐 **Secret Entregue**\n\n` +
            `**Projeto:** ${projectName}\n` +
            `**Secret:** ${secretName}\n` +
            `**Versão:** ${secretVersion}\n\n` +
            `\`\`\`\n${secretValue}\n\`\`\`\n\n` +
            `⚠️ **Importante:** Armazene este secret de forma segura e delete esta mensagem após copiá-lo.`
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
