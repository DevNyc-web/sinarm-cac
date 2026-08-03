# 53 — Decisão sobre a UX da ação admin de cancelamento real

> **O que é este documento.** A decisão de UX para o botão/ação admin de
> cancelamento real, deixado como PR futuro possível por
> [`docs/52 §6`](52-decisao-visibilidade-cancelamento-real.md) ("Nenhuma
> UI/botão de cancelamento pode ser criada antes de resolver §3.3/§3.10" —
> ambos já resolvidos; o que falta agora é só a FORMA da UI).
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** botão, formulário, action ou rota — só decide como serão,
>   quando existirem.
> - ❌ **NÃO altera** `cancelProcess.ts`, `operationalStatus`,
>   `operationalStatusProjection.ts` nem `statusDivergence.ts`.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-02
> **Base da `main`:** `31750ea` — *feat: show real cancellation state in admin*
> **Referências:** [`docs/51`](51-decisao-cancelamento-real.md) (decisão do
> fluxo de cancelamento real, service `cancelProcess`), [`docs/52`](52-decisao-visibilidade-cancelamento-real.md)
> (visibilidade admin/cliente, correção sobre o histórico), `docs/50 §5/§6`
> (mesmo padrão de ação explícita com motivo — `reopenDocumentReview`,
> `approveDocumentOutOfFlow` — usado aqui como referência de UX já validada
> no próprio admin).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-02 |
| `main` | `31750ea` |
| Tipo | **Decisão de UX/documental** — forma da ação, não implementação |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** o botão de cancelamento real é um **form inline**
(mesmo padrão de `reopenDocumentReview`/`approveDocumentOutOfFlow`, **não**
um modal/dialog em JS — este app não usa nenhum), aparece **só no detalhe
admin** para quem tem `process.cancel`, exige motivo, mostra o texto de aviso
inline (documentos/pagamentos preservados, cliente sem motivo detalhado), e a
elegibilidade visual usa uma função exportada de `cancelProcess.ts` — nunca
uma segunda lista de estados mantida à mão na UI.

---

## 2. Contexto — o que já existe (verificado no código, `main` `31750ea`)

