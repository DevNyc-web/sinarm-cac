# 52 — Decisão sobre visibilidade/projeção do cancelamento real

> **O que é este documento.** A decisão sobre **como** `CANCELADO_OPERACIONAL`
> (o `InternalStatus` que [`cancelProcess`](../src/server/services/cancelProcess.ts)
> passou a produzir) deve **aparecer** para admin e cliente, antes de qualquer
> botão/UI ser criado — item deixado explicitamente aberto por
> [`docs/51 §6`](51-decisao-cancelamento-real.md).
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** `OperationalStatus` novo, mapa ou projeção.
> - ❌ **NÃO cria** UI, botão, rota ou dropdown.
> - ❌ **NÃO altera** `cancelProcess`, `statusDivergence.ts` nem
>   `operationalStatusProjection.ts`.
> - ❌ **NÃO decide** reembolso, processo já protocolado nem reversão
>   (`docs/51 §4` itens 11–13 continuam abertos).
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-02
> **Base da `main`:** `67bc281` — *feat: add cancel process service*
> **Referências:** [`docs/51`](51-decisao-cancelamento-real.md) (decisão do
> fluxo de cancelamento real), [`docs/45`](45-decisao-user-facing-status.md)
> (fonte única do status visível ao cliente), [`docs/49 §3.5`](49-decisao-valores-operacionais-restantes.md)
> (por que `CANCELADO_DEV` fica fora da projeção canônica).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-02 |
| `main` | `67bc281` |
| Tipo | **Decisão arquitetural documental** — resposta ao item deixado aberto em `docs/51 §6` |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** `CANCELADO_OPERACIONAL` **já aparece hoje** para o
admin, como diagnóstico (`internalStatus` bruto), e **não aparece** para o
cliente nem para fila/prontidão/SLA — nenhum destes lê `internalStatus`. Por
ora isso **fica como está**: sem `alsoSet`, sem `OperationalStatus` novo, sem
UI. A lacuna de fila/prontidão é registrada como consequência conhecida, não
corrigida aqui.

---

## 2. O que já existe hoje (verificado no código, `main` `67bc281`)

| Superfície | O que lê | Sabe de `CANCELADO_OPERACIONAL`? |
|---|---|---|
| Admin — detalhe do processo (`src/app/(admin)/admin/processos/[id]/page.tsx:203`) | `INTERNAL_STATUS_LABELS[detail.internalStatus]`, rotulado "interno (docs/12 §6)" | **Sim** — já mostra `"Cancelado (operacional)"` (rótulo já existe em `statusLabels.ts:59`, adicionado no PR do enum) |
| Cliente — dashboard/detalhe (`clientVisibleStatusLabel`, `statusLabels.ts:158`) | Só `{ operationalStatus, manualExecutionStatus }` — a assinatura da função **não aceita** `internalStatus` | **Não** — estruturalmente incapaz de refletir o cancelamento; o cliente continua vendo o rótulo antigo (ex.: "Documento em analise") |
| Fila do admin (`getAdminQueue.ts`) | Só `operationalStatus` (`PAGO_EM_FILA`/`EM_REVISAO_OPERACIONAL` para a flag de fila) | **Não** — nunca referencia `internalStatus`; processo cancelado continua listado normalmente |
| Prontidão/sinalizadores/SLA (`operationalSignals.ts` — `isClosed`, `deriveSignals`, `deriveReadiness`, `deriveSla`, `derivePendings`) | Só `operationalStatus === "CANCELADO_DEV"` | **Não** — nenhuma das cinco funções conhece `internalStatus`; processo cancelado continua com sinalizadores, prontidão e SLA como se estivesse ativo |
| Motivo do cancelamento (`ProcessStatusEvent.note`) | Nenhuma tela hoje | **Não exibido em lugar nenhum** — admin só vê a contagem agregada "Entradas na trilha: `{eventCount}`"; o texto do motivo só é lido direto do banco (Prisma Studio/consulta manual) |

