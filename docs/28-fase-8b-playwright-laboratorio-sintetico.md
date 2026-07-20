# 28 — Fase 8B: Automação Playwright contra o Laboratório Sintético

> **O que é este documento.** Registra a **Fase 8B** — a **primeira automação
> Playwright** do projeto, executada **exclusivamente** contra a rota fake/sintética
> da Fase 8A (`/admin/lab/guia-trafego`). Implementada e validada em **dev**.
>
> **Não libera automação real.** A automação toca **apenas** a página sintética em
> `localhost`. **Não** acessa Gov.br/SINARM, **não** acessa site público real,
> **não** usa dados reais, **não** faz upload/pagamento/protocolo real.
>
> **Data:** 2026-07-20
> **Commit base (Fase 8A):** `ceb1932` — *feat: add synthetic automation lab for guia de trafego*
> **Base:** `docs/26` (arquitetura híbrida), `docs/27` (laboratório sintético).

---

## 1. Objetivo

Provar, com um motor **determinístico** (Playwright), que a automação consegue
conduzir o fluxo sintético da Guia de Tráfego **ponta a ponta**, parando/validando
os **gates** (arma, confirmação de revisão) — em ambiente 100% controlado, sem
nenhum toque em sistema real. É a prova de mecânica prevista em `docs/26 §11`.

---

## 2. Escopo

- **Alvo único:** `/admin/lab/guia-trafego` (página fake da Fase 8A), em `localhost`.
- **Motor:** `@playwright/test` (Chromium apenas).
- **Login:** mecanismo **mock/dev existente** (Fase 2) — clica o perfil "Admin
  Exemplo" na tela `/login`; nenhum usuário/auth real criado.
- **Fora do escopo:** qualquer rota fora do laboratório; Gov.br/SINARM; site
  público; dados reais; upload/pagamento/protocolo reais; IA no controle do
  navegador.

---

## 3. Dependência instalada

| Item | Detalhe |
|------|---------|
| `@playwright/test` | `^1.61.1` (devDependency) |
| Browser | **Chromium apenas** (`npx playwright install chromium`) — sem Firefox/WebKit |
| Puppeteer / outras | **NÃO** instalados |

> Instalação mínima: só o necessário para rodar o teste em Chromium local.

---

## 4. Rotas testadas

- `/login` — autenticação mock/dev (clique no perfil Admin).
- `/admin/lab/guia-trafego` — o laboratório sintético (todo o fluxo).

**Nenhuma outra rota** é automatizada.

---

## 5. O que a automação faz

