# WhatsappBatchApi

API Node.js/Express para autenticação, gerenciamento de instâncias WhatsApp, grupos de contato, lotes de mensagens e lotes de mídia.

## Arquitetura alvo (cluster/worker)

Foi adicionado um blueprint técnico com fases de implantação, contratos de fila, sharding e estratégia de failover em:

- `docs/whatsapp-worker-blueprint.md`


## Requisitos
- Node.js 18+
- MongoDB

## Configuração rápida
1. Instale dependências:
   ```bash
   npm install
   ```
2. Crie o arquivo `.env` com variáveis mínimas:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/whatsapp-batch-api
   JWT_SECRET=sua_chave_jwt
   CORS_ORIGIN=http://localhost:3000
   NODE_ENV=development
   REDIS_URL=redis://localhost:6379
   WORKER_NODE_ID=api-node-1
   WORKER_NODE_LIST=api-node-1,api-node-2
   QUEUE_FIRST_MODE=true
   SHARED_SESSIONS_PATH=/mnt/efs/whatsapp-sessions
   WORKER_HEARTBEAT_TIMEOUT_MS=30000
   ```
3. Rode a API:
   ```bash
   npm run dev
   ```



## Redis no ambiente local

### Opção 1: Docker (recomendado)
```bash
docker run -d --name whatsapp-redis -p 6379:6379 redis:7-alpine
```

### Opção 2: Docker Compose completo (API + Worker + Mongo + Redis)
```bash
docker compose up -d
```

Com isso, os serviços sobem com:
- API em `http://localhost:3000`
- MongoDB em `localhost:27017`
- Redis em `localhost:6379`

Para validar Redis:
```bash
docker exec -it whatsapp-redis redis-cli ping
```
Resposta esperada: `PONG`.

### Troubleshooting: sessão não conecta no Docker
Se a API enfileira comandos para um `ownerNode` que não tem consumer ativo, a sessão fica pendente.
No `docker-compose.yml` deste projeto, o `WORKER_NODE_LIST` já está fixado para `worker-node-1` em API/worker, garantindo que os jobs vão para a fila consumida pelo worker (`whatsapp.commands.worker-node-1`).

Se você customizar nós, mantenha esta regra:
- todo nó listado em `WORKER_NODE_LIST` precisa ter um worker rodando e consumindo sua fila
- se houver só 1 worker, use exatamente esse nó na lista
- para jobs nomeados (`connect/recover/disconnect/delete`), o worker precisa registrar process handlers por tipo (já implementado neste projeto)

## Worker de comandos WhatsApp (Fase 2 inicial)

Quando `REDIS_URL` estiver configurada, os comandos de `connect/recover/disconnect` podem ser enfileirados em `whatsapp.commands` e consumidos por um processo dedicado:

```bash
npm run worker:whatsapp
```

Para migrar sessões locais antigas para o storage compartilhado:

```bash
npm run migrate:sessions
```

Sem `REDIS_URL`, a API mantém fallback para execução local em memória.

Roteamento determinístico de ownership (Fase 2.2):
- owner da sessão é resolvido por hash determinístico (`userId:sessionName`)
- comandos são publicados na fila por owner: `whatsapp.commands.<ownerNode>`
- cada worker consome apenas sua fila e valida ownership antes de executar

Fase 2.3 (queue-first em produção):
- com `QUEUE_FIRST_MODE=true`, comandos de ciclo de vida são bloqueados fora da fila quando `REDIS_URL` está ativa

Fase 3.1 (provider de sessão compartilhada):
- sessões Baileys usam provider via `SHARED_SESSIONS_PATH` (EFS/NFS recomendado em produção)
- worker executa bootstrap automático de recover ao subir quando há sessão persistida
- ownership stale pode ser reassumido pelo owner determinístico (`WORKER_HEARTBEAT_TIMEOUT_MS`)

Fase 4 (realtime + observabilidade inicial):
- stream de status por SSE em `GET /api/whatsapp/instances/:id/stream`
- métricas por sessão em `GET /api/whatsapp/instances/:id/metrics`

