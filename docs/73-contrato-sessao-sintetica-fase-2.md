# 73 — Contrato de sessão sintética — Fase 2

> **O que é este documento.** A **especificação do contrato de sessão
> sintética** da Fase 2, prevista no [`docs/72 §13.1`](72-desenho-laboratorio-sintetico-automacao-fase-2.md):
> a **lista fechada** de campos permitidos, a **lista explícita** de campos
> proibidos e o **ciclo de vida** do `sessionHandle` sintético.
>
> **É contrato SINTÉTICO, não contrato real.** Descreve o que o motor do
> **laboratório local** pode receber. Um contrato para sessão real, se um dia
> existir, é outro documento, depois de outros gates.
>
> - ❌ **NÃO implementa** tipo, schema, validador, teste ou migration.
> - ❌ **NÃO abre** execução real e **NÃO** acessa Gov.br/SINARM/PF.
> - ❌ **NÃO usa** CPF real, senha, OTP, cookie, `storageState` ou credencial
>   Gov.br real.
> - ❌ **NÃO altera** a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED` — segue
>   `false as const`.
> - ❌ **NÃO altera** `src`, `prisma`, `tests`, `package.json`,
>   `package-lock.json`, `.env`, `docs/25`, `docs/26` ou `docs/70`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `f71843a` — *docs: design synthetic automation lab (#141)*
> **Referências:** [`docs/71 §5.3`](71-decisao-arquitetura-sessao-fase-2.md) (a
> decisão de criar um contrato abstrato), [`docs/72 §6`](72-desenho-laboratorio-sintetico-automacao-fase-2.md)
> (o desenho conceitual que esta página especifica),
> [`docs/37`](37-fase-8d-log-seguro-e-relatorio.md) (redação e relatório já
> implementados), [`docs/30 §3`](30-fase-8c-excecoes-sinteticas.md) (cenários de
> exceção), [`docs/62`](62-decisao-formato-numero-interno-processo.md) (formato
> `CAC-YYYY-NNNNNN`), [`docs/26 §19`](26-arquitetura-automacao-hibrida.md)
> (gates), [`docs/23 §5`](23-checklist-piloto-real.md) (12 pendências).

---

## 1. Status

| # | Registro |
|---|---|
| 1.1 | **A Fase 2 segue apenas como laboratório e preparação.** |
| 1.2 | **Baseado no `docs/71`** (decisão de arquitetura) **e no `docs/72`** (desenho do laboratório). |
| 1.3 | **Especifica contrato SINTÉTICO**, não contrato real (§11). |
| 1.4 | **Não abre execução real** — nenhuma. |
| 1.5 | **Não altera a Fase 9** (§11). |
| 1.6 | **Especificação, não implementação.** Docs-only. |
| 1.7 | **Nenhum gate do `docs/26 §19` é fechado**; nenhuma pendência do `docs/23 §5` é fechada. |

---

## 2. Objetivo do contrato

| # | Objetivo |
|---|---|
| 2.1 | **Definir o que o motor sintético pode receber** — lista fechada, não "pelo menos isto". |
| 2.2 | **Definir o que ele nunca pode receber** — lista explícita, para o proibido ter nome. |
| 2.3 | **Permitir testes determinísticos** — mesmo handle, mesmo resultado. |
| 2.4 | **Impedir credencial real por desenho** — não por disciplina de quem escreve o PR. |
| 2.5 | **Servir de base para o PR futuro de implementação local** (§12). |

> **A propriedade que importa.** Se o contrato só admite os campos da §3, então
> um PR que precise de senha, cookie ou `storageState` **não compila** — ele
> teria de **alterar o contrato**, e alterar o contrato é visível na revisão.
> É a diferença entre uma regra que alguém precisa lembrar e uma regra que o
> tipo cobra (`docs/71 §4.3.6`, `docs/42 §6/§7`).

---

## 3. Lista fechada de campos permitidos

**Fechada** significa: campo fora desta tabela é **rejeitado** (§6.3), não
ignorado. Descrição conceitual — o tipo é o PR seguinte.

| Campo | Natureza | Regras |
|---|---|---|
| **`sessionHandle`** | Referência **opaca** | Sintético; **não derivado** de cookie real; **não reversível** (não contém, cifra ou codifica credencial); prazo curto. Saber o handle diz *qual* sessão, nunca *como* autenticar. |
| **`processId`** | Identificador interno | Do nosso produto. Fictício ou de desenvolvimento. **Nunca** protocolo Gov.br/SINARM/PF real. |
| **`actorId`** | Identificador interno | Usuário do sistema/laboratório. **Nunca** credencial, login ou conta Gov.br. |
| **`scope`** | Lista curta de capacidades | Ex.: `LAB_GUIA_TRAFEGO_SYNTHETIC`. **Não representa permissão em portal real** — é escopo dentro do laboratório. Fora do escopo, o motor para. |
| **`expiresAt`** | Instante de expiração | **Curto**. Sem renovação silenciosa (§5.9). Vencido, o handle não vale mais. |
| **`issuedAt`** | Instante de criação | Base do prazo e da ordem dos eventos. |
| **`environment`** | Marcação de ambiente | Apenas `synthetic` / `local` / `test`. **Nunca `production`** (§6.1). |
| **`consentMarker`** | Marcador sintético | Registra que houve "consentimento" no laboratório. **Não substitui** o consentimento real do `docs/39 §5` — e não pode ser reaproveitado como se fosse. |
| **`handoffState`** | Estado do handoff | Um de: `CREATED`, `CLAIMED`, `IN_PROGRESS`, `COMPLETED`, `EXPIRED`, `CANCELLED`, `BLOCKED`, `FAILED` (§5). Lista fechada e **alinhada ao [`docs/74 §4`](74-maquina-estados-automacao-sintetica-fase-2.md)**. |
| **`auditCorrelationId`** | Id interno de correlação | Amarra os eventos sintéticos de uma execução (§7). Interno, sem relação com identificador externo. |
| **`allowedSyntheticProcessCode`** | Código fictício aceito | Apenas `PROT-FICT-*` (padrão do `labRunReport.ts`) ou `CAC-*` de ambiente local (`docs/62`). Formato de protocolo real é rejeitado (§6.5). |

### 3.1 Uma nota sobre o nome `sessionHandle`

A redação existente (`src/server/automation/redaction.ts`) trata **`session`
como token secreto exato** — ou seja, o **valor** de um campo chamado
`sessionHandle` seria mascarado em log automaticamente.

**Isso é desejável, e o contrato deve preservar.** O handle é opaco e
descartável; ele não precisa aparecer em log. É exatamente por isso que a
correlação de eventos usa o **`auditCorrelationId`**, e não o handle: o campo
de correlação pode ser registrado à vontade, e o handle continua redigido por
padrão. **Defesa em profundidade de graça** — não contornar renomeando o campo
para escapar da redação.

---

## 4. Lista explícita de campos proibidos

O contrato **nunca** pode conter, sob nome nenhum e em nenhuma forma
(direta, aninhada, serializada, cifrada, hasheada ou codificada):

| # | Proibido | # | Proibido |
|---|---|---|---|
| 4.1 | **senha** | 4.10 | **nome da mãe real** |
| 4.2 | **OTP** | 4.11 | **data de nascimento real** |
| 4.3 | **token Gov.br** | 4.12 | **documento real** |
| 4.4 | **cookie** | 4.13 | **PDF real de cliente** |
| 4.5 | **`storageState`** | 4.14 | **HTML real de Gov.br/SINARM/PF** |
| 4.6 | **refresh token** | 4.15 | **screenshot real de portal externo** |
| 4.7 | **access token externo** | 4.16 | **qualquer segredo que exija KMS** |
| 4.8 | **credencial Gov.br** | 4.17 | **qualquer identificador de sessão real externo** |
| 4.9 | **CPF real** · **RG real** | | |

> **Sobre 4.16.** A regra não é "guardar segredo com KMS". É **não haver
> segredo**. Se algum campo passasse a exigir KMS, isso é sinal de que o
> contrato foi violado — não de que falta infraestrutura (`docs/71 §6.6`,
> `docs/72 §11.5`).

> **Sobre 4.9.** A base atual **não tem CPF no schema** (`docs/68 §3.2.1`), e o
> laboratório usa `000.000.000-00` (`docs/27 §6`). O proibido é o CPF **real**;
> o fictício documentado continua permitido como dado de teste.

---

## 5. Ciclo de vida do handle

| # | Etapa | Regra |
|---|---|---|
| 5.1 | **Criação** | O portal sintético emite o handle com `issuedAt`, `expiresAt`, `scope` e `environment`. Estado: `CREATED`. |
| 5.2 | **Claim pelo motor** | O motor sintético reivindica o handle **uma vez**. Estado: `CLAIMED`. Segundo claim é falha, não substituição. |
| 5.3 | **Execução local** | Etapas dentro do `scope`, contra `localhost`. Estado: `IN_PROGRESS`. |
| 5.4 | **Conclusão** | Estado `COMPLETED`. Só aqui pode existir protocolo — e só o sintético (`PROT-FICT-*`). |
| 5.5 | **Expiração** | Passado o `expiresAt`, estado `EXPIRED`, mesmo no meio de uma etapa. O motor para e registra. |
| 5.6 | **Cancelamento** | Interrupção deliberada (humano ou sistema). Estado `CANCELLED`. |
| 5.7 | **Bloqueio por captcha sintético** | Estado `BLOCKED`, degradação para humano. **É o comportamento correto**, não uma falha do desenho (`docs/72 §7.10`). **Não é terminal** — exige desfecho explícito (5.12). |
| 5.8 | **Erro sintético** | Estado `FAILED`. Falha de etapa termina sem protocolo — invariante herdado do `docs/37`. |
| 5.9 | **Sem renovação silenciosa** | Handle vencido **não se renova**. Continuar exige **novo** handle, com novo `issuedAt` e novo evento. |
| 5.10 | **Descarte após o fim** | Em `COMPLETED`, `FAILED`, `EXPIRED` ou `CANCELLED`, o handle é invalidado e descartado. O descarte é **verificado**, não presumido — se falhar, é incidente (`docs/42 §8`). |
| 5.11 | **Logs redigidos** | Todo o ciclo passa pela redação existente (`docs/37 §4`). |
| 5.12 | **Desfecho do bloqueio** | De `BLOCKED` a sessão sai para `CANCELLED`, `FAILED` ou `EXPIRED` — **nunca** para `COMPLETED` nem de volta para `IN_PROGRESS` (§5.13). |

**Transições válidas:**

```
CREATED ──▶ CLAIMED ──▶ IN_PROGRESS ──▶ COMPLETED  ✦
   │           │             │
   │           │             ├──▶ BLOCKED ──┬──▶ CANCELLED ✦
   │           │             │              ├──▶ FAILED    ✦
   │           │             │              └──▶ EXPIRED   ✦
   │           │             ├──▶ FAILED    ✦  (erro sintético)
   │           │             ├──▶ CANCELLED ✦  (interrupção)
   │           │             └──▶ EXPIRED   ✦  (prazo)
   ├───────────┴─────────────────▶ EXPIRED  ✦
   └───────────┴─────────────────▶ CANCELLED ✦