1. Faz **login mock** (perfil Admin) pela tela `/login` existente.
2. Abre `/admin/lab/guia-trafego`.
3. **Valida o aviso** de ambiente sintético (contém "Laboratório sintético", "não
   é o Gov.br", "não é o SINARM", "fictício", "Não oficial").
4. Inicia o fluxo (`lab-start`) e avança solicitante → serviço.
5. **Preenche o destino fictício:** Clube Fictício Playwright · SP · São Paulo ·
   Rua de Teste Automatizado · 123 · Laboratório sintético.
6. **Seleciona arma fictícia** `weapon-select-fict-001` — e **prova o gate**:
   o botão "Continuar" fica **desabilitado** até haver seleção.
7. **Valida o documento fictício** (`documento-ficticio.pdf`, "documento fictício
   carregado").
8. **Confirma a revisão** — e **prova o gate**: `continue-to-gru` fica
   **desabilitado** até marcar `review-confirm-checkbox`. Também confere que o
   resumo mostra os dados preenchidos ("Clube Fictício Playwright", "FICT-001").
9. **Valida a tela fake "Dados da GRU"** (`fake-gru-screen`): `REF-FICT-0001`,
   `R$ 20,00` e o aviso "Esta GRU é fictícia. Não pague. Não possui validade.".
10. **Gera a GRU fictícia** (`generate-fake-gru`).
11. **Valida o sucesso fictício:** `fake-protocol-number` = `PROT-FICT-0001`,
    `fake-gru-reference` = `REF-FICT-0001`, e o texto "Nenhum processo real foi
    protocolado".
12. **Salva evidência local** (screenshot da tela final em `tests/e2e/artifacts/`).
13. **Prova negativa de escopo:** um listener de rede acumula qualquer requisição
    **não-localhost** ou que contenha `gov.br`/`servicos.pf`/`sinarm`/`acesso.gov`;
    ao final, o teste **falha** se essa lista não estiver vazia.

---

## 6. O que a automação NÃO faz

- ❌ Não acessa Gov.br, SINARM, PF nem qualquer site público real.
- ❌ Não visita nenhuma URL externa (só `localhost`).
- ❌ Não usa dados reais (tudo fictício).
- ❌ Não faz upload real, pagamento real nem gera protocolo real.
- ❌ Não usa IA para controlar o navegador (é 100% determinística).
- ❌ Não automatiza nenhuma rota fora do laboratório sintético.
- ❌ Não instala Puppeteer nem browsers além do Chromium.

---

## 7. Evidências geradas (não versionadas)

| Evidência | Local | Git |
|-----------|-------|-----|
| Screenshot da tela final | `tests/e2e/artifacts/lab-final-*.png` | **ignorado** |
| Vídeo da execução | `test-results/.../video.webm` | **ignorado** |
| Trace | `test-results/.../trace.zip` | **ignorado** |
| Relatório HTML | `playwright-report/` | **ignorado** |

Apenas `tests/e2e/artifacts/.gitkeep` é versionado (mantém a pasta). Regras em
`.gitignore` (seção "Playwright / automação — Fase 8B").

---

## 8. Como rodar localmente

Pré-requisito (uma vez): `npm install` e `npx playwright install chromium`.

O Playwright **sobe o app local sozinho** (via `webServer: npm run dev`) e o
derruba ao final — não é preciso iniciar o servidor à mão.

| Comando | O que faz |
|---------|-----------|
| `npm run test:e2e` | roda o teste (headless) |
| `npm run test:e2e:headed` | roda com navegador visível |
| `npm run test:e2e:ui` | abre o runner interativo do Playwright |
| `npm run test:e2e:report` | abre o último relatório HTML |

> Se já houver um dev server em `localhost:3000`, o Playwright o reaproveita
> (`reuseExistingServer` local).

---

## 9. Limites de segurança (verificados)

- **Só `localhost`:** `baseURL` e `webServer` apontam para `http://localhost:3000`;
  o próprio teste **falha** se detectar requisição externa.
- **Sem Gov.br/SINARM:** as únicas ocorrências desses nomes no teste estão na
  **lista de bloqueio** do guard de rede (para *rejeitar*), nunca como alvo.
- **Sem credenciais reais:** login é o mock/dev (perfil fictício via cookie).
- **Sem dados reais:** valores de destino/arma/GRU são fictícios.
- **Sem Puppeteer**, sem browsers além do Chromium.

---

## 10. Verificações executadas

| Verificação | Resultado |
|-------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ (sem warnings/erros) |
| `npm run build` | ✅ |
| `npm run test:e2e` | ✅ **1 passed** (fluxo completo) |
| Teste acessa apenas `localhost` | ✅ (guard de rede, lista vazia) |
| Sem URL Gov.br/SINARM no teste/config | ✅ (apenas na denylist do guard) |
| Sem dados reais | ✅ |
| Artifacts gerados fora do git | ✅ (PNG/traces/vídeo/report ignorados) |

---

## 11. Próximos passos possíveis

- **Ampliar o laboratório** com caminhos de exceção (sessão "expira", campo
  inválido, arma ambígua) para exercitar a **degradação para humano** (docs/26 §5/§8).
- **Medir tempo por etapa** e taxa de falha na página fake (observabilidade,
  docs/26 §16).
- **Ensaiar o gate humano**: manter o teste **parando** antes do irreversível como
  ensaio do "confirma humano" (docs/25 §4.3, docs/26 §5).

> **Nada disso toca sistema real.** A automação contra Gov.br/SINARM **continua
> bloqueada** pelos **gates do `docs/26 §19`** (escopo jurídico por escrito + 12
> pendências do `docs/23 §5` + segurança de sessão + confirmação explícita).

---

> **Lembrete permanente:** a Fase 8B automatiza **apenas** o laboratório
> sintético em `localhost`. Não autoriza automação real, não toca Gov.br/SINARM,
> não usa dados reais. Cada avanço depende de **confirmação explícita** do dono e
> dos **gates do `docs/26 §19`**.