## Base URL
- Local: `http://localhost:3000`
- Health check: `GET /health`


## Nota de produto
- A funcionalidade **Agenda de contatos foi descontinuada** no fluxo principal.
- O agendamento de disparo agora deve ser feito diretamente na criação de **Lotes de mídia** usando o campo `scheduledAt` (ISO 8601) ou o campo de data/hora no frontend.

## Autenticação
A maior parte das rotas usa token JWT no header `Authorization`:

```http
Authorization: Bearer <token>
```

### Fluxo mínimo
1. `POST /api/auth/register` (ou `POST /api/auth/login`)
2. Copie o `token` da resposta
3. Envie o token no header nas rotas protegidas

---

## Endpoints atuais

### Auth (`/api/auth`)
- `POST /register`
- `POST /login`
- `GET /profile` (autenticado)

**Exemplo – Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"123456"}'
```

**Resposta (200)**
```json
{
  "success": true,
  "user": {
    "id": "65f...",
    "name": "Usuário",
    "email": "user@email.com",
    "role": "user"
  },
  "token": "eyJhbGci..."
}
```

### WhatsApp (`/api/whatsapp`) — autenticado
- `POST /instances`
- `GET /instances`
- `GET /instances/:id`
- `DELETE /instances/:sessionName`
- `GET /instances/:id/qrcode`
- `PUT /instances/:id/disconnect`
- `POST /instances/:id/load-groups`
- `GET /instances/:id/groups`
- `GET /instances/:id/status`
- `GET /instances/:id/stream` (SSE)
- `GET /instances/:id/metrics`

**Exemplo – Listar instâncias**
```bash
curl http://localhost:3000/api/whatsapp/instances \
  -H "Authorization: Bearer <token>"
```

### Grupos de contato (`/api/contact-groups`) — autenticado
- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/contacts`
- `GET /instance/:instanceId`
- `POST /instance/:instanceId/sync`
- `GET /filters/advanced`

**Exemplo – Criar grupo**
```bash
curl -X POST http://localhost:3000/api/contact-groups \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Clientes SP","description":"Base de clientes SP"}'
```

**Resposta (201)**
```json
{
  "success": true,
  "message": "Grupo de contatos criado com sucesso",
  "contactGroup": {
    "_id": "66a...",
    "name": "Clientes SP",
    "description": "Base de clientes SP"
  }
}
```

### Lotes de mensagens (`/api/batches`) — autenticado
- `POST /`
- `GET /`
- `GET /:id`
- `PUT /:id/cancel`
- `GET /debug/socket/:instanceId`

### Lotes de mídia (`/api/media`)
Público:
- `GET /public-media/:userId/:filename`

Autenticado:
- `GET /media-file/:userId/:filename`
- `POST /upload`
- `POST /batches` (aceita `scheduledAt` opcional para envio agendado)
- `GET /batches`
- `GET /batches/:id`
- `PUT /batches/:id/cancel`
- `DELETE /batches/:id`

### Controle de mensagens (`/api/message-control`)
- `POST /:sessionName/enable`
- `POST /:sessionName/disable`
- `GET /:sessionName/status`
- `GET /active`

### Admin (`/api/admin`) — autenticado + role `admin`
- `GET /users/stats`
- `GET /users`
- `GET /messages/stats`
- `GET /system/stats`

---

## Formato padrão de erro
Exemplo comum de erro:

```json
{
  "success": false,
  "error": "Token inválido"
}
```

## Scripts disponíveis
- `npm run dev` — desenvolvimento com nodemon
- `npm start` — produção
- `npm test` — Jest


**Exemplo – Criar lote de mídia agendado**
```bash
curl -X POST http://localhost:3000/api/media/batches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Campanha fim de semana",
    "whatsappInstanceId":"66b...",
    "contactGroupIds":["66c..."],
    "mediaItems":[{"fileName":"banner.jpg","mimeType":"image/jpeg"}],
    "caption":"Promoção válida hoje",
    "scheduledAt":"2026-02-08T14:00:00.000Z",
    "options":{"delayBetweenMessages":3000}
  }'
```
