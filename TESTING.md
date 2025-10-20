# Guia de Testes

Este guia ajuda você a testar a funcionalidade do Bot de Google Chat para Secret Manager.

## Pré-requisitos

- Bot está rodando (localmente ou em deploy)
- Service account tem permissões apropriadas
- App do Google Chat está configurado
- Pelo menos um secret de teste existe

## Criar Secrets de Teste

### Usando gcloud CLI

```bash
# Configurar seu projeto
export PROJECT_ID="seu-project-id"

# Criar um secret de teste
echo -n "ValorSecretoTeste123" | gcloud secrets create test-api-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic" \
  --data-file=-

# Conceder acesso à service account
gcloud secrets add-iam-policy-binding test-api-key \
  --project=$PROJECT_ID \
  --member="serviceAccount:gchat-secret-bot@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Usando o script auxiliar

```bash
cd examples
chmod +x create-test-secret.sh
./create-test-secret.sh seu-project-id test-api-key "MeuValorSecreto"
```

## Cenários de Teste

### Teste 1: Bot Responde a Comandos

**Ação:** Enviar uma mensagem para o bot
```
olá
```

**Esperado:** Bot responde com instruções de uso

---

### Teste 2: Comando de Ajuda

**Ação:** Enviar comando de ajuda
```
help
```

**Esperado:** Bot exibe informações de ajuda com sintaxe do comando

---

### Teste 3: Solicitar um Secret (Caminho Feliz)

**Ação:** Solicitar um secret válido
```
/secret seu-project-id test-api-key
```

**Esperado:**
1. ✅ Bot exibe um card de aprovação
2. ✅ Card mostra info do solicitante, projeto e nome do secret
3. ✅ Botões Aprovar/Negar estão visíveis
4. ✅ Status mostra "Aguardando Aprovação"

---

### Teste 4: Aprovar Solicitação (Usuário Autorizado)

**Pré-requisitos:** Seu email está em `APPROVER_EMAILS`

**Ação:** Clicar no botão "✅ APROVAR"

**Esperado:**
1. ✅ Card atualiza para mostrar status "Aprovado"
2. ✅ Nome do aprovador é exibido
3. ✅ Solicitante recebe uma DM privada com o secret
4. ✅ DM contém o valor do secret em um bloco de código

---

### Teste 5: Negar Solicitação

**Ação:** Clicar no botão "❌ NEGAR"

**Esperado:**
1. ✅ Card atualiza para mostrar status "Negado"
2. ✅ Nome de quem negou é exibido
3. ✅ Nenhum secret é enviado
4. ✅ Solicitante não recebe uma DM

---

### Teste 6: Tentativa de Aprovação Não Autorizada

**Pré-requisitos:** Testar com um usuário que NÃO está em `APPROVER_EMAILS`

**Ação:** Clicar em "APROVAR" ou "NEGAR"

**Esperado:**
1. ✅ Mensagem de erro: "Não autorizado"
2. ✅ Card não atualiza
3. ✅ Solicitação permanece pendente

---

### Teste 7: Solicitação de Secret Inválido

**Ação:** Solicitar um secret inexistente
```
/secret seu-project-id secret-inexistente
```

**Esperado:**
1. ✅ Card de aprovação é exibido
2. ✅ Quando aprovado, mensagem de erro é mostrada
3. ✅ Erro explica que o secret não existe ou permissão negada

---

### Teste 8: Solicitação de Projeto Inválido

**Ação:** Solicitar de um projeto inexistente
```
/secret projeto-invalido-123 test-secret
```

**Esperado:**
1. ✅ Card de aprovação é exibido
2. ✅ Quando aprovado, mensagem de erro indica projeto não encontrado

---

### Teste 9: Entrega de Mensagem Privada

**Ação:** Aprovar uma solicitação de secret

**Esperado:**
1. ✅ Solicitante recebe uma DM do bot
2. ✅ DM contém nome do projeto e nome do secret
3. ✅ Valor do secret está em um bloco de código
4. ✅ Aviso de segurança está incluído

---

### Teste 10: Comando Inválido

**Ação:** Enviar um comando inválido
```
/secret
```

**Esperado:**
1. ✅ Bot responde com instruções de uso
2. ✅ Explica o formato correto

---

### Teste 11: Múltiplas Solicitações Simultâneas

**Ação:** Múltiplos usuários solicitam secrets ao mesmo tempo

**Esperado:**
1. ✅ Cada solicitação recebe seu próprio card
2. ✅ Cards podem ser aprovados independentemente
3. ✅ Cada solicitante recebe seu respectivo secret

---

### Teste 12: Endpoint de Health Check

**Ação:** Chamar o endpoint de health
```bash
curl https://url-do-seu-bot/health
```

**Esperado:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "pendingRequests": 0
}
```

