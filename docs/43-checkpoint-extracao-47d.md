# 43 — Checkpoint Técnico da Série #47D (Extração de Documentos)

> **O que é este documento.** Um **retrato** do estado da extração de documentos
> após a série #47D, e o **insumo** da próxima decisão arquitetural. É
> documentação: **não altera código, não altera schema, não cria migration, não
> fecha gate e não autoriza nada.**
>
> **Execução real continua BLOQUEADA.** `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false as const`. Os **gates 1, 2, 3 e 5** de `docs/26 §19` continuam
> **abertos**. Nada aqui toca Gov.br/SINARM/PF.
>
> **Data:** 2026-07-29
> **Base da `main`:** `5b1dff7` — *feat: add controlled extraction enqueue*
> **Referências:** `docs/00 §8` (regras permanentes), `docs/12 §6` (status
> canônicos), `docs/25 §4/§5` (visão de automação e escada de maturidade),
> `docs/26 §19` (gates), `docs/38` (estado da automação), `docs/42` (ensaio
> futuro).

---

## 1. Status do checkpoint

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| `main` | `5b1dff7` — *feat: add controlled extraction enqueue* |
| Escopo | **Documentação apenas** — sem código, sem schema, sem migration |
| Execução real | **BLOQUEADA** |
| `PHASE9_REAL_EXECUTION_ENABLED` | `false as const` (`src/server/automation/phase9/safety.ts`) |
| `docs/26 §19` | Gates 1, 2, 3 e 5 **abertos** — inalterados por este documento |
| Motor de extração | **mock** — não lê arquivo, não faz OCR, não usa rede |

---

## 2. Linha do tempo da série #47D

| PR | Entrega | O que resolveu |
|----|---------|----------------|
| **#47D-0** | Timeout lazy por documento | `PROCESSANDO` órfã travava o documento para sempre: o índice único parcial impedia a substituta e a aplicação não tinha saída |
| **#47D-1** | Worker manual | Passou a existir quem consome a fila, em lote pequeno e por acionamento explícito |
| **#47D-2** | Reaper global + índices | Varredura de `PROCESSANDO` abandonadas sem depender de alguém pedir aquele documento |
| **#47D-3A** | Acionador admin manual | Painel `/admin/extracao` com ações server-side para worker e reaper |
| **#47D-3B** | Criação controlada de fila `PENDENTE` | `requestDocumentExtraction` não tinha chamador de produção — a fila nunca tinha nada e o lote sempre devolvia zero |

---

## 3. Fluxo atual (ponta a ponta)

```
operador clica "Criar fila"        → enqueueDocumentExtractions
   elegíveis: documentos ENVIADO/EM_ANALISE sem tentativa ativa
   ordem: FIFO (created_at ASC, id ASC)
   limite: ENQUEUE_BATCH_SIZE = 10
   por documento: requestDocumentExtraction → cria ou reusa tentativa PENDENTE

operador clica "Processar fila"    → documentExtractionWorker
   lote: EXTRACTION_WORKER_BATCH_SIZE = 5
   claim atômico PENDENTE -> PROCESSANDO (quem perde a corrida, pula)
   engine mock → EXTRAIDA | PRECISA_REVISAO | FALHOU

operador clica "Destravar"          → documentExtractionReaper
   PROCESSANDO parada há mais de PROCESSING_TIMEOUT_MS (15 min) → FALHOU/TIMEOUT
   relógio: updated_at, renovado no claim
```

**Enfileirar não processa.** São dois acionamentos distintos, de propósito:
encadear os dois esconderia qual dos passos falhou.

**Nada é automático.** Não há schedule, cron, `setInterval` nem heartbeat.
Toda passada começa em um clique humano com permissão `extraction.run`.

---

## 4. O que está pronto

**Modelo de dados**

- Persistência **1:N** (uma linha por tentativa) — histórico preservado; decisão
  automática consegue apontar em qual extração se baseou.
- **Índice único parcial** `document_extractions_one_active_per_document`
  (`WHERE state IN ('PENDENTE','PROCESSANDO')`) — garantia no banco, não em
  código, de **uma tentativa ativa por documento**.
- Índices de varredura (`state, updated_at`) e de "mais recente do documento"
  (`document_id, created_at DESC, id DESC`) — ordem declarada, sem depender do
  que o Postgres devolver em empate de milissegundo.
- `engine` + `engine_version` gravados por tentativa — permite comparar motores
  quando o OCR real entrar.

**Comportamento**

- **Claim atômico** `PENDENTE → PROCESSANDO`; perder a corrida é caso normal
  (`worker_skipped_claim_lost`), não erro.
