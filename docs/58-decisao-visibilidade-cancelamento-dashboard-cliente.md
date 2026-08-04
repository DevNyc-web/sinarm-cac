# 58 — Decisão sobre mostrar "Processo cancelado" no dashboard do cliente

> **O que é este documento.** A decisão sobre se a **listagem de processos do
> cliente** (`/dashboard`) também deve mostrar que um processo foi cancelado
> de verdade (`internalStatus = CANCELADO_OPERACIONAL`), agora que o detalhe
> já mostra (`docs/56`, PR #107) e que as ações do cliente já estão
> bloqueadas no backend e escondidas na UI (`docs/57`, PRs #109–#112).
>
> **O que este documento NÃO faz:**
> - não implementa display, não altera `src/app/(user)/dashboard/page.tsx`;
> - não altera `clientVisibleStatusLabel`, `UserFacingStatus`, projeção ou
>   `statusDivergence.ts`;
> - não toca pagamento, `PaymentStatus`, reembolso ou Fase 9.
>
> **Data:** 2026-08-03
> **Base da `main`:** `e442fdc` — *docs: close client action locks implementation notes*
> **Referências:** [`docs/45`](45-decisao-user-facing-status.md) (regra de ouro
> do `userFacingStatus`), [`docs/51`](51-decisao-cancelamento-real.md)
> (cancelamento real), [`docs/52`](52-decisao-visibilidade-cancelamento-real.md)
> (visibilidade interna), [`docs/54`](54-decisao-politica-reembolso-cancelamento.md)
> (reembolso é manual), [`docs/56`](56-decisao-visibilidade-cliente-cancelamento.md)
> (visibilidade ao cliente — §3.10 adiou o dashboard),
> [`docs/57`](57-decisao-bloqueio-acoes-cliente-cancelado.md) (bloqueio de ações).

---

## 1. Status da decisão

Este documento **resolve o PR 3 do `docs/56 §6`** ("Decisão sobre exibir o
rótulo também no dashboard"), que ficou explicitamente adiado até o display
do detalhe existir e ser validado. O display do detalhe existe desde `6ecae7b`
e o bloco de bloqueio de ações fechou em `e442fdc` — a condição do adiamento
foi cumprida.

**Natureza:** docs-only. Nenhuma linha de código neste PR.

---

## 2. Contexto verificado no código (`main` `e442fdc`)

| Fato | Onde | Situação |
|------|------|----------|
| O dashboard já mostra um badge de status por processo | `src/app/(user)/dashboard/page.tsx` | `<Badge>{clientVisibleStatusLabel(process)}</Badge>` |
| `clientVisibleStatusLabel` **não lê** `internalStatus` | `src/server/processes/statusLabels.ts` | Recebe só `operationalStatus` + `manualExecutionStatus` (regra de ouro do `docs/45`, mantida) |
| `cancelProcess` **não altera** `operationalStatus` | `src/server/services/cancelProcess.ts` | De propósito, sem `alsoSet` (`docs/51`/`docs/52`) |
| `listProcessesByUser` traz a linha inteira do processo | `src/server/repositories/processRepository.ts` | Sem `select`: `internalStatus` **já chega** ao dashboard hoje |
| `CANCELADO_DEV` já tem rótulo de cliente | `OPERATIONAL_STATUS_USER_LABELS` | `"Cancelado"` — o fechamento técnico **já aparece** no dashboard |
| Teste trava a ausência do rótulo hoje | `tests/unit/processes/clientCancellationNotice.test.ts` | Afirma que o dashboard não menciona `CANCELADO_OPERACIONAL`/`internalStatus` |

### 2.1 O achado que pesa nesta decisão

Juntando as três primeiras linhas da tabela: hoje, um processo **cancelado de
verdade** aparece no dashboard com o **rótulo antigo**, o do momento em que
foi cancelado — "Aguardando pagamento", "Pagamento confirmado — em fila",
"Em andamento". Não é um rótulo ausente: é um rótulo **desatualizado**, que
descreve um andamento que não existe mais.

O resultado é que as duas telas do cliente respondem coisas diferentes para a
mesma pergunta: a lista diz "em fila", o detalhe diz "Processo cancelado".
Exatamente o tipo de divergência que o comentário do próprio dashboard já
registra ter sido corrigido uma vez, quando a lista lia só `operationalStatus`
e o detalhe já usava `clientVisibleStatusLabel`.

Isso desloca a decisão: **não** é "adicionar informação nova a uma lista
enxuta" (o enquadramento do `docs/56 §3.10`, tomado antes do display do
detalhe existir), e sim **corrigir uma informação que envelheceu**.

### 2.2 O que já não é problema

- O cliente **não consegue** agir sobre um processo cancelado, nem pela UI
  nem por POST direto: os três guards de service (`docs/57`) recusam
  pagamento, documento e destino antes de qualquer escrita.
- Financeiro, motivo interno e revisão financeira **já** não aparecem para o
  cliente em nenhuma superfície (`docs/54`, `docs/56 §3.4`–§3.6).

---

## 3. As 14 perguntas, respondidas

### 3.1 O dashboard/listagem do cliente deve mostrar "Processo cancelado"?
**Sim.** Pela razão do §2.1: sem isso a lista exibe um andamento que não
existe mais, e diverge do detalhe. Um cliente que abre o app depois de dias
lê a lista primeiro — é ali que ele decide se precisa fazer alguma coisa.

### 3.2 Deve mostrar só badge/rótulo ou também texto explicativo?
**Só o badge**, com o mesmo texto curto do rótulo. O dashboard é uma lista de
varredura; um parágrafo por item competiria com o próprio conteúdo da lista e
se repetiria a cada linha. **A explicação continua exclusiva do detalhe**, onde
o callout do `docs/56` já está e tem espaço para o contexto e o caminho do
atendimento.

### 3.3 Deve usar `internalStatus` diretamente?
**Sim** — `internalStatus === "CANCELADO_OPERACIONAL"`, o mesmo padrão que o
detalhe (`docs/56 §4.6`) e `canCreateCharge` já usam. O dado **já chega** ao
dashboard (§2), então isto não exige mudança de repositório nem query nova.

### 3.4 Deve usar `userFacingStatus`?
**Não.** Regra de ouro do `docs/45`, reafirmada pelo `docs/56 §3.8` e pelo
`docs/57 §3.11`: nem para exibir, nem para decidir. Nenhum leitor novo.

### 3.5 Deve criar projeção?
**Não.** É um rótulo derivado de uma comparação de uma linha, não uma
projeção canônica. `operationalStatusProjection.ts` continua sem candidato
para `CANCELADO_OPERACIONAL` (`docs/49`/`docs/51`) e não é reaberto aqui.

### 3.6 Deve alterar `statusDivergence`?
**Não.** `CANCELADO_OPERACIONAL` continua `needs_decision` lá, exatamente
como o `docs/56 §4.7` decidiu. Mostrar um rótulo ao cliente não muda a
relação entre os status internos.

### 3.7 Deve mostrar motivo interno?
**Não.** Mesma proibição do `docs/56 §3.3` e do `docs/57 §3.14`. O motivo é
registro interno; o cliente vê que foi cancelado, não por quê.

### 3.8 Deve mostrar financeiro/reembolso?
**Não.** Nenhum valor, nenhuma promessa de estorno, nenhuma menção a
devolução. A política é `docs/54` e ela é **manual** — o dashboard não é
lugar de insinuar o contrário.

### 3.9 Deve mostrar `needsFinanceReview`?
**Não.** É sinalizador da fila interna (`docs/55`); o cliente não tem
`refund.approve` nem `queue.view` e não deve saber que essa fila existe.

### 3.10 Deve mostrar ação/contestação?
**Não.** O card da lista já é um link para o detalhe, e é só isso que
continua. Sem botão novo, sem "contestar", sem "reabrir", sem "solicitar
reembolso". O contato segue pelo atendimento já citado no detalhe.

### 3.11 Deve alterar ordenação/filtros?
**Não.** A lista continua por `createdAt` decrescente, sem separar, esconder,
mover para o fim ou filtrar processos cancelados. Esconder seria pior que o
problema atual: o cliente perderia o histórico. Se algum dia a lista ficar
longa demais, agrupar é decisão de produto própria, não desta correção.

### 3.12 Deve impactar documentos/downloads?
**Não.** Leitura e download continuam livres (`docs/57 §3.7`/§3.8), e o
dashboard não tem essas ações — nada a mudar.

### 3.13 Deve mostrar o mesmo texto do detalhe?
**Parcialmente, e de propósito.** O badge usa **"Processo cancelado"**, o
mesmo título em negrito do callout do detalhe — a frase que o cliente
reconhece. As duas frases seguintes do detalhe ("encerrado
administrativamente", "entre em contato com o atendimento") **não** vão para
o badge: são a explicação, e a explicação fica no detalhe (§3.2).

### 3.14 O que fica fora do escopo?
A implementação (código e teste); qualquer mudança em
`clientVisibleStatusLabel`; agrupamento/filtro de cancelados na lista;
`CANCELADO_DEV` no dashboard (§4.9 — já resolvido, nada a fazer); qualquer
decisão de reembolso/financeiro (`docs/54`, não reaberta); reversão de
cancelamento (`docs/51 §4` itens 12–13, continua em aberto lá).

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | O dashboard do cliente **deve** mostrar que o processo foi cancelado quando `internalStatus = CANCELADO_OPERACIONAL`. |
| 2 | **Badge curto apenas**, com o texto **"Processo cancelado"**. Sem parágrafo, sem callout, sem ícone novo. |
| 3 | A **explicação completa continua exclusiva do detalhe** — o dashboard não repete o texto do `docs/56`. |
| 4 | A condição lê **`internalStatus` diretamente**, sem `userFacingStatus`, sem projeção, sem helper global novo. |
| 5 | O badge **substitui** o rótulo desatualizado na lista, em vez de aparecer ao lado dele — dois badges contando histórias diferentes seria pior que um errado. |
| 6 | **Nada de motivo interno, financeiro, reembolso, estorno, revisão financeira ou `needsFinanceReview`.** |
| 7 | **Nenhuma ação nova**: o card continua sendo apenas um link para o detalhe. |
| 8 | **Ordenação, filtros e agrupamento não mudam** — processo cancelado continua na lista, no mesmo lugar. |
| 9 | **`CANCELADO_DEV` não exige mudança**: já exibe "Cancelado" pelo rótulo operacional de cliente. Esta decisão trata só do cancelamento **real**. |
| 10 | `clientVisibleStatusLabel`, `UserFacingStatus`, `statusDivergence.ts`, `PaymentStatus` e pagamento **não são alterados**. |

### 4.1 Nota para quem implementar

O teste `tests/unit/processes/clientCancellationNotice.test.ts` afirma hoje
que o dashboard **não** menciona `CANCELADO_OPERACIONAL`/`internalStatus` —
ele foi escrito como não-regressão do `docs/56 §3.10`, quando o dashboard
estava fora do escopo. O PR técnico que implementar esta decisão precisa
**atualizar esse teste deliberadamente**, trocando a asserção de ausência por
uma de presença. Encontrar esse teste vermelho é esperado, não é sinal de
que algo quebrou.

---

## 5. O que este documento não resolve

- **Não implementa** o badge, não altera `dashboard/page.tsx`, não altera
  testes.
- **Não decide** agrupamento, filtro ou seção separada para processos
  encerrados na lista (§3.11) — se a lista crescer, é decisão de produto
  própria.
- **Não reabre** `docs/54` (reembolso), `docs/45` (status canônico) nem a
  reversão de cancelamento (`docs/51 §4`).
- **Não altera** nada do `docs/57`, que já está fechado — bloqueio de ação e
  rótulo de status são assuntos distintos.

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Prioridade | Depende de |
|-------|----|----------|------------|------------|
| 1 | Badge "Processo cancelado" no dashboard do cliente, lendo `internalStatus` direto, com atualização do teste do §4.1 | código (pequeno) | Média | este documento |

Não é pré-requisito de piloto ou divulgação. **Este PR não está aprovado por
este documento** — mesma lógica de `docs/56 §6`.

> **Situação em 2026-08-04:** o PR acima foi aprovado separadamente e já está
> na `main`. Ver §8 (fechamento) ao fim deste documento — a frase acima
> registra o estado na data da decisão, não hoje.

---

## 7. Proibições

- ❌ Ler ou escrever `userFacingStatus` para este rótulo.
- ❌ Criar `UserFacingStatus` novo, projeção nova ou helper global sem
  necessidade.
- ❌ Alterar `clientVisibleStatusLabel`, `statusDivergence.ts` ou
  `operationalStatusProjection.ts`.
- ❌ Mostrar motivo interno, valor, reembolso, estorno, revisão financeira ou
  `needsFinanceReview` ao cliente.
- ❌ Criar ação, botão, contestação ou pedido de reembolso no dashboard.
- ❌ Esconder, filtrar ou mover processos cancelados para fora da lista.
- ❌ Alterar `PaymentStatus`, pagamento, payment adapter ou chamar PSP.
- ❌ Bloquear leitura/download de documento ou histórico.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

## 8. Fechamento — bloco implementado (2026-08-04)

O PR técnico do §6 foi implementado, revisado e mergeado na `main`:

| PR | O que | Onde | Commit |
|----|-------|------|--------|
| 1 | Badge "Processo cancelado" no dashboard do cliente, lendo `internalStatus` direto | `src/app/(user)/dashboard/page.tsx` | `e00a7cf` |

**O que fica valendo:**

- O dashboard do cliente mostra **"Processo cancelado"** quando
  `internalStatus === "CANCELADO_OPERACIONAL"`, exatamente como o detalhe já
  mostra (`docs/56`) — **as duas telas agora contam a mesma história**.
- O badge **substitui** o rótulo desatualizado (decisão 5) — não aparece ao
  lado dele. Não existem dois badges conflitantes na mesma linha.
- O processo cancelado **continua listado**, na mesma posição, sem
  filtro/agrupamento novo (§3.11/decisão 8). O link para o detalhe permanece
  o mesmo.
- **A explicação completa continua exclusiva do detalhe** (§3.2/decisão 3): o
  dashboard só tem o rótulo curto, o parágrafo do `docs/56` não foi duplicado
  para a lista.
- **O backend não mudou**: `listProcessesByUser`, `cancelProcess`,
  `clientVisibleStatusLabel`, `statusDivergence.ts` e
  `operationalStatusProjection.ts` seguem exatamente como estavam (§2,
  decisão 10) — o dado já chegava ao dashboard, só a leitura na UI mudou.
- **Nenhum leitor novo de `userFacingStatus`**, nenhuma projeção nova
  (decisão 4).
- **O cliente não vê financeiro**: nem `needsFinanceReview`, nem "revisão
  financeira", nem motivo interno, nem promessa de reembolso ou estorno
  (decisão 6). Nenhuma ação, botão ou contestação nova (decisão 7).
- **Nada em pagamento**: `PaymentStatus`, payment adapter e PSP seguem
  intocados; nenhum reembolso, nenhum `registerRefund`, nenhuma migration —
  a leitura é de uma coluna que já existia.
- **Execução real segue bloqueada**: `PHASE9_REAL_EXECUTION_ENABLED`
  permanece `false`, o gate do `docs/26 §19` segue fechado e nada aqui toca
  Gov.br/SINARM/PF.

**Testes:** `tests/unit/processes/clientCancellationNotice.test.ts` teve a
asserção de ausência (§4.1) invertida deliberadamente para presença, mais
cobertura nova para badge único, ausência do rótulo antigo no caso
cancelado, processo continuar listado, link do detalhe e ausência de
financeiro/reembolso/motivo interno/`needsFinanceReview`.
`internalStatusStates.test.ts` e `adminRealCancellationView.test.ts` tiveram
suas allowlists de source-scanning atualizadas para permitir o dashboard
como sexto leitor de `CANCELADO_OPERACIONAL` — nenhuma outra proteção foi
relaxada.

**Pendências:** nenhuma decorrente deste documento. O §6 está encerrado; as
proibições do §7 continuam valendo permanentemente, inclusive para quem
mexer nestes arquivos depois.

---

> **Fecho.** Este documento **decide no papel** que o dashboard do cliente
> deve mostrar "Processo cancelado" como badge curto, lendo `internalStatus`
> direto — corrigindo um rótulo que hoje **envelhece** e diverge do detalhe.
> Não implementa nada, não altera `clientVisibleStatusLabel`, `PaymentStatus`,
> projeção ou divergência; não cria ação para o cliente; não fecha gate e não
> autoriza execução real. Regras permanentes (`docs/00 §8`) e bloqueios de
> fase (`docs/15`) seguem íntegros.
