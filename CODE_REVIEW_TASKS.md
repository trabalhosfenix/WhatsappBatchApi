# Revisão rápida da base e tarefas sugeridas

## 1) Tarefa para corrigir **erro de digitação**
**Problema encontrado:** existe uma pasta/arquivo duplicado com nome inconsistente: `public/component/list-component.js` (singular) enquanto o restante do projeto usa `public/js/components/list-component.js` (plural). Isso indica provável erro de digitação/estrutura e aumenta risco de confusão em manutenção.

**Tarefa sugerida:**
- Remover `public/component/list-component.js` se estiver obsoleto.
- Se ele for necessário, mover para `public/js/components/` e padronizar nomenclatura.
- Adicionar verificação no CI (script simples) para evitar duplicatas de componentes por variação de nome/pasta.

## 2) Tarefa para corrigir **bug**
**Problema encontrado:** em `src/controllers/contactGroupController.js`, o método `syncInstanceGroups` lê `req.params.id`, mas a rota define `:instanceId` (`src/routes/contactGroups.js`). Além disso, o controller usa `WhatsAppInstance` e `whatsappService` sem import explícito no arquivo.

**Tarefa sugerida:**
- Ajustar `syncInstanceGroups` para usar `req.params.instanceId`.
- Importar `WhatsAppInstance` e `whatsappService` no topo do controller.
- Adicionar validação de parâmetro obrigatório e retorno 400 quando ausente.
- Cobrir com teste de integração da rota `POST /api/contact-groups/instance/:instanceId/sync`.

## 3) Tarefa para ajustar **comentário/discrepância de documentação**
**Problema encontrado:** há comentários de instrução de edição deixados no código produtivo (ex.: `// 📁 controllers/whatsappController.js - ADICIONAR MÉTODOS` dentro de `contactGroupController.js`), que não refletem o estado real do arquivo e confundem manutenção.

**Tarefa sugerida:**
- Remover comentários temporários de “ADICIONAR/ATUALIZAR” nos controllers/serviços.
- Substituir por comentários de intenção de negócio (quando realmente necessários).
- Expandir o `README.md` com endpoints atuais, autenticação e exemplos mínimos de request/response.

## 4) Tarefa para melhorar **teste**
**Problema encontrado:** o projeto possui `jest` configurado no `package.json`, porém não há suíte de testes versionada cobrindo rotas críticas e regressões do controller de grupos.

**Tarefa sugerida:**
- Criar suíte inicial de testes com Jest + Supertest para:
  - autenticação básica de rota protegida;
  - fluxo de criação/listagem de grupos de contato;
  - caso de regressão para `syncInstanceGroups` (parâmetro `instanceId` correto).
- Adicionar comando de cobertura (`jest --coverage`) e meta mínima inicial (ex.: 60%).
