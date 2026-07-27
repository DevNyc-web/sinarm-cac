# 41 — Gate de Segurança / Credenciais

> **O que é este documento.** Uma **auditoria** do repositório em busca de risco
> de credencial, sessão, log sensível ou persistência indevida, antes de qualquer
> automação real. Achados são **reportados, não corrigidos**: nenhuma alteração de
> código acompanha este documento.
>
> **O que este documento NÃO faz — explicitamente:**
>
> - ❌ **NÃO altera código** (achados ficam para aprovação sua).
> - ❌ **NÃO altera `PHASE9_REAL_EXECUTION_ENABLED`.**
> - ❌ **NÃO adiciona env, secret ou entrada na allowlist.**
> - ❌ **NÃO salva credencial nem cria sessão real.**
> - ❌ **NÃO acessa Gov.br/SINARM** e **não executa automação real.**
> - ❌ **NÃO fecha gate** nenhum.
>
> **Fase 9 continua INERTE.** `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false as const`. **`docs/34 §16` continua em branco / não assinado.**
> **Gates 1, 2, 3 e 5 (`docs/26 §19`) continuam abertos.**
>
> **Data:** 2026-07-26
> **Base:** `docs/00 §8` (regras permanentes), `docs/05` (logs/LGPD),
> `docs/26 §15`, `docs/32 §4`, `docs/34 §6`/`§11`/`§12`, `docs/35`, `docs/37`,
> `docs/38`, `docs/39`, `docs/40`.

---

## 0. Escopo auditado e método

**Inspecionado:** `src/server/automation/phase9/` (6 arquivos),
`src/server/automation/redaction.ts`, `src/server/automation/lab/`,
`tests/unit/phase9/` (4 arquivos), `tests/unit/automation/` (6 arquivos),
`src/server/auth/`, `src/server/config/env.ts`, `src/lib/logger.ts`,
`src/server/payments/`, `src/app/api/payments/webhook/`, `prisma/schema.prisma`,
`.env.example`, `.gitignore`, `tests/e2e/artifacts/`, `docs/34`, `docs/38`.

**Termos buscados:** `senha`, `password`, `token`, `cookie`, `otp`,
`authorization`, `secret`, `credential`, `credencial`, `session`, `sessão`,
`gov.br`, `acesso.gov`, `SINARM`, `servicos.pf`,
`PHASE9_REAL_EXECUTION_ENABLED`, `process.env`.

**Resultado bruto:** 194 linhas com correspondência em 65 arquivos sob `src/`.

**Nota sobre `docs/39` e `docs/40`:** existem em **branches irmãs**, ainda não na
`main`. Foram considerados como contexto; não são pré-requisito desta auditoria.

**Método complementar.** Além da leitura, a cobertura da redação foi **medida
executando o módulo** com uma sonda fora do repositório (chaves candidatas e
strings de texto livre). Os resultados de §5 são medidos, não inferidos.

---

## 1. Onde existem menções sensíveis

Agrupadas por natureza, não por arquivo — o volume bruto (194) é enganoso: a
maioria é **texto declarando que o sistema não faz aquilo**.

Volume = **linhas com correspondência** nos arquivos listados, medido com a mesma
expressão dos termos de §0.

