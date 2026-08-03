# 55 — Decisão sobre a fila/relatório de revisão financeira

> **O que é este documento.** A decisão sobre como o time financeiro/admin
> deve **encontrar e acompanhar** processos com `needsFinanceReview = true` —
> pendência deixada pelo PR que implementou o sinal
> ([`docs/54`](54-decisao-politica-reembolso-cancelamento.md), atualização
> "código, sinalização": "relatório/filtro de cancelados com pagamento fica
> como pendência futura").
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** filtro, UI, action, export CSV ou `registerRefund`.
> - ❌ **NÃO altera** `PaymentStatus`, payment adapter nem PSP.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-03
> **Base da `main`:** `aa3ec5c` — *feat: flag cancelled paid processes for finance review*
> **Referências:** [`docs/54`](54-decisao-politica-reembolso-cancelamento.md)
> (decisão da política + sinal `needsFinanceReview`), `src/server/auth/permissions.ts`
> (matriz RBAC — `queue.view`, `refund.approve`, `audit.view.financial`).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-03 |
| `main` | `aa3ec5c` |
| Tipo | **Decisão arquitetural/UX documental** — fecha a pendência de "relatório/filtro" do `docs/54` |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** o primeiro passo é um **filtro simples na listagem
admin já existente** (mesmo padrão dos filtros de status/pagamento/documento
já implementados) — **não** uma fila/aba nova nem um relatório dedicado.
Quem já vê a fila hoje (`queue.view` — OPERADOR, FINANCEIRO, SUPORTE, ADMIN)
continua vendo o filtro; nenhuma restrição nova de RBAC é criada para essa
etapa. Um relatório financeiro **dedicado**, se um dia for construído, é que
deveria ser restrito a `refund.approve`/`audit.view.financial`
(FINANCEIRO/ADMIN) — decisão adiada, registrada em §6.

---

## 2. Contexto verificado no código (`main` `aa3ec5c`)

| Fato | Onde |
|---|---|
| `needsFinanceReview` já existe, calculado e exposto | `operationalSignals.ts`, `getAdminQueue.ts` (`AdminQueueRow.needsFinanceReview`), `AdminProcessDetail.indicators.needsFinanceReview` |
| Quem vê a fila/listagem hoje | `queue.view` — concedida a **OPERADOR, FINANCEIRO, SUPORTE** (e ADMIN, por herdar tudo). A página só exige `requireAdminRole()` (qualquer perfil interno), sem gate extra por coluna |
| O rótulo "Revisão financeira necessária" (PR anterior) já aparece hoje | Sem gate de permissão própria — mesmo padrão do `paymentStatus`/`realCancellation`, que já são visíveis a todo perfil interno na mesma tabela |
| Filtros já existentes na listagem | `status` (operacional), `pagamento`, `documento`, `codigo`, `ordem` — todos em `<select>`/`<input>` simples, sem permissão própria, disponíveis a quem já vê a fila |
| Permissões financeiras já existentes e sem uso hoje | `refund.approve` (FINANCEIRO/ADMIN), `audit.view.financial` (FINANCEIRO/ADMIN) — candidatas naturais para um relatório dedicado futuro |

**Achado que muda a recomendação inicial:** a sugestão de "visível para
ADMIN e FINANCEIRO, não para OPERADOR/SUPORTE" **não é compatível** com como
a listagem já funciona hoje — `queue.view` já é de todo perfil interno, e o
próprio sinal `needsFinanceReview` já foi implementado (PR anterior) **sem**
gate de permissão, no mesmo padrão do restante da tabela. Restringir agora
exigiria **código novo** (gate por permissão numa coluna que hoje é
compartilhada) — fora do escopo docs-only, e uma mudança de comportamento
que ninguém pediu para o que já existe. A decisão abaixo reflete isso: o
filtro simples continua **sem gate extra**; a restrição a
FINANCEIRO/ADMIN fica reservada para quando (e se) existir uma superfície
**nova e dedicada** (relatório/aba própria).

---

## 3. As 15 perguntas, respondidas

### 3.1 `needsFinanceReview` deve virar filtro na listagem admin?
**Sim — é a recomendação central deste documento.** Um `<select>` a mais no
mesmo `<form method="get">` da fila, mesmo padrão dos filtros existentes.

### 3.2 Deve virar aba/fila própria?
**Não agora.** Uma aba/fila separada implica decidir navegação, layout e
provavelmente permissão própria — maior que "adicionar um filtro". Fica
registrado como PR futuro possível (§6), não decidido aqui.

### 3.3 Deve virar relatório financeiro separado?
**Não agora — decisão adiada.** Um relatório dedicado (exportável, com
resumo/contadores) é o PR 2 da tabela do §6, quando e se o volume de casos
justificar algo além de "filtrar a fila que já existe".

### 3.4 Quem pode ver essa fila?
**Quem já vê a fila hoje** — `queue.view` (OPERADOR, FINANCEIRO, SUPORTE,
ADMIN). O filtro **não** introduz uma restrição nova.

### 3.5 ADMIN vê?
**Sim** — ADMIN tem todas as permissões, incluindo `queue.view`.

### 3.6 FINANCEIRO vê?
**Sim** — `queue.view` já concedida.

### 3.7 OPERADOR vê?
**Sim** — `queue.view` já concedida, e o sinal já é visível a esse perfil
desde o PR anterior (sem gate). Restringir agora seria regressão de UX sem
pedido explícito.

### 3.8 Cliente vê?
**Não, nunca.** Mesma decisão do `docs/54`/`docs/52`/`docs/53` — cliente não
tem `queue.view` nem qualquer acesso à listagem/detalhe admin.

### 3.9 O filtro deve se chamar como?
**"Revisão financeira"** no rótulo do campo (mesmo padrão de "Status
operacional"/"Pagamento"/"Documento"), com opção única
**"Necessária"** — não precisa de um `<select>` com múltiplos valores, um
`<input type="checkbox">`/toggle "Só revisão financeira necessária" resolve,
já que o sinal é binário.

### 3.10 O texto deve prometer reembolso?
**Não.** Mesmo texto já em produção: "Revisão financeira necessária" —
nunca "Reembolso devido" ou equivalente. Nenhum texto novo deste documento
muda isso.

### 3.11 Deve haver exportação CSV?
**Não agora.** Registrado como possível item do relatório dedicado futuro
(§3.3/§6), não do filtro simples.

### 3.12 Deve haver ação de reembolso nessa mesma tela?
**Não.** `registerRefund` (candidato do `docs/54`) continua fora do escopo
de qualquer PR desta lista — filtrar/listar é diferente de agir.

### 3.13 Deve haver contador/resumo?
**Não no filtro simples.** Um contador ("N processos com revisão financeira
pendente") é natural para o relatório dedicado futuro (§3.3), não para uma
coluna a mais na tabela existente.

### 3.14 O que entra no relatório (quando existir)?
Os mesmos campos que a fila **já expõe hoje** para todo perfil interno:
código do processo, status operacional, `paymentStatus`, responsável,
data de criação, e o próprio `needsFinanceReview`. Nada além do que
`AdminQueueRow` já carrega.

### 3.15 O que não deve entrar por segurança?
**Nenhum metadado de documento ou arma/PCE** (mesmo need-to-know de
`docs/11 §3/§19` que já rege `getAdminQueue`/`getAdminProcessDetail`);
nenhum dado bruto de PSP (`providerRefShort`, `providerPaymentId` completo);
nenhuma informação de contato do cliente além do que a tela já mostra hoje;
e, por definição, nenhuma promessa/valor de reembolso — o sinal é binário,
não um cálculo de quanto seria devolvido.

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | `needsFinanceReview` será usado como **filtro administrativo** na listagem já existente — não fila nova, não relatório dedicado, nesta etapa. |
| 2 | O filtro futuro é **read-only** — só filtra, não altera nada. |
| 3 | O filtro **não altera** `PaymentStatus`. |
| 4 | O filtro **não aciona** reembolso. |
| 5 | O filtro **não chama** PSP. |
| 6 | O filtro **não expõe** dados sensíveis além do que a fila já mostra hoje (§3.15). |
| 7 | **Cliente não vê** — nem o filtro, nem o sinal, nunca. |
| 8 | `registerRefund` **continua fora do escopo** — filtrar/listar não é agir. |
| 9 | Exportação/relatório dedicado **fica para decisão futura** (§6), incluindo a pergunta de gate por `refund.approve`/`audit.view.financial`. |
| 10 | O filtro simples **não introduz gate de permissão novo** — continua visível a quem já tem `queue.view` (OPERADOR/FINANCEIRO/SUPORTE/ADMIN), consistente com o sinal já implementado. |

---

## 5. O que este documento não resolve

- **Não implementa** o filtro, UI, action ou export — fica para o PR de
  código que seguir esta decisão.
- **Não decide** a forma final do relatório dedicado (§3.3) nem se/quando
  ele será construído.
- **Não decide** `registerRefund` (`docs/54 §6` PR 1) — continua pendência
  separada.
- **Não altera** a matriz RBAC — nenhuma permissão nova, nenhum gate novo.

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Filtro "Revisão financeira" na listagem admin (`<input type="checkbox">`/toggle, sem gate novo) | código (pequeno) | este documento |
| 2 | Relatório financeiro dedicado (contador, layout próprio) — decidir se é aba nova e se é restrito a `refund.approve`/`audit.view.financial` | docs + código | produto, este documento |
| 3 | Exportação CSV do relatório dedicado, se o PR 2 existir | código | PR 2 |
| 4 | Ação `registerRefund` (`docs/54 §6` PR 1) | código | `docs/54`, decisão de produto separada |

Nenhum destes é pré-requisito de piloto ou divulgação. **Nenhum PR desta
tabela está aprovado por este documento** — mesma lógica de `docs/54 §6`.

---

## 7. Proibições

- ❌ Criar fila/aba separada ou relatório dedicado nesta etapa.
- ❌ Criar exportação CSV nesta etapa.
- ❌ Criar `registerRefund` ou qualquer ação de reembolso nesta etapa.
- ❌ Restringir a visualização do sinal/filtro para além de `queue.view` sem
  decisão própria — a etapa do filtro simples não introduz gate novo.
- ❌ Prometer reembolso no texto do filtro ou de qualquer resumo/contador.
- ❌ Expor metadado de documento, arma/PCE ou dado bruto de PSP no relatório
  futuro.
- ❌ Alterar `PaymentStatus`, payment adapter ou chamar PSP.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

> **Atualização (2026-08-03, código, implementação).** O filtro "Revisão
> financeira" foi implementado exatamente como decidido acima:
> `getAdminQueue.ts` ganhou `needsFinanceReview?: boolean` em
> `AdminQueueFilters` (tipo estendido localmente, `processRepository.ts` e
> `listAdminQueue` **não** foram tocados) e filtra o array **em memória**,
> depois do `.map()` que já calculava o sinal — nenhum novo `where` no banco,
> porque `needsFinanceReview` não é coluna. Na página da fila, um
> `<input type="checkbox" name="revisaoFinanceira" value="1">` no mesmo
> `<form method="get">` dos demais filtros; query param `revisaoFinanceira=1`
> quando marcado, ausente quando não (comportamento nativo de checkbox em
> GET). **Sem gate de permissão novo** — continua sob `queue.view`, como
> decidido. Sem fila/aba nova, sem relatório dedicado, sem export CSV, sem
> contador/resumo, sem `registerRefund`, sem botão de reembolso. Cliente não
> ganhou nenhuma menção ao filtro. **Achado durante a implementação:** o fake
> de Prisma usado pelos testes de service (`tests/unit/services/testPrisma.ts`)
> tinha uma lacuna real — não tratava chave `undefined` em `where` como
> "sem filtro" (Prisma de verdade trata), o que fazia `listAdminQueue({})`
> devolver 0 linhas no fake. Corrigido na raiz (uma linha, `matches()`),
> sem alterar nenhum service; suíte de services inteira (207 testes)
> revalidada sem regressão. **Execução real continua bloqueada.**

---

> **Fecho.** Este documento **decide a forma no papel**: o próximo passo é um
> filtro simples na listagem já existente, sem gate de permissão novo, sem
> relatório dedicado, sem exportação e sem ação de reembolso. Não implementa
> nada disso; não altera `PaymentStatus`, RBAC, schema ou `cancelProcess`;
> não fecha gate e não autoriza execução real. Regras permanentes
> (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
