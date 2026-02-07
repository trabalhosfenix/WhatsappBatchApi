# Blueprint técnico — arquitetura WhatsApp em cluster (1 instância por usuário)

## 1) Objetivos não funcionais

- Garantir **unicidade operacional**: apenas uma sessão ativa por usuário.
- Permitir **failover sem perda de recuperação** de sessão WhatsApp.
- Suportar escalabilidade horizontal com **afinidade determinística** de sessão.
- Reduzir polling no frontend com **stream de eventos em tempo real**.

---

## 2) Arquitetura alvo (visão de alto nível)

### Componentes

1. **API (Control Plane)**
   - CRUD de instâncias
   - Comandos de ciclo de vida (connect/recover/disconnect)
   - Consulta de estado consolidado
   - Emissão de eventos para frontend (SSE/WebSocket)

2. **Worker WhatsApp (Data Plane)**
   - Socket Baileys
   - Reconnect e gestão de QR
   - Consumo da fila de comandos
   - Publicação de eventos e heartbeat

3. **Infra compartilhada**
   - **Redis**: lock distribuído + Bull + estado volátil
   - **MongoDB**: estado durável de instância/operação
   - **Storage de sessão**: EFS/NFS *ou* objeto + cache local com lock

### Fluxo resumido

1. API recebe comando (ex.: `connect`).
2. API calcula `ownerNode` via hash determinístico (`userId` + `sessionName`) e grava comando na fila.
3. Worker dono consome o comando, adquire lock distribuído e executa.
4. Worker publica estado (`connectionState`, QR, erro, heartbeat).
5. API entrega estado por endpoint e por stream em tempo real.

---

## 3) Contratos de dados

## 3.1 MongoDB — `whatsapp_instances`

Adicionar campos:

- `ownerNode: string | null` — nó lógico responsável pela sessão.
- `lastHeartbeat: Date | null` — último batimento do worker dono.
- `version: number` — controle otimista de concorrência.
- `connectionState: "disconnected" | "connecting" | "qr" | "connected" | "reconnecting" | "error"`
- `reconnectAttempts: number`
- `lastErrorCode: string | null`

### Índices recomendados

- `unique(userId)` (regra forte de 1 instância por usuário)
- `index(ownerNode, connectionState)`
- `index(lastHeartbeat)`

## 3.2 Redis — chaves operacionais

- `wa:lock:session:{sessionId}` — lock distribuído de reconnect/connect.
- `wa:state:{sessionId}` — snapshot rápido do estado atual.
- `wa:owner:{sessionId}` — owner calculado para roteamento determinístico.
- `wa:heartbeat:{workerId}` — presença do worker no cluster.

---

## 4) Contratos de fila (Bull/Redis)

Fila principal: `whatsapp.commands`

### Jobs

1. `connect`
   - payload: `{ sessionId, userId, sessionName, requestedBy, traceId }`
2. `recover`
   - payload: `{ sessionId, reason, traceId }`
3. `disconnect`
   - payload: `{ sessionId, requestedBy, traceId }`
4. `sync-groups`
   - payload: `{ sessionId, instanceId, traceId }`
5. `send-batch`
   - payload: `{ sessionId, batchId, traceId }`

### Políticas sugeridas

- `attempts`: 5
- `backoff`: exponencial (base 2s, máx 60s)
- `removeOnComplete`: `true`
- `removeOnFail`: `false` (com retenção e DLQ)
- DLQ: `whatsapp.commands.dlq`

### Idempotência

- `jobId` estável por operação (ex.: `connect:{sessionId}:{version}`).
- Worker valida versão atual da sessão antes de executar o job.

---

## 5) Regras de ownership/sharding

- Estratégia inicial: **Rendezvous Hashing** com lista de workers ativos.
- Chave de roteamento: `sessionKey = userId + ":" + sessionName`.
- API calcula owner e persiste em `ownerNode`.
- Apenas owner executa comandos da sessão.
- Se owner cair (`heartbeat` expirado), API recalcula owner e publica `recover`.

