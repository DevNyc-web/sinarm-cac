# 35 — Configuração Segura da Fase 9

> **O que é este documento.** Define a **configuração segura** que precisa existir
> **antes** de implementar ou executar a Fase 9 (Prova Técnica Controlada). Nasce da
> **revisão dos pré-checks** do `docs/34 §5/§6`, que encontrou bloqueios: a config
> atual do Playwright é boa para o **laboratório sintético**, mas **insegura** para
> tela real com PII.
>
> **NÃO implementa a Fase 9. NÃO altera o Playwright ainda. NÃO acessa Gov.br/
> SINARM. NÃO usa dados reais.** É decisão técnica documentada — a implementação vem
> depois, sob branch dedicada e após aprovação.
>
> **Data:** 2026-07-20
> **Commit base:** `d53ab63` — *docs: add phase 9 execution checklist*
> **Base:** `docs/33` (plano), `docs/34` (checklist §5/§6/§16), `docs/26`
> (arquitetura), `docs/30` (falha segura).
>
> **Nota de numeração:** o `docs/34 §19` reservava `docs/35` para a *validação* da
> Fase 9; com este documento ocupando o `docs/35`, a validação passa a ser
> `docs/36-validacao-fase-9-prova-controlada.md` (futuro).

---

## 1. Objetivo da configuração segura

A configuração atual do Playwright foi feita para o **laboratório fake**
(`localhost`, dados fictícios) e **não deve ser reutilizada diretamente** num
ambiente real/autorizado. Este documento define uma **config separada e segura**
para a Fase 9, para que evidências e sessão não exponham dados sensíveis.

---

## 2. Diagnóstico da configuração atual

- ✅ **`@playwright/test@1.61.1` instalado**; **Chromium disponível** (cache
  `ms-playwright`).
- ✅ **Config atual usa `localhost`** (`baseURL`/`webServer` em
  `http://localhost:3000` — `playwright.config.ts`).
- ⚠️ **Config atual gera screenshot/video/trace** (`screenshot: "on"`,
  `video: "on"`, `trace: "on"`).
- ✅ **Artifacts são gitignored** (`.gitignore`: `test-results/`,
  `playwright-report/`, `traces/`, `tests/e2e/artifacts/*`).
- ✅ **Isso é aceitável no laboratório sintético** (dados fictícios).
- ❌ **Isso NÃO é aceitável, sem ajuste, em fluxo real com PII.**

---

## 3. Risco de screenshots, vídeos e traces

Em um fluxo real, screenshots/vídeos/traces automáticos podem **capturar**:

- **CPF/RG.**
- **Dados de arma/PCE** (SIGMA, série, calibre).
- **Documentos** (identificação).
- **Protocolo/GRU.**
- **Cookies/tokens** presentes no DOM/rede (o trace registra requisições).
- E ficam em **artifacts locais**.

**Vetores de vazamento:** commit acidental, backup, compartilhamento do arquivo,
ou simples permanência em disco de máquina não isolada.

---

## 4. Decisão recomendada para a Fase 9

Criar uma **config separada** — por exemplo **`playwright.phase9.config.ts`** (ou
equivalente) — que:

- **Roda apenas quando chamada explicitamente** (script próprio, ex.:
  `test:phase9`).
- **Não substitui** o `playwright.config.ts` do laboratório sintético.
- Tem **`baseURL` controlado**.
- **Evita URL real hardcoded** sempre que possível (usar env/allowlist — §10).
- **`trace` desativado** por padrão.
- **`video` desativado** por padrão.
- **`screenshot` desativado** por padrão — ou **apenas manual e mascarado**.
- Salva artifacts em **pasta separada e gitignored**.
- Usa **browser context novo por execução**.
- **Fecha contexto/browser ao final** (inclusive em erro).
- **Impede persistência de `storageState` real.**
- **Bloqueia qualquer artifact sensível.**

> Regra: a config do sintético e a da Fase 9 são **arquivos distintos**; nunca
> reaproveitar a do laboratório para tocar dado real.

---

## 5. Política de evidências da Fase 9

- **Log textual por etapa é a evidência preferida** (etapa, horário, resultado).
- **Screenshot só se mascarado e necessário.**
- **Vídeo/trace desativados no primeiro teste real.**
- **Nenhum artifact sensível entra no git.**
- **Evidência revisada manualmente** após a execução.
- **Evidência sensível expurgada** após a validação.
- Manter apenas um **relatório interno limpo** (sem PII).

---

## 6. Sessão efêmera (requisitos)

