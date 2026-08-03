# 54 — Decisão sobre a política de reembolso/financeiro no cancelamento real

> **O que é este documento.** A decisão sobre o comportamento financeiro
> quando um processo é cancelado operacionalmente — item 11 deixado
> explicitamente aberto por [`docs/51 §4`](51-decisao-cancelamento-real.md)
> ("Decisão futura, fora deste documento: política de reembolso/financeiro
> associada ao cancelamento real").
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** tabela, enum, ação de reembolso ou UI.
> - ❌ **NÃO altera** `cancelProcess.ts`, `PaymentStatus` nem qualquer adapter
>   de pagamento.
> - ❌ **NÃO decide** processo já protocolado nem reversão/reabertura
>   (`docs/51 §4` itens 12–13, continuam abertos, fora deste documento).
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-03
> **Base da `main`:** `a019346` — *docs: close admin cancellation implementation notes*
> **Referências:** `docs/00 §2` (régua geral de reembolso por estágio, já
> decidida no produto), [`docs/51`](51-decisao-cancelamento-real.md) (decisão
> do cancelamento real, item 11 pendente), `docs/46 §6`/`docs/49 §3.5`
> (por que `CANCELADO_REEMBOLSADO` nunca pode ser reusado sem reembolso real).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-03 |
| `main` | `a019346` |
| Tipo | **Decisão arquitetural/financeira documental** — fecha o item 11 do `docs/51 §4` |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** cancelar um processo **nunca** dispara reembolso,
crédito ou mudança de `PaymentStatus` automaticamente — só sinaliza, para
quem já tem a permissão `refund.approve` (FINANCEIRO/ADMIN, **já existente**
na matriz RBAC e ainda sem consumidor), que aquele caso **precisa de análise
manual**. Reembolso de verdade continua ação humana, fora do app, registrada
manualmente quando e se acontecer — mesmo padrão que `manual.execution.register`/
`registerManualGru` já usam para tudo que é "dinheiro/protocolo real".

---

## 2. Contexto verificado no código (`main` `a019346`)

| Fato | Onde |
|---|---|
| `PaymentStatus` **não tem** valor de reembolso/estorno | `prisma/schema.prisma` — enum tem `PENDENTE`, `AGUARDANDO_PAGAMENTO`, `PAGO`, `EXPIRADO`, `CANCELADO`, `FALHOU`. Nenhum `REEMBOLSADO`/`ESTORNADO` |
| A permissão `refund.approve` **já existe** | `src/server/auth/permissions.ts` — concedida a **FINANCEIRO** (e a ADMIN, por herdar tudo). **Zero consumidores** hoje: nenhuma tela, action ou service a checa |
| `cancelProcess` nunca toca pagamento | Confirmado por teste estrutural (`cancelProcess.test.ts`) — nenhuma menção a `paymentRepository`/`storageAdapter` |
| Régua de reembolso do produto já existe | `docs/00 §2`: 100% antes do envio de documentos; depende do estágio depois; **não reembolsável após protocolo/GRU** |
| `CANCELADO_REEMBOLSADO` (`InternalStatus`) já existe e **afirma** reembolso | Nunca reusado para cancelamento real (`docs/49 §3.5`, `docs/51` regras 1/5) — continua reservado para quando reembolso **de verdade** tiver acontecido |
| GRU (taxa governamental) é sempre registro **manual** | `registerManualGru`/`registerManualGruPayment` — o app nunca movimenta essa taxa, só registra o que o humano fez fora dele |

**A allowlist de `cancelProcess` hoje** (`RASCUNHO`, `AGUARDANDO_PAGAMENTO`,
`PAGO_EM_FILA`, `DOCUMENTO_RECEBIDO_PARA_ANALISE`, `DOCUMENTO_VALIDADO`,
`BLOQUEADO_OPERACIONAL`) cobre **só estados pré-automação** — nenhum deles
passou por protocolo/GRU. Pela régua do `docs/00 §2`, isso significa que
**a maioria dos casos que `cancelProcess` hoje permite cancelar são,
em princípio, elegíveis a reembolso** (100% antes do documento, "depende do
estágio" depois) — nenhum cai na faixa "não reembolsável". Isso não muda a
decisão abaixo (o app não movimenta dinheiro sozinho), mas explica por que
"nunca vai ter caso de reembolso" seria uma leitura errada do problema.

---

## 3. As 14 perguntas, respondidas

### 3.1 Cancelar processo gera reembolso automático?
**Não.** `cancelProcess` não movimenta pagamento, PSP ou banco. Reembolso é
sempre ato humano fora do app (mesmo padrão de GRU/protocolo).

### 3.2 Cancelar processo cria crédito interno?
**Não, agora.** Crédito interno (ex.: usar o valor pago num processo futuro)
é modelo de negócio que este documento **não decide** — fica em aberto,
registrado no §6.

### 3.3 Cancelar processo apenas marca necessidade de análise financeira?
**Sim — e essa marcação já existe hoje, sem precisar de código novo.** Um
processo com `internalStatus = CANCELADO_OPERACIONAL` e um pagamento com
`status = PAGO` já é uma combinação **consultável** (mesmos dados que
`getAdminProcessDetail`/`getAdminQueue` já carregam). O que falta é só a
**tela/relatório** (item 10), não um sinalizador novo.

### 3.4 Quem decide reembolso?
**FINANCEIRO** (com `refund.approve`, permissão **já existente** na matriz —
concedida também a ADMIN por herança). Nenhuma decisão nova de RBAC é
necessária: quando a ação de aprovar reembolso for implementada, ela deve
**reusar** `refund.approve`, não inventar `finance.refund`/`process.refund`
como o pedido inicial sugeria.

### 3.5 O cliente vê informação financeira automaticamente?
**Não.** Mesma decisão do `docs/52`/`docs/53` para o motivo do cancelamento:
nada financeiro é exposto automaticamente ao cliente. Se um dia o cliente
precisar ser avisado de um reembolso, é comunicação explícita (mensagem/nota
visível — já existe o mecanismo de `message.send`), nunca um texto genérico
prometendo reembolso.

### 3.6 O pagamento existente muda de status?
**Não.** `Payment.status` continua exatamente o que era antes do
cancelamento (ex.: `PAGO` continua `PAGO`). Não existe hoje um valor de
`PaymentStatus` para representar "reembolsado" — criá-lo é migration, fora
de um documento docs-only.

### 3.7 O processo cancelado pode ter pagamento preservado?
**Sim, sempre.** Cancelar não apaga nem altera `Payment` — regra já vigente
desde `docs/51` regra 10, reafirmada aqui.

### 3.8 Deve existir status financeiro futuro?
**Talvez, decisão própria.** Um valor novo de `PaymentStatus` (ex.:
"reembolso pendente"/"reembolsado") resolveria a rastreabilidade, mas exige
migration aditiva e decisão de nome — fora deste documento (§6, PR futuro).

### 3.9 Deve existir ação futura de registrar reembolso?
**Sim, recomendado.** Mesmo padrão de `registerManualGru`: uma ação
`registerRefund` (nome candidato) que **registra** que um humano fez o
reembolso fora do app (Pix manual, estorno no PSP, etc.), com motivo/valor/
data, sem o app executar nada. Requer `refund.approve`.

### 3.10 Deve existir relatório/lista de processos cancelados com pagamento?
**Sim, recomendado.** Uma view/filtro (mesmo padrão de `getAdminQueue`)
listando processos com `internalStatus = CANCELADO_OPERACIONAL` **e**
pagamento `PAGO` — exatamente o "sinalizador de análise financeira" da
pergunta 3. Não decide layout nem permissão de acesso além de `refund.approve`
(ou `process.pii.viewFull`/`queue.view`, a decidir no PR que a implementar).

### 3.11 O que fazer com processo pago mas não protocolado?
**É o caso central que este documento cobre.** Cai na allowlist atual de
`cancelProcess`. Reembolso é **elegível** pela régua do `docs/00 §2`
("depende do estágio"), mas a execução continua manual/futura (§3.1/3.9).

### 3.12 O que fazer com processo já protocolado?
**Fora do escopo — decisão futura própria (`docs/51 §4` item 12).**
`cancelProcess` já bloqueia isso hoje (protocolo/pós-GRU fora da allowlist);
este documento não muda essa allowlist nem antecipa a decisão de reversão de
protocolo.

### 3.13 O que fazer com taxa/GRU, quando existir?
**Nunca é reembolso "do sistema".** A GRU é paga pelo cliente **ao órgão**,
não à plataforma — o app só registra manualmente que ela foi paga
(`registerManualGruPayment`). Se o processo é cancelado antes do protocolo,
não há GRU envolvida (a allowlist de `cancelProcess` já garante isso). Se um
dia cancelamento pós-protocolo for decidido (item 12), a GRU **nunca** entra
na régua de reembolso da plataforma — é relação cliente↔governo, fora do
alcance do app.

### 3.14 O que fazer com serviço interno já prestado parcialmente?
**Resposta já existe, no produto — não aqui.** `docs/00 §2` já registra que
o reembolso "depende do estágio" após o envio de documentos; isso já É a
resposta para "serviço parcialmente prestado". Este documento não recalcula
percentuais nem cria tabela de proporcionalidade — isso é decisão de produto,
não arquitetura, e fica para quando (e se) o fluxo de reembolso for
implementado.

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | `cancelProcess` **continua** sem tocar pagamentos — nenhum código muda. |
| 2 | Pagamentos existentes **permanecem preservados**, com o mesmo `status` de antes do cancelamento. |
| 3 | **Nenhum estorno automático** — o app nunca movimenta dinheiro sozinho, nem para PSP nem para o cliente. |
| 4 | **Nenhuma promessa automática ao cliente** — cancelamento não gera mensagem/UI prometendo reembolso. |
| 5 | Eventual **reembolso de verdade** é fluxo separado e futuro (ação `registerRefund`, candidato), sempre registrando o que um humano fez fora do app. |
| 6 | Eventual **crédito interno** é decisão de produto separada, não coberta aqui. |
| 7 | Eventual **status financeiro novo** (`PaymentStatus` ou campo próprio) é decisão de produto separada, exige migration, fora deste documento. |
| 8 | **Processo já protocolado permanece fora do escopo** — `docs/51 §4` item 12 continua sem resposta. |
| 9 | **GRU/taxa pública nunca é misturada** com taxa de serviço interna na régua de reembolso — são relações financeiras distintas (cliente↔governo vs. cliente↔plataforma). |
| 10 | Relatórios futuros **podem** listar cancelados com pagamento para revisão financeira — recomendado, não implementado. |
| 11 | A permissão **`refund.approve`, já existente**, é quem deve decidir reembolso quando a ação existir — não criar `finance.refund`/`process.refund` novos. |

---

## 5. O que este documento não resolve

- **Não implementa** nenhuma ação, tela, migration ou mudança de schema.
- **Não decide** o nome final nem o design da futura ação `registerRefund`
  (motivo, campos, se afirma valor exato) — fica para o PR que a propuser.
- **Não decide** processo já protocolado (`docs/51 §4` item 12) nem
  reversão/reabertura (item 13) — ambos continuam abertos, sem relação com
  este documento.
- **Não recalcula** a régua de reembolso do `docs/00 §2` — só a referencia.
- **Não cria** relatório/lista de cancelados com pagamento — só recomenda.

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Ação `registerRefund` (nome candidato), exigindo `refund.approve`, registrando reembolso feito manualmente fora do app | código | este documento |
| 2 | Relatório/filtro de processos cancelados com pagamento pendente de análise | código | este documento |
| 3 | Decisão de produto: status financeiro novo (`PaymentStatus` ou campo próprio) para representar reembolso | docs + migration | produto |
| 4 | Decisão de produto: crédito interno | docs | produto |
| 5 | Decisão sobre processo já protocolado (`docs/51 §4` item 12) | docs | produto |
| 6 | Decisão sobre reversão/reabertura (`docs/51 §4` item 13) | docs | produto |

Nenhum destes é pré-requisito de piloto ou divulgação. **Nenhum PR desta
tabela está aprovado por este documento** — mesma lógica de `docs/53 §9`.

---

## 7. Proibições

- ❌ Fazer `cancelProcess` alterar `Payment.status`, PSP ou storage.
- ❌ Criar reembolso/estorno automático.
- ❌ Prometer reembolso ao cliente automaticamente.
- ❌ Criar `finance.refund`/`process.refund` — reusar `refund.approve`, já
  existente.
- ❌ Misturar GRU (taxa governamental) com a régua de reembolso da
  plataforma.
- ❌ Decidir processo já protocolado ou reversão por baixo deste documento.
- ❌ Criar migration, enum ou tabela nova.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

> **Atualização (2026-08-03, código, sinalização).** O item 3 (§3.3/§4 item
> 10) ganhou uma implementação mínima: `operationalSignals.ts` exporta
> `deriveNeedsFinanceReview` (`internalStatus === "CANCELADO_OPERACIONAL" &&
> paymentStatus === "PAGO"`), incluída em `OperationalIndicators` como
> `needsFinanceReview: boolean` — o mesmo objeto que já alimenta
> `getAdminQueue`/`getAdminProcessDetail`. **É só sinalização**: nenhum
> `PaymentStatus` muda, nenhum PSP é chamado, nenhuma ação de reembolso
> existe. O admin vê um aviso read-only ("Revisão financeira necessária") no
> detalhe do processo (card de pagamento) e um rótulo equivalente na fila —
> nunca "Reembolso devido" ou qualquer texto que prometa reembolso. Cliente
> não recebe o sinal. `registerRefund` (§6 PR 1) **continua não
> implementado** — este PR só cobre a detecção/exibição (§3.3/§4 item 10),
> não a ação de aprovar/registrar reembolso. **Execução real continua
> bloqueada.**

---

> **Atualização (2026-08-03, docs, fila/relatório).** Como o time
> financeiro/admin deve **encontrar** processos com `needsFinanceReview` foi
> decidido em [`docs/55`](55-decisao-fila-revisao-financeira.md): primeiro
> passo é um filtro simples na listagem admin já existente (mesmo padrão dos
> filtros de status/pagamento/documento), **sem** gate de permissão novo —
> continua visível a quem já tem `queue.view` (OPERADOR/FINANCEIRO/SUPORTE/
> ADMIN), sem restringir a FINANCEIRO/ADMIN nesta etapa. Fila/aba separada,
> relatório dedicado e exportação CSV ficam como decisões futuras. **Nada
> disso foi implementado.** `registerRefund` continua fora do escopo.
> **Execução real continua bloqueada.**

---

> **Fecho.** Este documento **decide a política no papel**: cancelamento real
> nunca movimenta dinheiro sozinho, pagamentos ficam preservados, e a análise
> financeira fica com quem já tem `refund.approve`. Não implementa ação,
> migration, UI nem mudança de `PaymentStatus`; não decide processo
> protocolado nem reversão; não fecha gate e não autoriza execução real.
> Regras permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem
> íntegros.
