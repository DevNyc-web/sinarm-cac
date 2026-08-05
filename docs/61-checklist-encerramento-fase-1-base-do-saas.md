# 61 — Checklist de Encerramento da Fase 1 — Base do SaaS

> **O que é este documento.** O **checklist objetivo** do que precisa estar
> pronto antes de alguém poder declarar a **Fase 1 oficial (Base do SaaS)**
> encerrada. Nasce da decisão estratégica do [`docs/60`](60-decisao-estrategia-automated-first-e-ux-cliente.md),
> que definiu o produto como **SaaS automatizado-first** e registrou que a
> Fase 1 está **no final, mas ainda NÃO encerrada**.
>
> **Este documento é o portão, não a passagem.**
>
> - ❌ **NÃO encerra** a Fase 1.
> - ❌ **NÃO abre** a Fase 2 como execução real.
> - ❌ **NÃO altera** código, UI, rotas, auth, banco, Prisma, testes ou migration.
> - ❌ **NÃO toca** Gov.br/SINARM/PF.
> - ❌ **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED` e **NÃO fecha gate.**
>
> **Data:** 2026-08-04
> **Base da `main`:** `f148c21` — *docs: decide automated-first client ux strategy*
> **Referências:** [`docs/60`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (estratégia automated-first, fases oficiais 1–5, §15 PR 1 = este documento),
> [`docs/26`](26-arquitetura-automacao-hibrida.md) (gates do §19),
> [`docs/23`](23-checklist-piloto-real.md) (12 pendências de piloto — escopo
> **separado**), [`docs/24`](24-revisao-ux-textos-conformidade.md) (linguagem),
> [`docs/15`](15-decisoes-fase-0.md) (bloqueios de fase),
> `src/server/automation/phase9/safety.ts` (flag).

---

## 1. Contexto

| # | Registro |
|---|---|
| 1.1 | O [`docs/60`](60-decisao-estrategia-automated-first-e-ux-cliente.md) definiu a estratégia oficial: **SaaS automatizado-first**, suporte humano como exceção, perfis cliente/admin distintos. |
| 1.2 | **Fase 1 oficial significa "Base do SaaS"** — o alicerce do produto, não a automação (`docs/60 §11`). |
| 1.3 | **Fase 1 oficial ≠ fases técnicas antigas.** Coexistem dois esquemas: as **fases oficiais de produto 1–5** (`docs/60 §11`) e as **fases técnicas 1–9** já usadas em `docs/14`–`docs/36`. A Fase 1 oficial corresponde às fases técnicas **1 a 7** mais os blocos de cancelamento/financeiro/UX (`docs/44`–`docs/60`). |
| 1.4 | A Fase 1 oficial está **no final, mas ainda NÃO encerrada** (`docs/60 §12.1`). |
| 1.5 | **Este documento cria o checklist de fechamento** — é o PR 1 previsto em `docs/60 §15`. |
| 1.6 | **Este documento NÃO fecha a Fase 1.** Fechar exige um documento próprio, posterior, que verifique este checklist item a item (§7). |

### 1.1 Relação com o `docs/23` (checklist de piloto real)

São **checklists diferentes, não concorrentes**:

| Checklist | Pergunta que responde |
|---|---|
| `docs/23 §5` (12 pendências) | "Podemos colocar **cliente real** no produto?" — auth real, MFA, storage de produção, KMS, retenção, Mercado Pago produção, webhook público, termos, reembolso, revisão jurídica, política operacional, treinamento |
| **`docs/61` (este)** | "A **base do SaaS** está completa o bastante para chamar a Fase 1 de encerrada?" |

Fechar a Fase 1 **não** libera piloto real, e **não** fecha nenhuma das 12
pendências do `docs/23 §5` — elas continuam abertas e são pré-requisito
independente.

---

## 2. Definição da Fase 1 oficial — Base do SaaS

A Fase 1 oficial cobre as seguintes áreas (conforme `docs/60 §11`):

| Área | O que inclui |
|---|---|
| Cadastro / auth | Criação de conta e autenticação do cliente e do time interno |
| Permissões / RBAC | Matriz de papéis e permissões internas |
| Processos | Criação, acompanhamento e ciclo de vida do processo |
| Documentos | Upload, conferência e revisão de documentos |
| Pagamentos base | Cobrança, pagamento e status de pagamento (sem reembolso) |
| Status | Status interno, operacional e o status simples voltado ao cliente |
| Auditoria | Trilha de eventos e histórico rastreável |
| Segurança | PII, need-to-know, DTOs redigidos, logs seguros |
| Dashboard cliente | Área logada do cliente comum |
| Admin | Fila, detalhe, operação e diagnóstico interno |
| Cancelamento | Cancelamento real do processo e seus efeitos |
| Financeiro read-only | Relatório interno de cancelados pagos, sem ação financeira |
| Documentação | `docs/00` como índice e as decisões numeradas |
| Decisões base de UX | Linguagem, entrada do cliente, visibilidade por perfil |
| Bloqueio de execução real | Gov.br/SINARM/PF inertes, flag e gates íntegros |

---

## 3. Itens já considerados prontos ou avançados

Registro do que **já existe**, para nenhum PR futuro refazer trabalho pronto.
**Nenhuma decisão é reescrita aqui** — cada linha aponta para onde ela vive.

Legenda: ✅ pronto · 🟡 avançado/parcial

| # | Item | Estado | Onde |
|---|---|---|---|
| 3.1 | Índice `docs/00` contínuo até `docs/60`, sem lacuna | ✅ | `docs/00 §4` (lacuna `docs/38`–`docs/53` preenchida em `b29901f`) |
| 3.2 | Estratégia automated-first registrada | ✅ | `docs/60` |
| 3.3 | Cancelamento real implementado, distinto de `CANCELADO_DEV` | ✅ | `docs/51`–`docs/53`; `src/server/services/cancelProcess.ts` |
| 3.4 | Ações do cliente bloqueadas em processo cancelado (pagamento/documento/destino) | ✅ | `docs/57` — **fechado**, 4 PRs mergeados |
| 3.5 | Dashboard do cliente mostra processo cancelado | ✅ | `docs/58` — **fechado**, PR técnico mergeado |
| 3.6 | Relatório financeiro read-only para cancelados pagos | ✅ | `docs/59`; rota `/admin/financeiro`, gate `audit.view.financial` |
| 3.7 | Data **real** de cancelamento no relatório financeiro (via `ProcessStatusEvent`, em lote, sem N+1) | ✅ | `docs/59` (PR 2, `626f407`) |
| 3.8 | `Process.code` existe e é único | ✅ | `prisma/schema.prisma` (`code String @unique`) |
| 3.9 | Cliente novo entra pela **escolha de processo** | ✅ | `ClientStartPanel` (variantes `full`/`compact`) + `semPedidos` no dashboard — a variante `full` passou de boas-vindas para **escolha de processo** no PR de §4.B |
| 3.10 | Execução real Gov.br/SINARM/PF bloqueada | ✅ | Gates do `docs/26 §19` abertos; nenhum acesso real no app |
| 3.11 | `PHASE9_REAL_EXECUTION_ENABLED` segue `false` | ✅ | `src/server/automation/phase9/safety.ts` (`false as const`) |

**Leitura correta de 3.9:** o item nasceu 🟡 — a **estrutura de ramificação**
existia, mas entregava boas-vindas, não escolha de processo. Passou a ✅ quando
o §4.B foi implementado; o histórico dessa transição está na nota do §4.B.

---

## 4. Pendências obrigatórias antes de encerrar a Fase 1

Todos os itens abaixo estão **pendentes**. Nenhum está marcado como feito.
Marcar um item exige o PR correspondente mergeado **ou** uma decisão documentada
que o resolva explicitamente.

### A. Número interno do processo

- [x] A.1 — Decidir o **formato amigável futuro** do `Process.code`. → **`CAC-YYYY-NNNNNN`** ([`docs/62 §3`](62-decisao-formato-numero-interno-processo.md))
- [x] A.2 — Exemplo aceitável de formato: `CAC-2026-000001` (`docs/60 §8.4`). → **adotado**, com sequência **global monotônica** que não reinicia por ano (`docs/62 §4`)
- [x] A.3 — Decidir o **tratamento dos códigos antigos** `GT-DEV-…` (manter como estão vs. renumerar). → **preservar como estão**, sem backfill e sem migration de reescrita (`docs/62 §5`)
- [x] A.4 — Implementar o ajuste técnico em **PR separado**, se decidido. → **implementado**: sequence `process_code_seq` + `generateProcessCode()`
- [x] A.5 — Garantir **exibição para cliente e admin**. → **verificado, sem mudança** (não regressão)
- [x] A.6 — Garantir **consulta admin por número interno**. → **verificado, sem mudança** (não regressão)

> **Decidido em 2026-08-04 pelo [`docs/62`](62-decisao-formato-numero-interno-processo.md):**
> A.1–A.3 estão **resolvidos**. Com isso, a condição **§5.6** ("número interno
> amigável estiver decidido") passa a estar satisfeita.
>
> **Implementado em 2026-08-04 (PR técnico `feat/process-code-friendly-format`):**
> A.4 está **feito** — migration `20260804000000_add_process_code_sequence`
> (`CREATE SEQUENCE process_code_seq`) e `src/server/processes/processCode.ts`
> geram `CAC-YYYY-NNNNNN` via `nextval`, só para processos **novos**. **Sem
> backfill**, sem renomear `GT-DEV-…`/`GT-DEMO-001`, sem mudança em
> `schema.prisma`.
>
> **A.5 e A.6 foram verificados, não alterados** — as 6 telas que exibem o
> código (3 do cliente, 3 do admin) renderizam a string crua, sem parsing nem
> validação, e a busca admin segue `contains` + `mode: "insensitive"`, sem
> regex de formato. Códigos antigos e novos continuam exibíveis e
> encontráveis; há teste travando essa ausência de validação. Marcados `[x]`
> como **não regressão**, conforme a nota de escopo abaixo.
>
> **O bloco A está fechado. A Fase 1 continua NÃO encerrada** — os blocos
> **B–H seguem integralmente abertos**, e das 9 condições do §5 apenas a §5.6
> está satisfeita.
>
> **Nota de escopo (verificado em `docs/60 §2`/`§8.1`):** A.5 e A.6 **já estão
> atendidos hoje** — o cliente vê o código no dashboard e no detalhe, e o admin
> filtra a fila por código. Ficam no checklist como **verificação de não
> regressão**: se A.4 trocar o gerador, exibição e consulta precisam continuar
> funcionando. A pendência **nova** real é A.1–A.3.

### B. Entrada do cliente novo

- [x] B.1 — Melhorar a tela inicial para **cliente sem processos**. → `ClientStartPanel` (variante `full`) passa a ser a **escolha de processo**
- [x] B.2 — Priorizar a pergunta **"Qual processo você deseja realizar?"**. → é o **`<h1>` da página** no ramo `semPedidos`
- [x] B.3 — **Não destacar** lista vazia de "Meus processos". → o cabeçalho "Meus processos" só renderiza **quando há processos**; sem processos, a lista vira `<h2>` secundário
- [x] B.4 — Exibir **opções simples de processo**. → 4 cards com **nomes amigáveis**, CTA só no processo criável
- [x] B.5 — Manter **ajuda visível**. → card de ajuda **vídeo-first** (`/ajuda#videos`) na própria tela