- **Novo browser context por execução.**
- **Sem `storageState` persistente.**
- **Sem salvar cookies.**
- **Sem salvar `localStorage`/`sessionStorage`.**
- **Fechar o contexto no `finally`** (garantido mesmo em erro/cancelamento).
- **Apagar cache/arquivos temporários** quando possível.
- **Nunca persistir cookie/token em banco.**
- **Nunca logar cookie/token.**

> Baseline já a favor: o `schema.prisma` **não tem** modelo de sessão/cookie/token
> (verificado na revisão dos pré-checks) — nada persiste sessão hoje.

---

## 7. Logs sem segredo

- **Registrar:** etapa, horário, resultado, erro e motivo de parada.
- **NÃO registrar:** senha, OTP, token, cookie, documento integral, número
  completo sensível ou payload bruto.
- **Aplicar máscara** para CPF/RG/número de arma quando possível (ex.:
  `***.***.***-**`).
- Os logs devem ser **suficientes para auditoria sem expor segredo**.

> Base: `src/lib/logger.ts` já traz a regra "NUNCA registrar PII em claro"; a Fase 9
> precisa **aplicar máscara** de fato no código da automação.

---

## 8. Ambiente isolado

- Rodar a Fase 9 em **máquina/servidor dedicado** ou ambiente **claramente
  isolado**.
- **Acesso restrito** (need-to-know, MFA).
- **Usuário do sistema separado**, se possível.
- **Sem arquivos pessoais** no ambiente.
- **Sem reuso de profile de navegador pessoal.**
- **Não rodar junto** de tarefas normais de desenvolvimento.
- **Limpar artifacts** após a execução.
- **Registrar responsável técnico e operacional.**

---

## 9. Branch dedicada

- **Criar uma branch específica** antes de qualquer código da Fase 9.
- Sugestão de nome: **`feat/phase-9-controlled-proof`**.
- **Não implementar direto na `main`.**
- **PR/revisão antes de merge.**
- **Commits pequenos.**
- **Rollback fácil.**

---

## 10. Guard de rede para a Fase 9

- **No laboratório sintético:** o guard bloqueia **tudo fora de `localhost`**
  (comportamento atual — `tests/e2e/lab-guia-trafego.spec.ts`).
- **Na Fase 9:** o guard deve permitir **apenas domínios explicitamente
  aprovados** (allowlist curta e revisada).
- **Qualquer outro domínio → abortar.**
- **Logar a tentativa bloqueada** sem expor dados sensíveis.

> A allowlist da Fase 9 (domínios oficiais estritamente necessários) deve ser
> **definida e revisada** — e mantida a menor possível.

---

## 11. Critérios para liberar a assinatura do `docs/34 §16`

Só assinar o §16 (autorização de execução) **depois** que **todos**:

- [ ] **Config segura** definida/implementada (`playwright.phase9.config.ts`).
- [ ] **Ambiente isolado** definido.
- [ ] **Branch dedicada** criada.
- [ ] **Política de evidências** aprovada.
- [ ] **Sessão efêmera** implementada.
- [ ] **Logs sem segredo** implementados (com máscara).
- [ ] **Allowlist de rede** definida.
- [ ] **Responsável técnico** definido.
- [ ] **Ponto de parada confirmado** em **"Dados da GRU"**.

---

## 12. O que ainda fica pendente depois desta documentação

- Implementar a **config segura**.
- Criar a **branch**.
- Preparar o **ambiente isolado**.
- Implementar a **automação mínima**.
- Validar **sem tocar cliente real**.
- Preencher o **`docs/34 §16`**.

---

## 13. Próximo passo recomendado

1. **Commitar este documento.**
2. **Criar a branch dedicada** (`feat/phase-9-controlled-proof`).
3. **Implementar apenas a configuração segura** da Fase 9 (a config separada) —
   **sem automação real**.
4. **Rodar os testes existentes** para garantir que o laboratório sintético **não
   quebrou**.
5. **Só depois** revisar o `docs/34 §16`.

> Cada etapa depende de **confirmação explícita**. Nada de automação real antes da
> config segura, da branch, do ambiente isolado e do §16 assinado.

---

## 14. Conclusão

- A **Fase 9 ainda NÃO está liberada.**
- A **config atual é boa para o sintético, ruim para o real.**
- **Separar as configs reduz o risco** (evidências não capturam PII por padrão).
- **Ambiente isolado e branch dedicada são obrigatórios** antes de qualquer código
  da Fase 9.

---

> **Lembrete permanente:** este documento é **decisão técnica**, não implementação.
> Não altera o Playwright, não toca Gov.br/SINARM, não usa dados reais. A execução
> da Fase 9 depende da config segura + ambiente isolado + branch + `docs/34 §16`
> assinado; produção/piloto dependem das pendências do `docs/23 §5` / `docs/32 §7`.
> Regras permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
