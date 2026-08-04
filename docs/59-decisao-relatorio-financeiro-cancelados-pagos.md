# 59 — Decisão sobre relatório/tela financeira dedicada para processos cancelados com pagamento

> **O que é este documento.** A decisão sobre se deve existir uma **tela/relatório
> financeiro DEDICADO** para processos com `internalStatus = CANCELADO_OPERACIONAL`
> e pagamento `PAGO` — além do filtro simples já existente na fila admin
> (`docs/55`, já implementado). É exatamente o **PR 2** deixado em aberto pelo
> `docs/55 §6`: *"Relatório financeiro dedicado (contador, layout próprio) —
> decidir se é aba nova e se é restrito a `refund.approve`/`audit.view.financial`"*.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** tela, action, export CSV ou `registerRefund`.
> - ❌ **NÃO altera** `PaymentStatus`, payment adapter nem PSP.
> - ❌ **NÃO cria** permissão nova.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-04
> **Base da `main`:** `37988b3` — *docs: close client dashboard cancellation visibility*
> **Referências:** [`docs/54`](54-decisao-politica-reembolso-cancelamento.md)
> (política de reembolso, sinal `needsFinanceReview`),
> [`docs/55`](55-decisao-fila-revisao-financeira.md) (filtro simples na fila,
> PR 2 pendente), `src/server/auth/permissions.ts` (`refund.approve`,
> `audit.view.financial`, `queue.view`),
> `src/server/processes/operationalSignals.ts` (`deriveNeedsFinanceReview`),
> `src/server/services/getAdminQueue.ts`, `src/server/services/getAdminProcessDetail.ts`.

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-04 |
| `main` | `37988b3` |
| Tipo | **Decisão arquitetural/UX documental** — resolve o PR 2 do `docs/55 §6` |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** o filtro simples do `docs/55` **basta por enquanto**
para *encontrar* os casos, mas **deve existir uma tela/relatório dedicado**
como próximo PR técnico — read-only, restrito a quem já tem `refund.approve`
**ou** `audit.view.financial` (FINANCEIRO/ADMIN, diferente do `queue.view`
mais amplo do filtro simples), mostrando valor pago e datas que **já têm
fonte segura** no schema atual, sem export CSV, sem `registerRefund` e sem
qualquer ação financeira nesta etapa.

---

## 2. Contexto verificado no código (`main` `37988b3`)

| Fato | Onde |
|---|---|
| O filtro simples de revisão financeira já existe, é read-only e sem gate próprio | `docs/55` (implementado) — `getAdminQueue.ts` filtra `needsFinanceReview` em memória, sob `queue.view` |
| `Payment.amountCents` (valor pago) já é coluna real, populada e **já exibida ao admin** | `prisma/schema.prisma` (`Payment.amountCents: Int`); `src/app/(admin)/admin/processos/[id]/page.tsx:444` — `formatBRL(payment.amountCents)` |
| `Payment.paidAt` (data de pagamento) já é coluna real, **populada** na confirmação do Pix, e já exibida ao admin e ao cliente | `prisma/schema.prisma` (`Payment.paidAt: DateTime?`); `src/server/repositories/paymentRepository.ts:70` (`data: { status: "PAGO", paidAt: new Date(), ... }`); `admin/processos/[id]/page.tsx:450`; `user/processos/[id]/page.tsx:367-370` |
| Data de cancelamento **tem fonte segura em princípio**, mas nenhuma query hoje a isola | `prisma/schema.prisma` (`ProcessStatusEvent.createdAt` + `toStatus`); `cancelProcess.ts` grava o evento via `transitionInternalStatus` com `toStatus: "CANCELADO_OPERACIONAL"` — o dado existe na trilha, mas exige uma consulta nova (`where: { toStatus: "CANCELADO_OPERACIONAL" }`), não uma coluna pronta |
| `listAdminQueue` hoje seleciona só `payments.status` — `amountCents`/`paidAt` **não** estão no `select` da fila (só no detalhe) | `src/server/repositories/processRepository.ts` (`listAdminQueue`) |
| `refund.approve` e `audit.view.financial` já existem, concedidas a **FINANCEIRO** (+ADMIN por herança), **zero consumidores** hoje | `src/server/auth/permissions.ts` |
| `queue.view` (quem vê a fila/filtro simples hoje) é concedida a **OPERADOR, FINANCEIRO, SUPORTE, ADMIN** — mais amplo que `refund.approve` | `src/server/auth/permissions.ts` |
| Nenhuma rota/página "financeiro" dedicada existe hoje | `src/app/(admin)/admin/*` — só `processos`, `processos-lancamento`, `automacao`, `extracao`, `lab` |
| GRU (taxa do órgão) já é campo/fluxo **separado** do pagamento de serviço — nunca o mesmo registro | `ManualExecution.gruAmountCents` (registro manual, `registerManualGru`) vs. `Payment.amountCents` (Pix do cliente pelo serviço) |
| `registerRefund` (`docs/54 §6` PR 1) continua **não implementado** | `docs/54` |