| Grupo | Onde | Volume |
|-------|------|--------|
| **Declarações de não-acesso** ("não acessa Gov.br/SINARM") | ~40 arquivos de `src/components/`, `src/app/`, `src/server/processes/`, `src/server/automation/` | 108 — o restante de `src/` |
| **Guard / bloqueio ativo** | `phase9/networkGuard.ts` (allowlist + `FORBIDDEN_HOST_PATTERN`), `phase9/safety.ts` (`FORBIDDEN_REAL_MARKERS`) | 7 |
| **Redação / sanitização** | `automation/redaction.ts` (`SECRET_KEY_SUBSTRINGS`, `SECRET_KEY_EXACT_TOKENS`, padrões de valor) | 20 |
| **Sessão mock** | `server/auth/session.ts` (`cac_mock_session`), `mockUsers.ts`, `guards.ts`, `permissions.ts` | 16 |
| **Credencial de pagamento** | `payments/mercadoPagoProvider.ts` (`Authorization: Bearer`), `api/payments/webhook/route.ts` (`x-dev-webhook-secret`), `config/env.ts` | 18 |
| **Rótulos de domínio** | `processes/statusLabels.ts` (`AGUARDANDO_LOGIN_GOVBR`, `SESSAO_GOVBR_EXPIRADA`) — 7; `prisma/schema.prisma` (enums `SINARM_*`) — 6 | 13 \* |
| **Texto legal público** | `/consentimento`, `/termos`, `/privacidade`, `Footer`, `LegalPage`, `login` | 18 |
| **Fixtures de teste** | `tests/unit/phase9/` — 26; `tests/unit/automation/labRedaction.test.ts` — 27; `tests/e2e/` — 58 | 111 \* |

> **\* Escopo.** O total de 194 (§0) cobre **apenas `src/`**. Duas linhas da
> tabela extrapolam esse escopo de propósito, porque a menção sensível está fora
> de `src/`: `prisma/schema.prisma` (6, em *Rótulos*) e `tests/**` (111, em
> *Fixtures*). Somando só as parcelas dentro de `src/` —
> 108 + 7 + 20 + 16 + 18 + 7 + 18 — fecha-se exatamente **194**.

---

## 2. Classificação de cada menção

Legenda: ✅ **segura** · 🧪 **teste** · 📄 **documentação** · ⚠️ **observação** ·
🔴 **risco**

| Menção | Classe | Justificativa |
|--------|--------|---------------|
| "não acessa Gov.br/SINARM" em componentes/serviços | 📄 | Prosa declaratória. Dois testes **verificam** a prosa contra o código (`documentUploadContract.test.ts:54`, `automationQueueSubmission.test.ts:170` — `assert.doesNotMatch(code, /gov\.br|sinarm/i)`) |
| `FORBIDDEN_HOST_PATTERN` / `FORBIDDEN_REAL_MARKERS` | ✅ | Menciona os domínios **para bloqueá-los**. Trava dura: bloqueia mesmo se alguém colocar na allowlist (verificado em `networkGuard.test.ts:37`) |
| `SECRET_KEY_SUBSTRINGS` / `EXACT_TOKENS` | ✅ | Lista de termos **para redigir**, não valores |
| `cac_mock_session` (`auth/session.ts`) | ⚠️ | Cookie `httpOnly`, guarda **id de usuário fictício**. Sem senha, sem token assinado, sem MFA — o módulo declara isso. **Não assinado**: o valor é falsificável, então o "login" é spoofável. Aceitável em dev; auth real é pendência bloqueadora (`docs/23 §5` item 1) |
| `Authorization: Bearer ${token}` (`mercadoPagoProvider.ts:42`) | ✅ | Token vem de env, vai no header, **nunca é logado**. Trava exige prefixo `TEST-` (linha 30) — credencial de produção é rejeitada em runtime |
| `x-dev-webhook-secret` (`webhook/route.ts:19`) | ⚠️ | Comparação com `!==` — **não** é *timing-safe*. Proteção declaradamente dev; validação oficial de assinatura (HMAC) é TODO registrado no próprio arquivo |
| `envSchema` / `getEnv()` (`config/env.ts`) | ⚠️ | Mensagem de erro monta `path: message`. Hoje **não vaza valor** (nenhum env secreto é `enum`, cujo erro do Zod ecoa o recebido). Vira risco se um segredo futuro entrar como enum ou com validador que ecoa valor |
| `logger` pino (`src/lib/logger.ts`) | ⚠️ | Sem *redact* configurado e **sem serializer**. Só o nível vem de env. Quem chamar `logger.info({ token })` registra em claro — a proteção de redação **não** está no logger de aplicação, só no caminho lab/Fase 9 |
| `statusLabels.ts` (`SESSAO_GOVBR_EXPIRADA`, etc.) | ✅ | Rótulos de UI. Nomeiam estados, não guardam dado |
| Enums `SINARM_*` em `prisma/schema.prisma` | ✅ | Nomes de estado operacional. Nenhum campo de credencial |
| `/consentimento`, `/termos`, `/privacidade` | 📄 | Declaram que senha nunca é pedida/guardada. **Mas descrevem execução manual** — ver `docs/40 §2`, achado 2 |
| `senha`/`token`/`cookie`/`otp` em `labRedaction.test.ts` e fixtures | 🧪 | Valores fictícios usados para **provar** a redação |
| `"conta servicos.pf.gov.br"` (`safety.test.ts:55`) | 🧪 | String fictícia para provar o bloqueio `REAL_DATA_BLOCKED` |
| **Redação apenas por chave** (`redaction.ts`) | 🔴 | Ver §5 — achado principal |
| **Trilha de auditoria em memória** (`auditLogger.ts`) | 🔴 | Ver §4 e `docs/40 §2` (G-LOG) |

