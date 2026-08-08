# 75 — Fechamento do bloco do Motor Sintético (Fase 2)

> **O que é este documento.** Fechamento **documental** do bloco do motor
> sintético construído na Fase 2, do PR #144 ao PR #158. Registra o que foi
> construído e validado, com referência aos componentes reais e aos testes
> que sustentam cada garantia — sem inflar maturidade além do que o código
> comprova.
>
> **Este fechamento NÃO libera nada.**
>
> - ❌ **NÃO abre** execução real de portal público.
> - ❌ **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false as const`.
> - ❌ **NÃO toca** Gov.br/SINARM/PF.
> - ❌ **NÃO altera** código, schema, migration, dependência ou configuração de CI.
> - ❌ **NÃO é** "produção pronta", "automação concluída" nem "fila de produção completa".
>
> **Data:** 2026-08-08
> **Base da `main`:** `d31bf9d` — *feat: add synthetic engine observability (#158)*
> **Escopo fechado:** motor sintético da Fase 2 — contrato de sessão,
> lifecycle, laboratório local, coordenador de runs, store (memória e
> Prisma), worker de execução única, dispatcher de lote limitado e
> observabilidade operacional.

---

## 1. Objetivo do bloco

Este bloco construiu e validou o **motor sintético** necessário para
aprender, testar e evoluir a automação do Guia de Tráfego **antes de
qualquer execução real** contra Gov.br/SINARM/PF. Tudo roda contra um
laboratório local — sessão fictícia, portal simulado, Playwright só local
— e serve para provar, com teste automatizado, que as regras de
concorrência, idempotência, recuperação e observabilidade funcionam **antes**
de a Fase 9 (execução real controlada) ser autorizada a avançar.

---

## 2. Capacidades concluídas

| Capacidade | Componente |
|---|---|
| Contrato seguro de sessão sintética | `src/server/automation/synthetic/sessionContract.ts` |
| Lifecycle e máquina de estados | `src/server/automation/synthetic/sessionLifecycle.ts` |
| Eventos e consultas de estado | `src/server/automation/synthetic/sessionState.ts` |
| Laboratório local de login e handoff | `src/server/automation/synthetic/labSyntheticFlow.ts` |
| Simulações de captcha, timeout e expiração | `sessionLifecycle.ts` (`SyntheticFailureKind`) + `labSyntheticFlow.ts` |
| Coordenador de runs | `src/server/automation/synthetic/syntheticRunCoordinator.ts` |
| Executor Playwright exclusivamente local | `src/server/automation/synthetic/playwright/localSyntheticRunner.ts`, `localSyntheticPlaywrightAdapter.ts`, `localSyntheticNetworkGuard.ts` |
| Harness de execução e relatório redigido | `src/server/automation/synthetic/playwright/syntheticPlaywrightRunHarness.ts` |
| Contrato `SyntheticRunStore` | `src/server/automation/synthetic/store/syntheticRunStore.ts` |
| Store em memória | `src/server/automation/synthetic/store/inMemorySyntheticRunStore.ts` |
| Store Prisma/Postgres | `src/server/automation/synthetic/store/prismaSyntheticRunStore.ts` |
| Versão otimista | `syntheticRunStore.ts` (`SaveStoredRunInput.expectedVersion`) |
| Idempotência de criação e etapa | `syntheticRunStore.ts` (`idempotencyKey`, `lastStepIdempotencyKey`) |
| Claims com expiração | `syntheticRunStore.ts` (`SyntheticRunClaim`), stores em memória/Prisma |
| Recuperação de runs abandonados | `src/server/automation/synthetic/store/syntheticRunRecovery.ts` |
| Worker de execução única | `src/server/automation/synthetic/worker/syntheticSingleStepWorker.ts` |
| Dispatcher de lote limitado | `src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher.ts` |
| Métricas | `src/server/automation/synthetic/observability/syntheticEngineMetrics.ts` |
| Logs estruturados redigidos | `src/server/automation/synthetic/observability/syntheticEngineLogger.ts`, `inMemorySyntheticEngineLogger.ts` |
| Health | `src/server/automation/synthetic/observability/syntheticEngineHealth.ts` |
| Readiness | `src/server/automation/synthetic/observability/syntheticEngineReadiness.ts` |
| Snapshot operacional | `src/server/automation/synthetic/observability/syntheticEngineSnapshot.ts` |

---

## 3. Garantias já comprovadas

Cada linha abaixo é sustentada por teste automatizado, não por descrição:

- uma chamada de `runSyntheticWorkerOnce` executa **no máximo um run e uma
  etapa**, depois retorna (`syntheticSingleStepWorker.ts`,
  `syntheticSingleStepWorker.test.ts`);
- `dispatchSyntheticBatch` tem limites explícitos — `maxRuns` nunca acima do
  teto interno (`SYNTHETIC_BATCH_MAX_RUNS_CAP`), configuração inválida é
  recusada antes de tocar o store (`syntheticBatchDispatcher.test.ts`);
- a concorrência é limitada — pico observado nunca ultrapassa
  `maxConcurrency`, provado com executor de atraso real
  ("concorrência real nunca ultrapassa maxConcurrency");
- dois workers não recebem legitimamente o mesmo run — claim ativo gera
  `CLAIM_CONFLICT` isolado, sem derrubar o lote ("claim conflitante em um
  item é isolado, sem derrubar o lote");
- conflito de versão não sobrescreve silenciosamente — `VERSION_CONFLICT`
  isolado, etapa não é reexecutada ("conflito de versão em um item é
  isolado, sem reexecutar");
- repetição idempotente não duplica etapa, evento, evidência nem protocolo
  — mesma `idempotencyKey` devolve o resultado já salvo, sem rechamar o
  executor ("mesmo batchId não duplica evento/evidência/protocolo nem
  rechama o executor");
- captcha leva a espera humana — `WAITING_HUMAN`, run não avança sozinho
  ("captcha em um item não interrompe os outros");
- timeout não gera protocolo — falha sintética nunca produz
  `PROT-FICT-*` (`sessionLifecycle.ts`, regra "falha nunca produz
  protocolo");
- sessão expirada não é renovada automaticamente — handle vencido só
  admite `EXPIRED`, sem renovação silenciosa (`sessionLifecycle.ts`,
  código `SESSION_EXPIRED`);
- run terminal e `WAITING_HUMAN` não são reservados — `claimNext` recusa
  ambos (`inMemorySyntheticRunStore.ts`, `syntheticRunRecovery.ts`, "run
  terminal e run WAITING_HUMAN não são selecionados para o lote");
- a sessão viva nunca é persistida — o store só guarda
  `StoredSyntheticRun`, projeção sem `sessionHandle` (`syntheticRunStore.ts`,
  `toStoredSyntheticRun`);
- `sessionHandle` não é persistido, em nenhuma camada, inclusive
  observabilidade ("o relatório do lote nunca carrega sessionHandle nem
  credencial", "nenhum evento emitido carrega sessionHandle nem
  credencial");
- logs e snapshots não carregam credenciais — redigidos via
  `redactLabText`/`scanSyntheticValue`, sem regex nova
  (`syntheticEngineLogger.test.ts`, `syntheticEngineSnapshot.test.ts`);
- o laboratório não depende de execução real — executor é sempre injetado,
  o adaptador Playwright é exclusivamente local
  (`localSyntheticNetworkGuard.ts`);
- a Fase 9 continua bloqueada — `PHASE9_REAL_EXECUTION_ENABLED = false as const`
  (`src/server/automation/phase9/safety.ts`), intocada por este bloco.

---

## 4. Limitações atuais

Ainda **não existem**:

- serviço contínuo;
- scheduler;
- cron;
- polling;
- endpoint operacional;
- dashboard;
- acionador administrativo;
- persistência externa de logs ou métricas;
- alertas;
- integração com Sentry, Prometheus, OpenTelemetry ou similares;
- gestão real de sessões;
- integração real com Gov.br, SINARM ou Polícia Federal;
- solução de captcha;
- bypass;
- execução real autorizada;
- operação em produção.

Este bloco **não é** "produção pronta", **não é** "automação concluída",
**não é** "fila de produção completa" e **não é** "integração real pronta".
É um motor sintético testável, chamado manualmente, em processo — cada
chamada de worker/dispatcher precisa ser disparada explicitamente (via
teste ou comando local), nada roda sozinho.

---

## 5. Arquitetura resumida

```text
plano sintético
→ store
→ seleção de run
→ claim
→ worker de uma etapa
→ executor injetado
→ save com versão
→ release/complete claim
→ resultado redigido
→ métricas/logs/health/readiness
```

O Playwright entra **somente** por `SyntheticStepExecutor` injetado
(`playwright/syntheticStepExecutor.ts`) e permanece limitado ao laboratório
local — o dispatcher e o worker não importam Playwright diretamente, e o
adaptador real (`localSyntheticPlaywrightAdapter.ts`) só fala com o portal
sintético local, atrás de `localSyntheticNetworkGuard.ts`.

---

## 6. Critérios de aceite do bloco

- [x] Contratos (`sessionContract.ts`, `syntheticRunStore.ts`)
- [x] Persistência (store em memória e Prisma/Postgres, mesmo contrato)
- [x] Concorrência (dispatcher com `maxConcurrency` provado por teste)
- [x] Idempotência (criação e etapa, sem duplicar evento/evidência/protocolo)
- [x] Recuperação (`syntheticRunRecovery.ts`, claims expirados voltam a ficar elegíveis)
- [x] Worker limitado (uma chamada, no máximo um run e uma etapa)
- [x] Dispatcher limitado (teto interno, deadline, cancelamento, sem `while(true)`)
- [x] Observabilidade (métricas, logs redigidos, health, readiness, snapshot)
- [x] Testes (ver total abaixo, confirmado por comando real)
- [x] Documentação (`docs/72`–`docs/75`)
- [x] Salvaguardas (sem `sessionHandle` persistido, sem execução real, Fase 9 intocada)

**Total de testes após o merge do #158:** `npm run test:unit:all` →
**1962 testes, 0 falhas** (`test:documents:unit` 1700 + `test:phase9:unit` 36
+ `test:auth:unit` 87 + `test:support:unit` 139).

---

## 7. Evidências técnicas

**PRs do bloco (motor sintético, #144–#158):**

| PR | Título | Commit em `main` |
|---|---|---|
| #144 | feat: add synthetic session contract types | `3de3b5b` |
| #148 | feat: apply synthetic session transitions and emit lab events | `56a52f0` |
| #149 | feat: add synthetic login and session handoff flow | `66963fb` |
| #150 | feat: add synthetic timeout captcha and handle expiry | `36e80f4` |
| #151 | feat: add synthetic automation run coordinator | `caa2c8f` |
| #152 | feat: connect synthetic coordinator to local playwright lab | `2ebe022` |
| #153 | feat: add synthetic playwright run harness and report | `5034396` |
| #154 | feat: add synthetic run store and recovery contracts | `85f2cc1` |
| #155 | feat: add prisma synthetic run store | `37d02b6` |
| #156 | feat: add synthetic single-step worker | `9391e10` |
| #157 | feat: add bounded synthetic batch dispatcher | `01f2cd4` |
| #158 | feat: add synthetic engine observability | `d31bf9d` |

> PR #145 (docs de capacidade/carga) segue **aberto**, e PR #146 (helpers de
> estado) foi **fechado sem merge próprio** — seu conteúdo (`sessionState.ts`)
> entrou como parte do #148. Nenhum dos dois é listado acima como commit
> próprio em `main`, para não inventar hash que o histórico não sustenta.

**Hash do squash merge do #158:** `d31bf9d306ee6b53712d05d893f91f79e2d6ed7c`

**Comandos de validação utilizados (executados sobre `main` pós-merge):**

```bash
npm run typecheck
npm run test:unit:all
npm run lint
npm run build
```

**Resultado:**

- `typecheck` — sem erro;
- `test:unit:all` — **1962 testes, 0 falhas**;
- `lint` — sem warning nem erro (`next lint`);
- `build` — build de produção concluído com sucesso (26 rotas).

**Fase 9:** `src/server/automation/phase9/safety.ts` define
`PHASE9_REAL_EXECUTION_ENABLED = false as const` — confirmado por leitura
direta do arquivo em `main` pós-merge, intocado por este bloco e por este
fechamento documental.

---

## 8. Próximo bloco recomendado

```text
acionamento manual administrativo do dispatcher sintético
```

Esse futuro acionador deverá:

- exigir ação explícita (sem disparo automático);
- usar os limites de lote e concorrência já existentes no dispatcher;
- não ser scheduler;
- não usar polling;
- não operar continuamente;
- expor resultado redigido (reusando métricas/logs já construídos aqui);
- consultar health e readiness antes de aceitar a execução;
- continuar sem acesso a portais reais.

**Depois dele**, como etapas futuras ainda **não iniciadas**:

- persistência/integração externa de observabilidade;
- serviço agendado controlado;
- gestão segura de sessão efêmera;
- gates jurídicos, operacionais e de segurança;
- prova real controlada, somente em fase explicitamente autorizada.
