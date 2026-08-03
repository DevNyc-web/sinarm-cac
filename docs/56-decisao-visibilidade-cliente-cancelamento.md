# 56 — Decisão sobre a visibilidade do cliente ao cancelamento real

> **O que é este documento.** A decisão sobre se, quando e como o **cliente**
> verá que seu processo foi cancelado operacionalmente — item deixado
> explicitamente aberto desde [`docs/52 §3.1`](52-decisao-visibilidade-cancelamento-real.md)
> ("Cliente continua sem visualização do cancelamento real") e reafirmado em
> [`docs/54`](54-decisao-politica-reembolso-cancelamento.md)/[`docs/55`](55-decisao-fila-revisao-financeira.md).
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** UI, `UserFacingStatus` novo, projeção ou ação do cliente.
> - ❌ **NÃO altera** `PaymentStatus`, payment adapter, `statusDivergence.ts`
>   nem `operationalStatusProjection.ts`.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-03
> **Base da `main`:** `be84e85` — *feat: add finance review filter to admin queue*
> **Referências:** [`docs/51`](51-decisao-cancelamento-real.md) (cancelamento
> real), [`docs/52`](52-decisao-visibilidade-cancelamento-real.md)
> (visibilidade admin, cliente deixado aberto), [`docs/54`](54-decisao-politica-reembolso-cancelamento.md)
> (política financeira), `docs/45` (deprecação de `userFacingStatus` como
> fonte visual — regra de ouro relevante aqui).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-03 |
| `main` | `be84e85` |
| Tipo | **Decisão arquitetural/UX documental** — fecha `docs/52 §3.1` |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** o cliente **deve**, no futuro, ver que o processo
foi encerrado — com um texto neutro e curto ("Processo cancelado"), **só no
detalhe do processo** (não no dashboard nesta etapa), calculado
diretamente de `internalStatus === "CANCELADO_OPERACIONAL"` — **nunca**
lendo `UserFacingStatus.CANCELADO` (existe no enum, mas usá-lo violaria a
regra de ouro do `docs/45`) nem criando projeção nova. Motivo, dado
financeiro e promessa de reembolso continuam **fora** da tela do cliente.

---

## 2. Contexto verificado no código (`main` `be84e85`)

| Fato | Onde |
|---|---|
| Cliente não vê `internalStatus` hoje, para status | `clientVisibleStatusLabel(process)` só recebe `{ operationalStatus, manualExecutionStatus }` — não aceita `internalStatus` |
| `internalStatus` **já chega** à página do cliente, para outro fim | `src/app/(user)/processos/[id]/page.tsx:85` — `canCreateCharge` já checa `process.internalStatus === "RASCUNHO" \|\| "AGUARDANDO_PAGAMENTO"`. Ou seja, **o dado já está disponível** no objeto `process` carregado — nenhuma query nova seria necessária para um display futuro |
| Cancelamento real **já bloqueia cobrança nova**, por efeito colateral do gate acima | Um processo `CANCELADO_OPERACIONAL` nunca é `RASCUNHO`/`AGUARDANDO_PAGAMENTO`, então `canCreateCharge` já é `false` — **sem nenhum código novo**. Isso responde parcialmente à pergunta 13 (§3.13) |
| `UserFacingStatus` **já tem** um valor `CANCELADO` | `prisma/schema.prisma` (enum `UserFacingStatus`) e `USER_FACING_STATUS_LABELS.CANCELADO = "Cancelado"` (`statusLabels.ts`) — existe desde antes deste ciclo, **nunca escrito por `cancelProcess`** (sem `alsoSet`) |
| `docs/45` já decidiu que `userFacingStatus` é fonte **deprecada** | "Regra de ouro da transição: **nenhum código novo pode ler `userFacingStatus`**." — decisão anterior, não revista por este documento |
| `CANCELADO_OPERACIONAL` continua sem projeção canônica | `operationalStatusProjection.ts`/`statusDivergence.ts` — inalterados desde `docs/51`, classificados `needs_decision` |