> Evoluir o `ClientStartPanel`/dashboard existentes — **sem criar um segundo
> caminho paralelo** (`docs/60 §6`).

> **Decisão/plano registrados em 2026-08-04 pelo
> [`docs/63`](63-decisao-tela-inicial-cliente-novo-escolha-processo.md):**
> a tela do cliente novo passa a abrir com **"Qual processo você deseja
> realizar?"**, cards simples com **nomes amigáveis**, separação entre
> **disponível agora** e **em preparação** (sem CTA, sem promessa de prazo ou
> aprovação) e **ajuda visível com vídeos em destaque**; "Meus processos" vira
> informação secundária enquanto não houver processo.
>
> **B.1–B.5 continuam `[ ]`.** Diferente do bloco A, cuja condição (`§5.6`)
> exige **decisão**, a condição de B (`§5.4`) exige **entrada clara**
> — comportamento observável, que só o PR técnico de UI
> (`feat/client-start-process-selection`, `docs/63 §10`) entrega. **O bloco B
> NÃO está fechado** e a condição `§5.4` **NÃO** está satisfeita.

> **Implementado em 2026-08-04 (PR técnico `feat/client-start-process-selection`):**
> **B.1–B.5 estão feitos.** O `ClientStartPanel` (variante `full`) deixou de
> abrir com boas-vindas + "Primeiros passos" e passou a abrir com a **pergunta
> como `<h1>`** e com **cards de escolha** em nomes amigáveis, vindos do módulo
> puro `src/server/support/clientProcessChoices.ts`. O dashboard só renderiza o
> cabeçalho **"Meus processos"** quando **há** processos; sem processos, a lista
> aparece como `<h2>` secundário, com copy que não aponta mais para o botão
> "Nova solicitação" — que esse ramo deixou de exibir. A ajuda ficou
> **vídeo-first** (`/ajuda#videos` antes de `/ajuda#suporte`).
>
> **CTA falso é impossível por construção:** `href` e `cta` só recebem valor
> quando o processo é criável hoje, e a disponibilidade continua sendo lida da
> regra única que já existia (`processAvailability.ts`) — os três processos em
> preparação aparecem com selo e aviso, sem link. **Sem caminho paralelo**: o
> componente e a ramificação `semPedidos` são os que já existiam
> (`docs/60 §6`).
>
> **Com isso, a condição §5.4** ("cliente novo tiver entrada clara") **passa a
> estar satisfeita.**
>
> **O bloco B está fechado. A Fase 1 continua NÃO encerrada** — os blocos
> **C–H seguem integralmente abertos**, e das 9 condições do §5 apenas **§5.4 e
> §5.6** estão satisfeitas.
>
> **Nota de escopo:** este PR **não** fecha o bloco C. Ele introduz nomes
> amigáveis **na tela de escolha**; a revisão das labels em todo o produto
> (fila admin, detalhe, catálogo operacional) continua sendo C.

