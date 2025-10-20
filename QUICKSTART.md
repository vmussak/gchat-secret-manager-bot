# Guia de Início Rápido

Coloque seu Bot de Google Chat para Secret Manager funcionando em 15 minutos!

## Checklist de Pré-requisitos

- [ ] Node.js 16+ instalado
- [ ] Conta no Google Cloud Platform
- [ ] Google Workspace com acesso ao Google Chat
- [ ] Projeto GCP criado

## Configuração Passo a Passo

### 1. Habilitar APIs (2 minutos)

```bash
# Configurar seu projeto
gcloud config set project SEU-PROJECT-ID

# Habilitar APIs necessárias
gcloud services enable chat.googleapis.com secretmanager.googleapis.com
```

### 2. Criar Service Account (3 minutos)

```bash
# Criar service account
gcloud iam service-accounts create gchat-secret-bot \
  --display-name="Bot de Secret Manager do Google Chat"

# Obter ID do projeto
export PROJECT_ID=$(gcloud config get-value project)

# Conceder acesso ao Secret Manager
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Criar e baixar chave
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com
```

### 3. Instalar Aplicação (2 minutos)

```bash
# Clonar e instalar
cd gchat-secret-manager-bot
npm install

# Configurar ambiente
cp .env.example .env
```

Editar `.env`:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
APPROVER_EMAILS=seu-email@empresa.com,aprovador@empresa.com
GCP_PROJECT_ID=seu-project-id
```

### 4. Testar Localmente com ngrok (3 minutos)

Terminal 1:
```bash
npm start
```

Terminal 2:
```bash
ngrok http 3000
```

Copiar a URL HTTPS (ex: `https://abc123.ngrok-free.app`)

### 5. Configurar App do Google Chat (5 minutos)

1. Acesse: https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat
2. Clique em **"Configuração"**
3. Preencha:
   - **Nome do app**: Secret Manager Bot
   - **URL do avatar**: `https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png`
   - **Descrição**: Acesso seguro a secrets com aprovação
   - **Funcionalidade**: Marque ambas as opções
   - **Configurações de conexão**: URL do app → Sua URL do ngrok + `/webhook`
   - **Permissões**: Pessoas e grupos específicos

4. Clique em **"Salvar"**

### 6. Teste! (1 minuto)

1. Abra o Google Chat
2. Procure por "Secret Manager Bot"
3. Envie: `/secret meu-projeto meu-secret`
4. Clique em Aprovar (se você for aprovador)
5. Verifique sua DM pelo secret!

## Problemas Comuns

**Bot não responde:**
- Verifique se a URL do webhook está acessível: `curl https://sua-url-ngrok/webhook`
- Verifique os logs no seu terminal

**Não consigo aprovar:**
- Seu email deve estar em `APPROVER_EMAILS`
- Reinicie o bot após mudar o `.env`

**Secret não encontrado:**
- Verifique o nome do projeto e do secret
- Verifique se a service account tem a role `Secret Manager Secret Accessor`

## Próximos Passos

- [ ] Fazer deploy no Cloud Run para produção (veja README.md)
- [ ] Adicionar mais aprovadores no `.env`
- [ ] Testar com sua equipe
- [ ] Configurar monitoramento

## Precisa de Ajuda?

Veja o [README.md](./README.md) completo para documentação detalhada.
