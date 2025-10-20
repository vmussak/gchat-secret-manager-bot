# Bot de Google Chat para Secret Manager 🔐

Uma API Node.js Express segura que integra Google Chat com Google Secret Manager, com fluxo de aprovação para acesso a secrets.

## Funcionalidades

- 🔒 **Acesso Seguro a Secrets**: Solicite secrets do Google Secret Manager
- ✅ **Fluxo de Aprovação**: Aprovadores designados devem autorizar o acesso
- 💬 **Integração com Google Chat**: Cards interativos e mensagens privadas
- 🔑 **Entrega Privada**: Secrets são enviados privativamente aos solicitantes
- 📝 **Trilha de Auditoria**: Todas as solicitações são registradas com informações do solicitante e aprovador
- 🎯 **Suporte Multi-Projeto**: Use Service Accounts diferentes por projeto GCP
- 🔢 **Controle de Versão**: Especifique a versão do secret (padrão: 'latest')

## Arquitetura

1. Usuário solicita um secret via comando no Google Chat: `/secret <nome-do-projeto> <nome-do-secret>`
2. Bot cria um card de aprovação visível no espaço/sala
3. Aprovadores autorizados podem clicar em "Aprovar" ou "Negar"
4. Na aprovação, o bot busca o secret no Secret Manager
5. Secret é enviado privativamente ao solicitante via mensagem direta

## Pré-requisitos

- Node.js 16+ e npm
- Conta no Google Cloud Platform
- Google Workspace com Google Chat habilitado
- Projeto GCP com API do Secret Manager habilitada

## Instruções de Configuração

### 1. Criar um Projeto no Google Cloud