```

`COMPLETED`, `FAILED`, `EXPIRED` e `CANCELLED` são **terminais** (`✦`): não
voltam, não renovam, não reabrem. **`BLOCKED` não é terminal** — é estado de
bloqueio que **exige desfecho explícito** (5.12).

### 5.13 Por que `FAILED` existe e por que `BLOCKED` não é terminal

| # | Motivo |
|---|---|
| 5.13.1 | **`FAILED` separa defeito de bloqueio.** Erro técnico do laboratório (timeout, etapa indisponível, campo proibido) é coisa diferente de captcha parando a automação — o primeiro é problema, o segundo é o desenho funcionando. Sem estado próprio, o erro sintético do 5.8 não tinha casa. |
| 5.13.2 | **`BLOCKED` não-terminal evita sessão que morre sem desfecho auditável.** Quem foi bloqueado ou é encerrado (`CANCELLED`), ou vira falha do cenário (`FAILED`), ou vence (`EXPIRED`). Terminar em `BLOCKED` deixaria a trilha muda sobre o que houve depois do humano assumir. |
| 5.13.3 | **A mudança não afrouxa nada.** `BLOCKED` continua **sem saída para frente**: `BLOCKED → COMPLETED` e `BLOCKED → IN_PROGRESS` seguem **proibidos**, porque exigiriam um **evento de desbloqueio sintético** que **não existe** e cuja criação seria decisão própria, em PR próprio (`docs/74 §8.5`, `§10.2`). |
| 5.13.4 | Os oito estados e as transições ficam **alinhados ao [`docs/74`](74-maquina-estados-automacao-sintetica-fase-2.md)**, que é a fonte da máquina de estados; esta página segue sendo a fonte dos **campos permitidos e proibidos**. |

---

## 6. Regras de validação

Validação é **allow-list**, no espírito do `PROTOCOL_ALLOWED_STATUS` do
`labRunReport.ts`: o que não estiver explicitamente permitido cai no rejeitado,
para que campo novo não passe **por omissão**.

| # | Regra |
|---|---|
| 6.1 | **Rejeitar `environment: production`** — e qualquer valor fora de `synthetic`/`local`/`test`. |
| 6.2 | **Rejeitar qualquer URL externa** — só `localhost`/`127.0.0.1`, na mesma linha do `PHASE9_DEFAULT_ALLOWED_HOSTS`; `gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` são bloqueio duro, mesmo em allowlist (`phase9/networkGuard.ts:22`). |
| 6.3 | **Rejeitar qualquer campo não listado** na §3 — inclusive campo "inofensivo" e campo extra que "só veio junto". |
| 6.4 | **Rejeitar nome suspeito** — `password`, `senha`, `otp`, `cookie`, `token`, `credential`, `cpf`, `storageState` e variações. A função `isSecretKey` já cobre a maioria por token e substring; **`cpf` e `storageState` não estão nela hoje** e precisam de verificação própria. |
| 6.5 | **Rejeitar `processCode` com formato de protocolo real** — aceitar só `PROT-FICT-*` e `CAC-*` local (`docs/62`). |
| 6.6 | **Aceitar apenas dados fictícios.** |
| 6.7 | **Exigir expiração** — handle sem `expiresAt` é inválido; ausência não vira "não expira". |
| 6.8 | **Exigir `scope` sintético** — vazio ou genérico é inválido. |

> **6.4 é um achado, não uma suposição.** Conferi `redaction.ts` na `main`
> `f71843a`: `SECRET_KEY_EXACT_TOKENS` cobre `pass`, `otp`, `session`, `jwt`,
> `mfa`, `totp` e outros; `SECRET_KEY_SUBSTRINGS` cobre `password`, `senha`,
> `token`, `cookie`, `credential`, `secret`, `bearer`, `sessionid`… **mas não
> `cpf` nem `storagestate`**. Reusar `isSecretKey` na validação do contrato é
> certo — só não é **suficiente** sozinho.

---

## 7. Eventos de auditoria sintéticos

| # | Evento | Quando |
|---|---|---|
| 7.1 | `synthetic_session_created` | handle emitido |
| 7.2 | `synthetic_session_claimed` | motor reivindicou |
| 7.3 | `synthetic_session_step_started` | etapa sintética iniciada |
| 7.4 | `synthetic_session_step_completed` | etapa sintética concluída |
| 7.5 | `synthetic_session_blocked_by_captcha` | captcha sintético bloqueou → humano |
| 7.6 | `synthetic_session_failed` | erro ou timeout sintético |
| 7.7 | `synthetic_session_expired` | prazo estourado |
| 7.8 | `synthetic_session_cancelled` | interrupção deliberada |
| 7.9 | `synthetic_session_completed` | conclusão com protocolo sintético |

**Cada evento carrega:** `auditCorrelationId` · `processId` · `actorId` ·
`timestamp` · `status` · etapa sintética.

**Nenhum evento carrega:** PII · segredo · cookie · screenshot bruto real ·
o próprio `sessionHandle` em claro (§3.1).

> **Invariante.** Nenhum evento de falha, bloqueio, expiração ou cancelamento
> pode produzir protocolo. Só `synthetic_session_completed` admite — e só
> `PROT-FICT-*`. É a mesma porta allow-list do `labRunReport.ts`.

---

## 8. Evidências permitidas

| Permitido | Condição |
|---|---|
| **Screenshot sintético** | só de página `localhost` do laboratório |
| **HTML sintético redigido** | passa pela redação antes de virar artefato |
| **Protocolo fictício** | apenas `PROT-FICT-*` |
| **Logs redigidos** | `redactLabText` / `redactLabMeta` / `redactLabError` |
| **Timestamps** | do laboratório |
| **Relatório de execução local** | `labRunReport.ts`, marcado `LAB_SINTETICO` |
| **Artefatos** | apenas sob `tests/e2e/artifacts` ou equivalente local (`LAB_ARTIFACTS_ROOT`) |

Fora disso, artefato é rejeitado — o `labRunReport.ts` já devolve
`[ARTEFATO_FORA_DO_LAB]` para caminho estranho, e o contrato não deve afrouxar.

---

## 9. Estados de falha

| # | Falha | Resultado |
|---|---|---|
| 9.1 | **Handle expirado** | `EXPIRED`, sem protocolo |
| 9.2 | **Scope inválido** | rejeita antes de executar |
| 9.3 | **Environment inválido** | rejeita antes de executar |
| 9.4 | **Captcha sintético** | `BLOCKED`, degrada para humano |
| 9.5 | **Timeout sintético** | `IN_PROGRESS` → falha por prazo de etapa |
| 9.6 | **Etapa sintética indisponível** | falha registrada, sem protocolo |
| 9.7 | **Evidência sintética inválida** | artefato rejeitado, execução marcada |
| 9.8 | **Tentativa de campo proibido** | rejeita **e registra** — é sinal de desenho, não ruído |
| 9.9 | **Tentativa de URL externa** | rejeita e registra como incidente do laboratório |

> **9.8 e 9.9 merecem alarme, não só rejeição.** Um campo proibido aparecendo
> significa que algum caminho tentou trazer credencial para dentro. Silenciar
> seria perder exatamente o sinal que o laboratório existe para produzir.

---

## 10. Determinismo

| # | Regra |
|---|---|
| 10.1 | O validador do contrato deve ser **módulo puro** — sem `Date.now()`, `Math.random()` ou leitura de env, no padrão já provado do `labRunReport.ts`. |
| 10.2 | `issuedAt`/`expiresAt` entram como **input**, não são lidos do relógio dentro do validador. |
| 10.3 | Mesmo handle + mesma sequência de etapas ⇒ mesmos eventos, mesma ordem. |
| 10.4 | Cada estado de falha da §9 deve ser reproduzível **sempre**, nunca de forma intermitente. |

---

## 11. Relação com a Fase 9

| # | Registro |
|---|---|
| 11.1 | **A Fase 9 continua bloqueada.** |
| 11.2 | **`PHASE9_REAL_EXECUTION_ENABLED = false as const`** — `src/server/automation/phase9/safety.ts:32`, inalterado. |
| 11.3 | **Contrato sintético não é contrato real.** Um handle sintético jamais pode ser aceito por caminho real, nem o contrário — daí `environment` ser obrigatório (§3, §6.1). |
| 11.4 | **Nenhum campo do contrato pode ser usado para contornar a Fase 9** — nem `scope`, nem `environment`, nem `allowedSyntheticProcessCode`. |
| 11.5 | **A implementação futura deve continuar incapaz de apontar para Gov.br/SINARM/PF** — a incapacidade é estrutural (guard + allow-list), não configuração. |
| 11.6 | Os gates do `docs/26 §19` seguem **íntegros**; as 12 pendências do `docs/23 §5` seguem **abertas**. |

---

## 12. Próximo PR depois deste

| # | Opção | Observação |
|---|---|---|
| 12.1 | `docs: define synthetic automation state machine` | docs-only: formalizar as transições da §5 e os estados de falha da §9 antes de codificar |
| 12.2 | `feat: add synthetic session contract types` | **primeiro PR de código** da Fase 2: só o tipo e o validador, puros, com testes unitários, **sem** motor, portal ou Playwright novo |

**Condições, em qualquer dos dois:**

| # | Condição |
|---|---|
| 12.3 | **Implementação só depois da revisão deste contrato** — aprovado o texto, não a intenção. |
| 12.4 | **Apenas local/sintética** — `localhost`, dado fictício, sem endpoint externo. |
| 12.5 | **Não toca a Fase 9** nem `PHASE9_REAL_EXECUTION_ENABLED`. |
| 12.6 | Recomendo **12.1 antes de 12.2**: a máquina de estados é barata em documento e cara em código refeito. |

---

## 13. Proibições deste PR

Este PR **não**:

- ❌ altera código, `src`, `prisma`, `tests`, `package.json`, `package-lock.json` ou `.env`;
- ❌ cria migration nem usa `db:push`;
- ❌ implementa tipo, validador, evento ou teste;
- ❌ acessa Gov.br, SINARM ou PF;
- ❌ usa CPF, senha, OTP, cookie, `storageState` ou credencial reais;
- ❌ altera a política de captcha — que continua **nunca burlar**;
- ❌ altera a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED`;
- ❌ altera `docs/25`, `docs/26` ou `docs/70`;
- ❌ abre execução real, cliente real ou produção;
- ❌ fecha gate do `docs/26 §19` nem pendência do `docs/23 §5`.