- **Timeout lazy por documento** (#47D-0) + **reaper global** (#47D-2) — as duas
  redes, porque a lazy só dispara quando alguém pede aquele documento.
- **Recuperação de corrida no enqueue**: violação de unique (`P2002`) é relida e
  devolvida como `reused`, com contador próprio — é a proteção funcionando, não
  falha.
- Estados terminais (`EXTRAIDA`, `PRECISA_REVISAO`, `CONFIRMADA`, `FALHOU`)
  permitem reprocessar criando linha **nova**, sem apagar a anterior.

**Segurança e observabilidade**

- Motivos de falha **sanitizados** e fechados: `ARQUIVO_ILEGIVEL`,
  `FORMATO_NAO_SUPORTADO`, `TIMEOUT`, `ENGINE_INDISPONIVEL`, `ERRO_INTERNO` —
  nunca texto bruto de OCR.
- Logs estruturados com `actorId`/`actorRole` e **sem PII**: `clientId`,
  `processId`, `documentId`, `extractionId`, `filename`, `storageKey`, `fields`,
  conteúdo de documento e erro bruto **não** entram no log de acionamento.
- Eventos disponíveis: `extraction_enqueue_manual_triggered` /
  `_failed`, `extraction_worker_manual_triggered` / `_failed`,
  `extraction_reaper_manual_triggered` / `_failed`,
  `extraction_processing_timeout`, `extraction_processing_reaped` / `_failed`,
  `worker_started` / `_batch_completed` / `_completed` / `_failed` /
  `worker_skipped_claim_lost`.
- **UI sem identificadores**: a tela de operação não lista documentos e não expõe
  `documentId`, `processId`, `extractionId`, `filename`, `storageKey` ou
  `fields`. O resumo é só contagem — `candidates`, `requested`, `reused`,
  `failed`, `durationMs`, com o invariante
  `candidates === requested + reused + failed`.
- **Sem seleção individual**: o escopo do enqueue é fixo (status + ausência de
  tentativa ativa + limite). Como a UI não pode apontar um documento, ela não
  precisa listá-los.
- Cobertura de testes do fluxo mock/manual: service, server action, UI segura e
  fake de banco.

---

## 5. O que NÃO existe ainda

- ❌ **OCR real** — `getExtractionEngine()` devolve sempre `mockExtractionEngine`.
- ❌ **Leitura real de arquivo** — o motor não recebe bytes.
- ❌ **Storage no motor** — nenhum acesso a `storage-local/` ou nuvem no caminho
  de extração.
- ❌ **Schedule / cron / `setInterval`** — tudo por clique.
- ❌ **Heartbeat** — só `PROCESSING_TIMEOUT_MS` fixo com relógio em `updated_at`.
- ❌ **Máquina de exceções ativa** — ver §7.
- ❌ **Execução real em Gov.br/SINARM/PF** — nenhuma, em nenhum caminho.
- ❌ **Bypass de captcha** — proibido permanentemente (`docs/00 §8`).
- ❌ **Armazenamento de senha Gov.br, OTP, cookies ou tokens** — proibido.
- ❌ **Ato irreversível automático** — não existe caminho para isso.
- ❌ **Processamento totalmente automático** — o operador aciona cada etapa.

---

## 6. Dívidas conhecidas

| # | Dívida | Situação |
|---|--------|----------|
| 1 | **Elegibilidade não filtra status do processo** — documento de processo cancelado/bloqueado pode entrar na fila | Mitigado por limite 10, engine mock, sem efeito externo e sem escrita no processo |
| 2 | **N+1 aproximado no enqueue** — um `requestDocumentExtraction` por candidato | Aceitável para ação manual de lote 10; revisar se o lote crescer |
| 3 | **Sem índice em `process_documents(status, created_at)`** — a tabela hoje só tem `@@index([processId])` | Irrelevante no volume atual; vira gargalo com base grande |
| 4 | **CI sem Postgres real** — o índice único parcial e o claim atômico não são exercitados contra o banco de verdade | Coberto por fake; o comportamento real do `P2002` só existe em runtime |
| 5 | **`FakePrisma` não valida operador desconhecido em tabela vazia** | Pode mascarar erro de query em teste cuja tabela está vazia |
| 6 | **Engine segue mock** | Bloqueia qualquer conclusão sobre acurácia, confiança e tempo real |
| 7 | **Sem heartbeat** | `PROCESSING_TIMEOUT_MS` de 15 min é folgado para o mock; com OCR/portal real, ou mata trabalho legítimo ou demora demais para destravar |
| 8 | **Sem schedule** | Toda passada depende de alguém clicar |

---

## 7. Achado arquitetural — múltiplos campos de estado concorrentes

`model Process` carrega **quatro** campos de status:

| Campo | Papel | Situação |
|-------|-------|----------|
| `internalStatus` | **Canônico** por `docs/12 §6`, com os estados de SINARM/GRU/exceção | **Inerte** — o único write em `src/` é `confirmPixPayment` → `PAGO_EM_FILA`; o resto existe só como rótulo |
| `operationalStatus` | Trilha operacional da Fase 6 (fila/atribuição/prioridade) | **É o que roda** |
| `manualExecutionStatus` | Declarações do operador na Fase 7 | **Roda** |
| `userFacingStatus` | Visão do cliente | **Sincronizado** pelas transições |

**O `InternalStatus` já contém boa parte dos estados necessários para automação
assistida** — e eles estão inertes:

```
AGUARDANDO_LOGIN_GOVBR · SESSAO_GOVBR_EXPIRADA · EM_PREENCHIMENTO_SINARM
EM_REVISAO_HUMANA · BLOQUEADO_INSTABILIDADE
EXCECAO_DOC_INVALIDO · EXCECAO_ARMA_DIVERGENTE · EXCECAO_DESTINO_INCOMPLETO
PROTOCOLADO_GRU_GERADA · GRU_PAGA_EMPRESA · CONCLUIDO
```

No nível do documento, `ExtractionState` (`PENDENTE`, `PROCESSANDO`, `EXTRAIDA`,
`PRECISA_REVISAO`, `CONFIRMADA`, `FALHOU`) **está vivo e é dirigido por código**.

**Consequência.** Antes de evoluir exceções assistidas será necessário **decidir
a fonte canônica de estado** — qual enum manda, o que vira projeção e o que
morre. Evoluir automação sobre fontes de verdade concorrentes multiplica o custo
da unificação a cada PR.

> **Esta decisão não é tomada aqui.** Ela deve ser um **PR documental próprio e
> posterior**. Este documento apenas **registra o achado**.
>
> A decisão arquitetural foi registrada em
> [`docs/44-decisao-maquina-de-estados.md`](44-decisao-maquina-de-estados.md).

---

## 8. Meta de produto

> **Automático por padrão. Assistido somente em exceções.**

- O sistema **tenta avançar sozinho** em tudo que for seguro.
- Ao encontrar ambiguidade, validação, captcha, divergência de dados, erro do
  portal, falta de documento, baixa confiança ou ponto irreversível, ele
  **pausa em uma exceção tipada**.
- O **humano resolve** apenas essa exceção.
- O sistema **retoma do ponto exato**, sem refazer o que já estava certo.
- **Pontos irreversíveis exigem confirmação humana** — do nível 0 ao 5 da escada
  do `docs/25 §5`. Isso não sobe de nível nunca.

Duas consequências de projeto que decorrem disso:

1. **Toda pausa é tipada e retomável.** `FALHOU` fica reservado a erro não
   recuperável; o que um humano consegue resolver nunca deve cair nele.
2. **O ato irreversível não é estado automático.** Sair dele exige ação
   explícita de pessoa.

---

## 9. Próximos PRs recomendados

| Ordem | PR | Natureza |
|-------|----|----------|
| 1 | **Decisão documental da máquina de estados** — qual enum é canônico, o que vira projeção, o que morre | docs |
| 2 | **Heartbeat com deadline absoluto** | código |
| 3 | **Máquina de exceções assistidas** — pausa tipada + tarefa humana + retomada | código |
| 4 | **Métricas / última execução no painel** — contagens, sem listar documentos, sem PII | código |
| 5 | **OCR real controlado** — limiares de confiança, logs sem PII, revisão humana em exceção | código |
| 6 | **Schedule interno controlado** | código |
| 7 | **Ensaio real controlado** | **gated** |
| 8 | **Automação progressiva ponta a ponta** | **gated** |

### Por que schedule vem depois

- **Schedule antes de heartbeat e exceções cria loop automático sem controle**:
  sem heartbeat, trabalho longo é morto ou trava; sem exceções tipadas, o que
  falha não tem onde parar de forma recuperável — e processos travariam em massa
  sem ninguém perceber.
- **Agendar um motor mock não automatiza nada.** Só adiciona superfície que roda
  sozinha sem produzir valor.
- Quando entrar, schedule exige **lock, idempotência, deadline absoluto e kill
  switch** — os quatro, não três.

> Ordem de **automação**, não de lançamento. Nenhum destes PRs destrava piloto ou
> divulgação: isso depende das 12 pendências de `docs/23 §5`, que seguem abertas.

---

## 10. Escopo proibido (permanente)

- ❌ Armazenar **senha Gov.br**.
- ❌ Armazenar **OTP**.
- ❌ Armazenar **cookies**.
- ❌ Armazenar **tokens**.
- ❌ **Burlar captcha** ou contornar validações/anti-bot.
- ❌ **Ocultar a execução do usuário.**
- ❌ **Execução real** antes de PR técnico separado.
- ❌ **Schedule real** antes dos gates.
- ❌ **Ato irreversível sem confirmação humana** — em nível nenhum.
- ❌ Ligar `PHASE9_REAL_EXECUTION_ENABLED` — permanece `false as const`.
- ❌ `db:push` — o schema evolui por migration versionada.

---

## 11. Verificações deste PR

- [x] Somente um **novo `.md`** criado (`docs/43-checkpoint-extracao-47d.md`).
- [x] **Nenhum código alterado** — nenhum `.ts`/`.tsx` no diff.
- [x] **Nenhum schema/migration** alterado.
- [x] `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const`.
- [x] `docs/26 §19` **não** foi alterado — gates 1, 2, 3 e 5 seguem abertos.
- [x] **Execução real segue bloqueada.**

> **Fecho.** Este documento **retrata**. Ele não implementa, não altera código,
> não altera schema, não cria migration, não fecha gate, não decide a máquina de
> estados e não autoriza execução real. Regras permanentes (`docs/00 §8`) e
> bloqueios de fase (`docs/15`) seguem íntegros.