### 2.1 O que isso muda na recomendação inicial

A recomendação inicial pedia registrar como "pendente" qualquer campo sem
fonte segura. Verificando o código: **valor pago e data de pagamento têm
fonte pronta e já em uso** (mesma coluna que o detalhe admin já mostra hoje —
o relatório dedicado só levaria ao nível de *listagem* algo que já existe no
*detalhe*). **Data de cancelamento é o único campo que exige trabalho real**
no PR técnico futuro: o dado existe na trilha de eventos, mas nenhuma
consulta hoje o isola — não é invenção de campo novo, é uma query que falta
escrever.

---

## 3. As 18 perguntas, respondidas

### 3.1 O filtro atual de revisão financeira basta por enquanto?
**Sim, por enquanto.** O filtro simples (`docs/55`, implementado) já resolve
"encontrar" os casos — read-only, sem gate novo, disponível a quem já tem
`queue.view`. Não há hoje volume documentado que exija mais que isso
imediatamente. A lacuna não é funcional, é de **ergonomia para uma rotina
financeira recorrente** (ver §3.2).

### 3.2 Deve existir relatório/tela dedicada?
**Sim, recomendado como próximo PR técnico — não implementado agora.**
Revisão financeira é um fluxo de trabalho distinto de operar a fila
(perfil diferente, cadência diferente, campos diferentes: valor, datas).
Uma tela própria evita que FINANCEIRO precise garimpar a fila operacional —
pensada para OPERADOR/SUPORTE — só para achar os casos que lhe cabem.
Registrado como PR futuro (§6), **não aprovado por este documento**.

### 3.3 Qual usuário/permissão pode ver?
Quem tiver **`refund.approve` OU `audit.view.financial`** — hoje só
FINANCEIRO e ADMIN (por herança). Diferente do filtro simples (`queue.view`,
mais amplo) porque a tela dedicada concentra valor pago e datas de pagamento
lado a lado — informação mais sensível, em massa, do que o rótulo binário
"revisão financeira necessária" que já é visível a todo perfil interno hoje.

### 3.4 Deve ser admin, financeiro, ou ambos?
**Ambos** — FINANCEIRO e ADMIN, via as permissões já existentes
(`refund.approve`/`audit.view.financial`). Nenhuma combinação nova.

### 3.5 Deve usar `needsFinanceReview`?
**Sim.** Mesma fonte já validada pelo `docs/54`/`docs/55` — nenhum sinal
novo, nenhuma lógica de derivação nova.

### 3.6 Deve expor isso ao cliente?
**Não, nunca.** Mesma decisão permanente de `docs/52`/`docs/53`/`docs/54`/
`docs/55`/`docs/56`/`docs/58` — cliente não tem `queue.view` nem qualquer
acesso a superfície admin/financeira.