**A consequência mais concreta:** hoje, um processo cancelado via
`cancelProcess` **continua aparecendo na fila do admin com prontidão, SLA e
sinalizadores calculados normalmente** — porque essas quatro funções em
`operationalSignals.ts` são puras e só recebem `operationalStatus`, que
`cancelProcess` deliberadamente não altera (`docs/51`, sem `alsoSet`). Isto
não é um bug do PR anterior — é a consequência direta e já esperada da
decisão de manter a divergência `needs_decision`; este documento só a torna
explícita.

---

## 3. As 10 perguntas, respondidas

### 3.1 `CANCELADO_OPERACIONAL` deve aparecer para cliente?
**Ainda não.** Mostrar exigiria que `clientVisibleStatusLabel` passasse a
aceitar `internalStatus` — mudança de assinatura e de código, fora do escopo
deste documento (docs-only). Até lá, o cliente vê o rótulo operacional
anterior à cancelação, que fica **desatualizado** — lacuna conhecida,
registrada no §2, não corrigida aqui.

### 3.2 `CANCELADO_OPERACIONAL` deve aparecer para admin?
**Já aparece, hoje, sem nenhuma mudança de código** — o detalhe do admin
exibe `INTERNAL_STATUS_LABELS[internalStatus]` como diagnóstico há mais tempo
que `cancelProcess` existe (`docs/12 §6`). Este documento **confirma** que
essa exibição já cumpre a função de "admin ver o cancelamento", sem precisar
de UI nova.

### 3.3 Deve existir `OperationalStatus` próprio para cancelamento real?
**Decisão adiada, não recusada.** Um `OperationalStatus` dedicado resolveria
de uma vez a lacuna do §2 (fila, prontidão, SLA passariam a reconhecer o
fechamento), mas exige migration de enum — fora do escopo docs-only. Fica
registrado como PR futuro possível (§6).

### 3.4 Deve reutilizar algum `OperationalStatus` existente?
**Não.** Nem `CANCELADO_DEV` (técnico/dev, `docs/49 §3.5`, `docs/51 §4.1`),
nem `BLOQUEADO` (afirma bloqueio reversível, não cancelamento), nem qualquer
outro. Reuso inventaria uma equivalência que ninguém decidiu.

### 3.5 Deve continuar sem projeção canônica por enquanto?
**Sim.** `CANCELADO_OPERACIONAL` continua fora de
`CANONICAL_OPERATIONAL_PROJECTION` e classificado `needs_decision` em
`statusDivergence.ts` — nenhum dos dois arquivos é tocado por este documento.

### 3.6 O botão de UI pode ser criado antes desta decisão?
**Não.** Criar o botão sem resolver como o resultado aparece para
cliente/admin/fila produziria uma ação real sem visibilidade correspondente
— o mesmo tipo de risco que `docs/48 §3` recusou para `BLOQUEADO_OPERACIONAL`
(decidir a forma antes do código).

### 3.7 O cliente deve ver "Cancelado" ou uma mensagem mais neutra?
**Quando esta lacuna for fechada, tom neutro** — mesmo critério de
`OPERATIONAL_STATUS_USER_LABELS`/`MANUAL_EXECUTION_USER_LABELS`
(`docs/11 §11`, `docs/21 §11`): honesto, sem detalhe técnico, sem o nome do
enum. A palavra exata (`"Cancelado"` vs. algo como `"Processo encerrado"`) é
decisão de copy do PR que implementar a visibilidade ao cliente, não deste
documento.

### 3.8 O admin deve ver o motivo do cancelamento?
**Sim, em princípio — mas hoje não vê.** O motivo é gravado em
`ProcessStatusEvent.note` (`cancelProcess.ts`), e nenhuma tela exibe esse
campo hoje (o admin só vê a contagem agregada de eventos). Exibir o motivo é
natural (é dado interno, já coletado, já auditável) mas depende de UI de
timeline que não existe — fora do escopo docs-only.

### 3.9 O motivo deve aparecer para o cliente?
**Não, por padrão.** Motivo de cancelamento é dado interno/administrativo
(`docs/51 §4.3`: "sem PII do documento", mesmo contrato de
`reopenDocumentReview`/`approveDocumentOutOfFlow`). Se algum dia o produto
decidir comunicar cancelamento ao cliente, a mensagem é redigida (copy
própria, tom neutro — §3.7), nunca o texto livre do campo `note` exposto
diretamente.