---

> **Fecho.** O contrato de sessão sintética tem **11 campos permitidos** —
> `sessionHandle` opaco, `processId`, `actorId`, `scope`, `expiresAt`,
> `issuedAt`, `environment`, `consentMarker`, `handoffState`,
> `auditCorrelationId` e `allowedSyntheticProcessCode` — e **17 famílias de
> campo proibidas**, entre elas senha, OTP, cookie, `storageState`, tokens,
> credencial Gov.br, CPF/RG reais, documento real e qualquer segredo que exija
> KMS. O ciclo de vida tem **oito estados** — quatro deles terminais
> (`COMPLETED`, `FAILED`, `EXPIRED`, `CANCELLED`), com **`BLOCKED` exigindo
> desfecho explícito e sem saída para frente** —, **sem renovação silenciosa** e
> com **descarte verificado** no fim. A validação é
> **allow-list**: campo não listado é rejeitado, não ignorado — e `cpf` e
> `storageState` precisam de checagem própria, porque a `isSecretKey` atual não
> os cobre. **Nada aqui é implementado.** `PHASE9_REAL_EXECUTION_ENABLED`
> continua `false as const`, os gates do `docs/26 §19` seguem íntegros, as 12
> pendências do `docs/23 §5` seguem abertas e a Fase 2 continua sendo
> **laboratório e preparação**. O próximo passo recomendado é **formalizar a
> máquina de estados**, ainda docs-only.