### 3.7 Deve iniciar reembolso?
**Não.** É leitura. Nenhuma ação, nenhum botão de reembolso nesta tela.

### 3.8 Deve alterar `PaymentStatus`?
**Não.** Read-only — mesma regra do `docs/54 §4` item 1 e `docs/55 §4` item 3.

### 3.9 Deve chamar PSP/payment adapter?
**Não.** Nenhuma chamada a provedor de pagamento — só leitura do banco local.

### 3.10 Deve criar `registerRefund` agora?
**Não.** Continua fora do escopo (`docs/54 §6` PR 1), decisão de produto
separada.

### 3.11 Deve exportar CSV agora?
**Não no primeiro PR.** Registrado como item futuro condicionado à
existência da tela — mesma posição do `docs/55 §3.11`.

### 3.12 Deve mostrar motivo interno?
**Não, neste relatório.** O motivo do cancelamento já está na trilha de
eventos/nota, acessível por quem abrir o detalhe do processo quando
precisar. Incluí-lo na listagem financeira misturaria escopo (fato
financeiro vs. justificativa operacional) e aumentaria a superfície de
registro interno exposta sem necessidade — mesma cautela de
`docs/52`/`docs/54 §3.7`/`docs/56`/`docs/57`.

### 3.13 Deve mostrar valor pago?
**Sim — tem fonte segura.** `Payment.amountCents`, coluna real já exibida ao
admin no detalhe (`formatBRL`). O relatório só leva ao nível de listagem o
que o detalhe já mostra individualmente hoje.

### 3.14 Deve mostrar datas de pagamento/cancelamento?
**Data de pagamento: sim, tem fonte segura** (`Payment.paidAt`, já populada
e já exibida ao admin e ao cliente). **Data de cancelamento: tem fonte
segura em princípio** (`ProcessStatusEvent.createdAt` onde
`toStatus = CANCELADO_OPERACIONAL`, gravado por `transitionInternalStatus`),
**mas nenhuma query hoje isola esse evento** — não é campo pronto para uso,
exige uma consulta nova no PR técnico futuro (buscar o evento de transição,
não inventar coluna). Registrado como pendência técnica do PR futuro (§6),
não como decisão em aberto.

### 3.15 Deve mostrar link para o processo?
**Sim.** Link para o detalhe admin (`/admin/processos/[id]`) — mesmo padrão
já usado na fila hoje.

### 3.16 Deve exigir permissão nova?
**Não.** `refund.approve` e `audit.view.financial` já existem e já cobrem
exatamente esse público — criar uma terceira seria redundante e contraria o
padrão já estabelecido no `docs/54 §3.4`/`§4` item 11 (reusar `refund.approve`,
não inventar `finance.refund`/`process.refund`).

### 3.17 Deve usar `refund.approve` agora ou deixar futuro?
**Usar agora, como gate de visualização da tela dedicada quando ela for
implementada** — isso não implica implementar `registerRefund`. `refund.approve`
é a permissão de **poder agir** sobre reembolso; usá-la também como gate de
**ver** os candidatos a reembolso é consistente e evita esperar por uma
segunda decisão de permissão antes de a tela poder existir. Quem hoje **não**
tem `refund.approve` mas tem `audit.view.financial` (nenhum perfil atual
cai nesse caso — FINANCEIRO/ADMIN têm as duas) também deveria enxergar,
daí o "ou" na condição.