1. Acesse o [Console do Google Cloud](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Anote o ID do seu projeto

### 2. Habilitar APIs Necessárias

Habilite as seguintes APIs no seu projeto GCP:

```bash
gcloud services enable chat.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

Ou habilite-as via [Biblioteca de APIs](https://console.cloud.google.com/apis/library):
- Google Chat API
- Secret Manager API

### 3. Criar uma Service Account

1. Acesse [IAM e Admin > Contas de Serviço](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Clique em **"Criar Conta de Serviço"**
3. Preencha os detalhes:
   - **Nome**: `gchat-secret-bot`
   - **Descrição**: Conta de serviço para o Bot de Secret Manager do Google Chat
4. Clique em **"Criar e Continuar"**
5. Conceda as seguintes roles:
   - `Secret Manager Secret Accessor` (para ler secrets)
   - `Chat Bot` (para enviar mensagens)
6. Clique em **"Continuar"** e depois em **"Concluir"**

### 4. Criar Chave da Service Account

1. Clique na conta de serviço recém-criada
2. Vá para a aba **"Chaves"**
3. Clique em **"Adicionar Chave"** > **"Criar nova chave"**
4. Selecione o formato **JSON**
5. Clique em **"Criar"** - o arquivo de chave será baixado
6. Renomeie o arquivo para `service-account-key.json`
7. Mova-o para o diretório raiz do seu projeto

⚠️ **Importante**: Nunca faça commit deste arquivo no controle de versão!

### 5. Configurar Permissões do Secret Manager

Para cada projeto GCP contendo secrets que você deseja acessar:

1. Acesse o [Secret Manager](https://console.cloud.google.com/security/secret-manager)
2. Selecione o projeto
3. Para cada secret (ou em nível de projeto):
   - Clique no nome do secret
   - Vá para a aba **"Permissões"**
   - Clique em **"Conceder Acesso"**
   - Adicione o email da sua service account: `gchat-secret-bot@SEU-PROJECT-ID.iam.gserviceaccount.com`
   - Selecione a role: **"Secret Manager Secret Accessor"**
   - Clique em **"Salvar"**

### 6. Criar App do Google Chat

1. Acesse [Console do Google Cloud > API do Google Chat](https://console.cloud.google.com/apis/api/chat.googleapis.com)
2. Clique em **"Configuração"** na barra lateral esquerda
3. Preencha os detalhes do app:

   **Nome do app**: `Secret Manager Bot`
   
   **URL do avatar**: `https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png`
   
   **Descrição**: `Acesso seguro ao Google Secret Manager com fluxo de aprovação`

4. **Funcionalidade**:
   - ☑️ Receber mensagens 1:1
   - ☑️ Participar de espaços e conversas em grupo

5. **Configurações de conexão**:
   - Selecione **"URL do app"**
   - **URL do app**: `https://seu-dominio.com/webhook` (veja a seção de deploy abaixo)
   
6. **Comandos de barra** (opcional):
   - Comando: `/secret`
   - Descrição: `Solicitar um secret do Google Secret Manager`

7. **Permissões**:
   - Selecione **"Pessoas e grupos específicos no seu domínio"**
   - Adicione usuários/grupos que podem usar o bot

8. Clique em **"Salvar"**

### 7. Instalar a Aplicação

1. Clone este repositório:
```bash
git clone <url-do-repositorio>
cd gchat-secret-manager-bot
```

2. Instale as dependências:
```bash
npm install
```

3. Crie o arquivo `.env`:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env`:
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
APPROVER_EMAILS=aprovador1@suaempresa.com,aprovador2@suaempresa.com
GCP_PROJECT_ID=seu-project-id
```

⚠️ **Importante**: Adicione os endereços de email dos usuários que podem aprovar solicitações de secrets

📚 **Configuração Multi-Projeto**: Se você tem múltiplos projetos GCP e quer usar Service Accounts diferentes para cada um, veja [MULTI_PROJECT_SETUP.md](./MULTI_PROJECT_SETUP.md) para instruções detalhadas de configuração.

### 8. Fazer Deploy da Aplicação

Você precisa tornar seu bot acessível via HTTPS. Escolha uma opção:

#### Opção A: Usar ngrok (para testes)

1. Instale o [ngrok](https://ngrok.com/)
2. Inicie seu bot localmente:
```bash
npm start
```
3. Em outro terminal, exponha-o:
```bash
ngrok http 3000
```
4. Copie a URL HTTPS (ex: `https://abc123.ngrok.io`)
5. Atualize a configuração do seu app Google Chat com: `https://abc123.ngrok.io/webhook`

#### Opção B: Deploy no Google Cloud Run

1. Crie um `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

2. Build e deploy:
```bash
gcloud run deploy gchat-secret-bot \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars APPROVER_EMAILS=aprovador@empresa.com
```

3. Atualize a configuração do app Google Chat com a URL do Cloud Run

#### Opção C: Deploy em qualquer serviço de hospedagem

Faça deploy no Heroku, AWS, Azure, ou qualquer outra plataforma que suporte aplicações Node.js. Certifique-se de:
- Configurar variáveis de ambiente
- Fazer upload da chave da service account de forma segura
- Usar HTTPS

### 9. Testar o Bot

1. Abra o Google Chat
2. Procure pelo seu bot: **"Secret Manager Bot"**
3. Inicie uma conversa ou adicione-o a um espaço
4. Teste com um comando:
```
/secret meu-project-id senha-database
```

## Uso

### Solicitar um Secret

Em qualquer espaço onde o bot esteja presente:

```
/secret <nome-do-projeto> <nome-do-secret>
```

**Exemplo:**
```
/secret projeto-producao chave-api
```

### Processo de Aprovação

1. Bot posta um card interativo com detalhes da solicitação
2. Aprovadores designados veem botões "Aprovar" e "Negar"
3. Aprovador clica em um botão
4. Na aprovação:
   - Bot busca o secret no Secret Manager
   - Envia o secret privativamente ao solicitante
   - Atualiza o card para mostrar o status de aprovação

### Obter Ajuda

```
help
```

ou

```
/secret
```

## Considerações de Segurança

- ✅ Apenas aprovadores designados (em `APPROVER_EMAILS`) podem aprovar solicitações
- ✅ Secrets são enviados privativamente via DM, nunca em espaços públicos
- ✅ Service account tem permissões mínimas necessárias
- ✅ Todas as solicitações são registradas para fins de auditoria
- ✅ Solicitações pendentes são rastreadas com timestamps
- ⚠️ Armazene sua chave de service account de forma segura
- ⚠️ Use HTTPS para o endpoint do webhook
- ⚠️ Considere usar um banco de dados para produção (ao invés de armazenamento em memória)

## Solução de Problemas

### Bot não responde

1. Verifique os logs do bot para erros
2. Verifique se a URL do webhook está correta e acessível
3. Certifique-se de que a API do Google Chat está habilitada
4. Verifique as permissões da service account

### "Erro ao buscar secret"

1. Verifique se o nome do projeto está correto
2. Certifique-se de que o secret existe no Secret Manager
3. Confirme que a service account tem a role `Secret Manager Secret Accessor`
4. Verifique se a chave da service account é válida

### "Não autorizado" ao clicar em Aprovar

1. Verifique se seu email está na variável de ambiente `APPROVER_EMAILS`
2. Reinicie o bot após atualizar as variáveis de ambiente
3. Verifique se há erros de digitação nos endereços de email

### Mensagem privada não recebida

1. Certifique-se de que a service account tem a role `Chat Bot`
2. Verifique se o usuário iniciou uma DM com o bot pelo menos uma vez
3. Verifique se o pacote `googleapis` está instalado corretamente

## Endpoints da API

- `POST /webhook` - Handler do webhook do Google Chat
- `GET /health` - Endpoint de health check

## Desenvolvimento

### Executar localmente

```bash
npm run dev
```

### Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `PORT` | Porta do servidor | Não (padrão: 3000) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Caminho para chave da service account | Sim |
| `APPROVER_EMAILS` | Emails dos aprovadores separados por vírgula | Sim |
| `GCP_PROJECT_ID` | ID do projeto GCP (opcional) | Não |

## Considerações para Produção

Para deploy em produção:

1. **Use um banco de dados** para armazenar solicitações pendentes (Redis, Firestore, PostgreSQL)
2. **Implemente expiração de solicitações** (ex: solicitações expiram após 1 hora)
3. **Adicione rate limiting** para prevenir abuso
4. **Habilite verificação de solicitações** do Google Chat
5. **Configure monitoramento e alertas**
6. **Use rotação de secrets** para chaves de service account
7. **Implemente log de auditoria** em armazenamento persistente
8. **Adicione campo de motivo** nas solicitações para melhor trilha de auditoria

## Licença

MIT

## Suporte

Para problemas e questões, por favor crie uma issue no repositório.

---

**Desenvolvido com ❤️ para gerenciamento seguro de secrets**