| Peça | Estado |
|---|---|
| Service `cancelProcess` | Implementado (`src/server/services/cancelProcess.ts`) — motivo obrigatório (mín. `MIN_CANCEL_REASON_LENGTH = 10`), sem `alsoSet`, allowlist de 6 estados pré-automação |
| Permissão `process.cancel` | Implementada, **ADMIN-only** |
| `InternalStatus.CANCELADO_OPERACIONAL` | No enum, migration aplicada |
| Sinais operacionais | Reconhecem `CANCELADO_OPERACIONAL` como encerrado (`isClosed`, PR #97) |
| Visualização admin | Callout read-only no detalhe + rótulo na fila (PR #98) |
| Botão/form/action de UI | **Não existe** — é exatamente o que este documento prepara |

**Padrão de UX já validado no mesmo admin, para ação explícita com motivo**
(`docs/50 §5/§6`): um `<form>` inline dentro do `<li>`/`<Card>` do item
afetado, com `<input type="hidden" name="processId">`, um `<input>` de texto
para o motivo (placeholder, sem componente de modal) e um
`<Button variant="secondary">`. Sem JavaScript de cliente, sem
`useState`/dialog — o app inteiro é Server Components com Server Actions.
**Este documento adota o mesmo padrão**, em vez de introduzir um modal
próprio: um modal exigiria um Client Component novo (JS, estado, foco/escape)
que não existe em nenhuma outra ação deste projeto — mudança de arquitetura
maior do que o pedido, para um ganho de UX marginal sobre o form inline que
já funciona para `reopenDocumentReview`/`approveDocumentOutOfFlow`. Se o
produto quiser um modal de verdade no futuro, é decisão própria, separada
desta.

---

## 3. As 16 decisões pedidas — registradas

| # | Decisão |
|---|---|
| 1 | O botão existe **apenas no detalhe admin** do processo (`src/app/(admin)/admin/processos/[id]/page.tsx`) — nunca na fila/listagem. |
| 2 | O botão só é renderizado quando `hasPermission(admin, "process.cancel")` — mesmo padrão de `canReopenReview`/`canApproveOutOfFlow` já usados na página. |
| 3 | O botão não aparece em nenhuma tela de cliente (`src/app/(user)`) — cliente não tem, não terá e não é afetado por esta decisão. |
| 4 | A fila/listagem admin **não ganha o botão** — continua só com o rótulo read-only já existente (PR #98). |
| 5 | A confirmação é um **form inline com o motivo** (§2) — não um modal/dialog em JS. Ver §5 para o texto de aviso que substitui um passo de confirmação separado. |
| 6 | Motivo é **obrigatório** — o form não submete sem preencher (`required` no `<input>`), e o backend recusa vazio de qualquer forma (dupla checagem, cliente e servidor). |
| 7 | O mínimo de motivo no frontend, se validado ali, deve ser o **mesmo** `MIN_CANCEL_REASON_LENGTH` (10) exportado por `cancelProcess.ts` — nunca um número reescrito à mão na UI. |
| 8 | O texto de aviso deixa explícito que **documentos e pagamentos não são apagados** (§4, texto de confirmação). |
| 9 | O texto de aviso deixa explícito que o **cliente não verá o motivo automaticamente** (§4, mesmo texto). |
| 10 | O botão só aparece para estados **elegíveis** — ver §6 (como evitar duplicar a allowlist do backend). |
| 11 | O frontend **não duplica** a regra de negócio inteira — esconde nos casos óbvios (processo já fechado), mas o `cancelProcess` continua sendo a autoridade final; um clique num estado "quase elegível" pode falhar no backend, e a mensagem de erro genérica (§4) cobre isso. |
| 12 | Depois de cancelar, a tela redireciona para o mesmo detalhe (mesmo padrão `backTo(processId)` das demais actions) — o callout read-only **já existente** (PR #98) aparece sozinho, porque `internalStatus` já é `CANCELADO_OPERACIONAL`. Nenhum callout novo é necessário. |
| 13 | `operationalStatus` **não é alterado** por esta ação — mesma decisão do `docs/51`, sem `alsoSet`. |
| 14 | Nenhuma projeção canônica é criada para `CANCELADO_OPERACIONAL` por causa desta UX — `operationalStatusProjection.ts` continua fora do escopo. |
| 15 | Nenhum ato em Gov.br/SINARM/PF — a ação continua só registro no app. |
| 16 | A Fase 9 não é ativada nem referenciada por esta decisão. |

---

## 4. As perguntas — respondidas

| Pergunta | Resposta |
|---|---|
| Texto do botão | **"Cancelar processo"** |
| Texto do "título" (form, não modal) | **"Cancelar processo"** — cabeçalho curto acima do form inline, mesmo padrão de outras seções da página (`<p className="font-medium">`) |
| Texto de confirmação/aviso | **"Esta ação encerra o processo operacionalmente. Documentos e pagamentos não são apagados. O cliente não verá o motivo automaticamente."** — uma frase a mais que a sugestão original, para também cobrir a decisão 9 no mesmo lugar |
| Texto do campo motivo (placeholder/label) | **"Motivo do cancelamento"**, com texto de ajuda: **"Informe o motivo interno (mínimo 10 caracteres). Fica registrado no histórico do processo."** — o número (10) deve vir de `MIN_CANCEL_REASON_LENGTH`, nunca hardcoded no texto se o componente puder interpolar |
| Mensagem de sucesso | **"Processo cancelado operacionalmente."** |
| Mensagem de erro genérica | **"Não foi possível cancelar o processo."** — o backend já produz mensagens mais específicas (`cancelProcess.ts`: motivo curto, processo não encontrado, estado não cancelável, `CANCELADO_DEV`); a UI **repassa a mensagem do backend quando existir** e só cai nesta genérica em falha inesperada (mesmo padrão do `erro` da query string já usado na página) |
| Onde exibir a ação | **Card "Operacao"** do detalhe admin, junto das demais ações administrativas (atribuir responsável, prioridade, status operacional) — não uma seção nova e isolada |
| Onde NÃO exibir | Fila/listagem admin (decisão 4); qualquer tela de cliente (decisão 3); para quem não tem `process.cancel` (decisão 2); para processo já em `CANCELADO_OPERACIONAL` ou `CANCELADO_DEV` (decisão 10/11) |
| Quais estados são elegíveis visualmente | Os mesmos 6 que o backend aceita hoje (`RASCUNHO`, `AGUARDANDO_PAGAMENTO`, `PAGO_EM_FILA`, `DOCUMENTO_RECEBIDO_PARA_ANALISE`, `DOCUMENTO_VALIDADO`, `BLOQUEADO_OPERACIONAL`) — **lidos de uma função exportada**, nunca reescritos na UI (§6) |
| Como evitar duplicar a allowlist do backend perigosamente | §6 |

---

## 5. Por que form inline, não modal (detalhe da decisão 5)

A sugestão original usava "confirmação/modal/form" como sinônimos. Neste
projeto eles **não são equivalentes**: um modal exige Client Component,
estado de abertura/fechamento e foco — nenhuma ação existente usa isso
(`reopenDocumentReview`, `approveDocumentOutOfFlow`, o próprio dropdown de
`operationalStatus` — todos são `<form>` inline com Server Action).

Cancelamento real é mais sério que essas duas ações, mas a resposta a "mais
sério" não precisa ser "mais JavaScript" — é **texto mais explícito** no
mesmo form (o aviso da decisão 8/9, §4) e motivo com piso maior (10
caracteres, já implementado). Isso mantém a UI nova consistente com o resto
do admin, sem introduzir a primeira peça de UI client-side do projeto para
uma única ação.

---

## 6. Como evitar duplicar a allowlist do backend perigosamente

`cancelProcess.ts` hoje mantém `CANCELLABLE_INTERNAL_STATUS` e
`isCancellableInternalStatus` como **privados** ao módulo (não exportados) —
correto para um PR que ainda não tinha UI. Quando a UI for implementada, a
recomendação é:

- **Exportar** `isCancellableInternalStatus` (ou o array) de `cancelProcess.ts`
  e a página **importar e reusar essa função** para decidir se mostra o
  botão — nunca reescrever a lista de 6 estados na página.
- Isso elimina o risco central: uma allowlist da UI que droga do backend (ex.:
  alguém adiciona um estado ao backend e esquece a UI, ou vice-versa) —
  com uma função só, os dois lugares sempre concordam por construção.
- O backend **continua a autoridade final** (decisão 11): mesmo que a UI
  esconda o botão corretamente hoje, uma condição de corrida (dois admins
  na mesma tela) ou um estado que mudou entre o carregamento da página e o
  clique ainda é pego pelo `cancelProcess` — a mensagem de erro específica
  do backend (§4) cobre esse caso, sem a UI precisar prever tudo.
- **Não fazer:** copiar os 6 nomes de estado para dentro do arquivo da página
  como uma constante separada — é exatamente o tipo de duplicação que este
  item recusa.

---

## 7. Estilo visual (nota menor)

`Button.tsx` hoje só tem `variant="primary"|"secondary"` — sem variante
"perigo"/vermelha. A recomendação da decisão (ação "destrutiva/secundária,
não primária") mapeia diretamente para **`variant="secondary"`**, o mesmo
já usado em `reopenDocumentReview`/`approveDocumentOutOfFlow` — zero
componente novo. Se o produto quiser uma variante visual de perigo (vermelho)
no futuro, é decisão de design separada, fora deste documento.

---

## 8. O que este documento não resolve

- **Não implementa** o form, o botão nem a action — fica para o PR de código
  que seguir esta decisão.
- **Não decide** reembolso, processo já protocolado nem reversão/reabertura
  (`docs/51 §4` itens 11–13) — continuam abertos, sem relação com este
  documento.
- **Não decide** a visibilidade do cliente ao cancelamento real (`docs/52
  §3.1`) — continua em aberto.
- **Não resolve** a lacuna de fila/prontidão/SLA — já foi resolvida em
  outro PR (`docs/52`, atualização "código"), sem relação com a UX do botão.
- **Não cria** variante visual de perigo no `Button.tsx`.

---

## 9. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Exportar `isCancellableInternalStatus`/allowlist de `cancelProcess.ts` | código (pequeno) | este documento (§6) |
| 2 | Server Action `cancelProcessAction` em `actions.ts`, mesmo padrão de `reopenDocumentReviewAction` | código | PR 1, permissão `process.cancel` já existe |
| 3 | Form inline no detalhe admin (botão, motivo, textos desta decisão) | código + UI | PR 2 |
| 4 | Decisão de produto: visibilidade do cliente (`docs/52 §3.1`) | docs | independente, pode vir antes ou depois |

Nenhum destes é pré-requisito de piloto ou divulgação. **Nenhum PR desta
tabela está aprovado por este documento** — mesma lógica de `docs/52 §6`.

---

## 10. Proibições

- ❌ Implementar o botão/form/action antes desta decisão existir (resolvido:
  este documento é essa decisão).
- ❌ Usar modal/dialog em JavaScript para esta ação.
- ❌ Reescrever a allowlist de estados cancelaveis dentro da página — só
  reusar a função exportada de `cancelProcess.ts`.
- ❌ Expor o motivo ao cliente automaticamente.
- ❌ Adicionar o botão à fila/listagem.
- ❌ Alterar `operationalStatus`, `operationalStatusProjection.ts` ou
  `statusDivergence.ts` por causa desta UX.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

> **Atualização (2026-08-02, código, implementação).** O botão foi
> implementado exatamente como decidido acima: `isCancellableInternalStatus`
> foi **exportada** de `cancelProcess.ts` (§6/PR 1); a server action
> `cancelProcessAction` foi criada em `actions.ts`, exigindo
> `requirePermission("process.cancel")` e chamando `cancelProcess(actor,
> processId, reason)` — o service continua validando permissão, motivo e
> estado de novo, sem duplicação de autoridade (§6, regra 11); o form inline
> foi adicionado ao card "Operacao" do detalhe admin (PR 2+3 combinados),
> gated por `canCancelProcess = hasPermission(admin, "process.cancel") &&
> isCancellableInternalStatus(detail.internalStatus)` — nenhuma allowlist
> reescrita na página. Textos usados: botão "Cancelar processo", campo
> "Motivo do cancelamento" (com `required`/`minLength={MIN_CANCEL_REASON_LENGTH}`),
> aviso "Esta ação encerra o processo operacionalmente. Documentos e
> pagamentos não são apagados. O cliente não verá o motivo automaticamente.",
> erro por `?erro=` (mesmo padrão das demais ações) e sucesso "Processo
> cancelado operacionalmente." por `?sucesso=` — banner novo, simétrico ao de
> erro já existente (nenhuma outra ação desta página tinha mensagem de
> sucesso; esta ganhou por ser mais séria, decisão explícita do §4 acima).
> **Sem modal, sem Client Component** — confirmado pelo tamanho da rota no
> build (`/admin/processos/[id]` continua 200 B de JS, sem aumento). O
> callout read-only (PR anterior) continua aparecendo sozinho após o
> cancelamento, sem duplicação. Cliente, `operationalStatus`,
> `operationalStatusProjection.ts` e `statusDivergence.ts` **não foram
> tocados**. **Execução real continua bloqueada.**

---

> **Atualização (2026-08-03, ciclo de implementação encerrado).** Com este
> PR, o ciclo iniciado em [`docs/51`](51-decisao-cancelamento-real.md) fecha:
> decisão → `InternalStatus` preparado → service backend → sinais
> operacionais reconhecendo o encerramento → visibilidade admin read-only →
> decisão de UX (este documento) → implementação da UX. **Estado final
> registrado:**
>
> | Item | Estado |
> |---|---|
> | Ação "Cancelar processo" | Implementada, só no detalhe admin |
> | Forma | Form server-side simples, sem modal/Client Component |
> | Permissão | `process.cancel`, ADMIN-only |
> | Motivo | Obrigatório, piso `MIN_CANCEL_REASON_LENGTH` |
> | Autoridade | `cancelProcess` continua validando tudo de novo |
> | Allowlist | Só em `isCancellableInternalStatus`, exportada — nunca duplicada na UI |
> | `operationalStatus` | Nunca alterado por esta ação |
> | Projeção canônica | `CANCELADO_OPERACIONAL` continua fora, por decisão |
> | `statusDivergence` | Continua `needs_decision` |
> | Documentos/pagamentos/storage | Nunca tocados |
> | Cliente | Continua sem visualização e sem motivo automático |
> | Fila/prontidão/SLA | Já tratam o cancelamento como encerrado/inativo |
> | Callout read-only | Aparece sozinho após o cancelamento, sem duplicar o form |
>
> **Pendências futuras, explicitamente fora deste ciclo:** visibilidade do
> cliente ao cancelamento real; reembolso/financeiro; processo já
> protocolado; reversão/reabertura (`docs/51 §4` itens 11–13, nunca
> respondidos); um eventual `OperationalStatus`/projeção próprios para
> cancelamento real, se algum dia decidido; e eventual refinamento de
> auditoria/relatório (hoje o motivo só aparece no histórico do processo,
> sem tela dedicada). Nenhuma UI/decisão futura desta lista está aprovada por
> este documento. **Execução real continua bloqueada.**

---

> **Atualização (2026-08-03, docs, política financeira).** O item
> "reembolso/financeiro" da lista de pendências acima foi decidido em
> [`docs/54`](54-decisao-politica-reembolso-cancelamento.md): sem reembolso
> automático, pagamentos preservados, análise financeira a cargo de
> `refund.approve` (permissão já existente, hoje sem consumidor). Processo já
> protocolado e reversão/reabertura **continuam** sem resposta. Nada foi
> implementado. **Execução real continua bloqueada.**

---

> **Fecho.** Este documento **decide a forma da UX no papel**. Não implementa
> botão, form, action ou rota; não altera `cancelProcess`, `operationalStatus`,
> projeção ou divergência; não fecha gate e não autoriza execução real. Regras
> permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