### 3.18 O que fica fora do escopo?
A implementação (código, teste, UI, migration); `registerRefund`;
exportação CSV; contador/resumo automático (pode acompanhar a tela, mas o
PR técnico decide, não este documento); qualquer alteração de
`PaymentStatus`/schema; decisão de crédito interno (`docs/54 §5`); decisão
sobre processo já protocolado ou reversão/reabertura (`docs/51 §4` itens
12–13); qualquer promessa de prazo ou reembolso ao cliente.

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | O filtro simples do `docs/55` **é suficiente por enquanto** — nenhuma mudança nele. |
| 2 | Uma **tela/relatório financeiro dedicado é recomendado** como próximo PR técnico — não aprovado/implementado por este documento. |
| 3 | A tela dedicada é **restrita a `refund.approve` OU `audit.view.financial`** (FINANCEIRO/ADMIN) — diferente do `queue.view` do filtro simples. |
| 4 | **Nenhuma permissão nova** — reusa as duas já existentes. |
| 5 | Fonte do sinal continua **`needsFinanceReview`**, sem lógica nova. |
| 6 | A tela é **estritamente read-only**: sem reembolso, sem `PaymentStatus` alterado, sem PSP, sem `registerRefund`. |
| 7 | **Cliente nunca vê** — nem o sinal, nem a tela, nem qualquer derivado dela. |
| 8 | **Sem export CSV** e **sem motivo interno** nesta etapa/tela. |
| 9 | **Valor pago e data de pagamento entram** — fonte segura já existente (`Payment.amountCents`/`paidAt`), já exibida individualmente no detalhe. |
| 10 | **Data de cancelamento entra, mas exige query nova** (`ProcessStatusEvent` por `toStatus`) — registrado como trabalho do PR técnico, não pendência de decisão. |
| 11 | **Link para o detalhe admin entra**, mesmo padrão já usado na fila. |
| 12 | GRU **nunca é misturada** com o valor do pagamento de serviço na mesma linha do relatório — são registros distintos (`ManualExecution.gruAmountCents` vs. `Payment.amountCents`). |

---

## 5. O que este documento não resolve

- **Não implementa** a tela, query, action ou qualquer código.
- **Não decide** layout final, se há contador/resumo, nem paginação —
  fica para o PR técnico (§6).
- **Não decide** `registerRefund` (`docs/54 §6` PR 1) — continua pendência
  separada.
- **Não altera** a matriz RBAC — nenhuma permissão nova, nenhum gate no
  filtro simples do `docs/55`.
- **Não decide** processo já protocolado (`docs/51 §4` item 12) nem
  reversão/reabertura (item 13).
- **Não recalcula** a régua de reembolso do `docs/00 §2` — só a referencia.

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Tela/relatório financeiro dedicado (read-only), gate **`audit.view.financial`** (permissão final — ver atualização de 2026-08-04 abaixo). Campos: processo (código + link para o detalhe admin), cliente, `internalStatus`, `paymentStatus`, valor pago (`Payment.amountCents`), data de pagamento (`Payment.paidAt`), data de cancelamento (query nova sobre `ProcessStatusEvent`), `needsFinanceReview` | código | este documento |
| 2 | Exportação CSV do relatório, se o PR 1 existir | código | PR 1 |
| 3 | Ação `registerRefund` (`docs/54 §6` PR 1) | código | `docs/54`, decisão de produto separada |

Nenhum destes é pré-requisito de piloto ou divulgação. **Nenhum PR desta
tabela está aprovado por este documento** — mesma lógica de `docs/54 §6`/
`docs/55 §6`.

> **Situação em 2026-08-04:** o **PR 1** acima foi implementado e mergeado
> (`a9f21b6`). Ver atualização (2026-08-04, código, implementação parcial)
> ao fim deste documento — o bloco **não está totalmente fechado**: a data
> de cancelamento continua pendente, registrada ali como **PR técnico 2**.

---

## 7. Proibições

- ❌ Implementar a tela, action, query ou export nesta etapa.
- ❌ Criar `registerRefund` ou qualquer ação de reembolso.
- ❌ Restringir o filtro simples do `docs/55` além de `queue.view` — a
  restrição a `refund.approve`/`audit.view.financial` vale **só** para a
  tela dedicada nova, não retroage sobre o filtro já implementado.
