# 74 — Máquina de estados da automação sintética — Fase 2

> **O que é este documento.** A **máquina de estados** da automação sintética da
> Fase 2, prevista no [`docs/73 §12.1`](73-contrato-sessao-sintetica-fase-2.md):
> quais estados existem, quem move cada um, o que é terminal, o que é transição
> **proibida** e que evento cada transição emite.
>
> **É máquina de estados SINTÉTICA.** Descreve o que acontece **dentro do
> laboratório local**. **Não** define fluxo real de Gov.br/SINARM/PF — esse não
> existe em documento nenhum e não é criado aqui.
>
> - ❌ **NÃO implementa** tipo, máquina, validador, evento ou teste.
> - ❌ **NÃO abre** execução real e **NÃO** acessa Gov.br/SINARM/PF.
> - ❌ **NÃO usa** CPF real, senha, OTP, cookie, `storageState` ou credencial
>   Gov.br real.
> - ❌ **NÃO altera** a Fase 9, `PHASE9_REAL_EXECUTION_ENABLED`, allowlist ou
>   `networkGuard`.
> - ❌ **NÃO altera** `src`, `prisma`, `tests`, `package.json`,
>   `package-lock.json`, `.env`, `docs/25`, `docs/26` ou `docs/70`.
>
> **Data:** 2026-08-06
> **Base da `main`:** `f85af46` — *docs: specify synthetic session contract (#142)*
> **Referências:** [`docs/71`](71-decisao-arquitetura-sessao-fase-2.md) (decisão
> de arquitetura), [`docs/72`](72-desenho-laboratorio-sintetico-automacao-fase-2.md)
> (desenho do laboratório), [`docs/73`](73-contrato-sessao-sintetica-fase-2.md)
> (contrato de sessão), [`docs/37`](37-fase-8d-log-seguro-e-relatorio.md)
> (redação e relatório), [`docs/30 §3`](30-fase-8c-excecoes-sinteticas.md)
> (cenários), [`docs/26 §19`](26-arquitetura-automacao-hibrida.md) (gates),
> [`docs/23 §5`](23-checklist-piloto-real.md) (12 pendências).

---

## 1. Status

| # | Registro |
|---|---|
| 1.1 | **A Fase 2 segue apenas como laboratório e preparação.** |
| 1.2 | **Baseado nos `docs/71`, `docs/72` e `docs/73`.** |
| 1.3 | **Define máquina de estados SINTÉTICA.** |
| 1.4 | **Não define fluxo real Gov.br/SINARM/PF** — nem por analogia. |
| 1.5 | **Não abre execução real.** |
| 1.6 | **Não altera a Fase 9** (§15). |
| 1.7 | **Definição, não implementação.** Docs-only. |
| 1.8 | **Estende o conjunto de estados do `docs/73`** em dois pontos — declarados na §14.1 e **reconciliados no próprio `docs/73`, neste mesmo PR**. |

---

## 2. Objetivo

| # | Objetivo |
|---|---|
| 2.1 | **Formalizar os estados permitidos** da automação sintética. |
| 2.2 | **Impedir transição improvisada** — o que não está na tabela §7 não acontece. |
| 2.3 | **Separar falha, bloqueio, expiração, cancelamento e sucesso** — cinco desfechos distintos, não um balde de "deu errado". |
| 2.4 | **Permitir testes determinísticos** (§10 do `docs/73`). |
| 2.5 | **Preparar a implementação futura local/sintética** (§16). |

> **Por que separar os cinco desfechos.** Porque respondem perguntas
> diferentes: `FAILED` é defeito nosso ou do cenário; `BLOCKED` é o desenho
> **funcionando** (captcha parou a automação); `EXPIRED` é prazo; `CANCELLED` é
> decisão humana; `COMPLETED` é sucesso. Colapsá-los em "erro" apagaria
> justamente o sinal que o laboratório existe para produzir.

---

## 3. Entidades conceituais

Sem schema — descrição, como no `docs/73`.

| Entidade | O que é |
|---|---|
| **`syntheticSession`** | A sessão sintética do `docs/73`: o handle opaco, seu escopo, prazo e estado. Uma por handoff. |
| **`syntheticRun`** | Uma execução do motor sobre uma sessão. Tem começo, fim e desfecho (§5). |
| **`syntheticStep`** | Uma etapa dentro do run — seleção de serviço, documento, revisão (§6). |
| **`syntheticEvidence`** | Artefato produzido: screenshot sintético, HTML redigido, protocolo fictício, relatório (§13). |
| **`syntheticAuditEvent`** | Registro append-only de uma transição (§12). |

**Cardinalidade:** uma `syntheticSession` tem **um** `syntheticRun`; um run tem
**muitos** `syntheticStep`; cada step pode produzir `syntheticEvidence`; toda
transição de qualquer entidade emite `syntheticAuditEvent`.

> **Um run por sessão, de propósito.** Retentar exige **nova sessão sintética**
> (§9). Se um run pudesse recomeçar sobre a mesma sessão, o handle sobreviveria
> ao próprio desfecho — que é exatamente o que o `docs/73 §5.9/§5.10` proíbe.

---

## 4. Estados da sessão sintética

| Estado | Significado | Quem move | Terminal |
|---|---|---|---|
| **`CREATED`** | Handle emitido pelo portal sintético; ninguém reivindicou | portal sintético | não |
| **`CLAIMED`** | Motor reivindicou o handle, **uma única vez** | motor sintético | não |
| **`IN_PROGRESS`** | Motor executando etapas dentro do `scope`, contra `localhost` | motor sintético | não |
| **`COMPLETED`** | Jornada sintética concluída; **único** estado que admite protocolo (`PROT-FICT-*`) | motor sintético | **sim** |
| **`EXPIRED`** | `expiresAt` vencido — vale mesmo no meio de etapa | relógio (avaliado na transição) | **sim** |
| **`CANCELLED`** | Interrupção deliberada, humana ou do sistema | humano ou sistema | **sim** |
| **`BLOCKED`** | Captcha sintético bloqueou; degradou para humano | motor sintético | **não** (§14.1) |
| **`FAILED`** | Falha sintética (§11) — sem protocolo, sempre | motor sintético | **sim** |

**Eventos por estado alcançado:** `CREATED` → `synthetic_session_created` ·
`CLAIMED` → `synthetic_session_claimed` · `COMPLETED` →
`synthetic_session_completed` · `EXPIRED` → `synthetic_session_expired` ·
`CANCELLED` → `synthetic_session_cancelled` · `BLOCKED` →
`synthetic_session_blocked_by_captcha` · `FAILED` →
`synthetic_session_failed`. `IN_PROGRESS` emite os eventos de etapa (§12).

---

## 5. Estados do run sintético

| Estado | Significado |
|---|---|
| **`NOT_STARTED`** | Run criado, motor ainda não começou |
| **`RUNNING`** | Executando etapa |
| **`WAITING_SYNTHETIC_HANDOFF`** | Aguardando o handoff sintético — a automação **abre e para** (`docs/72 §7.2`) |
| **`WAITING_SYNTHETIC_STEP`** | Aguardando etapa sintética (pausa humana, confirmação de ato sensível) |
| **`BLOCKED_BY_SYNTHETIC_CAPTCHA`** | Captcha sintético bloqueou (§10) |
| **`FAILED`** | Falha sintética (§11) |
| **`COMPLETED`** | Run concluído com sucesso |
| **`CANCELLED`** | Run interrompido deliberadamente |
| **`EXPIRED`** | Handle venceu durante o run |

> **Espera não é execução.** `WAITING_SYNTHETIC_HANDOFF` e
> `WAITING_SYNTHETIC_STEP` existem para tornar visível o momento em que o motor
> **não está agindo** — que é onde o humano entra. Um run que nunca espera é um
> run que nunca pediu confirmação.

---

## 6. Estados de etapa sintética

| Estado | Significado |
|---|---|
| **`PENDING`** | Etapa prevista, não iniciada |
| **`STARTED`** | Etapa em execução |
| **`COMPLETED`** | Etapa concluída |
| **`SKIPPED`** | Etapa pulada por decisão do cenário — **nunca** para contornar bloqueio |
| **`FAILED`** | Etapa falhou |
| **`BLOCKED`** | Etapa bloqueada (captcha sintético) |
| **`EXPIRED`** | Handle venceu durante a etapa |

Alinhados aos `LAB_STEP_STATUSES` já existentes (`OK`, `FALHOU`, `BLOQUEADO`,
`PULADO`) do `labRunReport.ts` — a implementação futura deve **mapear**, não
criar um segundo vocabulário paralelo.

---

## 7. Transições permitidas

**Sessão sintética.** O que não está aqui **não acontece**.

| # | De | Para | Gatilho |
|---|---|---|---|
| 7.1 | `CREATED` | `CLAIMED` | motor reivindica |
| 7.2 | `CREATED` | `EXPIRED` | prazo vence sem claim |
| 7.3 | `CREATED` | `CANCELLED` | cancelamento antes do claim |
| 7.4 | `CLAIMED` | `IN_PROGRESS` | primeira etapa inicia |
| 7.5 | `CLAIMED` | `EXPIRED` | prazo vence antes de executar |
| 7.6 | `CLAIMED` | `CANCELLED` | cancelamento após claim |
| 7.7 | `IN_PROGRESS` | `COMPLETED` | jornada sintética concluída |
| 7.8 | `IN_PROGRESS` | `BLOCKED` | captcha sintético |
| 7.9 | `IN_PROGRESS` | `FAILED` | falha sintética (§11) |
| 7.10 | `IN_PROGRESS` | `EXPIRED` | prazo vence durante execução |
| 7.11 | `IN_PROGRESS` | `CANCELLED` | interrupção deliberada |
| 7.12 | `BLOCKED` | `CANCELLED` | humano encerra após o bloqueio |
| 7.13 | `BLOCKED` | `FAILED` | bloqueio tratado como falha do cenário |
| 7.14 | `BLOCKED` | `EXPIRED` | prazo vence com a sessão bloqueada |

```
CREATED ──▶ CLAIMED ──▶ IN_PROGRESS ──▶ COMPLETED ✦
   │           │             │
   │           │             ├──▶ BLOCKED ──┬──▶ CANCELLED ✦
   │           │             │              ├──▶ FAILED    ✦
   │           │             │              └──▶ EXPIRED   ✦
   │           │             ├──▶ FAILED    ✦
   │           │             ├──▶ EXPIRED   ✦
   │           │             └──▶ CANCELLED ✦
   ├───────────┼─────────────────▶ EXPIRED  ✦
   └───────────┴─────────────────▶ CANCELLED ✦

✦ = terminal
```

**Run e etapa** seguem a sessão: run entra em `RUNNING` só com a sessão em
`IN_PROGRESS`; etapa só sai de `PENDING` com o run em `RUNNING`. Sessão em
estado terminal ⇒ run e etapas **congelam** no estado em que estiverem.

---

## 8. Transições proibidas

| # | Proibido | Por quê |
|---|---|---|
| 8.1 | `COMPLETED` → `IN_PROGRESS` | terminal não reabre (§9) |
| 8.2 | `FAILED` → `IN_PROGRESS` | idem — retentar exige **nova** sessão |
| 8.3 | `EXPIRED` → `IN_PROGRESS` | seria renovação silenciosa (`docs/73 §5.9`) |
| 8.4 | `CANCELLED` → `IN_PROGRESS` | cancelamento é decisão, não pausa |
| 8.5 | `BLOCKED` → `COMPLETED` | **sem evento de desbloqueio sintético decidido**, e esse evento **não existe hoje** (§10.2) |
| 8.6 | `BLOCKED` → `IN_PROGRESS` | seria "seguir apesar do captcha" — o bypass por outro nome |
| 8.7 | `CLAIMED` → `CLAIMED` | claim é único; segundo claim é falha, não substituição (`docs/73 §5.2`) |
| 8.8 | **qualquer estado** → **execução real** | a máquina é sintética; não há aresta para o real |
| 8.9 | **qualquer estado** → **Gov.br/SINARM/PF real** | bloqueio duro do `phase9/networkGuard.ts:22`, mesmo via allowlist |
| 8.10 | **qualquer estado** → **uso de senha, cookie, OTP ou credencial** | campos proibidos do `docs/73 §4`; nenhum estado os introduz |
| 8.11 | terminal → terminal | não se "corrige" desfecho depois; registra-se outro evento, não outro estado |

> **8.5 e 8.6 são a mesma regra vista de dois ângulos.** Sair de `BLOCKED` para
> frente exigiria alguém decidir o que significa "desbloquear" — e essa decisão
> **não foi tomada** (`docs/72 §7.10`, `docs/73 §5.7`). Enquanto não for, as
> únicas saídas de `BLOCKED` são `CANCELLED`, `FAILED` e `EXPIRED`: para o lado
> e para trás, nunca para frente.

---

## 9. Estados terminais

**`COMPLETED` · `FAILED` · `EXPIRED` · `CANCELLED`**

| # | Regra |
|---|---|
| 9.1 | **Não reabrem** — nenhuma transição sai deles (§8.1–8.4, §8.11). |
| 9.2 | **Não renovam** — handle vencido não ganha prazo novo (`docs/73 §5.9`). |
| 9.3 | **Não reexecutam silenciosamente** — não há retry automático. |
| 9.4 | **Nova tentativa exige nova sessão sintética** — novo handle, novo `issuedAt`, novo `auditCorrelationId`, novo evento `synthetic_session_created`. |
| 9.5 | Alcançado o terminal, o handle é **invalidado e descartado**, com descarte **verificado** (`docs/73 §5.10`, `docs/42 §8`). |

`BLOCKED` **não é terminal** aqui — ver §14.1.

---

## 10. Bloqueio por captcha sintético

| # | Regra |
|---|---|
| 10.1 | **Captcha sintético é bloqueio**, não desafio a resolver. |
| 10.2 | **Não existe evento de desbloqueio** — nem manual, nem automático. Criar um exigiria decisão própria, em PR próprio. |
| 10.3 | **Não existe bypass** — nem 2captcha, anti-captcha, resolvedor externo ou evasão. |
| 10.4 | **Não existe "modo teste que pula"** — nem flag, nem env, nem atalho de fixture. |
| 10.5 | **Emite evento e evidência sintética** de bloqueio (§12, §13). |
| 10.6 | **Resultado esperado é `BLOCKED`, nunca `COMPLETED`.** O teste afirma o **bloqueio** como sucesso (`docs/72 §10.7`). |
| 10.7 | Degradação para humano é o comportamento **correto** — não é falha do desenho. |

> **A tentação a nomear.** "É captcha fake, então pode pular." O caminho que
> pula o captcha sintético é **o mesmo código** que pularia o real. Por isso ele
> não deve existir — nem em teste, nem atrás de flag.

---

## 11. Falhas sintéticas

Todas levam a `FAILED` (ou a etapa `FAILED`), **nunca a protocolo**.

| # | Falha | Observação |
|---|---|---|
| 11.1 | **Timeout** | prazo de etapa estourado |
| 11.2 | **Etapa indisponível** | etapa fora do `scope` ou ausente |
| 11.3 | **Evidência inválida** | artefato fora de `tests/e2e/artifacts` → `[ARTEFATO_FORA_DO_LAB]` |
| 11.4 | **Campo proibido** | qualquer um do `docs/73 §4` |
| 11.5 | **URL externa** | fora de `localhost`/`127.0.0.1` |
| 11.6 | **Ambiente inválido** | `environment` diferente de `synthetic`/`local`/`test` |
| 11.7 | **Scope inválido** | vazio, genérico ou fora da lista sintética |
| 11.8 | **Handle expirado** | leva a `EXPIRED`, não a `FAILED` — prazo não é defeito |
| 11.9 | **Tentativa de credencial real** | senha, OTP, cookie, `storageState`, token |
| 11.10 | **Tentativa de dado real** | CPF, RG, documento, PDF, HTML ou screenshot reais |

> **11.9 e 11.10 são alarme, não ruído** (`docs/73 §9.8`). Significam que algum
> caminho tentou trazer dado real para dentro do laboratório — o sinal mais
> valioso que a máquina pode emitir. Rejeitar em silêncio o desperdiçaria.

---

## 12. Eventos emitidos por transição

| Transição | Evento |
|---|---|
| → `CREATED` | `synthetic_session_created` |
| `CREATED` → `CLAIMED` | `synthetic_session_claimed` |
| etapa → `STARTED` | `synthetic_session_step_started` |
| etapa → `COMPLETED` | `synthetic_session_step_completed` |
| → `BLOCKED` | `synthetic_session_blocked_by_captcha` |
| → `FAILED` | `synthetic_session_failed` |
| → `EXPIRED` | `synthetic_session_expired` |
| → `CANCELLED` | `synthetic_session_cancelled` |
| → `COMPLETED` | `synthetic_session_completed` |

**Cada evento carrega:** `auditCorrelationId` · `processId` · `actorId` ·
**estado anterior** · **estado novo** · `timestamp` · etapa sintética (se
houver) · **motivo redigido**.

**Nenhum evento carrega:** PII · segredo · cookie · senha · screenshot real ·
o `sessionHandle` em claro (`docs/73 §3.1`).

> **Estado anterior + estado novo em todo evento.** É o que torna a trilha
> auditável sem reconstrução: lendo os eventos em ordem, a máquina inteira é
> reproduzível. Sem o par, "falhou" não diz de onde se caiu.

---

## 13. Evidências por estado

| Estado | Evidência admitida |
|---|---|
| **`COMPLETED`** | protocolo fictício (`PROT-FICT-*`), screenshot sintético, relatório |
| **`FAILED`** | relatório redigido, screenshot sintético, erro redigido |
| **`BLOCKED`** | evidência sintética do bloqueio (tela do captcha sintético) |
| **`EXPIRED`** | timestamp e etapa em que parou |
| **`CANCELLED`** | motivo sintético redigido |

| # | Invariante |
|---|---|
| 13.1 | **Nenhum estado anexa evidência real externa** — screenshot de portal real, HTML real ou documento real são proibidos (`docs/73 §4`). |
| 13.2 | **Só `COMPLETED` admite protocolo**, e só o sintético — a mesma porta allow-list do `labRunReport.ts` (`PROTOCOL_ALLOWED_STATUS`). |
| 13.3 | Toda evidência passa pela redação (`docs/37 §4`) e vive sob `tests/e2e/artifacts` ou equivalente local. |

---

## 14. Relação com o `docs/73`

| # | Registro |
|---|---|
| 14.1 | **O contrato define o que entra; a máquina define o que acontece depois.** São camadas, não alternativas. |
| 14.2 | **Nenhum estado adiciona campo** — a lista fechada do `docs/73 §3` continua fechada. |
| 14.3 | **Nenhum evento carrega campo proibido** (`docs/73 §4`). |
| 14.4 | **Nenhum estado contorna a Fase 9** (§15). |
| 14.5 | Os 9 eventos são **os mesmos** do `docs/73 §7` — sem evento novo, sem renomeação. |

### 14.1 Duas extensões ao `docs/73` — declaradas e já reconciliadas

Este documento **estende** o `docs/73` em dois pontos. Ambos são deliberados, e
ficam registrados aqui porque divergência silenciosa entre documentos é pior que
divergência declarada. **Ambos foram reconciliados no próprio `docs/73`, neste
mesmo PR** — a `main` não recebe os dois documentos discordando.

| # | Extensão | `docs/73` **antes** | Regra **agora**, nos dois documentos | Por quê |
|---|---|---|---|---|
| A | **`FAILED` como estado de sessão** | `handoffState` tinha **7** valores, sem `FAILED` | **8** valores, com `FAILED` (`docs/73 §3` · §4 daqui) | O `docs/73 §5.8` já previa "erro sintético", mas sem estado próprio — a falha ficava sem casa. `FAILED` separa **defeito** de **bloqueio**, **prazo** e **decisão humana** (§2.3). |
| B | **`BLOCKED` deixa de ser terminal** | listava `BLOCKED` entre os terminais | `BLOCKED` **não é terminal**; sai para `CANCELLED`, `FAILED` ou `EXPIRED` (`docs/73 §5.12` · §7.12–7.14 daqui) | Uma sessão bloqueada precisa de **desfecho registrado**: quem foi bloqueado ou é encerrado, ou vira falha, ou vence. Terminar em `BLOCKED` deixaria a trilha sem dizer o que aconteceu depois do humano assumir. |

| # | Reconciliação |
|---|---|
| 14.1.1 | **A extensão não afrouxa nada.** `BLOCKED` continua **sem saída para frente**: nada de `COMPLETED`, nada de `IN_PROGRESS` (§8.5, §8.6, `docs/73 §5.13.3`). As saídas novas são laterais ou terminais. |
| 14.1.2 | **`FAILED` não cria campo** — é valor de `handoffState`, que já existe na lista fechada. A lista de campos permitidos continua com **11 campos**, inalterada. |
| 14.1.3 | **O `docs/73 §3`, `§5.7`, `§5.8`, `§5.10` e o diagrama foram atualizados** para os 8 estados e para a nova leitura de `BLOCKED`, mais a nova regra `§5.12` e a justificativa `§5.13`. |
| 14.1.4 | **Divisão de fontes mantida:** esta página é a fonte da **máquina de estados**; o `docs/73` segue sendo a fonte dos **campos permitidos e proibidos** — que nada aqui altera. |
| 14.1.5 | Com a reconciliação feita, **a implementação futura não parte de documentos divergentes** (§16.5). |

---

## 15. Relação com a Fase 9

| # | Registro |
|---|---|
| 15.1 | **`PHASE9_REAL_EXECUTION_ENABLED = false as const`** — `src/server/automation/phase9/safety.ts:32`, inalterado. |
| 15.2 | **A máquina de estados é sintética** — não descreve, não prevê e não prepara execução real. |
| 15.3 | **Não autoriza execução real.** |
| 15.4 | **Não mexe em allowlist.** |
| 15.5 | **Não mexe no `networkGuard`** — `gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` seguem bloqueados mesmo via allowlist (`phase9/networkGuard.ts:22`). |
| 15.6 | **Não fecha gate do `docs/26 §19`**; as 12 pendências do `docs/23 §5` seguem abertas. |
| 15.7 | **Nenhum estado tem aresta para o real** (§8.8, §8.9) — a ausência é estrutural, não configuração. |

---

## 16. Próximo PR depois deste

**Sugerido:** `feat: add synthetic session contract types` — o **primeiro PR de
código** da Fase 2.

| # | Condição |
|---|---|
| 16.1 | **Ainda local/sintético** — `localhost`, dado fictício, sem endpoint externo. |
| 16.2 | **Sem portal real.** |
| 16.3 | **Sem Fase 9** — não toca `phase9/`, `safety.ts`, `networkGuard.ts` nem a flag. |
| 16.4 | **Sem Prisma e sem migration**, a menos que uma decisão posterior autorize explicitamente. O contrato é **em memória** por padrão — persistir sessão é decisão nova, não detalhe. |
| 16.5 | **A implementação deve seguir o `docs/73` e este documento** — que, a partir deste PR, estão **alinhados** (§14.1). |
| 16.6 | **Escopo mínimo sugerido:** tipos + validador puro + testes unitários. Sem motor, sem portal novo, sem Playwright novo. |

---

## 17. Proibições deste PR

Este PR **não**:

- ❌ altera código, `src`, `prisma`, `tests`, `package.json`, `package-lock.json` ou `.env`;
- ❌ cria migration nem usa `db:push`;
- ❌ implementa máquina, tipo, evento, validador ou teste;
- ❌ acessa Gov.br, SINARM ou PF;
- ❌ usa CPF, senha, OTP, cookie, `storageState` ou credencial reais;
- ❌ altera a política de captcha — que continua **nunca burlar**;
- ❌ altera a Fase 9, `PHASE9_REAL_EXECUTION_ENABLED`, allowlist ou `networkGuard`;
- ❌ altera `docs/25`, `docs/26` ou `docs/70` — o **`docs/73` é alterado de propósito**, e **apenas** para a reconciliação da §14.1 (estados e transições), sem tocar nas listas de campos permitidos e proibidos;
- ❌ abre execução real, cliente real ou produção;
- ❌ fecha gate do `docs/26 §19` nem pendência do `docs/23 §5`.

---

> **Fecho.** A máquina de estados sintética tem **8 estados de sessão**, **9 de
> run** e **7 de etapa**; **14 transições permitidas** e **11 proibidas**, entre
> elas toda aresta para execução real, para Gov.br/SINARM/PF e para uso de
> senha, cookie, OTP ou credencial. Os terminais são **`COMPLETED`, `FAILED`,
> `EXPIRED` e `CANCELLED`**: não reabrem, não renovam, não reexecutam — nova
> tentativa exige **nova sessão sintética**. `BLOCKED` **não tem saída para
> frente**: captcha sintético é bloqueio, não desafio, e não existe evento de
> desbloqueio, bypass nem "modo teste que pula". Cada transição emite um dos **9
> eventos** do `docs/73 §7`, sempre com **estado anterior e estado novo**, e
> nunca com PII, segredo, cookie ou screenshot real. **Duas extensões ao
> `docs/73` estão declaradas na §14.1 — e reconciliadas no próprio `docs/73`,
> neste mesmo PR**, para que a `main` não receba dois documentos discordando em
> ponto normativo; as listas de **campos permitidos e proibidos ficam
> intactas**. `PHASE9_REAL_EXECUTION_ENABLED`
> continua `false as const`, os gates do `docs/26 §19` seguem íntegros, as 12
> pendências do `docs/23 §5` seguem abertas e a Fase 2 continua sendo
> **laboratório e preparação**.
