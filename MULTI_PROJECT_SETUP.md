# Configuração Multi-Projeto com Service Accounts Separadas

Este guia explica como configurar o bot para usar Service Accounts (SAs) diferentes para cada projeto do GCP.

## 📋 Visão Geral

O bot agora suporta múltiplos projetos, cada um com sua própria Service Account para acessar o Secret Manager. Isso é útil quando:

- Você tem múltiplos projetos GCP com secrets diferentes
- Cada projeto tem sua própria SA com permissões específicas
- Você quer seguir o princípio de menor privilégio (cada SA acessa apenas seu projeto)

## 🔑 Arquitetura

```
┌─────────────────────────────────────────────────┐
│              Google Chat Bot                    │
│  (usa SA principal: service-account-key.json)   │
└─────────────────────────────────────────────────┘
                        │
                        │ Envia mensagens
                        ▼
        ┌───────────────────────────────┐
        │     Google Chat API           │
        └───────────────────────────────┘

        ┌───────────────────────────────┐
        │  Acesso ao Secret Manager     │
        └───────────────────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │                                │
        ▼                                ▼
  ┌─────────┐                      ┌─────────┐
  │Projeto A│                      │Projeto B│
  │SA: sa-a │                      │SA: sa-b │
  └─────────┘                      └─────────┘
```

## 🚀 Configuração Passo a Passo

### 1. Criar Service Accounts para Cada Projeto

Para cada projeto (exemplo: `projeto-a` e `projeto-b`):

```bash
# Definir o projeto
gcloud config set project projeto-a

# Criar Service Account
gcloud iam service-accounts create gchat-secret-sa-a \
  --display-name="Google Chat Secret Manager SA - Projeto A"

# Conceder permissão de acesso aos secrets
gcloud projects add-iam-policy-binding projeto-a \
  --member="serviceAccount:gchat-secret-sa-a@projeto-a.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Criar e baixar a chave
gcloud iam service-accounts keys create sa-projeto-a.json \
  --iam-account=gchat-secret-sa-a@projeto-a.iam.gserviceaccount.com
```

Repita para o `projeto-b`:

```bash
gcloud config set project projeto-b

gcloud iam service-accounts create gchat-secret-sa-b \
  --display-name="Google Chat Secret Manager SA - Projeto B"

gcloud projects add-iam-policy-binding projeto-b \
  --member="serviceAccount:gchat-secret-sa-b@projeto-b.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud iam service-accounts keys create sa-projeto-b.json \
  --iam-account=gchat-secret-sa-b@projeto-b.iam.gserviceaccount.com
```

### 2. Organizar as Chaves de Service Account

Coloque os arquivos de chave no diretório do projeto:

```
gchat-secret-manager-bot/
├── service-account-key.json    # SA principal do bot (Google Chat)
├── sa-projeto-a.json            # SA para acessar projeto-a
├── sa-projeto-b.json            # SA para acessar projeto-b
├── .env
└── server.js
```

### 3. Configurar o arquivo .env

Edite o arquivo `.env`:

```env
# Service Account principal (para Google Chat)
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# Mapeamento de projetos e suas Service Accounts
PROJECT_SA_MAPPING=projeto-a:./sa-projeto-a.json,projeto-b:./sa-projeto-b.json

# Emails dos aprovadores
APPROVER_EMAILS=seu-email@empresa.com,outro-aprovador@empresa.com
```

**Formato do PROJECT_SA_MAPPING:**
```
projeto-id:caminho/para/sa.json,outro-projeto:caminho/para/outra-sa.json
```

### 4. Iniciar o Bot

```bash
npm start
```

Você verá no log:

```
✓ Configured Secret Manager for project: projeto-a
✓ Configured Secret Manager for project: projeto-b
🚀 Secret Manager Bot listening on port 3000
📝 Webhook URL: http://localhost:3000/webhook
👥 Approvers: seu-email@empresa.com, outro-aprovador@empresa.com
📦 Configured projects (2): projeto-a, projeto-b
```

