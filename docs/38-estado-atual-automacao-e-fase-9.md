# 38 — Estado Atual da Automação e da Fase 9

> **O que é este documento.** Consolida, num único lugar, o **estado atual** da
> automação após os merges recentes. É um **retrato**, não uma autorização:
> **não libera execução real**, **não** toca Gov.br/SINARM, **não** fecha gate
> nenhum e **não** altera código.
>
> **Fase 9 continua INERTE.** `PHASE9_REAL_EXECUTION_ENABLED` continua `false`.
> Merge de infraestrutura **não é** autorização de execução real.
>
> **Data:** 2026-07-26
> **Base:** `docs/26 §19` (gates), `docs/34 §16` (checklist não assinado),
> `docs/35`/`docs/36` (config/infra Fase 9), `docs/37` (Fase 8D).

---

## 1. Estado da `main`

| PR | Situação | Conteúdo |
|----|----------|----------|
| #29 | **merge** | Fase 8D — log seguro e relatório do Automation Lab sintético |
| #30 | **merge** | Fase 9 *controlled proof* adaptada à `main` atual (infra inerte) |
| #31 | **merge** | Storage local `@/server/storage` corrigido (módulo ausente) |
| #32 | **merge** | Redação promovida de `lab/` para módulo compartilhado `src/server/automation/redaction.ts` (rename byte-idêntico) |
| #33 | **merge** | Script agregador `test:unit:all` — inclui os testes unitários da Fase 9 no fluxo de verificação |
| #1  | **fechado** | Substituído funcionalmente pelo PR #30 (não absorvido literalmente); branch preservada como referência histórica |

A `main` compila, passa nos testes unitários (`npm run test:unit:all`, que
agrega `test:documents:unit` + `test:phase9:unit`) e no build. Nenhuma
automação real foi liberada por esses merges.

## 2. Fase 8D — Automation Lab sintético

- **Laboratório sintético**: exercita navegação/preenchimento/falha/retry contra
  páginas **fake locais** — nunca serviço oficial.
- **Log seguro**: redação/sanitização implementada como mecanismo, não promessa
  em comentário (chave de segredo vira `[REDACTED]`; PII em claro é mascarada).
- **Relatório estruturado**: determinístico, auto-declarado `LAB_SINTETICO`,
  incapaz de produzir protocolo quando o run falhou.
- **Artifacts gitignored**: evidências do lab não são versionadas.
- **Sem Gov.br/SINARM**, sem credencial, sem documento real, sem rede externa.

## 3. Fase 9 — infraestrutura presente, porém inerte

- **Infra na `main`**: runner, guarda de rede, audit logger e camada de segurança
  existem no código (`src/server/automation/phase9/`).
- **Controlled proof**: prova a *forma* do controle (sessão, logs redigidos,
  parada humana) **sem** execução real.
- **Runner inerte**: `PHASE9_REAL_EXECUTION_ENABLED = false` (constante). Os
  caminhos bloqueados marcam `sessionDiscarded: true` e **não** executam.
- **Sem execução real**: nenhum acesso a Gov.br/SINARM, nenhuma credencial,
  nenhum protocolo. A infra estar presente **não** significa estar ligada.
- **Redação compartilhada** (PR #32): o `auditLogger` da Fase 9 consome o módulo
  `src/server/automation/redaction.ts` (mesmo módulo usado pela Fase 8D) —
  comportamento byte-idêntico, `[REDACTED]` e proteção de métrica numérica
  preservados.

## 4. Storage

- `@/server/storage` **existe** (corrigido no PR #31).
- Adapter **local** `FileSystemStorage`, contrato `put/get/exists`.
- Grava em `storage-local/` — **gitignored**.
- **Sem** nuvem, **sem** rede, **sem** credenciais, **sem** URL pública/assinada.
- Uso atual: uploads **fictícios** de dev (Fase 4); apenas metadados + sha256 no
  banco.

## 5. Gates — o que continua fechado

- **Gates 1, 2, 3 e 5** de `docs/26 §19` continuam **abertos** (não vencidos).
- **`docs/34 §16`** continua **não assinado / em branco**.
- **Merge de infraestrutura ≠ autorização de execução real.** Nenhum texto deste
  documento fecha gate, libera Gov.br/SINARM ou liga a flag. Qualquer execução
  real depende de aprovação escrita e dos gates cumpridos — fora do escopo aqui.

## 6. Próximas pendências (mapeadas, não executadas)

> Já concluídos: **redação compartilhada** (PR #32) e **`test:unit:all`**
> (PR #33) — ver §1/§3. Restam abaixo apenas itens **não** iniciados.

- **Diagnóstico de validação real (futuro `docs/39`)** — mapear pré-condições,
  gates, riscos e checklist antes de qualquer ensaio; **diagnóstico**, não
  liberação. (`docs/38`, este arquivo, já está ocupado pelo retrato de estado.)
- **Política de sessão / credenciais / documentos reais** — definir por escrito
  antes de considerar execução real.

> **Fecho.** Este documento descreve o que **está** na `main` hoje. Ele **não**
> autoriza, **não** liga a Fase 9 e **não** altera nenhum gate.