### C. Nomes amigáveis dos processos

- [x] C.1 — Revisar as **labels exibidas ao cliente**. → **5 superfícies** revisadas: dashboard, detalhe, sucesso, escolha de processo e `/processos/novo`
- [x] C.2 — Evitar termos técnicos como foco principal. → o **nome do registro** ("Guia de Trafego (Pessoa Fisica - CAC)") saiu das telas do cliente; o nome **regulatório** do catálogo virou linha secundária
- [x] C.3 — Manter **códigos técnicos internamente** (ex.: `GUIA_TRAFEGO_PF_CAC`). → **nenhum código renomeado**; catálogo, mapeamento, seed e admin intactos
- [x] C.4 — Usar **linguagem simples** na escolha de processo e no acompanhamento. → **dois registros**: ação ("Emitir Guia de Tráfego") ao escolher, substantivo ("Guia de Tráfego") ao acompanhar

> Continua valendo `docs/24`: sem jargão de dev, sem status cru, sem erro
> técnico exposto ao cliente.

> **Implementado em 2026-08-05 (PR técnico `feat/friendly-process-labels`):**
> **C.1–C.4 estão feitos.** O `clientProcessChoices.ts` — já a fronteira de copy
> do cliente desde o bloco B — ganhou o **registro substantivo** (`name`) ao
> lado do de ação (`label`), mais `clientProcessName(code, fallback)`, que
> aceita o código **persistido** (`GUIA_TRAFEGO_PF_CAC`) ou o do **catálogo**
> (`GUIA_TRAFEGO`) e cai no nome do banco quando o tipo é desconhecido — tipo
> fora do catálogo continua exibível.
>
> **O achado real do bloco C não eram enums na tela.** O cliente nunca viu
> `GUIA_TRAFEGO` cru: via o `ProcessType.name` **semeado**, que é
> `"Guia de Trafego (Pessoa Fisica - CAC)"` — sem acento e com rótulo de
> registro —, em **3** telas (dashboard, detalhe, sucesso), mais o nome
> **regulatório** do catálogo como título na escolha ("Emissão de CRAF",
> "Autorização de Compra") e um `"Guia de Tráfego (CAC)"` hardcoded em
> `/processos/novo`.
>
> **Nada foi renomeado por baixo (C.3):** `LAUNCH_PROCESS_CODES`,
> `PERSISTED_PROCESS_TYPE_CODES`, `ProcessType.name` no banco e o catálogo
> seguem idênticos — a tradução é de **exibição**. Sem migration, sem Prisma,
> sem `db:push`. O **admin preserva** nome e código técnicos
> (`detail.processTypeName`, `detail.processTypeCode`), com teste travando essa
> preservação.
>
> **`Process.code` × `ProcessType.code` ficou explícito no código** — o
> `clientProcessName` documenta a distinção e há teste garantindo que um número
> interno (`CAC-2026-000001`) **não** é tratado como tipo de processo. Isso
> atende a ressalva não bloqueante registrada na revisão do `docs/63`.
>
> **O bloco C está fechado. A Fase 1 continua NÃO encerrada** — os blocos
> **D–H seguem integralmente abertos**, e das 9 condições do §5 continuam
> satisfeitas apenas **§5.4 e §5.6** (C não tem condição própria no §5).

