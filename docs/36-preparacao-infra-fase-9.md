# 36 — Preparação da Infra da Fase 9 (config segura + módulo bloqueado)

> **O que é este documento.** Registra a criação da **primeira infraestrutura real
> da Fase 9** — config Playwright segura, módulo de automação, runner, guard de rede,
> logs de auditoria, feature flag/bloqueio e testes — **sem tocar Gov.br/SINARM, sem
> dados reais e com a execução real BLOQUEADA por padrão**.
>
> **NÃO é automação real. NÃO acessa sistema real.** É base de produto com bloqueios.
> A execução real da Fase 9 continua **NÃO autorizada** — depende do **`docs/34 §16`
> assinado** (ainda pendente).
>
> **Data:** 2026-07-21
> **Branch:** `feat/phase-9-controlled-proof`
> **Base:** `docs/33` (plano), `docs/34` (checklist), `docs/35` (config segura),
> `docs/30` (falha segura), `docs/32` (gate jurídico).

---

## 1. Objetivo

Transformar a trilha de automação em **produto real**, criando a infra da Fase 9
**com bloqueios explícitos**, mas **sem** acessar Gov.br/SINARM, **sem** site público
real, **sem** dados reais e **sem** habilitar execução real. Este passo cria a base;
a automação real virá **só** depois do `docs/34 §16` assinado.

---

## 2. Branch criada

- **`feat/phase-9-controlled-proof`** (a partir da `main`, working tree limpa),
  conforme `docs/35 §9`. Nada implementado direto na `main`.

---

## 3. Config segura criada (`playwright.phase9.config.ts`)

Arquivo **separado** do `playwright.config.ts` (laboratório sintético), rodado
**apenas** por comando explícito (`npm run test:e2e:phase9`). Requisitos (docs/35 §4):

- `trace: "off"`, `video: "off"`, `screenshot: "off"` — nenhuma evidência automática.
- Sem `storageState` persistente — contexto **novo por execução** (default Playwright).
- Sem profile persistente (não usa `launchPersistentContext`).
- **`outputDir` próprio** e gitignored: `tests/e2e/phase9-artifacts/runs/`.
- **Sem `webServer`** — a config nunca sobe/aponta para serviço real.
- **A config do sintético NÃO foi alterada em comportamento**; apenas ganhou um
  `testIgnore: "**/phase9/**"` para **impedir** que a config de evidências ON capture
  um teste da Fase 9 (isolamento exigido por `docs/35 §3`).

Detalhe do `.gitkeep`: o Playwright **limpa o `outputDir`** a cada run, por isso os
artifacts vão para a subpasta `runs/` e o `.gitkeep` fica no diretório-pai
(`tests/e2e/phase9-artifacts/.gitkeep`), sobrevivendo à limpeza.

---

## 4. Módulo de automação criado (`src/server/automation/phase9/`)

Arquivos **reais, porém seguros/stubados**:

| Arquivo | Papel |
|---------|-------|
| `types.ts` | Contratos/tipos (`Phase9ExecutionRequest`, `...Result`, `...StepName`, `...StepStatus`, `...AuditEvent`, `...SafetyDecision`, `...NetworkPolicy`). |
| `safety.ts` | Validações/bloqueios (`evaluateSafety`) + feature flag `PHASE9_REAL_EXECUTION_ENABLED = false`. |
| `networkGuard.ts` | Allowlist (`localhost`/`127.0.0.1`), `assertUrlAllowed`, `createPhase9NetworkPolicy`, `isExternalAccessAllowed`. |
| `auditLogger.ts` | Logger de auditoria **em memória**, com máscara de campos proibidos. |
| `phase9Runner.ts` | Runner **bloqueado/seguro** — não abre navegador, não faz rede. |
| `index.ts` | Ponto único de exportação. |

---

## 5. Runner ainda BLOQUEADO

`runPhase9(request)`:

- recebe o `Phase9ExecutionRequest`;
- roda os safety checks;
- registra eventos de auditoria em memória;
- retorna resultado **bloqueado/seguro** com a mensagem:
  **“Execução real da Fase 9 ainda não autorizada. docs/34 §16 pendente.”**;
- marca **`sessionDiscarded: true`**;
- **não** chama Playwright contra site real, **não** abre Gov/SINARM, **não** faz rede
  externa;
- todas as etapas planejadas retornam `status: "BLOCKED"`.

Dois níveis de bloqueio: (1) **safety** (dryRun/stopPoint/allowRealExternalAccess/
marcadores reais) e (2) **feature flag** — mesmo com safety aprovado, a execução real
está desabilitada até o `docs/34 §16`.

---

## 6. Allowlist só localhost — sem Gov/SINARM

- `externalAccessAllowed = false` por padrão.
- `allowedHosts = ["localhost", "127.0.0.1"]`.
- Qualquer outro host → **bloqueado**.
- **Trava dura:** `gov.br`, `servicos.pf`, `sinarm`, `acesso.gov` são **sempre**
  bloqueados, mesmo que alguém os coloque na allowlist. **Nada de Gov/SINARM na
  allowlist agora.**

---

