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
| 3.9 | Cliente novo já tem **alguma** ramificação | 🟡 | `ClientStartPanel` (variantes `full`/`compact`) + `semPedidos` no dashboard — entrega boas-vindas, **não** escolha de processo (§4.B) |
| 3.10 | Execução real Gov.br/SINARM/PF bloqueada | ✅ | Gates do `docs/26 §19` abertos; nenhum acesso real no app |
| 3.11 | `PHASE9_REAL_EXECUTION_ENABLED` segue `false` | ✅ | `src/server/automation/phase9/safety.ts` (`false as const`) |

**Leitura correta de 3.9:** "avançado" significa **a estrutura existe**, não que
o requisito está atendido. O item continua **pendente** no §4.B.

---

## 4. Pendências obrigatórias antes de encerrar a Fase 1

Todos os itens abaixo estão **pendentes**. Nenhum está marcado como feito.
Marcar um item exige o PR correspondente mergeado **ou** uma decisão documentada
que o resolva explicitamente.

### A. Número interno do processo

- [x] A.1 — Decidir o **formato amigável futuro** do `Process.code`. → **`CAC-YYYY-NNNNNN`** ([`docs/62 §3`](62-decisao-formato-numero-interno-processo.md))
- [x] A.2 — Exemplo aceitável de formato: `CAC-2026-000001` (`docs/60 §8.4`). → **adotado**, com sequência **global monotônica** que não reinicia por ano (`docs/62 §4`)
- [x] A.3 — Decidir o **tratamento dos códigos antigos** `GT-DEV-…` (manter como estão vs. renumerar). → **preservar como estão**, sem backfill e sem migration de reescrita (`docs/62 §5`)
- [ ] A.4 — Implementar o ajuste técnico em **PR separado**, se decidido.
- [ ] A.5 — Garantir **exibição para cliente e admin**.
- [ ] A.6 — Garantir **consulta admin por número interno**.

> **Decidido em 2026-08-04 pelo [`docs/62`](62-decisao-formato-numero-interno-processo.md):**
> A.1–A.3 estão **resolvidos**. **A.4–A.6 continuam pendentes** — a
> implementação do gerador é PR técnico próprio, ainda não aprovado. Com isso,
> a condição **§5.6** ("número interno amigável estiver decidido") passa a
> estar satisfeita; **a Fase 1 continua NÃO encerrada**, pois as demais
> pendências (B–H) e A.4–A.6 seguem abertas.
>
> **Nota de escopo (verificado em `docs/60 §2`/`§8.1`):** A.5 e A.6 **já estão
> atendidos hoje** — o cliente vê o código no dashboard e no detalhe, e o admin
> filtra a fila por código. Ficam no checklist como **verificação de não
> regressão**: se A.4 trocar o gerador, exibição e consulta precisam continuar
> funcionando. A pendência **nova** real é A.1–A.3.

### B. Entrada do cliente novo

- [ ] B.1 — Melhorar a tela inicial para **cliente sem processos**.
- [ ] B.2 — Priorizar a pergunta **"Qual processo você deseja realizar?"**.
- [ ] B.3 — **Não destacar** lista vazia de "Meus processos".
- [ ] B.4 — Exibir **opções simples de processo**.
- [ ] B.5 — Manter **ajuda visível**.

> Evoluir o `ClientStartPanel`/dashboard existentes — **sem criar um segundo
> caminho paralelo** (`docs/60 §6`).

### C. Nomes amigáveis dos processos

- [ ] C.1 — Revisar as **labels exibidas ao cliente**.
- [ ] C.2 — Evitar termos técnicos como foco principal.
- [ ] C.3 — Manter **códigos técnicos internamente** (ex.: `GUIA_TRAFEGO_PF_CAC`).
- [ ] C.4 — Usar **linguagem simples** na escolha de processo e no acompanhamento.

> Continua valendo `docs/24`: sem jargão de dev, sem status cru, sem erro
> técnico exposto ao cliente.

### D. Separação cliente/admin

- [ ] D.1 — Revisar a **experiência de entrada**.
- [ ] D.2 — Deixar claro o **acesso de cliente comum**.
- [ ] D.3 — Deixar claro o **acesso admin/equipe interna**.
- [ ] D.4 — Garantir que o **cliente não veja área administrativa**.
- [ ] D.5 — Garantir que o admin continue sob **RBAC/permissions**.

> **Verificado:** D.4 e D.5 já são garantidos por permissão hoje (`USER: []` em
> `ROLE_PERMISSIONS`); a pendência real é D.1–D.3 — hoje existe **uma única**
> entrada pública (`/login`), sem distinção de experiência (`docs/60 §5`).

### E. Área de ajuda

- [ ] E.1 — Definir a **estrutura mínima** da área de ajuda.
- [ ] E.2 — Priorizar **vídeos tutoriais**.
- [ ] E.3 — **Reduzir texto longo**.
- [ ] E.4 — Conectar a ajuda com os **processos mais comuns**.
- [ ] E.5 — **Não** transformar a ajuda em atendimento manual obrigatório.

> A rota `/ajuda` já existe e já é linkada do painel do cliente — a pendência é
> **conteúdo e estrutura**, não criação de página.

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