### D. Separação cliente/admin

- [ ] D.1 — Revisar a **experiência de entrada**.
- [ ] D.2 — Deixar claro o **acesso de cliente comum**.
- [ ] D.3 — Deixar claro o **acesso admin/equipe interna**.
- [ ] D.4 — Garantir que o **cliente não veja área administrativa**.
- [ ] D.5 — Garantir que o admin continue sob **RBAC/permissions**.

> **Verificado:** D.4 e D.5 já são garantidos por permissão hoje (`USER: []` em
> `ROLE_PERMISSIONS`); a pendência real é D.1–D.3 — hoje existe **uma única**
> entrada pública (`/login`), sem distinção de experiência (`docs/60 §5`).

> **Direção registrada em 2026-08-05 pelo
> [`docs/64`](64-decisao-login-federado-captcha-rate-limit.md):** a entrada do
> cliente caminha para **login federado (Google/OIDC)**, sem senha própria, e o
> admin mantém **entrada separada** com RBAC interno, allowlist e MFA do
> provedor como requisitos futuros.
>
> **Nenhum item de D é marcado por isso.** D.1–D.3 exigem a experiência de
> entrada **implementada** — decidir a direção não entrega tela. **D exige PR
> técnico futuro**, ainda não aprovado, e o `docs/64` **aumenta** o escopo de D
> em vez de reduzi-lo.