---

## Script de Teste Automatizado

Crie um script de teste para verificar funcionalidade básica:

```bash
#!/bin/bash

BOT_URL="https://url-do-seu-bot"

# Testar endpoint de health
echo "Testando endpoint de health..."
curl -s $BOT_URL/health | jq .

# Testar endpoint de webhook (deve retornar 200)
echo "Testando endpoint de webhook..."
curl -X POST $BOT_URL/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MESSAGE",
    "message": {
      "text": "help"
    },
    "user": {
      "name": "users/test",
      "displayName": "Usuário Teste",
      "email": "teste@exemplo.com"
    },
    "space": {
      "name": "spaces/test"
    }
  }'
```

## Solução de Problemas nos Testes

### Teste Falha: Bot Não Responde

**Verificar:**
- [ ] Bot está rodando: `curl https://url-do-seu-bot/health`
- [ ] URL do webhook está correta na config do Google Chat
- [ ] Verificar logs do bot para erros

### Teste Falha: "Erro ao buscar secret"

**Verificar:**
- [ ] ID do projeto está correto
- [ ] Secret existe: `gcloud secrets describe NOME_SECRET --project=PROJECT_ID`
- [ ] Service account tem acesso:
```bash
gcloud secrets get-iam-policy NOME_SECRET --project=PROJECT_ID
```

### Teste Falha: Mensagem Privada Não Recebida

**Verificar:**
- [ ] Usuário iniciou uma DM com o bot pelo menos uma vez
- [ ] Service account tem permissões de Chat Bot
- [ ] Verificar logs do bot para "Error sending private message"

### Teste Falha: "Não autorizado" para Aprovador Válido

**Verificar:**
- [ ] Email corresponde exatamente (sensível a maiúsculas/minúsculas)
- [ ] Sem espaços extras em `APPROVER_EMAILS`
- [ ] Bot foi reiniciado após atualizar `.env`
- [ ] Verificar logs: `console.log` mostrará validação do aprovador

## Checklist de Testes

Antes de ir para produção, verificar:

- [ ] Todos os testes de caminho feliz passam
- [ ] Casos de erro são tratados graciosamente
- [ ] Mensagens privadas funcionam corretamente
- [ ] Autorização funciona como esperado
- [ ] Múltiplas solicitações concorrentes funcionam
- [ ] Entradas inválidas não quebram o bot
- [ ] Logs são claros e informativos
- [ ] Endpoint de health responde corretamente

## Teste de Performance

Para prontidão em produção, testar:

1. **Carga:** 10+ solicitações de secret simultâneas
2. **Tempo de resposta:** Card de aprovação aparece em até 2 segundos
3. **Entrega de secret:** DM chega em até 5 segundos após aprovação
4. **Memória:** Bot não vaza memória com solicitações pendentes

## Teste de Segurança

Verificar medidas de segurança:

- [ ] Secrets nunca aparecem em espaços públicos
- [ ] Apenas aprovadores podem aprovar/negar
- [ ] Service account tem permissões mínimas
- [ ] Chaves de API/credenciais não são logadas
- [ ] HTTPS é obrigatório para webhook

## Monitoramento

Configurar monitoramento para:

- Volume de solicitações
- Taxas de aprovação/negação
- Taxas de erro
- Tempos de resposta
- Falhas ao buscar secrets

---

**Bons Testes! 🧪**
