# 70 — Encerramento da Fase 1 — Base do SaaS

> **O que é este documento.** O **fechamento oficial da Fase 1 (Base do SaaS)**,
> previsto no [`docs/61 §5`](61-checklist-encerramento-fase-1-base-do-saas.md)
> como o **único** instrumento capaz de declarar a fase encerrada. Percorre o
> **§4 bloco a bloco** e o **§5 condição a condição**, registrando a evidência de
> cada um.
>
> **Encerrar a Fase 1 NÃO libera nada.**
>
> - ❌ **NÃO abre** a Fase 2 como **execução real**.
> - ❌ **NÃO libera** automação real de portal público.
> - ❌ **NÃO toca** Gov.br/SINARM/PF.
> - ❌ **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false as const`.
> - ❌ **NÃO fecha** nenhuma das 12 pendências do [`docs/23 §5`](23-checklist-piloto-real.md).
> - ❌ **NÃO altera** código, banco, Prisma, migration, auth, captcha ou testes.
>
> **Data:** 2026-08-05
> **Base da `main`:** `9293c4d` — *feat: separate client and team entry (#138)*
> **Escopo encerrado:** **Fase 1 oficial — Base do SaaS** (`docs/60 §11`), que
> corresponde às fases técnicas 1–7 mais os blocos de cancelamento, financeiro e
> UX (`docs/44`–`docs/59`).

---

## 1. Status

| # | Registro |
|---|---|
| 1.1 | **A Fase 1 (Base do SaaS) está ENCERRADA**, por este documento. |
| 1.2 | Todos os **8 blocos (A–H)** do `docs/61 §4` estão fechados (§2, §3). |
| 1.3 | Todas as **9 condições** do `docs/61 §5` estão satisfeitas (§4). |
| 1.4 | **NÃO abre a Fase 2 como execução real** (§7). |
| 1.5 | **NÃO libera** automação real de Gov.br/SINARM/PF. |
| 1.6 | **A Fase 9 continua bloqueada** (§8). |
| 1.7 | Este documento é **docs-only**: não altera uma linha de código. |

> **O que "encerrada" significa aqui.** Que a **base do SaaS** — cadastro, auth,
> permissões, processos, documentos, pagamento, status, auditoria, segurança,
> dashboard, admin, cancelamento, financeiro read-only, documentação e decisões
> de UX — está completa o bastante para o produto seguir para a próxima fase.
> **Não** significa que o produto está pronto para cliente real: isso continua
> dependendo das **12 pendências do `docs/23 §5`**, todas abertas (§6).

---

## 2. O que foi fechado

| Bloco | Escopo | Itens |
|---|---|---|
| **A** | Número interno amigável do processo | 6/6 ✅ |
| **B** | Tela inicial do cliente novo | 5/5 ✅ |
| **C** | Nomes amigáveis dos processos | 4/4 ✅ |
| **D** | Separação cliente/admin | 5/5 ✅ |
| **E** | Área de ajuda | 5/5 ✅ |
| **F** | Segurança, PII, logs e permissões | 8/8 ✅ |
| **G** | Pagamentos base e GRU administrada | 6/6 ✅ |
| **H** | Documentação final | 6/6 ✅ (§5) |

**Total: 45 itens, todos fechados.**

---

## 3. Evidências por bloco

| Bloco | Decisão | Implementação | Resultado |
|---|---|---|---|
| **A** | [`docs/62`](62-decisao-formato-numero-interno-processo.md) (PR #127) | PR **#128** | `CAC-YYYY-NNNNNN` via sequence Postgres; códigos `GT-DEV-…` preservados, sem backfill |
| **B** | [`docs/63`](63-decisao-tela-inicial-cliente-novo-escolha-processo.md) (PR #129) | PR **#130** | `ClientStartPanel` abre com "Qual processo você deseja realizar?"; lista vazia deixou de ser o foco |
| **C** | `docs/60 §8` | PR **#132** | Nome de exibição separado do código técnico; `LAUNCH_PROCESS_CODES` e `ProcessType.name` intactos |
| **D** | [`docs/64`](64-decisao-login-federado-captcha-rate-limit.md) (PR #131) + [`docs/65`](65-decisao-transicao-contas-senha-login-federado.md) (PR #134) | PR **#138** | `/login` do cliente e `/equipe` da equipe, mesma sessão e política; `entryPaths.ts`; 18 testes |
| **E** | — | PR **#133** | `/ajuda` vídeo-first, 5 seções em ordem de prioridade, ajuda por processo |
| **F** | [`docs/68`](68-revisao-seguranca-pii-logs-fase-1.md) (PR #136) + [`docs/69`](69-decisao-escopo-auditoria-fase-1.md) (PR #137) | — (revisão) | Nenhum achado bloqueante; F.8 fechado por decisão de escopo da auditoria |
| **G** | [`docs/67`](67-decisao-pagamentos-gru-admin-mvp.md) (PR #135) | — (confirmação) | Pix via Mercado Pago; cartão aprovado sem implementação; boleto fora; GRU administrada internamente |
| **H** | **este documento** | — | §5 |

---

## 4. As 9 condições do `docs/61 §5`, uma a uma

O `docs/61 §5` exige que este documento percorra cada condição com evidência.
São **conjuntivas**: uma falsa impediria o encerramento.

| # | Condição | Evidência | Estado |
|---|---|---|---|
| **5.1** | Itens do §4 decididos ou implementados | 45/45 itens `[x]`; blocos A–H fechados (§2, §3) | ✅ |
| **5.2** | Pendências futuras separadas em docs próprios | `docs/54` (reembolso), `docs/59` (CSV), `docs/64 §7/§8` (captcha, rate limit), `docs/67 §3.3/§6/§8` (cartão, `/admin/grus`, BB), `docs/69 §6/§8` (auditoria ampla, log de PII) — **e §6 deste documento**, que registra as residuais | ✅ |
| **5.3** | Nenhum fluxo manual compensando produto incompleto | Ver a análise abaixo | ✅ |
| **5.4** | Cliente novo com entrada clara | Bloco B (PR #130): pergunta como `<h1>`, cards de escolha, lista vazia secundária | ✅ |
| **5.5** | Admin separado do fluxo de cliente | Bloco D (PR #138): `/equipe` própria, destino e logout por perfil, `USER: []` intacto | ✅ |
| **5.6** | Número interno amigável **decidido** | `docs/62` decidiu e o PR #128 implementou — a condição pedia só a decisão | ✅ |
| **5.7** | Segurança / permissions / PII / logs revisados | `docs/68`: sem achado bloqueante; `docs/69` fechou F.8 | ✅ |
| **5.8** | `PHASE9_REAL_EXECUTION_ENABLED` continua `false` | `phase9/safety.ts:32` → `false as const`, hard-coded | ✅ |
| **5.9** | Execução real Gov.br/SINARM/PF continua bloqueada | `networkGuard.ts:22` bloqueia `gov.br`, `servicos.pf`, `sinarm`, `acesso.gov` **mesmo se adicionados à allowlist**; `phase9Runner` não abre navegador nem faz rede externa | ✅ |

### 4.1 A condição 5.3 merece justificativa, não só um ✅

Existem **fluxos manuais** no produto hoje: a execução do processo no SINARM é
feita por uma pessoa fora do app (`ManualExecution`, fase técnica 7), e a **GRU
é paga manualmente** pela equipe interna (`docs/67 §5`).

A pergunta da condição é se esses fluxos **compensam produto incompleto**. Não
compensam — eles **são o modelo decidido para esta fase**:

| # | Razão |
|---|---|
| 4.1.1 | O escopo da Fase 1 (`docs/61 §2`) **não inclui automação**. Automação é a **Fase 2** (`docs/60 §11`). |
| 4.1.2 | O `docs/25 §2` chama o modelo manual assistido de **"o estado atual e a ponte"** — decisão registrada, não lacuna. |
| 4.1.3 | O pagamento manual da GRU foi **decidido explicitamente** no `docs/67 §5`, com a automação bancária **deliberadamente fora do MVP** (`docs/67 §8`). |
| 4.1.4 | O app **registra e audita** o que a pessoa fez; ele não finge ter feito. |

> **A leitura correta de "produto incompleto" é "escopo da Fase 1 incompleto",
> não "visão final incompleta".** Sob a segunda leitura nenhuma fase intermediária
> poderia fechar jamais — e o `docs/61 §2` existe justamente para delimitar o que
> a Fase 1 tinha de entregar.

### 4.2 Nota honesta sobre a 5.2

Parte das pendências residuais **não tinha documento próprio** até agora — foram
levantadas ao longo das revisões e viviam apenas em nota de PR. **A §6 deste
documento é o que as separa formalmente.** A condição 5.2 passa a ser satisfeita
**por este documento**, não antes dele.

---

## 5. Bloco H — item a item

| Item | Evidência | Estado |
|---|---|---|
| **H.1** — `docs/00` atualizado | Índice contínuo de `docs/00` a `docs/69`, sem lacuna; atualizado a cada PR desta série e por este | ✅ |
| **H.2** — `docs/60` registrado | `docs/00`, linha 184 | ✅ |
| **H.3** — Checklist da Fase 1 registrado | `docs/00`, linha 197 (`docs/61`) | ✅ |
| **H.4** — Pendências futuras em docs próprios | Mesmas evidências da condição 5.2, mais a §6 daqui | ✅ |
| **H.5** — Fase 2 descrita **sem execução real** | `docs/60 §11` descreve a Fase 2 como "Motor de automação"; `docs/60 §12.3` registra que ela **NÃO deve abrir execução real** | ✅ |
| **H.6** — Fase 9 real continua bloqueada | §4 (5.8/5.9) e §8 | ✅ |

---

## 6. O que este encerramento NÃO libera

Nada abaixo é autorizado por este documento. A lista é **normativa**, não
informativa:

| # | Continua bloqueado / não implementado |
|---|---|
| 6.1 | **Execução real Gov.br/SINARM/PF** |
| 6.2 | **Automação real de portal público** |
| 6.3 | **Automação de pagamento no Banco do Brasil** (`docs/67 §8`) |
| 6.4 | **Pagamento real automatizado da GRU** |
| 6.5 | **Google/OIDC** (`docs/64`, `docs/65` — decidido, não construído) |
| 6.6 | **Captcha** (`docs/64 §7` — decidido, não construído) |
| 6.7 | **Auditoria ampla** (`docs/69` — escopo futuro com 8 requisitos) |
| 6.8 | **CPF/PII adicional** no schema |
| 6.9 | **Certidões externas** (portais fora do SINARM) |
| 6.10 | **Fase 2 como execução real** (§7) |
| 6.11 | **Fase 9** (§8) |
| 6.12 | **Reembolso**, `registerRefund` e chamada de PSP para estorno |
| 6.13 | **Cartão** e **boleto** (`docs/67 §3`) |
| 6.14 | **`/admin/grus`** (`docs/67 §6` — direção, não implementação) |

### 6.1 Pendências futuras, fora da Fase 1

Registradas aqui para **não se perderem** — é o que satisfaz a condição 5.2 para
as residuais (§4.2).

**Pré-condições de produção (bloqueiam tráfego real, não a Fase 1):**

| # | Pendência |
|---|---|
| 6.1.1 | **Log de acesso a PII** (`docs/05 §11b`) — a rota de arquivo de documento não registra acesso. Vira requisito **imediato** quando o CPF entrar no schema |
| 6.1.2 | **Rate limit distribuído** — hoje é memória por instância, zera no restart, e limitar por e-mail permite DoS de conta (`docs/64 §8`) |
| 6.1.3 | **PII/KMS antes do CPF** — coletar CPF exige criptografia em repouso, retenção e need-to-know definidos |
| 6.1.4 | As **12 pendências do `docs/23 §5`**, todas abertas |

**Trabalho futuro decidido, sem PR aprovado:**

| # | Pendência |
|---|---|
| 6.1.5 | **Auditoria ampla** — 8 requisitos em `docs/69 §6` |
| 6.1.6 | **`/admin/grus`** — 11 campos mapeados em `docs/67 §6`, 6 já no schema |
| 6.1.7 | **Cartão** como meio de pagamento (`docs/67 §3.3`) |
| 6.1.8 | **Automação Banco do Brasil** — 9 controles exigidos (`docs/67 §8`) |
| 6.1.9 | **Login federado Google/OIDC** (`docs/64`) e a transição de contas com senha (`docs/65 §2.5`) |

**Descoberta necessária antes de estimar:**

| # | Pendência |
|---|---|
| 6.1.10 | **Descoberta dos portais de certidões externas** — para cada um: existe API oficial? tem captcha? que dados exige? qual a validade da certidão? |
| 6.1.11 | **Política de captcha em automações externas** — a regra permanente de **nunca burlar captcha** (`docs/00 §8`, `docs/25 §7`) **continua valendo integralmente**; qualquer discussão de política exige **PR próprio e separado**, e nada neste documento a altera |
| 6.1.12 | **Laboratório sintético de automação** — evoluir o que existe (`docs/27`–`docs/30`, `docs/37`) antes de qualquer alvo real |

**Polimento (baixo risco, sem urgência):**

| # | Pendência |
|---|---|
| 6.1.13 | `requireAdminRole` ainda redireciona para `/login?motivo=perfil`; com `/equipe` existindo, faria mais sentido apontar para lá |
| 6.1.14 | `MOTIVOS` duplicado entre `/login` e `/equipe` — mantido separado de propósito (públicos diferentes), mas pode virar fonte única |

**Fora da `main`:**

| # | Pendência |
|---|---|
| 6.1.15 | **`docs/66-estado-atual-e-plano-6-meses-automacao-total.md`** existe apenas como arquivo local **untracked**, fora da `main` e de todo o histórico. **Não faz parte deste encerramento** e ainda aguarda decisão de destino. O número **66 permanece ocupado** no índice para não gerar colisão futura |

---

## 7. Fase 2

| # | Registro |
|---|---|
| 7.1 | A Fase 2 (**Motor de automação**, `docs/60 §11`) **pode começar como preparação, laboratório e testes internos**. |
| 7.2 | **NÃO é execução real** — e este documento não a abre como tal. |
| 7.3 | **Phase 9 permanece bloqueada** durante toda a preparação da Fase 2 (§8). |
| 7.4 | **Playwright, se usado, apenas contra `localhost` / laboratório sintético** — nunca alvo real, até que gates futuros digam o contrário. |
| 7.5 | **Qualquer acesso real a Gov.br/SINARM/PF exige os gates próprios** do `docs/26 §19` e **autorização explícita posterior** — que este documento **não** concede. |
| 7.6 | A arquitetura de **como a sessão do cliente chega ao servidor** continua **não especificada** em nenhum documento. É a primeira coisa a resolver na Fase 2, e tudo o mais depende dela. |

---

## 8. Fase 9

| # | Registro |
|---|---|
| 8.1 | **`PHASE9_REAL_EXECUTION_ENABLED = false as const`** — verificado em `src/server/automation/phase9/safety.ts:32`. **Hard-coded, não ligável por env.** |
| 8.2 | **Nenhuma alteração** foi feita na Fase 9 por este documento nem por qualquer PR da série que fechou os blocos D–H. |
| 8.3 | **Encerrar a Fase 1 não afrouxa, não revisa e não fecha essa trava** — é exatamente o que o `docs/61 §5` já registrava sobre 5.8/5.9. |
| 8.4 | O **guard de rede** continua bloqueando `gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` **mesmo que alguém os adicione à allowlist** (`networkGuard.ts:22`). |
| 8.5 | O runner da Fase 9 **não abre navegador**, não acessa rede externa e devolve resultado bloqueado. |
| 8.6 | Os gates do `docs/26 §19` seguem **íntegros**. |
| 8.7 | Ligar a execução real continua exigindo o bloco `docs/34 §16` assinado **mais** alteração deliberada de código sob revisão. |

---

## 9. Critério final

| # | Declaração |
|---|---|
| 9.1 | Os **8 blocos A–H** do `docs/61 §4` estão **fechados** — 45 itens, todos `[x]`. |
| 9.2 | As **9 condições** do `docs/61 §5` estão **satisfeitas**, cada uma com evidência (§4). |
| 9.3 | O **`docs/61` está atualizado** — H.1–H.6 marcados e o status geral registrado. |
| 9.4 | O **`docs/00` está atualizado** — com a entrada deste documento. |
| 9.5 | **A Fase 1 (Base do SaaS) é declarada ENCERRADA** por este documento, e **somente** por ele. |
| 9.6 | Nenhum commit, PR de código ou outro documento pode reivindicar esse encerramento — `docs/61 §5` é explícito. |

---

## 10. Proibições deste PR

Este PR **não**:

- ❌ altera código, `src`, `prisma`, testes, `package.json` ou `package-lock.json`;
- ❌ cria migration;
- ❌ altera auth, login ou sessão;
- ❌ altera a política de captcha;
- ❌ altera a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED`;
- ❌ abre a Fase 2 como execução real;
- ❌ toca Gov.br/SINARM/PF;
- ❌ implementa automação;
- ❌ fecha nenhuma das 12 pendências do `docs/23 §5`;
- ❌ toca o `docs/66`;
- ❌ usa `db:push`.

---

> **Fecho.** A **Fase 1 — Base do SaaS está encerrada**. Os oito blocos foram
> fechados ao longo de doze PRs, e as nove condições conjuntivas do `docs/61 §5`
> estão satisfeitas com evidência registrada aqui, item a item — incluindo a
> 5.3, que exigiu justificar por que os fluxos manuais existentes são **modelo
> decidido** desta fase e não remendo de produto faltando. **Encerrar não
> libera:** execução real de Gov.br/SINARM/PF continua bloqueada,
> `PHASE9_REAL_EXECUTION_ENABLED` continua `false as const`, os gates do
> `docs/26 §19` seguem íntegros, as 12 pendências do `docs/23 §5` seguem abertas
> e a **Fase 2 só pode começar como preparação, laboratório e teste interno**. O
> que muda é o portão: a base do SaaS está pronta o bastante para o produto
> seguir — e o próximo passo real é decidir **como a sessão autenticada do
> cliente chega ao servidor**, sem a qual o motor de automação não sai do papel.