**Tensão identificada e resolvida:** `UserFacingStatus.CANCELADO` parece, à
primeira vista, a solução óbvia — o valor já existe, com o rótulo certo. Mas
usá-lo **contradiria diretamente** a regra de ouro do `docs/45`
("nenhum código novo pode ler `userFacingStatus`"), decisão já tomada e não
revisitada aqui. Além disso, `cancelProcess` nunca escreveu esse campo
(seria preciso um `alsoSet`/write novo, decisão em aberto). A recomendação
deste documento é, portanto, **não reaproveitar `UserFacingStatus.CANCELADO`**
— o display futuro deve ler `internalStatus` diretamente, mesmo padrão que
`canCreateCharge` já usa hoje nesta mesma página.

---

## 3. As 15 perguntas, respondidas

### 3.1 Cliente deve ver que o processo foi cancelado?
**Sim, deve — mas ainda não implementado.** Deixar o cliente sem qualquer
sinal de que o processo parou é pior do que um texto neutro: ele continuaria
esperando um andamento que não vai acontecer.

### 3.2 Qual texto seguro deve aparecer?
**"Processo cancelado."** como rótulo curto, mais uma linha de contexto:
**"Este processo foi encerrado administrativamente. Em caso de dúvidas,
entre em contato com o atendimento."** — neutro, sem culpa, sem promessa,
mesmo tom de `docs/11 §11`/`docs/21 §11` (nunca alarmista, nunca técnico
demais).

### 3.3 Deve mostrar o motivo interno do cancelamento?
**Não.** Mesma decisão de `docs/51`/`docs/52`: motivo é dado
interno/administrativo, nunca exposto automaticamente ao cliente.

### 3.4 Deve mostrar detalhes financeiros?
**Não.** Nenhum valor, nenhum status de pagamento além do que a tela do
cliente já mostra hoje (se já mostra `PAYMENT_STATUS_LABELS` em algum lugar,
isso não muda — mas nada **novo** relacionado a financeiro é adicionado).

### 3.5 Deve mencionar reembolso?
**Não, nunca automaticamente.** Mesma decisão do `docs/54 §4` regra 4: sem
promessa automática ao cliente. Se um reembolso acontecer de verdade, a
comunicação é manual (`message.send`), não um texto fixo de status.

### 3.6 Deve mostrar "revisão financeira necessária"?
**Não.** Esse texto é exclusivamente admin/financeiro (`docs/54`/`docs/55`)
— o cliente não tem `refund.approve` nem `queue.view`, e não deveria saber
que existe uma fila de revisão interna.

### 3.7 Deve alterar o status público (`clientVisibleStatusLabel`)?
**Não da forma como a função existe hoje.** `clientVisibleStatusLabel` não
aceita `internalStatus` — mudar sua assinatura é decisão de código, fora de
um documento docs-only. A recomendação técnica (§4/§6) é um **display
adicional e separado**, não uma mudança da função existente.

### 3.8 Deve criar novo `UserFacingStatus`?
**Não.** Já existe `CANCELADO` no enum — criar outro seria duplicar sem
necessidade. E não deve **reusar** o existente (§2, tensão com `docs/45`).

### 3.9 Deve usar projeção?
**Não.** Nem `operationalStatusProjection.ts` (que já decidiu, via
`docs/49`/`docs/51`, não ter candidato para `CANCELADO_OPERACIONAL`) nem uma
projeção nova. Display direto de `internalStatus`, sem intermediário.

### 3.10 Deve aparecer no dashboard?
**Não nesta etapa.** Só no detalhe do processo (§3.11). O dashboard lista
vários processos; adicionar um rótulo ali é decisão de layout adicional,
melhor decidida depois que o display do detalhe já existir e for validado.