### E. Área de ajuda

- [x] E.1 — Definir a **estrutura mínima** da área de ajuda. → **5 seções em ordem de prioridade**, com índice de atalhos e âncoras estáveis, travadas por teste
- [x] E.2 — Priorizar **vídeos tutoriais**. → vídeos passaram a ser a **primeira seção** e o **primeiro atalho**; teste trava a ordem
- [x] E.3 — **Reduzir texto longo**. → a página deixou de **abrir** com 8 cards de texto; a abertura virou uma linha ("Comece pelos vídeos")
- [x] E.4 — Conectar a ajuda com os **processos mais comuns**. → nova seção **"Ajuda por processo"** (`#processos`), lendo as mesmas opções da tela de entrada
- [x] E.5 — **Não** transformar a ajuda em atendimento manual obrigatório. → suporte é a **última** seção e o **último** atalho, condicionado a "se os vídeos e as dúvidas acima não resolverem"

> A rota `/ajuda` já existe e já é linkada do painel do cliente — a pendência é
> **conteúdo e estrutura**, não criação de página.

> **Implementado em 2026-08-05 (PR técnico `feat/client-help-structure`):**
> **E.1–E.5 estão feitos.** A ordem das seções passou a ser
> **vídeos → ajuda por processo → dúvidas frequentes → guia de status →
> suporte**, e o índice de atalhos segue a mesma ordem. Ordem **é** prioridade:
> o cliente encontra o caminho rápido antes do material de referência, e o
> humano por último.
>
> **A estrutura já existia (E.1).** `/ajuda` tinha 4 seções, 4 âncoras e o aviso
> de não-oficialidade — a pendência era de **conteúdo e hierarquia**, como a
> nota acima já previa. O que faltava de fato era **E.4**: nada na ajuda
> mencionava os processos. A nova seção `HelpByProcessSection` lê
> `clientProcessChoices()` — **a mesma fonte** da tela de entrada (blocos B/C) —,
> então ajuda e produto não podem divergir, e **CTA falso continua impossível**:
> processo em preparação aparece com selo, sem link.
>
> **Escopo honesto de E.3:** o que mudou foi a **ordem de leitura** e a abertura
> da página, não o volume total — os 8 tópicos de referência continuam
> completos, abaixo. **Não** foram colapsados em `<details>`: `/ajuda#gov-br` é
> linkado do login e é aviso de **segurança** sobre senha do Gov.br; escondê-lo
> atrás de um clique seria pior do que o texto que economizaria.
>
> **E.5 sem criar barreira:** o suporte continua a um clique, sem fila e sem
> formulário — apenas deixou de ser apresentado como caminho normal
> (`docs/60 §10.3`).
>
> **O bloco E está fechado. A Fase 1 continua NÃO encerrada** — os blocos
> **D, F, G e H seguem integralmente abertos**, e das 9 condições do §5
> continuam satisfeitas apenas **§5.4 e §5.6** (E não tem condição própria
> no §5).