---

## 3. Persistência de credenciais

**Não há persistência de credencial em nenhum lugar do projeto.** Verificado, não
presumido:

- **`prisma/schema.prisma`** — os modelos são `ProcessType`, `Process`,
  `ManualExecution`, `ProcessNote`, `ProcessStatusEvent`, `ProcessChecklistItem`,
  `Destination`, `FirearmPce`, `ProcessDocument`, `Payment`. **Nenhum campo** de
  senha, token, cookie, OTP, sessão ou credencial. **Não existe modelo `User`.**
- **Consentimento** — nenhum campo. Nada de consentimento é persistido
  (a página `/consentimento` declara: *"nenhum consentimento real é coletado
  nesta etapa"*).
- **Cookie** — um único, `cac_mock_session`, contendo **id de usuário fictício**.
  `httpOnly`, sem assinatura. Não é credencial: não há senha por trás dele.
- **`.env`** — presente localmente e **gitignored** (`.gitignore:18-19`).
  `.env.example` é rastreado e contém **apenas placeholders** —
  `MERCADO_PAGO_ACCESS_TOKEN=` e `MERCADO_PAGO_WEBHOOK_SECRET=` vazios,
  `DATABASE_URL` com `USER:PASSWORD` literais de exemplo. **Nenhum segredo real
  versionado.**
- **Storage** — `FileSystemStorage` grava em `storage-local/`, **gitignored**,
  sem credencial, sem URL assinada.
- **Fase 9** — o runner **não recebe** e **não guarda** credencial: o
  `Phase9ExecutionRequest` não tem campo de senha/token/cookie.

**Artifacts não são versionados — verificado.** `git ls-files` sobre
`tests/e2e/artifacts/`, `tests/e2e/phase9-artifacts/` e `storage-local/` retorna
**somente os dois `.gitkeep`**.

O conteúdo local de `tests/e2e/artifacts/` é:

| Item | Quantidade | Versionado? |
|------|-----------|-------------|
| Relatórios de run (`lab-run-report-*.json`) | 12 | ❌ não |
| Screenshots do laboratório (`lab-final-*.png`) | 4 | ❌ não |
| `.gitkeep` (mantém a pasta no git) | 1 | ✅ sim |

Os 16 arquivos de evidência — relatórios **e** screenshots — são **locais, do
laboratório sintético**, e estão cobertos por `.gitignore:46`
(`tests/e2e/artifacts/*`, com exceção apenas do `.gitkeep`). Verificado item a
item com `git check-ignore -v`, inclusive nos `.png`.

**Isto não é um vazamento:** os screenshots são de páginas **fake locais**
(`docs/27`/`docs/28`), com dados fictícios, e nenhum deles entra no
repositório. A conclusão de §3 permanece: **nenhum artifact sensível está
versionado.** O registro dos 4 `.png` existe porque a política de screenshot
para **ensaio real** segue indefinida — ver §4, R5.

---

## 4. Risco de logar dados sensíveis

**Evidência positiva primeiro.** Um relatório real do laboratório local mostra a
redação funcionando de fato:

```json
"meta": {
  "senha": "[REDACTED]", "token": "[REDACTED]", "cookie": "[REDACTED]",
  "otp": "[REDACTED]", "authorization": "[REDACTED]",
  "cpf": "***.***.***-**", "email": "[EMAIL]", "uf": "SP"
},
"redactionSummary": { "redactedKeys": 5, "maskedValues": 2, "total": 7 }
```

Chave de segredo desaparece; PII é mascarada; a contagem é auto-declarada. É
mecanismo, não promessa.

**Riscos remanescentes:**

| # | Risco | Severidade hoje | Por quê |
|---|-------|-----------------|---------|
| **R1** | Segredo em **texto livre** não é mascarado | 🔴 Alta em ensaio real, **nula hoje** | Ver §5. Não existe credencial real no sistema hoje; num ensaio real, a `message` de um erro da página oficial poderia carregar token |
| **R2** | Chaves fora da lista passam em claro | ⚠️ Média em ensaio real | Ver §5 — `pwd`, `codigo`, `pin`, `assinatura`, `totp` e outras não são reconhecidas |
| **R3** | `logger` pino de aplicação **sem redact** | ⚠️ Média | A redação está no caminho lab/Fase 9, **não** no logger geral. Um `logger.info({ token })` fora desse caminho registra em claro |
| **R4** | Trilha de auditoria **em memória** | ⚠️ Média | `auditLogger.ts` declara: *"Ainda NAO grava em banco"*. Nada persiste ⇒ nada vaza por persistência, mas também **não há trilha append-only** (`docs/26 §15`) |
| **R5** | Screenshot/trace de ensaio real | ⚠️ Aberta | Política decidida para o lab (`docs/35 §5`); para ensaio real, **não definida** |

---

## 5. Cobertura da redação — medida

Resultado da execução do módulo (não leitura de código).

**Chaves reconhecidas como segredo (valor nunca é visitado):**
`password`, `passwd`, `senha`, `senhaGovBr`, `token`, `accessToken`,
`refreshToken`, `cookie`, `set-cookie`, `authorization`, `secret`, `credential`,
`credencial`, `bearer`, `apiKey`, `accessKey`, `privateKey`, `sessionId`, `pass`,
`otp`, `auth`, `sessao`, `session`, `jwt`, `codigoOtp`.

**Chaves que passam em claro (não reconhecidas):**
`pwd`, `codigo`, `codigoVerificacao`, `pin`, `pinCode`, `assinatura`,
`signature`, `hmac`, `xSignature`, `captchaResponse`, `recoveryCode`, `mfa`,
`totp`, `twoFactor`, `certificado`, `chave`, `chavePrivada`.

> `docs/32 §4` proíbe *"armazenar OTP/**código**"*. A palavra **`codigo` não é
> reconhecida** — só `codigoOtp` é, por conter `otp`.

**Ausência de falso positivo — confirmada.** `passo`, `passos`, `author`,
`durationMs`, `attempt`, `tentativas`, `processId` passam intactos. A distinção
`passo` vs `pass` e `author` vs `auth` funciona como o módulo documenta.

**Valores em texto livre (sem chave de segredo) — achado principal:**

| Entrada | Saída | Mascarado? |
|---------|-------|-----------|
| `senha=hunter2` | `senha=hunter2` | ❌ **não** |
| `a senha do usuario e Trov@dor2026` | *inalterado* | ❌ **não** |
| `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def` | *inalterado* | ❌ **não** |
| `set-cookie: session=9f8e7d6c5b4a` | *inalterado* | ❌ **não** |
| `codigo OTP enviado: 483920` | `codigo OTP enviado: ******` | ✅ (≥6 dígitos) |
| `codigo OTP enviado: 4839` | *inalterado* | ❌ **não** (4 dígitos) |
| `cpf 123.456.789-00 e email a@b.com` | `cpf ***.***.***-** e email [EMAIL]` | ✅ |
| `telefone (11) 98765-4321` | `telefone [TELEFONE]` | ✅ |

**Conclusão de §5.** A redação é **forte por chave** e **forte para PII
estruturada** (CPF, RG, e-mail, telefone, dígitos longos). Ela **não tem padrão
para segredo em texto livre** — os padrões de valor cobrem identificadores
pessoais, não credenciais.

⚠️ **Discrepância de comentário a corrigir (não corrigida aqui).**
`auditLogger.ts:53-54` afirma: *"Um segredo escrito em texto livre continua com o
backstop proprio"*. **Não existe tal backstop** em `redactLabText` — os padrões
são e-mail, CPF, RG, telefone e sequência de ≥6 dígitos. O comentário deve ser
lido como *proteção por chave apenas*, e vale ajustá-lo para não induzir
confiança indevida.

---

## 6. `sessionDiscarded` continua garantido?

**Sim como declaração; não como prova.**

- `phase9Runner.ts` retorna `sessionDiscarded: true` nos **três** pontos de saída
  (linhas 108, 146, 177) — safety bloqueado, flag desligada, abort defensivo.
  **Não há caminho de retorno sem ele.**
- O evento `SESSION_DISCARDED` é registrado na trilha antes de cada abort.
- `phase9Runner.test.ts:35-43` garante o invariante por teste.

**Limite honesto:** é um **literal `true`** em caminhos que **nunca abriram
sessão**. Não existe sessão para descartar. A garantia atual é *"o contrato
declara descarte"*, não *"o descarte foi observado"*. Um ensaio real precisaria
de descarte **verificado**, não afirmado — já registrado em `docs/40 §3`
(G-ROLLBACK).

---

## 7. A Fase 9 continua sem `process.env`?

**Sim — confirmado.** `process.env` aparece em **exatamente 3 lugares** no
repositório inteiro:

| Arquivo | Uso |
|---------|-----|
| `playwright.config.ts:52` | `!process.env.CI` — reuso de servidor local |
| `src/lib/logger.ts:9` | `process.env.LOG_LEVEL ?? "info"` |
| `src/server/config/env.ts:30` | `envSchema.safeParse(process.env)` |

**Nenhum deles está em `src/server/automation/phase9/`.** Os seis arquivos da
Fase 9 (`safety`, `networkGuard`, `auditLogger`, `phase9Runner`, `types`,
`index`) **não leem ambiente**. Isso é o que torna a inércia auditável no diff:
não há configuração capaz de ligar a Fase 9.

---

## 8. A flag continua `false as const`?

**Sim.** `src/server/automation/phase9/safety.ts:32`:

```ts
export const PHASE9_REAL_EXECUTION_ENABLED = false as const;
```

- **Literal**, não env — coerente com §7.
- Ponto único de leitura: `isPhase9RealExecutionEnabled()` (linha 39).
- **Travada por teste**: `safety.test.ts:61` — `assert.equal(..., false)`.
- `assertNotRealMode()` bloqueia sempre enquanto a flag for `false`.
- Comentário (linhas 26-31) exige `docs/34 §16` assinado **antes** de qualquer
  alteração.
- Com a ruleset ativa na `main`, mudá-la exige **PR com `CI / verify` verde, sem
  bypass** — e o teste falharia, forçando a mudança a ser explícita e revisada.

---

## 9. O que falta antes de qualquer ensaio real

Achados desta auditoria. **A1, A2 e A3 foram mitigados** pelo PR de hardening
(ver §9.1); os demais seguem **para sua aprovação**, sem correção.

| # | Pendência | Estado | Origem |
|---|-----------|--------|--------|
| **A1** | Decidir se a redação ganha padrão para **segredo em texto livre** (JWT, `chave=valor`, `Bearer ...`) | ✅ **mitigado** | §5, R1 |
| **A2** | Ampliar `SECRET_KEY_*` para `pwd`, `codigo*`, `pin`, `assinatura`/`signature`/`hmac`, `mfa`/`totp`, `recoveryCode`, `chave*`, `certificado` | ✅ **mitigado** | §5, R2 |
| **A3** | Corrigir o comentário de `auditLogger.ts:53-54` (afirma backstop de texto livre que não existe) | ✅ **resolvido** | §5 |
| **A4** | Configurar **`redact`/serializer no `logger` pino** de aplicação, ou proibir por convenção que ele receba objeto não sanitizado | ⬜ aberto | §4, R3 |
| **A5** | Definir **persistência append-only** da trilha de auditoria + retenção | ⬜ aberto | §4, R4; `docs/40 §3` (G-LOG) |
| **A6** | Provar **descarte de sessão observado**, não declarado | ⬜ aberto | §6; `docs/40 §3` (G-ROLLBACK) |
| **A7** | Definir política de **screenshot/trace para ensaio real** | ⬜ aberto | §4, R5 |
| **A8** | Comparação *timing-safe* no `x-dev-webhook-secret` + validação oficial de assinatura HMAC | ⬜ aberto | §2 |
| **A9** | Cuidado ao adicionar env secreta como `enum` (mensagem do Zod ecoa valor recebido) | ⬜ aberto | §2 |
| **A10** | **Auth real + MFA** — hoje não existe modelo `User`; a sessão mock é um cookie não assinado | ⬜ aberto | §3; `docs/23 §5` itens 1, 2 |
| **A11** | **Custo quadrático da redação** — medido: 4 k → 14 ms, 8 k → 55 ms, 16 k → 230 ms (4× por duplicação). Não há backtracking catastrófico, mas ~100 k caracteres ficariam na casa de segundos. Cabível um **teto de tamanho** antes de redigir | ⬜ aberto (dívida) | 1ª revisão adversarial |
| **A12** | **`Set-Cookie` multiatributo** — atributo posterior com nome fora da lista sobrevive (`set-cookie: a=1; refresh=X`). Decidir se o header inteiro deve ser redigido até o fim da linha | ⬜ aberto (dívida) | 2ª revisão adversarial; ver §9.3 |

**Ordem sugerida:** A1–A3 foram feitos primeiro porque eram o que de fato reduzia
risco de vazamento em log. A4 continua aberto e é do mesmo tema. A5–A7 são
pré-condição de auditabilidade do ensaio. A8–A12 não bloqueiam o ensaio da
Fase 9, mas A8–A10 bloqueiam piloto/produção; A11 é dívida de robustez e A12 é
decisão de projeto a tomar antes do ensaio.

> **Lição registrada.** O hardening passou por **duas** rodadas de revisão
> adversarial, e cada uma achou um vazamento real **com o CI verde**: primeiro os
> esquemas `Basic`/`Digest`/`Negotiate`/`Token`, depois os nomes compostos
> (`accessToken`, `govbrPassword`…) e o esquema codificado `Bearer%20`. Em ambas,
> os testes cobriam o que havia sido pensado, não o que faltava. **Suíte verde não
> é prova de ausência de furo.** Por isso a cobertura passou a ser gerada
> combinatoriamente, e não enumerada à mão — ver §9.2.

> **Nenhum item aberto acima é tarefa liberada.** Cada um é decisão sua; A4 mexe
> em código e exige PR próprio sob revisão.

### 9.1. O que o hardening mudou (A1, A2, A3)

Mitigação aplicada em `src/server/automation/redaction.ts` e no comentário de
`src/server/automation/phase9/auditLogger.ts`:

- **Duas camadas explícitas**: por **chave** (`isSecretKey`, inalterada em
  espírito) e por **conteúdo** (`CREDENTIAL_PATTERNS`, nova).
- **Credencial em texto livre** agora é mascarada: JWT (`eyJ...`), token opaco de
  3 segmentos, e par `chave=valor` sensível (`senha=`, `token=`, `set-cookie:`,
  `session=`, `authorization:`). A **chave permanece** visível como evidência; só
  o **valor** morre — mesma política da camada por chave.
- **Todos os esquemas HTTP auth**, não só `Bearer`: `Basic`, `Digest`,
  `Negotiate` e `Token`, em `Authorization` e `proxy-authorization`, com `:` ou
  `=`. O **esquema fica** como evidência (`Authorization: Basic [REDACTED]`).
  Corrigido depois da revisão do PR: a primeira versão cobria só `Bearer`, e a
  regra `chave=valor` — que para no espaço — transformava
  `authorization=Basic dXNl` em `authorization=[REDACTED] dXNl`, deixando a
  credencial em claro. `Basic` era o pior caso, por carregar
  `base64(usuário:senha)`. `Digest` tem regra própria, porque seu valor é uma
  lista `k=v` com espaços e vírgulas.
- **OTP curto por contexto**: `codigo OTP enviado: 4839` é mascarado; um `4839`
  solto **não** é, para não destruir número legítimo.
- **Aliases ampliados**: `pwd`, `codigo`, `pin`, `mfa`, `totp`, `recoveryCode`,
  `signature`, `assinatura`, `hmac`, `chave`, `chavePrivada`, `certificado`.
- **`pin` entrou como token exato, não substring** — por substring ele casaria
  dentro de `espingarda`, `labStepInput` e `processTypeMapping`, destruindo
  evidência de auditoria. Há teste cobrindo isso.
- **Métrica preservada**: `durationMs`, `bytes`, `attempt` e `tentativas`
  continuam **números**, inclusive em evento que carrega credencial redigida.
- **Modo `identifiers` preservado**: credencial é mascarada nos dois modos, mas a
  heurística de token opaco fica fora dele, para não destruir caminho de
  artefato com 3 segmentos longos.

### 9.2. Dois furos encontrados em revisão adversarial — e corrigidos

O hardening passou por duas rodadas de revisão adversarial **depois** de já estar
verde no CI. Cada rodada achou um vazamento real que os testes não pegavam.

**F1 — nomes compostos de credencial (2ª rodada).** A regra `chave=valor` exigia
fronteira de palavra antes do termo sensível. Em `accessToken` não há fronteira
antes de `Token`, então **nove nomes vazavam em texto livre**: `accessToken`,
`refreshToken`, `idToken`, `userPassword`, `govbrPassword`, `xAuthToken`,
`setCookie`, `mySecret`, `clientSecret`. O sintoma pior era a **incoerência entre
as camadas** — `isSecretKey` protegia todos eles como campo, e o conteúdo não; a
mesma credencial vazava ou não conforme aparecesse como chave ou como texto.
`govbrPassword` é justamente o exemplo do teste da camada por chave.

Corrigido separando os termos de conteúdo em duas famílias, espelhando o que a
camada por chave já fazia: **A** (inequívocos — `password`, `token`, `secret`,
`cookie`, `credential`, `apikey`, `authorization`, `signature`, `hmac`…) aceita
prefixo e sufixo; **B** (curtos/ambíguos — `pin`, `otp`, `mfa`, `totp`, `codigo`,
`chave`, `jwt`, `auth`, `pass`) exige fronteira dos dois lados. A separação é
obrigatória: prefixo livre em `pin` casaria em `espingarda`, `shipping` e
`processTypeMapping`; sufixo livre faria `auth` casar em `author` e `pass` em
`passo`.

**F2 — esquema codificado como escudo (2ª rodada).** `authorization=Bearer%20…`
escapava das **duas** regras: a de esquema exigia espaço literal, e o lookahead
da regra `chave=valor` bloqueava o casamento ao ver `Bearer`. Ninguém redigia
nada. Corrigido aceitando `%20`, `+`, `,` e `;` como separador de esquema, e
exigindo o separador no lookahead em vez de só a fronteira de palavra.

**Cobertura de regressão.** Além dos casos nomeados, entrou um teste
**combinatório** (prefixo × termo × sufixo × separador × valor = **1260
combinações**) e sua contraparte de falso positivo com 18 strings legítimas de
domínio. Enumeração manual foi o que deixou `accessToken` passar.

### 9.3. Limites que permanecem — documentados, não corrigidos

**Prosa sem par `chave=valor`.** Não existe backstop universal: `"a senha do
usuário é X"` continua passando na parte alfabética. A proteção nesse caso é o
**nome do campo**. Coberto pelo teste `LIMITE conhecido: segredo em prosa sem par
chave=valor sobrevive`.

**F3 — `Set-Cookie` multiatributo (dívida aberta, não corrigida neste PR).** O
casamento de `cookie:` para no `;`, então atributos posteriores só são redigidos
se o nome estiver na lista:

```
set-cookie: a=1; session=X   → set-cookie: [REDACTED]; session=[REDACTED]
set-cookie: a=1; refresh=X   → set-cookie: [REDACTED]; refresh=X   ← atributo não listado
```

A escolha atual é **não** matar o header inteiro até o fim da linha, para não
destruir prosa de diagnóstico. É limitação inerente a lista de termos: nenhuma
lista enumera todo nome de cookie. **Antes de qualquer ensaio real é preciso
decidir** se `Set-Cookie` deve redigir o valor inteiro do header — decisão de
projeto, registrada aqui como pendente. **Isto não é gate fechado.**

> **Isto não autoriza execução real.** O hardening reduz risco de vazamento em
> log; **não** liga a Fase 9, **não** libera Gov.br/SINARM, **não** altera
> `PHASE9_REAL_EXECUTION_ENABLED` e **não fecha gate nenhum** — inclusive o
> G-SEC de `docs/40`, que exige revisão formal registrada, não só código.

---

## 10. Conclusão

- **Execução real continua BLOQUEADA.** `PHASE9_REAL_EXECUTION_ENABLED` é
  `false as const`, a Fase 9 não lê env, o guard bloqueia domínios oficiais mesmo
  se alguém os colocar na allowlist, e `assertNoRealGru` bloqueia sempre.
- **Não há persistência de credencial** em banco, arquivo, cookie ou artifact.
  Não existe modelo de usuário; não existe campo de senha/token/cookie/OTP.
- **Nenhum segredo real versionado.** `.env` é gitignored; `.env.example` só tem
  placeholders; artifacts do lab não são rastreados (só `.gitkeep`).
- **A redação funciona** — comprovada em relatório real do laboratório. O achado
  principal desta auditoria era que ela agia **só por chave**, deixando segredo em
  texto livre sobreviver (§5). Isso foi **mitigado** pelo hardening (§9.1): agora
  há uma segunda camada por conteúdo. Permanece o limite de prosa sem par
  `chave=valor`, hoje coberto por teste.
- **`sessionDiscarded` é declarado, não observado** (§6).
- **A trilha de auditoria não persiste** — sem append-only, `docs/26 §15` segue
  sem atendimento.
- **Nenhum código foi alterado.** Os 10 achados de §9 estão registrados para sua
  decisão.
- **`docs/34 §16` continua em branco / não assinado.** **Gates 1, 2, 3 e 5
  continuam abertos.** Nenhum gate foi fechado.

---

> **Fecho.** Esta auditoria **reporta**. Ela **não corrige código**, **não altera
> a flag**, **não adiciona env/secret/allowlist**, **não cria sessão real**,
> **não acessa Gov.br/SINARM**, **não executa automação real** e **não fecha
> gate**. Regras permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`)
> seguem íntegros.