### 3.10 O que acontece com prontidão/listagens quando o processo está cancelado?
**Nada, hoje.** Como o §2 mostra, `getAdminQueue.ts` e as cinco funções de
`operationalSignals.ts` só leem `operationalStatus`, que `cancelProcess` não
altera. Um processo cancelado continua na fila do admin com sinalizadores,
prontidão e SLA calculados como se estivesse ativo. Esta é a lacuna mais
concreta identificada por este documento — registrada como decisão futura
(§6), não corrigida aqui.

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | `CANCELADO_OPERACIONAL` **não é reutilização** de nenhum `OperationalStatus` existente — nem `CANCELADO_DEV`, nem `BLOQUEADO`, nem qualquer outro. |
| 2 | Visibilidade ao **admin** via diagnóstico (`INTERNAL_STATUS_LABELS`) **já está resolvida** — nenhuma mudança necessária; este documento apenas confirma que ela cobre a necessidade imediata. |
| 3 | Visibilidade ao **cliente** continua **em aberto** — `clientVisibleStatusLabel` não lê `internalStatus` hoje, e não é alterada por este documento. |
| 4 | Projeção canônica de `CANCELADO_OPERACIONAL` **continua ausente por enquanto** — `operationalStatusProjection.ts`/`statusDivergence.ts` não são tocados; a divergência segue `needs_decision`. |
| 5 | Um `OperationalStatus` **próprio** para cancelamento real é uma opção **para PR futuro**, não decidida agora — resolveria fila/prontidão/SLA de uma vez, mas exige migration de enum. |
| 6 | **Nenhuma UI/botão de cancelamento pode ser criada** enquanto a visibilidade ao cliente e a lacuna de fila/prontidão (§3.10) não tiverem resposta própria. |
| 7 | Motivo do cancelamento é **dado interno/admin por padrão** — não é exibido ao cliente automaticamente nem em nenhuma tela hoje; exibi-lo ao admin é natural mas depende de UI de timeline futura. |
| 8 | A lacuna de fila/prontidão/SLA (§2, §3.10) é **registrada como consequência conhecida**, não como bug a corrigir neste documento. |

---

## 5. O que este documento não resolve

- **Não decide** a forma final de um eventual `OperationalStatus` próprio de
  cancelamento (nome, se entra na projeção canônica, migration) — fica para
  um PR de decisão dedicado, mesmo padrão de `docs/48`/`docs/51 §7` item 1.
- **Não altera** `clientVisibleStatusLabel`, `getAdminQueue.ts` nem
  `operationalSignals.ts` — a lacuna de fila/prontidão/SLA continua existindo
  exatamente como descrita no §2/§3.10.
- **Não desenha** a UI de timeline que exibiria o motivo do cancelamento ao
  admin.
- **Não decide** reembolso, processo já protocolado nem reversão — `docs/51
  §4` itens 11–13 continuam abertos, sem relação com este documento.
- **Não autoriza** criação de botão/UI de cancelamento — permanece bloqueado
  até que §3.3 e §3.10 tenham resposta própria.

---

## 6. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Decisão própria: `OperationalStatus` dedicado para cancelamento real (nome, projeção, migration) | docs | este documento |
| 2 | Migration aditiva do `OperationalStatus` decidido no PR 1 | migration aditiva | PR 1 |
| 3 | Corrigir `getAdminQueue.ts`/`operationalSignals.ts` para reconhecer o processo cancelado (fila, prontidão, SLA) | código | PR 1 e 2, ou decisão alternativa que não exija novo enum |
| 4 | UI de timeline no admin exibindo `ProcessStatusEvent` (incluindo motivo do cancelamento) | código | nenhuma decisão pendente deste documento |
| 5 | Decisão de copy: como o cliente vê o cancelamento (`clientVisibleStatusLabel` aceitar `internalStatus`, tom da mensagem) | docs + código | PR 1, §3.7 |
| 6 | UI/botão de cancelamento (admin) | código | PRs 1–5, e `docs/51 §4` itens 11–13 |