### 3.11 Deve aparecer no detalhe do processo?
**Sim.** É a superfície recomendada para a primeira versão — mesmo padrão
que o admin já usa (`docs/52`/PR #98): um callout read-only, não uma mudança
do rótulo de status principal.

### 3.12 Deve permitir alguma ação do cliente?
**Não.** Sem botão, sem link, sem contestação — só leitura. Se precisar de
contato, é o canal de suporte já existente (§3.14), não uma ação nova nesta
tela.

### 3.13 Deve bloquear upload/pagamento/ações pendentes?
**Parcialmente, já e por acidente — precisa de auditoria própria.** A
criação de cobrança (`canCreateCharge`) já fica bloqueada hoje, porque exige
`internalStatus` em `RASCUNHO`/`AGUARDANDO_PAGAMENTO` (§2). **Não auditamos
aqui** se upload de documento ou outras ações do cliente têm o mesmo
comportamento — isso fica registrado como pendência (§6), não decidido
neste documento.

### 3.14 Deve haver suporte/contato?
**Sim — reusando o que já existe.** O texto recomendado (§3.2) já aponta
para "entre em contato com o atendimento", usando o canal de suporte já
documentado (`docs/support`/`message.send`), sem criar um canal novo.

### 3.15 O que fica fora do escopo?
Implementação do display (código); mudança de `clientVisibleStatusLabel`;
auditoria completa de quais ações do cliente precisam de bloqueio explícito
(§3.13); dashboard (§3.10); qualquer decisão de reembolso/financeiro (já
coberta por `docs/54`, não reaberta aqui).

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | Cliente **deve**, no futuro, ver "Processo cancelado" — texto definido em §3.2. |
| 2 | Aparece **só no detalhe do processo**, não no dashboard, nesta etapa. |
| 3 | **Sem motivo interno, sem dado financeiro, sem menção a reembolso ou "revisão financeira".** |
| 4 | **Não reusar** `UserFacingStatus.CANCELADO` — violaria a regra de ouro do `docs/45`. |
| 5 | **Não criar** `UserFacingStatus` novo, projeção nova, nem alterar `clientVisibleStatusLabel`. |
| 6 | O display futuro lê `internalStatus` **diretamente** — mesmo padrão que `canCreateCharge` já usa na mesma página hoje. |
| 7 | `CANCELADO_OPERACIONAL` **continua** `needs_decision` em `statusDivergence.ts` e sem projeção canônica — nenhuma mudança por causa deste documento. |
| 8 | **Nenhuma ação do cliente** é criada — read-only, com texto apontando para o suporte já existente. |
| 9 | Auditoria de bloqueio de upload/outras ações do cliente fica **pendência futura** (§6), não resolvida aqui. |

---

## 5. O que este documento não resolve

- **Não implementa** o display, não altera `clientVisibleStatusLabel`, não
  toca `src/app/(user)`.
- **Não audita** exaustivamente quais ações do cliente (upload, mensagens,
  etc.) precisam de bloqueio explícito quando o processo está cancelado —
  só registra que `canCreateCharge` já bloqueia, por efeito colateral.
- **Não decide** dashboard (§3.10) — fica para PR futuro separado, se
  decidido.
- **Não reabre** reembolso/financeiro (`docs/54`) nem processo
  protocolado/reversão (`docs/51 §4` itens 12–13).

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Display read-only "Processo cancelado" no detalhe do cliente, lendo `internalStatus` direto (mesmo padrão de `canCreateCharge`) | código (pequeno) | este documento |
| 2 | Auditoria: quais ações do cliente (upload, etc.) já bloqueiam corretamente para processo cancelado, e quais precisam de guarda explícita | código + docs | PR 1 |
| 3 | Decisão sobre exibir o rótulo também no dashboard | docs | PR 1, validação de produto |

Nenhum destes é pré-requisito de piloto ou divulgação. **Nenhum PR desta
tabela está aprovado por este documento** — mesma lógica de `docs/55 §6`.

---

## 7. Proibições

- ❌ Ler `UserFacingStatus.CANCELADO` para este display — regra de ouro do
  `docs/45` continua valendo.
- ❌ Criar `UserFacingStatus` novo para cancelamento real.
- ❌ Criar projeção canônica para `CANCELADO_OPERACIONAL`.
- ❌ Alterar `clientVisibleStatusLabel`, `operationalStatusProjection.ts` ou
  `statusDivergence.ts` por causa desta decisão.
- ❌ Mostrar motivo interno, dado financeiro, "revisão financeira" ou
  qualquer menção a reembolso na tela do cliente.
- ❌ Criar ação, botão ou contestação do cliente.
- ❌ Adicionar o rótulo ao dashboard nesta etapa.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Ativar ou depender da Fase 9.
- ❌ Tocar Gov.br/SINARM/PF.

---

> **Fecho.** Este documento **decide a visibilidade ao cliente no papel**:
> sim, com texto neutro, só no detalhe, lendo `internalStatus` direto, nunca
> reusando `UserFacingStatus.CANCELADO`. Não implementa, não altera
> `clientVisibleStatusLabel`, `PaymentStatus`, projeção ou divergência; não
> fecha gate e não autoriza execução real. Regras permanentes (`docs/00 §8`)
> e bloqueios de fase (`docs/15`) seguem íntegros.