## 🧪 Testando

### Solicitar secret do projeto A:
```
/secret projeto-a database-password
```

### Solicitar secret do projeto B:
```
/secret projeto-b api-key
```

O bot automaticamente usará a Service Account correta para cada projeto!

## 📊 Verificar Status

Acesse o endpoint de health check:

```bash
curl http://localhost:3000/health
```

Resposta:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-20T12:30:00.000Z",
  "pendingRequests": 0,
  "configuredProjects": ["projeto-a", "projeto-b"],
  "totalProjects": 2
}
```

## 🔒 Segurança

### Princípio de Menor Privilégio

Cada Service Account tem acesso **apenas** ao seu projeto:

- `sa-projeto-a.json` → Acesso apenas aos secrets do `projeto-a`
- `sa-projeto-b.json` → Acesso apenas aos secrets do `projeto-b`

### Permissões Necessárias por SA

**Service Account Principal (GOOGLE_APPLICATION_CREDENTIALS):**
- Role: `Chat Bot` (para enviar mensagens)

**Service Accounts por Projeto (PROJECT_SA_MAPPING):**
- Role: `Secret Manager Secret Accessor` (apenas no projeto específico)

## ⚠️ Troubleshooting

### Erro: "Permission denied" ao buscar secret

**Problema:** SA não tem permissão no projeto

**Solução:**
```bash
gcloud projects add-iam-policy-binding PROJETO-ID \
  --member="serviceAccount:SA-EMAIL@PROJETO-ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Aviso: "Using default SA for project: projeto-x"

**Problema:** Projeto não está no `PROJECT_SA_MAPPING`

**Solução:** Adicione o projeto no `.env`:
```env
PROJECT_SA_MAPPING=projeto-a:./sa-a.json,projeto-b:./sa-b.json,projeto-x:./sa-x.json
```

### Bot não encontra o arquivo de chave

**Problema:** Caminho incorreto no `PROJECT_SA_MAPPING`

**Solução:** Use caminhos relativos ao diretório do projeto:
```env
# ✅ Correto
PROJECT_SA_MAPPING=projeto-a:./sa-projeto-a.json

# ❌ Incorreto (caminho absoluto pode variar)
PROJECT_SA_MAPPING=projeto-a:/home/user/sa-projeto-a.json
```

## 🔄 Retrocompatibilidade

Se você **não configurar** o `PROJECT_SA_MAPPING`, o bot usa a SA padrão (`GOOGLE_APPLICATION_CREDENTIALS`) para todos os projetos:

```env
# Configuração antiga - ainda funciona!
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
# PROJECT_SA_MAPPING não definido
```

**Log:**
```
⚠️  No project-specific SAs configured. Using default SA for all projects.
```

## 📚 Exemplo Completo

### Estrutura de Arquivos:
```
gchat-secret-manager-bot/
├── service-account-key.json      # Bot principal
├── sa-production.json            # SA para produção
├── sa-staging.json               # SA para staging
├── sa-development.json           # SA para dev
├── .env
└── server.js
```

### Arquivo .env:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
PROJECT_SA_MAPPING=production:./sa-production.json,staging:./sa-staging.json,development:./sa-development.json
APPROVER_EMAILS=tech-lead@empresa.com,devops@empresa.com
```

### Uso:
```
/secret production database-url
/secret staging api-key
/secret development test-credentials
```

## 🎯 Melhores Práticas

1. **Nomeie as SAs descritivamente:**
   ```bash
   gchat-secret-sa-production
   gchat-secret-sa-staging
   ```

2. **Use arquivos .json separados** para cada ambiente

3. **Não commite as chaves** no Git (já está no `.gitignore`)

4. **Rotacione as chaves** periodicamente:
   ```bash
   gcloud iam service-accounts keys create nova-chave.json \
     --iam-account=SA-EMAIL
   ```

5. **Monitore o acesso** via Cloud Logging

6. **Documente quais projetos** cada SA pode acessar

---

**Configuração multi-projeto implementada com sucesso! 🎉**
