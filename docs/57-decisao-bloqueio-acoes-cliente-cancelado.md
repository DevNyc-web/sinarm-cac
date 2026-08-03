# 57 — Decisão sobre bloqueio de ações do cliente em processo cancelado

> **O que é este documento.** A auditoria e decisão sobre quais ações do
> cliente devem ficar bloqueadas quando `internalStatus = CANCELADO_OPERACIONAL`
> — pendência deixada explicitamente por
> [`docs/56 §5`](56-decisao-visibilidade-cliente-cancelamento.md) ("Não
> auditamos aqui se upload de documento ou outras ações do cliente têm o
> mesmo comportamento [de `canCreateCharge`]").
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** bloqueio, UI, action ou contestação.
> - ❌ **NÃO altera** `PaymentStatus`, payment adapter, PSP, `statusDivergence.ts`
>   nem `operationalStatusProjection.ts`.
> - ❌ **NÃO usa** `userFacingStatus`.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-03
> **Base da `main`:** `6ecae7b` — *feat: show client cancellation notice in process detail*
> **Referências:** [`docs/56`](56-decisao-visibilidade-cliente-cancelamento.md)
> (visibilidade do cliente, pendência de auditoria), [`docs/51`](51-decisao-cancelamento-real.md)
> (cancelamento real), `operationalSignals.ts` (`isClosed`, já usado para
> "processo fechado" em outras superfícies).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-03 |
| `main` | `6ecae7b` |
| Tipo | **Auditoria + decisão arquitetural documental** — fecha a pendência do `docs/56 §5` |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** das 4 server actions do cliente hoje
(`uploadDocumentAction`, `applyDocumentFieldSuggestionAction`,
`createPixPaymentAction`, `simulatePaymentApprovedAction`), **só uma já
bloqueia corretamente** processo cancelado (`createPixPaymentAction`, via
guarda em `createPixPayment.ts`); as outras três **não têm nenhum guard de
estado** — e uma delas (`simulatePaymentApprovedAction` →
`confirmPixPayment`) pode **reativar silenciosamente** um processo cancelado,
movendo `internalStatus` de volta para `PAGO_EM_FILA`. Isso é tratado como
**achado de prioridade alta** para o PR técnico futuro (§6).

---

## 2. Auditoria verificada no código (`main` `6ecae7b`)

| Ação do cliente | Server action | Service | Guard de estado hoje? |
|---|---|---|---|
| Gerar cobrança Pix | `createPixPaymentAction` | `createPixPayment.ts` | **Sim** — `if (internalStatus !== "RASCUNHO" && internalStatus !== "AGUARDANDO_PAGAMENTO") return erro` (linha 32) |
| Simular pagamento aprovado (dev) | `simulatePaymentApprovedAction` | `confirmPixPayment.ts` | **Não** — só checa `payment.status`, nunca `process.internalStatus`. Ferramenta **só existe em modo mock** (`isMockAuth()`), mas o padrão (nenhum guard em `confirmPixPayment`/`transitionInternalStatus`) valeria também para um webhook real futuro |
| Upload de documento | `uploadDocumentAction` | `uploadProcessDocument.ts` | **Não** — nenhuma checagem de `internalStatus`/`operationalStatus`; aceita upload para processo em qualquer estado, inclusive cancelado |
| Aplicar sugestão de destino | `applyDocumentFieldSuggestionAction` | `applyDestinationSuggestion.ts` | **Não** — nenhuma checagem de estado |
| Ver/baixar documento já enviado | rota `documentFileHref`/`/api/documents/[id]/file` | — | Read-only, não escreve nada — **fora do escopo de bloqueio** |
| Ver detalhe/histórico do processo | página do cliente | — | Read-only — **fora do escopo de bloqueio** |

**Achado central:** `transitionInternalStatus.ts` (a porta canônica) **declara
explicitamente**, no próprio docstring, que "**não valida** a máquina de
transições" — por desenho, não é ela quem recusaria mover um processo
cancelado de volta para ativo. A responsabilidade de recusar é de quem
CHAMA a porta canônica (mesmo padrão que `createPixPayment.ts` já segue
corretamente). As outras três ações não seguem esse padrão ainda.

**Peça já pronta para reaproveitar:** `operationalSignals.ts` já exporta
`isClosed(operationalStatus, internalStatus)` — a mesma função que já
decide "processo fechado" para sinalizadores, prontidão, SLA e destaque da
fila (`docs/52`). A recomendação técnica (§6) é que os três guards que
faltam **reusem esta função**, em vez de reescrever a checagem de
`internalStatus` à mão em cada service.

---

## 3. As 15 perguntas, respondidas

### 3.1 Cliente pode criar cobrança/pagamento em processo cancelado?
**Não — e já está bloqueado hoje**, no backend (`createPixPayment.ts`), não
só na UI. Nenhuma mudança necessária.

### 3.2 Cliente pode fazer upload de documento?
**Não deveria poder, mas hoje pode.** `uploadProcessDocument.ts` aceita sem
checar estado — **gap real**, prioridade alta (§6).

### 3.3 Cliente pode substituir documento?
**Mesma resposta da 3.2** — substituição usa o mesmo `uploadDocumentAction`/
`uploadProcessDocument`, mesmo gap.

### 3.4 Cliente pode reenviar documento rejeitado?
**Mesma resposta da 3.2** — reenvio de documento rejeitado passa pela mesma
action/service, sem tratamento especial hoje. Mesmo gap, mesma correção.

### 3.5 Cliente pode editar dados do processo?
**Não deveria poder, mas hoje pode**, no único ponto que existe
(`applyDocumentFieldSuggestionAction` → `applyDestinationSuggestion.ts`,
edição do destino/evento). **Gap real**, prioridade média (§6) — menos
grave que pagamento porque não reativa nem movimenta dinheiro, mas ainda
é edição indevida de um processo encerrado.

### 3.6 Cliente pode criar nova solicitação dentro do processo?
**Não existe essa funcionalidade hoje** — não há ação de "adicionar novo
item" a um processo existente no código atual. Pergunta não se aplica;
registrado para não deixar a pergunta sem resposta.

### 3.7 Cliente pode ver documentos já enviados?
**Sim, deve continuar podendo.** É leitura, não ação — não há motivo para
bloquear.

### 3.8 Cliente pode baixar documentos já enviados?
**Sim, deve continuar podendo**, mesmo raciocínio da 3.7 — a rota de
download é read-only e não decide nada sobre o processo.

### 3.9 Cliente pode ver histórico/status?
**Sim.** É exatamente o que o `docs/56`/PR #107 acabou de garantir — o
cliente **precisa** continuar vendo o status (incluindo o aviso de
cancelamento) mesmo depois de cancelado.

### 3.10 O bloqueio deve ser por `internalStatus`?
**Sim** — mesmo padrão já usado por `createPixPayment.ts` e pelo aviso do
`docs/56`. Preferencialmente via `isClosed()` (§2), não uma nova checagem
solta.

### 3.11 Deve usar `userFacingStatus`?
**Não.** Mesma regra de ouro do `docs/45`, reafirmada pelo `docs/56` — vale
igualmente para lógica de bloqueio, não só para exibição.

### 3.12 Deve mexer em `PaymentStatus`?
**Não.** Bloquear uma ação não é o mesmo que mudar o estado de um
pagamento já existente — nenhuma dessas correções futuras precisa tocar
`PaymentStatus`.

### 3.13 Deve criar projection?
**Não.** O bloqueio é uma checagem de guarda (`if closed return erro`), não
uma projeção de status.

### 3.14 Deve haver mensagem explicativa?
**Sim, recomendado.** Mesmo padrão de erro já usado pelas outras actions
(`redirect(...&erro=...)`) — algo como "Este processo foi cancelado e não
aceita mais alterações." Texto exato fica para o PR de implementação, mas
**não deve prometer reembolso nem citar motivo interno** (mesmas regras do
`docs/56`).

### 3.15 O que fica fora do escopo?
Implementação dos guards (código); esconder/desabilitar botões na UI (a UI
pode ser tratada no mesmo PR ou depois — a autoridade é o backend, §6);
qualquer decisão de reembolso/financeiro (`docs/54`, não reaberta aqui);
qualquer nova funcionalidade de "solicitação dentro do processo" (não
existe hoje, §3.6).

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | Para `internalStatus = CANCELADO_OPERACIONAL`, o cliente **não pode**: criar cobrança (já bloqueado), confirmar/simular pagamento, enviar ou reenviar documento, editar destino/evento. |
| 2 | O cliente **continua podendo**: ver detalhe, ver status (incluindo o aviso de cancelamento), ver e baixar documentos já enviados, contatar atendimento. |
| 3 | O bloqueio é decidido no **backend** (service/server action) — a UI pode esconder/desabilitar como reforço, mas nunca é a única barreira. |
| 4 | Os guards futuros devem **reusar `isClosed()`** (`operationalSignals.ts`), não reescrever a checagem à mão em cada service. |
| 5 | `confirmPixPayment.ts` — usado hoje só pela ferramenta dev `simulatePaymentApprovedAction` — precisa de guard **com prioridade alta**, porque sem ele um processo cancelado pode ser reativado silenciosamente. |
| 6 | `uploadProcessDocument.ts` e `applyDestinationSuggestion.ts` precisam do mesmo tipo de guard, prioridade média. |
| 7 | Mensagem de erro é permitida e recomendada, sem motivo interno nem promessa de reembolso. |
| 8 | Nenhuma dessas correções usa `userFacingStatus`, cria projeção, ou altera `PaymentStatus`/`statusDivergence.ts`. |

---

## 5. O que este documento não resolve

- **Não implementa** nenhum guard, mudança de UI ou mensagem de erro — fica
  para o PR de código que seguir esta decisão.
- **Não decide** o texto exato da mensagem de erro (§3.14) — só o tom
  (neutro, sem motivo, sem reembolso).
- **Não reabre** reembolso/financeiro (`docs/54`) nem a decisão de
  visibilidade do cliente já tomada (`docs/56`).
- **Não audita** rotas de leitura (visualização/download de documento,
  histórico) — já concluído que não precisam de bloqueio (§3.7/§3.8/§3.9).

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Prioridade | Depende de |
|-------|----|----------|------------|------------|
| 1 | Guard em `confirmPixPayment.ts` (via `isClosed`) contra reativar processo cancelado | código (pequeno) | **Alta** | este documento |
| 2 | Guard em `uploadProcessDocument.ts` (via `isClosed`) | código (pequeno) | Média | este documento |
| 3 | Guard em `applyDestinationSuggestion.ts` (via `isClosed`) | código (pequeno) | Média | este documento |
| 4 | Esconder/desabilitar os botões correspondentes na UI do cliente, reforçando os guards acima | código (pequeno) | Baixa (UX) | PRs 1–3 |

Nenhum destes é pré-requisito de piloto ou divulgação. **Nenhum PR desta
tabela está aprovado por este documento** — mesma lógica de `docs/56 §6`.

> **Situação em 2026-08-03:** os quatro PRs acima foram aprovados
> separadamente e já estão na `main`. Ver §8 (fechamento) ao fim deste
> documento — a frase acima registra o estado na data da decisão, não hoje.

---

## 7. Proibições

- ❌ Bloquear leitura/visualização/download de documento já enviado.
- ❌ Bloquear visualização de status/histórico do processo.
- ❌ Usar `userFacingStatus` para decidir ou exibir o bloqueio.
- ❌ Criar projeção canônica ou alterar `statusDivergence.ts`/`operationalStatusProjection.ts`.
- ❌ Alterar `PaymentStatus`, payment adapter ou chamar PSP como parte desta
  correção.
- ❌ Mostrar motivo interno ou prometer reembolso na mensagem de erro.
- ❌ Criar ação nova do cliente ou contestação.
- ❌ Reescrever a checagem de `internalStatus` à mão em vez de reusar
  `isClosed()`.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

> **Atualização (2026-08-03, implementação do PR 1 — §6).** Guard
> implementado em `confirmPixPayment.ts`: antes de `markPaid`/
> `transitionInternalStatus`, checa
> `isClosed(payment.process.operationalStatus, payment.process.internalStatus)`
> (mesma função de `operationalSignals.ts` já usada em outras superfícies,
> conforme decisão §4.4) e retorna
> `{ ok: false, error: "Nao e possivel confirmar pagamento de um processo
> encerrado." }` sem alterar `PaymentStatus` nem criar evento de transição.
> `simulatePaymentApprovedAction` não foi alterada — herda a guarda
> automaticamente por chamar `confirmPixPayment` sem lógica própria. Nenhuma
> mudança em UI, payment adapter, PSP ou reembolso. PRs 2–4 desta tabela
> (`uploadProcessDocument.ts`, `applyDestinationSuggestion.ts`, UI)
> permanecem pendentes.

> **Atualização (2026-08-03, implementação do PR 2 — §6).** Guard
> implementado em `uploadProcessDocument.ts`: logo após a checagem de posse
> (`findProcessByIdForUser`) e **antes** do storage e do `createDocument`,
> checa `isClosed(process.operationalStatus, process.internalStatus)` (mesma
> função de `operationalSignals.ts`, decisão §4.4) e retorna
> `{ ok: false, error: "Nao e possivel enviar documento para um processo
> encerrado." }` — nenhum byte vai para `storage-local/`, nenhuma linha em
> `ProcessDocument`, nenhum evento de transição, nenhum status movido. Cobre
> §3.2/§3.3/§3.4 de uma vez: envio, substituição e reenvio de documento
> rejeitado passam pelo mesmo service. `uploadDocumentAction` não foi
> alterada — herda a guarda automaticamente. Leitura/download seguem livres
> (§3.7/§3.8). PRs 3–4 (`applyDestinationSuggestion.ts`, UI) permanecem
> pendentes.

> **Atualização (2026-08-03, implementação do PR 3 — §6).** Guard
> implementado em `applyDestinationSuggestion.ts`: logo após a checagem de
> posse (`findProcessByIdForUser`) e **antes** de `updateProcessDestination`
> e de `recordOperationalEvent`, checa
> `isClosed(process.operationalStatus, process.internalStatus)` (mesma função
> de `operationalSignals.ts`, decisão §4.4) e retorna
> `{ ok: false, error: "Nao e possivel alterar destino de um processo
> encerrado." }` — nenhum campo de destino muda e nada entra na trilha
> append-only. Fecha §3.5, o último gap de **código** do §6.
> `applyDocumentFieldSuggestionAction` não foi alterada — herda a guarda
> automaticamente. Com isto os três guards de service (PRs 1–3) estão
> implementados; **o PR 4 (esconder/desabilitar os botões na UI do cliente,
> reforço de UX) permanece pendente** — o backend já é a autoridade (§4.3).

> **Atualização (2026-08-03, implementação do PR 4 — §6).** Reforço de UX no
> detalhe do cliente (`src/app/(user)/processos/[id]/page.tsx`): a página
> deriva `closed = isClosed(process.operationalStatus, process.internalStatus)`
> — a mesma função dos três guards, sem segunda definição de "encerrado" — e
> **esconde** as ações que o backend já recusa: gerar cobrança Pix, simular
> pagamento aprovado, anexar/substituir documento (o painel de intake passa a
> receber `uploadAction` indefinido, contrato que `applyAction` já tinha) e
> aplicar sugestão de destino. No lugar, um texto neutro: *"Este processo está
> encerrado. Novas ações não estão disponíveis."* — que cobre também o
> fechamento técnico (`CANCELADO_DEV`), não alcançado pelo aviso do `docs/56`.
> Tudo que é **leitura permanece visível**: status, aviso de cancelamento,
> destino, mensagens da equipe, documentos enviados com download, e o próprio
> código Pix já gerado (some apenas o botão de simulação). Nenhum guard
> server-side foi alterado — a UI é reforço, nunca a barreira (§4.3). Sem
> menção a motivo interno, revisão financeira, reembolso ou estorno (§3.14).
> Com isto, os PRs 1–4 do §6 estão **concluídos**.

---

## 8. Fechamento — bloco implementado (2026-08-03)

O bloco de **bloqueio de ações do cliente em processo encerrado/cancelado
está concluído**. Os quatro PRs do §6 foram implementados, revisados e
mergeados na `main`:

| PR | O que | Onde | Commit |
|----|-------|------|--------|
| 1 | Guard server-side de pagamento | `confirmPixPayment.ts` | `d3a6f19` |
| 2 | Guard server-side de documento | `uploadProcessDocument.ts` | `508ff89` |
| 3 | Guard server-side de destino | `applyDestinationSuggestion.ts` | `c9446a3` |
| 4 | Reforço de UI/UX no detalhe do cliente | `processos/[id]/page.tsx`, `DocumentIntakePanel.tsx` | `5f61ec0` |

Os três guards reusam a **mesma** `isClosed(operationalStatus, internalStatus)`
de `operationalSignals.ts` (§4.4) — não existe uma segunda definição de
"processo fechado" no código.

**O que fica valendo:**

- Processo fechado/cancelado **não avança** por confirmação de pagamento, por
  envio/substituição/reenvio de documento, nem por aplicação de sugestão de
  destino. Cada tentativa para antes de qualquer escrita: nenhum
  `PaymentStatus` muda, nenhum byte vai para o storage, nenhuma linha entra na
  trilha append-only.
- **O backend é a autoridade** (§4.3). O PR 4 apenas deixa de oferecer as
  ações na tela; remover o reforço visual não reabre nenhuma delas.
- **Ações de leitura continuam permitidas** (§3.7/§3.8/§3.9): ver o detalhe e
  o status, ver o aviso de cancelamento, ver e baixar documentos já enviados,
  ler mensagens da equipe, procurar o atendimento.
- **Não há reembolso automático** — nada aqui move dinheiro, chama PSP ou
  altera `PaymentStatus`. A revisão financeira de processo cancelado com
  pagamento `PAGO` continua **manual**, na fila do admin (`docs/54`).
- **O cliente não vê financeiro**: nem `needsFinanceReview`, nem "revisão
  financeira", nem motivo interno, nem promessa de reembolso ou estorno
  (§3.14).
- **Execução real segue bloqueada**: `PHASE9_REAL_EXECUTION_ENABLED`
  permanece `false`, o gate do `docs/26 §19` segue fechado e nada aqui toca
  Gov.br/SINARM/PF.

**Pendências:** nenhuma decorrente deste documento. O §6 está encerrado; as
proibições do §7 continuam valendo permanentemente, inclusive para quem
mexer nestes arquivos depois.

---

> **Fecho.** Este documento **audita e decide no papel**: mapeia exatamente
> quais ações do cliente já bloqueiam processo cancelado (uma) e quais não
> (três, incluindo um achado de prioridade alta), e recomenda reusar
> `isClosed()` para as correções futuras. Não implementa nenhum guard, não
> altera `PaymentStatus`, projeção ou `userFacingStatus`; não fecha gate e
> não autoriza execução real. Regras permanentes (`docs/00 §8`) e bloqueios
> de fase (`docs/15`) seguem íntegros.