### F. Segurança e permissões

- [ ] F.1 — Revisar **need-to-know**.
- [ ] F.2 — Revisar **PII**.
- [ ] F.3 — Revisar **DTOs seguros** (permissão na query + DTO redigido, `docs/18 §6`).
- [ ] F.4 — Revisar **logs sem credenciais, cookies ou tokens**.
- [ ] F.5 — Revisar **`storageKey` fora da UI**.
- [ ] F.6 — Revisar **permissões financeiras**.
- [ ] F.7 — Revisar **permissões de cancelamento**.
- [ ] F.8 — Revisar **auditoria**.

> Item F é uma **revisão**, não uma reescrita: espera-se confirmar o que já está
> correto e registrar achados, no espírito do `docs/41` (achados reportados, não
> corrigidos no mesmo PR).

> **Direção registrada em 2026-08-05 pelo
> [`docs/64`](64-decisao-login-federado-captcha-rate-limit.md):** proteção
> contra abuso ganha **captcha** em pontos sensíveis (preferência: Cloudflare
> Turnstile, nunca como defesa única) e **rate limit** por IP, usuário/e-mail e
> rota, com bloqueio progressivo e logs sem PII.
>
> **Rate limit não é construção do zero:** já existe para login e cadastro
> (`src/server/auth/rateLimit.ts`); o que falta é armazenamento **distribuído**
> — hoje é memória por instância e zera no restart — e cobertura das demais
> rotas. O **DoS de conta** documentado nesse módulo continua sem solução.
>
> **Nenhum item de F é marcado por isso.** F.1–F.8 são revisão do código **como
> ele está hoje**; captcha e rate limit distribuído são trabalho **novo**, de
> **PR técnico futuro**, e ampliam a superfície que F terá de revisar.

### G. Pagamentos base

- [ ] G.1 — Confirmar **cobrança / pagamento / status**.
- [ ] G.2 — Confirmar **relatório financeiro read-only**.
- [ ] G.3 — Confirmar **processo cancelado pago** entrando em revisão financeira.
- [ ] G.4 — **Não** criar reembolso ainda.
- [ ] G.5 — **Não** criar `registerRefund` ainda.
- [ ] G.6 — **Não** chamar PSP para reembolso.

> G.4–G.6 são **restrições permanentes deste bloco**, não tarefas: um item
> "confirmado" aqui significa confirmar que **continuam ausentes**.

### H. Documentação final

- [ ] H.1 — `docs/00` atualizado.
- [ ] H.2 — `docs/60` registrado.
- [ ] H.3 — Checklist da Fase 1 (**este documento**) registrado.
- [ ] H.4 — Pendências futuras **separadas em docs próprios**.
- [ ] H.5 — **Fase 2 oficial descrita sem execução real.**
- [ ] H.6 — **Fase 9 real continua bloqueada.**

> H.1–H.3 são atendidos **por este PR**; ficam listados porque o documento de
> fechamento (§7) precisa verificá-los, não porque estejam em aberto agora.

---

## 5. Critério para declarar a Fase 1 encerrada

A Fase 1 **só pode ser encerrada** quando **todas** as condições abaixo forem
verdadeiras — são **conjuntivas**, não uma lista de preferências:

| # | Condição |
|---|---|
| 5.1 | Todos os itens obrigatórios do §4 estiverem **decididos ou implementados**. |
| 5.2 | Pendências futuras estiverem **separadas em docs próprios**. |
| 5.3 | **Nenhum fluxo manual** estiver sendo usado para compensar produto incompleto. |
| 5.4 | **Cliente novo tiver entrada clara** (escolha de processo, não lista vazia). |
| 5.5 | **Admin estiver separado** do fluxo de cliente. |
| 5.6 | **Número interno amigável estiver decidido.** |
| 5.7 | **Segurança / permissions / PII / logs** estiverem revisados. |
| 5.8 | **`PHASE9_REAL_EXECUTION_ENABLED` continuar `false`.** |
| 5.9 | **Execução real Gov.br/SINARM/PF continuar bloqueada.** |