- ❌ Criar permissão nova (`finance.refund`, `process.refund` ou
  equivalente) — reusar `refund.approve`/`audit.view.financial`.
- ❌ Mostrar motivo interno de cancelamento nesta tela.
- ❌ Prometer reembolso, prazo ou valor de devolução em qualquer texto.
- ❌ Misturar GRU (taxa governamental) com valor de pagamento de serviço na
  mesma linha/campo.
- ❌ Alterar `PaymentStatus`, payment adapter ou chamar PSP.
- ❌ Criar migration, enum ou tabela nova.
- ❌ Expor isso ao cliente, em qualquer superfície.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

> **Atualização (2026-08-04, docs, permissão final).** A permissão final do
> relatório dedicado read-only (§3.3/§3.4/§3.17, deixada como
> `refund.approve` **OU** `audit.view.financial` na decisão original) fica
> resolvida: **`audit.view.financial`**, não `refund.approve`.
>
> **1. Qual permissão final governa o relatório read-only?**
> `audit.view.financial`.
>
> **2. Por que não `refund.approve`?** `refund.approve` é a permissão de
> **agir** — aprovar/registrar um reembolso, quando essa ação existir
> (`docs/54 §6` PR 1, `registerRefund`, ainda não implementado). Usá-la
> também para **ver** uma listagem read-only mistura autorização de ação com
> autorização de leitura: quem só precisa **auditar** os casos (contar
> quantos há, checar valor e data) não deveria precisar da permissão que
> autoriza mexer em dinheiro. `audit.view.financial` já existe exatamente
> para esse papel — "ver logs/auditoria (financeiros)" — e é a leitura mais
> próxima do que o relatório faz. `refund.approve` fica **reservado** para
> quando (e se) uma ação de aprovar/registrar reembolso for decidida e
> implementada; nesse PR futuro, é a **ação** (não a visualização) que exige
> `refund.approve`.
>
> **3. Por que não `queue.view`?** `queue.view` já é a permissão do filtro
> simples (`docs/55`) — mais ampla, concedida também a OPERADOR e SUPORTE
> (`docs/55 §2`). O relatório dedicado concentra valor pago e datas lado a
> lado, informação mais sensível em massa do que o rótulo binário já visível
> na fila hoje; usar `queue.view` para a tela dedicada apagaria a distinção
> que motivou criar uma tela própria (§3.3 original). **O filtro simples
> continua sob `queue.view`, sem mudança** — só a tela nova usa a permissão
> diferente.
>
> **4. Quais perfis devem ter a permissão?** FINANCEIRO (concedida
> diretamente) e ADMIN (por herdar todas as permissões) — os mesmos dois
> perfis já cobertos por `refund.approve` hoje, então nenhum perfil ganha ou
> perde acesso na prática; a mudança é **qual permissão** o PR técnico deve
> checar, não **quem** tem acesso.
>
> **5. Essa decisão cria a permissão agora?** Não. `audit.view.financial`
> **já existe** em `src/server/auth/permissions.ts`, concedida a
> FINANCEIRO/ADMIN, sem nenhum consumidor hoje (mesmo achado do `§2`).
> Nenhum RBAC muda no código; nenhum seed; nenhuma migration.
>
> **6. Essa decisão implementa relatório agora?** Não. Fica para o PR
> técnico do `§6` PR 1, que agora deve usar `audit.view.financial` como
> gate — não mais "refund.approve OU audit.view.financial".
>
> **7. Essa decisão cria ação de reembolso?** Não. Relatório continua
> estritamente read-only; `registerRefund` continua fora do escopo
> (`docs/54 §6` PR 1).
>
> **8. Essa decisão expõe algo ao cliente?** Não. Nenhuma decisão anterior
> deste documento muda: cliente nunca vê (§3.6/§4 item 7).
>
> **9. O que fica fora do escopo?** Implementação do relatório; criação da
> permissão (já existe); `registerRefund`; export CSV; qualquer mudança em
> `PaymentStatus`, PSP, Prisma ou RBAC no código; qualquer decisão sobre o
> filtro simples do `docs/55` (continua sob `queue.view`, intocado).
>
> Nada além da escolha da permissão muda: relatório continua read-only, sem
> export CSV, sem reembolso, sem `registerRefund`, sem PSP, sem
> `PaymentStatus`, nunca exposto ao cliente. **Execução real continua
> bloqueada.**