Nenhum destes é pré-requisito de piloto ou divulgação — mesma lógica de
`docs/51 §7`/`docs/49 §7`: registro de ordem, não autorização de execução.

---

## 7. Proibições

- ❌ Criar `OperationalStatus` novo para cancelamento sem decisão própria.
- ❌ Reutilizar `CANCELADO_DEV`, `BLOQUEADO` ou qualquer `OperationalStatus`
  existente para representar cancelamento real.
- ❌ Criar botão, UI ou rota de cancelamento antes de resolver §3.3/§3.10.
- ❌ Expor o texto livre de `ProcessStatusEvent.note` diretamente ao cliente.
- ❌ Afirmar, neste ou em qualquer documento futuro que cite este, que a
  visibilidade do cancelamento real (cliente, fila, prontidão) **já está
  resolvida** — só a visibilidade ao admin via diagnóstico está.
- ❌ Fechar gate de `docs/26 §19`.

---

> **Atualização (2026-08-02, código).** A lacuna técnica registrada no §2/§3.10
> (fila/prontidão/SLA tratando processo cancelado como ativo) **foi
> corrigida**: `isClosed` em `operationalSignals.ts` agora reconhece
> `internalStatus === "CANCELADO_OPERACIONAL"`, além de
> `operationalStatus === "CANCELADO_DEV"` (comportamento anterior preservado).
> `deriveSignals`/`deriveReadiness`/`deriveSla`/`derivePendings` herdam o
> fechamento — um processo com cancelamento real não gera mais sinalizadores,
> prontidão "quase pronta", SLA em atraso nem pendências ativas.
> `getAdminQueue.ts` também não destaca mais (`highlighted`) um processo
> cancelado como se estivesse na fila prioritária. **Nada mais mudou**:
> `operationalStatus` continua intocado (nenhum `alsoSet`), `cancelProcess`
> continua o mesmo, `operationalStatusProjection.ts`/`statusDivergence.ts`
> continuam sem projetar `CANCELADO_OPERACIONAL` (`needs_decision` inalterado),
> `clientVisibleStatusLabel` continua sem ler `internalStatus` — a visibilidade
> ao **cliente** (§3.1) continua em aberto, exatamente como decidido acima.
> Nenhuma UI/botão foi criado. **Execução real continua bloqueada.**

---