---

## 6) Lock distribuído de reconexão

- Lock por sessão com TTL curto (ex.: 15s) + renovação durante operação.
- Sem lock válido, worker deve abortar reconnect.
- Em caso de timeout/erro:
  - liberar lock (best-effort)
  - atualizar estado para `reconnecting` com `reconnectAttempts + 1`
  - reagendar job com backoff

---

## 7) Sessão compartilhada (auth state)

### Opção A — Volume compartilhado (EFS/NFS)

- Caminho único por sessão: `/sessions/{sessionId}`
- Prós: simples de adotar.
- Contras: sensível à latência/locking do FS.

### Opção B — Objeto + cache local

- Source of truth em objeto (S3 compatível).
- Worker restaura para cache local no bootstrap.
- Persistência com lock distribuído e versionamento.
- Prós: mobilidade/failover melhores.

**Recomendação:** começar com A (entrega rápida) e evoluir para B quando throughput crescer.

---

## 8) Realtime para frontend

### SSE inicial (menor custo)

- Endpoint: `GET /api/whatsapp/instances/:id/stream`
- Eventos:
  - `state.changed`
  - `qr.updated`
  - `owner.changed`
  - `error`
- Fallback para polling somente em clientes legados.

---

## 9) Plano de execução por fase (baixo risco)

## Fase 1 — Hardening (sem quebrar produto)

- [ ] Migration Mongo: `ownerNode`, `lastHeartbeat`, `version`, índices.
- [ ] Regra de unicidade real por `userId`.
- [ ] Upsert controlado em create/recover.
- [ ] Lock distribuído no fluxo de reconnect.

### Critério de aceite

- Não é possível criar 2 instâncias para o mesmo usuário.
- Reconnect concorrente em 2 nós não ocorre para a mesma sessão.

## Fase 2 — Separar runtime de conexão

- [x] Criar processo `whatsapp-worker`.
- [x] API publica comandos na fila.
- [x] Worker consome e executa com ownership.

### Critério de aceite

- API pode escalar sem levar sockets Baileys junto.

## Fase 3 — Sessão compartilhada + failover

- [ ] Migrar `auth_sessions` para storage compartilhado.
- [ ] Bootstrap automático após restart de worker.
- [ ] Reclaim de sessão ao detectar owner offline.

### Critério de aceite

- Reinício de pod não exige recriação manual da sessão.

## Fase 4 — Realtime + observabilidade

- [ ] SSE/WebSocket de status e QR.
- [ ] Métricas por sessão:
  - connect_time
  - reconnect_rate
  - auth_401_rate
  - qr_refresh_rate

### Critério de aceite

- Frontend reduz polling e recebe atualização de estado em tempo quase real.

---

## 10) Backlog técnico (tarefas de sprint)

1. Criar migration e índices de unicidade.
2. Implementar adapter de lock distribuído (Redis).
3. Extrair módulo de comando (`CommandBus`) na API.
4. Criar binário/processo `whatsapp-worker` com bootstrap por filas.
5. Implementar ownership por hashing + heartbeat.
6. Implementar provider de storage de sessão (EFS primeiro).
7. Expor endpoint SSE e eventos padronizados.
8. Adicionar métricas e dashboard operacional.

---

## 11) Riscos e mitigação

- **Split brain de ownership**: proteger com lock + fencing token (`version`).
- **Storm de reconnect**: backoff exponencial e jitter.
- **Fila acumulando**: DLQ + autoscaling do worker por lag.
- **Falha no storage de sessão**: circuito aberto + alarme + retry controlado.

---

## 12) Definição de pronto (DoD)

- Unicidade de instância por usuário garantida em banco.
- Reconnect protegido por lock distribuído em ambiente multi-nó.
- Worker separado da API em produção.
- Failover recupera sessão sem intervenção manual.
- Frontend consumindo eventos em tempo real para status/QR.