**Como se declara o encerramento:** por um **documento próprio de fechamento**
(§7, sugestão `docs/close-phase-1-foundation`), que percorre §4 e §5 item a
item e registra a evidência de cada um. **Não** se encerra a Fase 1 por
declaração em commit, em PR de código ou neste documento.

> **5.6 é "decidido", não "implementado".** O formato pode ser decidido e a
> implementação ficar para PR posterior (A.4 é condicional: *"se decidido"*).
> A Fase 1 não fica refém de um PR de código; fica refém da **decisão**.
>
> **5.8/5.9 nunca são "resolvidos" pelo encerramento.** São condições que
> precisam continuar verdadeiras **no momento do fechamento** — encerrar a
> Fase 1 não as afrouxa, não as revisa e não as fecha.

---

## 6. O que NÃO faz parte do encerramento da Fase 1

Nenhum dos itens abaixo é pendência da Fase 1. Não bloqueiam o encerramento e
**não devem** ser puxados para dentro dele:

- Reembolso / `registerRefund` (`docs/54 §6` PR 1).
- Exportação CSV do relatório financeiro (`docs/59 §6`).
- Crédito interno (`docs/54 §5`).
- Reversão / reabertura de processo (`docs/51 §4` itens 12–13).
- Execução real Gov.br/SINARM/PF.
- OCR real.
- Schedule.
- Heartbeat.
- Playwright real fora de `localhost`/laboratório sintético.
- Automação real de Gov.br/SINARM/PF.
- Fechar os gates do `docs/26 §19`.
- Alterar `PHASE9_REAL_EXECUTION_ENABLED`.

---

## 7. Próximos PRs sugeridos após este checklist

**Sugestões, não execução.** Nenhum destes é aprovado por este documento, e os
nomes de branch são indicativos.

| Ordem | PR sugerido | Natureza | Cobre |
|---|---|---|---|
| 1 | `docs/code-format-decision` (ou similar) — decidir formato do `Process.code` e o destino dos `GT-DEV-…` | docs | A.1–A.3 |
| 2 | `feat/process-code-format` (ou similar) — implementar o formato amigável, **se aplicável** | código | A.4–A.6 |
| 3 | `feat/client-start-process-selection` — melhorar a tela inicial do cliente novo | código | B |
| 4 | `feat/friendly-process-labels` — aplicar nomes simples | código | C |
| 5 | `docs/admin-client-entry-decision` — decidir a separação de entrada cliente/admin | docs | D.1–D.3 |
| 6 | `docs/help-center-minimum-structure` — definir a ajuda com vídeos | docs | E |
| 7 | `docs/phase-1-security-review` — revisão final de segurança/permissões | docs | F |
| 8 | `docs/close-phase-1-foundation` — **fechar a Fase 1, apenas no final** | docs | §5 |

O PR 8 é o **único** que pode declarar a Fase 1 encerrada, e só depois dos
anteriores. Ordem entre 1–7 é sugestiva; **8 é obrigatoriamente último**.

---

## 8. Proibições

Este PR **não**:

- ❌ fecha a Fase 1;
- ❌ abre a Fase 2 como execução real;
- ❌ altera código;
- ❌ altera UI;
- ❌ altera banco;
- ❌ cria migration;
- ❌ altera Prisma;
- ❌ altera rotas, auth ou testes;
- ❌ toca Gov.br/SINARM/PF;
- ❌ cria automação real;
- ❌ cria OCR real;
- ❌ cria schedule;
- ❌ cria heartbeat;
- ❌ cria reembolso;
- ❌ cria `registerRefund`;
- ❌ chama PSP;
- ❌ usa `db:push`;
- ❌ altera `PHASE9_REAL_EXECUTION_ENABLED`.

---

> **Fecho.** Este documento **define o portão de saída da Fase 1 oficial**: o
> que já está pronto (§3), o que falta obrigatoriamente (§4, blocos A–H, todos
> pendentes), sob que condições conjuntivas o encerramento pode ser declarado
> (§5), o que explicitamente **não** faz parte dele (§6) e por quais PRs se
> chega lá (§7) — com o fechamento reservado a um documento próprio, o último
> da fila. **A Fase 1 NÃO é encerrada aqui.** A Fase 2 **NÃO** abre como
> execução real, `PHASE9_REAL_EXECUTION_ENABLED` continua `false`, e os gates
> do `docs/26 §19`, as regras permanentes (`docs/00 §8`) e os bloqueios de fase
> (`docs/15`) seguem íntegros.