## 7. Sem Gov/SINARM, sem dados reais, sem Playwright contra site real

- Nenhuma URL Gov.br/SINARM como alvo — as menções no código são **apenas** listas de
  bloqueio, comentários ou testes que **provam** o bloqueio.
- Nenhum dado real; o runner não persiste nada; o schema não tem modelo de sessão.
- Playwright só é usado no **smoke local** (`127.0.0.1`), nunca contra site real.

---

## 8. Logs de auditoria em stub/memória

Eventos suportados: `EXECUTION_CREATED`, `SAFETY_CHECK_PASSED`,
`SAFETY_CHECK_BLOCKED`, `NETWORK_BLOCKED`, `STEP_STARTED`, `STEP_COMPLETED`,
`STEP_FAILED`, `HUMAN_CONFIRMATION_REQUIRED`, `SESSION_DISCARDED`,
`EXECUTION_ABORTED`. **Sem gravação em banco** (só memória/objeto retornado).

Máscara aplicada de fato (docs/35 §7): chaves proibidas (`password/senha/otp/cookie/
token/secret/authorization/session/credential/bearer`) são **descartadas** do evento;
valores string têm CPF e sequências longas de dígitos **mascarados**.

---

## 9. Safety checks

- `stopPoint === "DADOS_DA_GRU"` obrigatório.
- `dryRun === true` obrigatório.
- `allowRealExternalAccess === false` obrigatório.
- Qualquer “modo real” → bloqueado (`assertNotRealMode`).
- Qualquer URL não permitida → bloqueada (`assertUrlSafe`).
- GRU/protocolo real → bloqueado (`assertNoRealGru`).
- Pedido que referencia sistema oficial real → bloqueado (`REAL_DATA_BLOCKED`).
- Retorna sempre **decisão segura**, nunca exception crua.

---

## 10. Testes criados

**Unitários (25 testes, `node:test` via `tsx` — sem dependência nova):**

- `tests/unit/phase9/safety.test.ts` — exige stopPoint/dryRun/allowRealExternalAccess;
  flag real desabilitada; modo real e GRU real bloqueados.
- `tests/unit/phase9/networkGuard.test.ts` — bloqueia URL externa; permite localhost;
  trava dura contra Gov mesmo na allowlist.
- `tests/unit/phase9/auditLogger.test.ts` — não registra campos proibidos; mascara CPF.
- `tests/unit/phase9/phase9Runner.test.ts` — runner bloqueia por padrão; `sessionDiscarded
  true`; mensagem menciona `docs/34 §16`; etapas todas `BLOCKED`.

**Smoke Playwright (3 testes, `tests/e2e/phase9/phase9-config-smoke.spec.ts`):**

- prova que `trace/video/screenshot` estão `off` (lendo a própria config);
- guard de rede: localhost permitido, Gov bloqueado;
- roda contra `127.0.0.1` (servidor efêmero próprio), guard de rede **vazio**.

---

## 11. Comandos rodados

```
git checkout -b feat/phase-9-controlled-proof
npm run test:phase9:unit     # 25 passed
npm run typecheck            # ok
npm run lint                 # No ESLint warnings or errors
npm run build                # ok
npm run test:e2e             # 10 passed (laboratório sintético intacto)
npm run test:e2e:phase9      # 3 passed (smoke)
```

Verificações de segurança: nenhuma URL Gov/SINARM como allowlist/alvo; nenhum
segredo real; artifacts (`tests/e2e/phase9-artifacts/runs/`) gitignored e `.gitkeep`
versionado.

---

## 12. Pendências antes de assinar o `docs/34 §16`

Da lista de `docs/35 §11`, esta entrega fecha: **config segura**, **branch dedicada**,
**sessão efêmera (base)**, **logs sem segredo (base)**, **allowlist de rede**.
**Ainda faltam** (fora deste passo):

- [ ] **Ambiente isolado** (máquina/servidor dedicado) definido e preparado.
- [ ] **Política de evidências** formalmente aprovada.
- [ ] **Responsável técnico** designado (docs/34 §3 — campos “preencher antes”).
- [ ] **Ponto de parada confirmado** em “Dados da GRU” pela pessoa responsável.
- [ ] **Autorização/consentimento próprio** documentado.
- [ ] **Bloco `docs/34 §16` assinado.**

Enquanto o §16 não for assinado, o runner permanece **bloqueado por padrão** — não há
“resolve durante”.

---

## 13. Próximo passo

1. Fechar as pendências do §12 (ambiente isolado, responsáveis, política de evidências).
2. **Só então** revisar e, se for o caso, assinar o `docs/34 §16`.
3. Após o §16, ligar a **menor automação possível** (feature flag) — **primeiro em
   conta própria/autorizada, sem clientes reais**, parando em “Dados da GRU”.
4. Registrar a **validação da execução real** em `docs/37` (este `docs/36` é só
   **infra**; não misturar “infra” com “execução validada”).

> **Lembrete permanente:** este documento registra **infra + bloqueios**, não
> autorização. Não implementa automação real, não toca Gov.br/SINARM, não usa dados
> reais. Regras permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) íntegros.
