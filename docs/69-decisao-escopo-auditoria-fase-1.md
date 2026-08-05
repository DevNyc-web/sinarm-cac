# 69 — Decisão: escopo da auditoria na Fase 1

> **O que é este documento.** Resolve o item **F.8** do `docs/61`, que ficou
> aberto após a revisão do [`docs/68`](68-revisao-seguranca-pii-logs-fase-1.md):
> a lacuna entre as permissões `audit.view.all` / `audit.view.own` e a ausência
> de modelo e tela de auditoria dedicados.
>
> **A decisão é de escopo, não de construção.** A Fase 1 **não** precisa de uma
> auditoria ampla; a lacuna é **aceita e documentada**, e a auditoria ampla vira
> escopo futuro com requisitos próprios.
>
> - ❌ **NÃO altera** código, permissões, RBAC, Prisma, migration, UI ou testes.
> - ❌ **NÃO cria** modelo, tabela nem tela de auditoria.
> - ❌ **NÃO remove** nenhuma permissão.
> - ❌ **NÃO fecha** os blocos D e H.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `250d022` — *docs: review security, PII, logs and permissions for phase 1 (#136)*
> **Referências:** [`docs/68 §4.2.1`](68-revisao-seguranca-pii-logs-fase-1.md) (o
> achado que este documento resolve), [`docs/61 §4.F`](61-checklist-encerramento-fase-1-base-do-saas.md)
> (o bloco), [`docs/05 §11`](05-logs-auditoria-lgpd.md) (logs, trilha append-only
> e log de acesso a PII), [`docs/11 §3`](11-painel-admin-operacao.md) (matriz de
> permissões), [`docs/23 §5`](23-checklist-piloto-real.md) (pendências de
> produção), [`docs/59`](59-decisao-relatorio-financeiro-cancelados-pagos.md)
> (relatório financeiro).

---

## 1. Status da decisão

| # | Registro |
|---|---|
| 1.1 | **Decisão de escopo registrada.** |
| 1.2 | **Implementação NÃO feita aqui.** Este documento é docs-only. |
| 1.3 | **Fecha o item F.8** — e com ele o **Bloco F** (§7). |
| 1.4 | **NÃO fecha a Fase 1** — D e H seguem abertos. |
| 1.5 | **NÃO abre a Fase 2.** |
| 1.6 | **NÃO altera a Fase 9** (§9). |
| 1.7 | **Nenhuma permissão é removida nem adicionada.** |

---

## 2. Contexto verificado no código (`main` `250d022`)

Reconfirmação do achado do `docs/68 §4.2.1`, mais dois detalhes que a revisão
anterior não tinha isolado.

| # | Situação hoje | Onde |
|---|---|---|
| 2.1 | Existem **três** permissões de auditoria na matriz | `permissions.ts`: `audit.view.all`, `audit.view.own`, `audit.view.financial` |
| 2.2 | **Só `audit.view.financial` é aplicada** — em `requirePermission` e no link do painel | `(admin)/admin/financeiro/page.tsx:41`; `(admin)/admin/page.tsx:68` |
| 2.3 | `audit.view.all` e `audit.view.own` **não têm ponto de aplicação** em nenhuma rota, página ou action | busca em `src/`: nenhuma ocorrência fora da matriz e dos rótulos |
| 2.4 | **Não existe modelo de auditoria dedicado** — a trilha é `ProcessStatusEvent`, por processo | `prisma/schema.prisma` |
| 2.5 | **As permissões são exibidas ao usuário interno**, com ✓/✕, na home do admin e no detalhe do processo | `(admin)/admin/page.tsx:45`; `(admin)/admin/processos/[id]/page.tsx:607` |
| 2.6 | **A rota que serve arquivo de documento não registra acesso algum** — nem log, nem evento | `api/documents/[documentId]/file/route.ts`: nenhuma chamada a `logger` ou à trilha |
| 2.7 | O `docs/05 §11b` pede **"log de acesso a PII separado (exigência LGPD): quem/qual processo leu quais dados pessoais, quando e para quê"** | `docs/05` |

> **O que 2.5 acrescenta.** A lacuna não é só uma linha morta na matriz: o
> rótulo *"Ver logs/auditoria (todos)"* aparece **com ✓ verde** para o ADMIN na
> tela `/admin`. A pessoa lê que pode ver todos os logs e não há para onde ir.
> É o único efeito concreto de manter as permissões — e é de UI, não de
> segurança: **permissão não aplicada não concede nada**.

> **O que 2.6 e 2.7 acrescentam.** Parte da lacuna toca uma expectativa de
> **LGPD** já escrita no `docs/05`, não apenas uma conveniência operacional. Hoje
> o impacto é baixo — não há CPF no schema (`docs/68 §3.2.1`) e não há cliente
> real —, mas ele **cresce junto com o tráfego real**. Ver §8.

---

## 3. Decisão principal

| # | Decisão |
|---|---|
| 3.1 | **`audit.view.financial` permanece** como permissão **aplicada e válida** para o relatório financeiro. Nada muda nela. |
| 3.2 | **`audit.view.all` e `audit.view.own` NÃO devem ser tratados como auditoria ampla implementada.** São reserva de vocabulário da matriz, não capacidade entregue. |
| 3.3 | **A Fase 1 não precisa construir auditoria ampla dedicada.** |
| 3.4 | **A lacuna é aceita como escopo futuro** — e fica documentada aqui, que é a condição para aceitá-la. |
| 3.5 | **Auditoria ampla futura exige decisão e PR próprios** (§6). |
| 3.6 | **Nenhuma promessa de auditoria ampla pode ser usada como requisito de lançamento da Fase 1.** |
| 3.7 | **Nenhuma permissão é removida.** Remover exigiria mexer em código, o que este PR não faz — e a matriz do `docs/11 §3` é decisão de produto, não detalhe de implementação. |

> **Por que aceitar em vez de remover.** As duas alternativas eram legítimas.
> Remover deixaria a matriz honesta hoje, mas exigiria PR de código e apagaria
> um vocabulário que o `docs/11 §3` definiu de propósito — para depois
> reintroduzi-lo igual. Aceitar mantém a matriz estável e transfere o custo para
> um documento, que é o instrumento mais barato disponível. **A condição da
> aceitação é esta página existir**: lacuna documentada não é lacuna esquecida.

---

## 4. O que as permissões significam a partir de agora

Leitura oficial, para nenhum PR futuro interpretar de outro jeito:

| Permissão | Significado hoje |
|---|---|
| `audit.view.financial` | **Capacidade real e aplicada.** Protege `/admin/financeiro`. |
| `audit.view.all` | **Reserva de vocabulário.** Nomeia uma capacidade **ainda não construída**. Concedê-la a um perfil **não** dá acesso a nada. |
| `audit.view.own` | **Reserva de vocabulário**, mesma leitura. |

**Consequências práticas:**

| # | Regra |
|---|---|
| 4.1 | Nenhum PR pode citar `audit.view.all`/`audit.view.own` como evidência de que existe auditoria. |
| 4.2 | Quem construir a auditoria ampla **deve reusar esses nomes**, não criar permissões paralelas. |
| 4.3 | Se a auditoria ampla for descartada de vez, aí sim as permissões saem da matriz — em PR próprio. |
| 4.4 | Ajustar o **rótulo** exibido (2.5) para não prometer o que não existe é **melhoria opcional**, de UI, e não é feita aqui. |

---

## 5. O que a trilha de hoje cobre — e o que não cobre

**Cobre** (`ProcessStatusEvent`, append-only, por processo, com ator e papel):

status interno · status operacional · prioridade · responsável · nota ·
execução manual · protocolo manual · GRU · pagamento da GRU

Isso atende o que a operação precisa hoje: **quem mexeu no processo, o quê e
quando**, sem PII no conteúdo (rótulos curtos, por contrato do schema).

**Não cobre:**

| Lacuna | Observação |
|---|---|
| **Acesso a arquivo de documento** | ninguém registra quem baixou o quê (2.6) — é a lacuna mais relevante, por tocar o `docs/05 §11b` |
| Eventos de autenticação | login, logout, falha de login, expiração de sessão |
| Mudança de permissão ou de usuário interno | `internalUsers.manage` existe na matriz, sem trilha própria |
| Acesso ao relatório financeiro | a permissão protege a rota, mas a consulta não é registrada |
| Visão consolidada | não há como perguntar "o que este operador fez esta semana" sem varrer processo a processo |
| Retenção e expurgo | sem política aplicada à trilha |

---

## 6. Requisitos da auditoria ampla futura

Quando for construída, o PR próprio precisa decidir **todos** os pontos abaixo.
Nenhum é aprovado aqui.

| # | Requisito |
|---|---|
| 6.1 | **Modelo**: tabela dedicada **ou** ampliação formal do `ProcessStatusEvent` — decisão explícita, não improviso. Trilha que não é por processo (login, permissão) provavelmente não cabe no modelo atual. |
| 6.2 | **Tela/consulta admin própria**, com os pontos de aplicação de `audit.view.all` e `audit.view.own`. |
| 6.3 | **Regras de retenção e expurgo** por tipo de registro (`docs/05`, `docs/15 §3.11`). |
| 6.4 | **Filtro por permissão**: `own` mostra só os próprios; `all` mostra tudo; `financial` continua separado. |
| 6.5 | **Redação/PII**: a trilha não pode virar o lugar onde a PII vaza — reusar `redaction.ts`, nunca gravar conteúdo de documento. |
| 6.6 | **Eventos cobertos**: definir a lista, incluindo os de §5 que hoje faltam. |
| 6.7 | **Append-only de verdade** — sem update, sem delete (`docs/05 §11b`). |
| 6.8 | **Log de acesso a PII separado**, conforme `docs/05 §11b`. |

---

## 7. Relação com o Bloco F

| # | Registro |
|---|---|
| 7.1 | **F.8 fecha** — a auditoria foi **revisada** (`docs/68 §3`, §5 daqui), a **lacuna foi registrada** (§2) e o **escopo futuro foi definido** (§6). |
| 7.2 | **Com F.8, o Bloco F está completo** — F.1–F.8 marcados. |
| 7.3 | O Bloco F fecha por **revisão + decisão de escopo**, não por construção — que é exatamente o que `docs/61 §4.F` previa ("confirmar o que já está correto e registrar achados"). |
| 7.4 | **Não marca D nem H.** |
| 7.5 | A condição `docs/61 §5.7` ("segurança / permissions / PII / logs revisados") **passa a estar satisfeita** — mas o encerramento da Fase 1 continua dependendo de **D**, **H** e do documento próprio de fechamento. |

> **Por que fechar é honesto aqui.** F.8 pede *revisar* auditoria, não
> *construir* auditoria. A revisão foi feita e encontrou uma lacuna real; a
> lacuna foi dimensionada, decidida e transferida para escopo futuro com
> requisitos escritos. O que **não** seria honesto é fechar F.8 sem esta página
> — foi por isso que o `docs/68` o deixou aberto.

---

## 8. Relação com produção e com o `docs/23`

A decisão vale para a **Fase 1 (base do SaaS)**, que roda em dev/fictício, sem
cliente real e sem CPF no schema. **Não vale como liberação para tráfego real.**

| # | Registro |
|---|---|
| 8.1 | O **log de acesso a PII** (§2.7, §6.8) é expectativa de LGPD já escrita no `docs/05 §11b` e **não está implementado**. |
| 8.2 | Enquanto não houver cliente real nem PII persistida, o impacto é **baixo** — a superfície de PII hoje é o arquivo de documento. |
| 8.3 | Com **tráfego real**, ele passa a ser **pré-condição de produção**, na mesma família do rate limit distribuído e das 12 pendências do `docs/23 §5`. |
| 8.4 | Este documento **não fecha nenhuma** das 12 pendências do `docs/23 §5`. |
| 8.5 | Quando o CPF entrar no schema (por exemplo, para as certidões externas do CR), §8.3 deixa de ser futuro e vira requisito imediato. |

> **Leitura correta:** F.8 fecha para a **Fase 1**. O log de acesso a PII segue
> aberto como item de **produção** — dois portões diferentes, e fechar um não
> fecha o outro.

---

## 9. Relação com a Fase 9

| # | Registro |
|---|---|
| 9.1 | **Não libera execução real.** |
| 9.2 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false as const`. |
| 9.3 | **Não toca** Gov.br/SINARM/PF. |
| 9.4 | **Não cria** schedule nem heartbeat. |
| 9.5 | A auditoria da Fase 9 (`phase9/auditLogger.ts`) é **outra coisa** — trilha da execução automatizada, em memória, já existente. Nada aqui a altera nem a promove a auditoria de produto. |
| 9.6 | Os gates do `docs/26 §19` seguem íntegros. |

---

## 10. Proibições deste PR

Este PR **não**:

- ❌ altera código;
- ❌ altera permissões ou RBAC;
- ❌ remove `audit.view.all` ou `audit.view.own`;
- ❌ cria modelo, tabela ou tela de auditoria;
- ❌ altera banco;
- ❌ cria migration;
- ❌ altera Prisma;
- ❌ altera UI;
- ❌ altera rotas;
- ❌ altera testes;
- ❌ altera `package.json`;
- ❌ altera a política de captcha;
- ❌ altera a Fase 9;
- ❌ fecha os blocos D ou H;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ usa `db:push`.

---

> **Fecho.** A auditoria da Fase 1 é o que já existe: `ProcessStatusEvent`,
> append-only, por processo, com ator e papel, sem PII no conteúdo — mais
> `audit.view.financial`, que protege o relatório financeiro de verdade.
> `audit.view.all` e `audit.view.own` passam a ser lidos como **reserva de
> vocabulário**: nomeiam capacidade ainda não construída e **não concedem
> acesso a nada**. A **Fase 1 não constrói auditoria ampla**; a lacuna é aceita
> e fica registrada aqui, com os **8 requisitos** que o PR futuro terá de
> decidir. O **log de acesso a PII** do `docs/05 §11b` continua aberto como
> item de **produção**, não de Fase 1. Com isso **F.8 fecha e o Bloco F fica
> completo**, os blocos **D e H seguem abertos**, a **Fase 1 continua NÃO
> encerrada**, a **Fase 2 não abre**, `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false` e os gates do `docs/26 §19` seguem íntegros.