---

> **Atualização (2026-08-04, código, implementação parcial).** O **PR 1**
> do `§6` foi implementado e mergeado na `main`: **`a9f21b6`** — *feat: add
> paid cancelled financial report*.
>
> **O que foi implementado:**
>
> - Primeira tela **read-only** do relatório financeiro dedicado, na rota
>   **`/admin/financeiro`**.
> - Gate: **`requirePermission("audit.view.financial")`** no topo da rota —
>   a permissão final decidida na atualização anterior (2026-08-04,
>   permissão final). **`queue.view` e `refund.approve` NÃO são gate** desta
>   tela.
> - Link a partir do admin home, visível **só** para quem tem
>   `audit.view.financial`.
> - Listagem reusa **`needsFinanceReview`** via
>   `getAdminQueue({ needsFinanceReview: true })` — nenhuma regra nova,
>   nenhuma query separada para decidir quem entra na lista.
> - Campos exibidos, todos com **fonte segura já existente**: processo
>   (código + link para o detalhe admin), cliente, status interno,
>   `paymentStatus`, valor pago (`Payment.amountCents`) e data de pagamento
>   (`Payment.paidAt`) — os dois últimos passaram a ser selecionados por
>   `listAdminQueue` (antes só `status`), sem query própria nova.
>
> **O que continua fora, como decidido:**
>
> - **Sem** motivo interno.
> - **Sem** reembolso, estorno ou qualquer promessa de devolução — só as
>   negações já aprovadas (`docs/54`).
> - **Sem** ação financeira nova: nenhum botão, form ou `action`; sem
>   `registerRefund`; sem chamada a PSP; sem alteração de `PaymentStatus`.
> - **Sem** exposição ao cliente, em nenhuma superfície.
> - **Sem** migration nem mudança de schema — os dois campos novos já eram
>   colunas reais do `Payment`.
>
> **O que fica pendente — bloco AINDA NÃO fechado:**
>
> - **Data de cancelamento continua fora** (§2/§3.14/§4 item 10). Fonte
>   permanece a mesma já identificada: `ProcessStatusEvent.createdAt` onde
>   `toStatus = "CANCELADO_OPERACIONAL"`, já gravado por `cancelProcess` via
>   `transitionInternalStatus`. Falta uma query própria para isolar esse
>   evento — é a única pendência técnica restante deste bloco.
> - Registrada como **PR técnico 2** (renumerando a tabela do `§6`: o antigo
>   PR 2/PR 3 — CSV/`registerRefund` — seguem depois deste, sem mudança de
>   posição relativa). Nenhuma outra pendência nova é criada aqui.
>
> **Execução real continua bloqueada.**

---

> **Fecho.** Este documento **decide no papel**: o filtro simples do
> `docs/55` basta por enquanto; uma tela financeira dedicada é recomendada
> como próximo PR técnico, restrita a `refund.approve`/`audit.view.financial`,
> read-only, mostrando valor e datas que já têm fonte segura no schema
> atual (mais uma query nova para a data de cancelamento). Não implementa
> nada, não cria permissão, não altera `PaymentStatus`/schema, não expõe
> nada ao cliente, não decide `registerRefund`. Não fecha gate e não
> autoriza execução real. Regras permanentes (`docs/00 §8`) e bloqueios de
> fase (`docs/15`) seguem íntegros.