> **Atualização (2026-08-02, código, admin read-only).** A visualização admin
> do cancelamento real (§3.2) ficou mais explícita, **sem criar nenhum botão,
> formulário, action ou rota**: o detalhe do processo
> (`src/app/(admin)/admin/processos/[id]/page.tsx`) agora mostra um callout
> âmbar, somente leitura, quando `internalStatus === "CANCELADO_OPERACIONAL"`
> ("Cancelado (operacional) — este processo teve cancelamento real
> registrado..."); a fila do admin
> (`src/app/(admin)/admin/processos/page.tsx`, via `getAdminQueue.ts`) ganhou
> um rótulo equivalente por linha (`AdminQueueRow.realCancellation`,
> calculado a partir de `internalStatus`, sem expor o enum inteiro no DTO).
> **Correção de registro:** a atualização anterior (§2 da tabela) afirmou que
> o motivo do cancelamento "não é exibido em lugar nenhum hoje" — isso estava
> **incorreto**. O "Historico do processo" no detalhe admin já renderizava
> `ProcessStatusEvent.note` (via `entry.detail` em `getAdminProcessDetail.ts`)
> para **qualquer** evento de transição com nota, antes mesmo deste PR — o
> motivo de um cancelamento real já aparecia ali, junto com ator e data. Por
> isso o callout novo **não repete** o motivo: só aponta, de cara, que o
> processo está encerrado, e remete ao histórico existente para o detalhe.
> Cliente continua sem qualquer menção a `CANCELADO_OPERACIONAL`/
> `internalStatus` (`clientVisibleStatusLabel` intocado). `operationalStatus`,
> `operationalStatusProjection.ts` e `statusDivergence.ts` continuam
> intocados. **Execução real continua bloqueada.**

---

> **Atualização (2026-08-02, docs, UX do botão).** A decisão de UX para o
> botão/ação admin de cancelamento real (mencionada como "próximo PR possível"
> em §6/§9 acima) foi registrada em
> [`docs/53`](53-decisao-ux-acao-cancelamento-admin.md): form inline no
> detalhe admin (mesmo padrão de `reopenDocumentReview`/
> `approveDocumentOutOfFlow`, **não** um modal em JS — este app não usa
> nenhum), visível só para `process.cancel`, nunca na fila/listagem nem para
> cliente, motivo obrigatório com o mesmo piso do backend
> (`MIN_CANCEL_REASON_LENGTH`), textos de botão/aviso/sucesso/erro definidos,
> e a elegibilidade visual deve **reusar** uma função exportada de
> `cancelProcess.ts` (recomendação: exportar `isCancellableInternalStatus`),
> nunca duplicar a allowlist de estados na UI. **Nada disso foi
> implementado** — nenhum botão, form ou action existe ainda. **Execução
> real continua bloqueada.**

---

> **Atualização (2026-08-03, ciclo de implementação encerrado).** A UX
> decidida acima **foi implementada**: `isCancellableInternalStatus` foi
> exportada de `cancelProcess.ts`; `cancelProcessAction` chama `cancelProcess`
> exigindo `process.cancel`; o form "Cancelar processo" está no detalhe
> admin, gated por `hasPermission(admin, "process.cancel") &&
> isCancellableInternalStatus(detail.internalStatus)` — sem allowlist
> duplicada. A lacuna de fila/prontidão/SLA (§2/§3.10 acima) também **foi
> corrigida** (`operationalSignals.ts`/`getAdminQueue.ts` já tratam
> `CANCELADO_OPERACIONAL` como encerrado/inativo). Detalhes completos em
> [`docs/53`](53-decisao-ux-acao-cancelamento-admin.md). **O que permanece
> como registrado:** o **cliente continua sem visualização** do cancelamento
> real (§3.1, não alterado por nenhum PR desta lista) e continua **sem ver o
> motivo automaticamente**; `CANCELADO_OPERACIONAL` segue sem projeção
> canônica. **Execução real continua bloqueada.**

---

> **Atualização (2026-08-03, docs, política financeira).** A política de
> reembolso/financeiro do cancelamento real — fora do escopo original deste
> documento (§8 acima) — foi decidida em
> [`docs/54`](54-decisao-politica-reembolso-cancelamento.md): nenhum
> reembolso automático, pagamentos preservados, análise financeira a cargo
> de `refund.approve` (já existente na matriz RBAC). Nada foi implementado.
> **Execução real continua bloqueada.**

---

> **Atualização (2026-08-03, docs, visibilidade cliente).** O item §3.1
> ("cliente continua sem visualização do cancelamento real") foi decidido em
> [`docs/56`](56-decisao-visibilidade-cliente-cancelamento.md): o cliente
> **deve**, no futuro, ver um texto neutro ("Processo cancelado") só no
> detalhe do processo, lendo `internalStatus` diretamente — **nunca**
> reusando `UserFacingStatus.CANCELADO` (existe no enum, mas usá-lo violaria
> a regra de ouro do `docs/45` contra novas leituras de `userFacingStatus`).
> Sem motivo, sem dado financeiro, sem menção a reembolso. **Nada foi
> implementado.** `clientVisibleStatusLabel` continua sem ler
> `internalStatus`. **Execução real continua bloqueada.**

---

> **Fecho.** Este documento **decide no papel**: confirma a visibilidade
> admin já existente, mantém a ausência de projeção canônica, deixa
> visibilidade ao cliente e a lacuna de fila/prontidão como decisões futuras,
> e **proíbe** UI/botão de cancelamento até que ambas tenham resposta própria.
> Não implementa, não migra, não altera `cancelProcess`, não fecha gate e não
> autoriza execução real. Regras permanentes (`docs/00 §8`) e bloqueios de
> fase (`docs/15`) seguem íntegros.
