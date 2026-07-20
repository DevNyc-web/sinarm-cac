# 29 — Validação da Fase 8: Laboratório de Automação Sintética

> **O que é este documento.** Consolida a **validação da Fase 8** — Laboratório de
> Automação Sintética — reunindo o que foi **criado na 8A** (página fake) e
> **provado na 8B** (automação Playwright contra a página fake). É o registro de
> fechamento da fase.
>
> **Não libera automação real.** A Fase 8 inteira roda **apenas** contra a página
> sintética em `localhost`. Automação contra Gov.br/SINARM **continua bloqueada**
> pelos **gates do `docs/26 §19`**.
>
> **Data:** 2026-07-20
> **Commit validado:** `48f112f` — *test: add Playwright automation for synthetic guia lab*
> **Base:** `docs/26` (arquitetura híbrida), `docs/27` (Fase 8A), `docs/28` (Fase 8B).

---

## 1. Objetivo da validação

Confirmar que o **laboratório sintético** funciona como **prova técnica segura**:
que existe um alvo fake estável (8A) e que um **motor determinístico**
(Playwright, 8B) consegue conduzir o fluxo **ponta a ponta**, validando os
**gates** de segurança, **sem tocar em nenhum sistema real**. É a prova de
mecânica prevista em `docs/26 §11`, dando base para (só depois) expandir com
exceções (Fase 8C).

---

## 2. Escopo validado

- **Alvo único:** `/admin/lab/guia-trafego` (página fake), em `localhost`.
- **Login:** mecanismo **mock/dev** existente (Fase 2), perfil Admin.
- **Motor:** `@playwright/test` (Chromium apenas).
- **Fora do escopo (não validado aqui, por design):** qualquer rota fora do
  laboratório; Gov.br/SINARM; site público; dados reais; upload/pagamento/
  protocolo reais; IA controlando o navegador; caminhos de exceção (ficam para 8C).

---

## 3. O que a Fase 8A entregou

- **Rota interna** `/admin/lab/guia-trafego` (ADMIN/OPERADOR apenas; USER,
  FINANCEIRO e SUPORTE redirecionados).
- **Página fake/sintética** imitando o fluxo da Guia de Tráfego em etapas
  (aviso → solicitante → serviço → destino → arma → documento → justificativa →
  revisão → GRU fake → sucesso), com **log visual** de 8 marcos.
- **Dados 100% fictícios** (Cliente Fictício de Teste, CPF `000.000.000-00`,
  armas FICT-001/002/003, GRU `REF-FICT-0001`, protocolo `PROT-FICT-0001`).
- **`data-testid` estáveis** para automação (`lab-start`, `service-select`,
  `destination-form`, `weapon-table`, `weapon-select-fict-001`,
  `fake-document-status`, `review-confirm-checkbox`, `continue-to-gru`,
  `fake-gru-screen`, `generate-fake-gru`, `fake-success`, `fake-protocol-number`,
  `fake-gru-reference`).
- **Estado 100% no cliente** — sem chamada de rede, sem persistência, sem upload/
  pagamento/protocolo real. (Detalhes em `docs/27`.)

---

## 4. O que a Fase 8B entregou

- **Playwright instalado** de forma mínima: `@playwright/test` (devDependency) +
  **Chromium apenas** (sem Puppeteer, sem Firefox/WebKit).
- **`playwright.config.ts`**: Chromium, `baseURL` e `webServer` em
  `http://localhost:3000` (sobe `npm run dev` e derruba ao final), evidências
  (screenshot/vídeo/trace) ligadas.
- **`tests/e2e/lab-guia-trafego.spec.ts`**: automação do fluxo completo + **guard
  de rede** (prova negativa de escopo).
- **Scripts** `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`.
- **`.gitignore`** atualizado para ignorar evidências geradas (mantendo
  `tests/e2e/artifacts/.gitkeep`). (Detalhes em `docs/28`.)

---

## 5. Caminho feliz provado pela automação

O teste `48f112f` executa e valida, na ordem:

1. **Login mock** — clique no perfil "Admin Exemplo" em `/login` (sem auth real).
2. **Acesso ao laboratório sintético** — `/admin/lab/guia-trafego`.
3. **Validação dos avisos** — página contém "Laboratório sintético", "não é o
   Gov.br", "não é o SINARM", "fictício", "Não oficial".
4. **Preenchimento de destino fictício** — Clube Fictício Playwright · SP ·
   São Paulo · Rua de Teste Automatizado · 123 · Laboratório sintético.
5. **Seleção de arma FICT-001** — `weapon-select-fict-001`, com **prova do gate**:
   "Continuar" fica desabilitado até haver seleção.
6. **Validação de documento fictício** — `documento-ficticio.pdf`, "documento
   fictício carregado".
7. **Gate do checkbox de revisão** — `continue-to-gru` fica **desabilitado** até
   marcar `review-confirm-checkbox`; o resumo mostra os dados preenchidos
   ("Clube Fictício Playwright", "FICT-001").
8. **Tela fake "Dados da GRU"** — `fake-gru-screen` com `REF-FICT-0001`, `R$ 20,00`
   e o aviso "Esta GRU é fictícia. Não pague. Não possui validade.".
9. **Geração de GRU fictícia** — `generate-fake-gru`.
10. **Protocolo fictício** — `fake-protocol-number` = `PROT-FICT-0001`,
    `fake-gru-reference` = `REF-FICT-0001`, texto "Nenhum processo real foi
    protocolado".
11. **Evidência local gerada** — screenshot da tela final em `tests/e2e/artifacts/`.

---

## 6. Comandos executados e resultado

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ passou |
| `npm run lint` | ✅ passou (sem warnings/erros) |
| `npm run build` | ✅ passou |
| `npm run test:e2e` | ✅ **1 passed** (fluxo completo; ~11s de teste) |

---

## 7. Garantias de segurança confirmadas

- ✅ **Apenas `localhost`** — `baseURL`/`webServer` em `http://localhost:3000`.
- ✅ **Sem URL externa** — nenhuma URL não-local no teste/config.
- ✅ **Sem Gov.br/SINARM real** — esses nomes aparecem só na **denylist** do guard
  e na validação do **aviso** da própria página, nunca como destino.
- ✅ **Sem site público real** — o alvo é a página fake local.
- ✅ **Sem dados reais** — destino/arma/GRU fictícios; login mock.
- ✅ **Sem upload real** — a etapa de documento é só exibição de status.
- ✅ **Sem pagamento real** — a GRU é fictícia.
- ✅ **Sem protocolo real** — o sucesso é sintético.
- ✅ **Sem IA controlando o navegador** — automação 100% determinística.
- ✅ **Artifacts fora do git** — screenshot/vídeo/trace/report ignorados.

---

## 8. Guard de rede (prova negativa de escopo)

O teste registra **toda requisição** feita pela página. Uma requisição é marcada
como violação se **não** for `localhost`/`127.0.0.1` (qualquer esquema http/ws) ou
se contiver `gov.br`, `servicos.pf`, `sinarm` ou `acesso.gov`. Ao final, o teste
**falha** se a lista de violações não estiver vazia.

- **Resultado:** a lista de requisições externas/proibidas ficou **vazia** — o
  fluxo inteiro rodou sem uma única chamada fora de `localhost`. É a prova, no
  próprio teste, de que a Fase 8 **não toca sistema real**.

---

## 9. Evidências locais

| Evidência | Local | Git |
|-----------|-------|-----|
| Screenshot da tela final | `tests/e2e/artifacts/lab-final-*.png` | **ignorado** |
| Vídeo da execução | `test-results/.../video.webm` | **ignorado** |
| Trace | `test-results/.../trace.zip` | **ignorado** |
| Relatório HTML | `playwright-report/` | **ignorado** |

Todas são **geradas localmente** ao rodar `npm run test:e2e` e **ignoradas pelo
git** (`.gitignore`, seção Playwright). Apenas `tests/e2e/artifacts/.gitkeep` é
versionado, para manter a pasta. Nenhuma evidência entra no repositório.

---

## 10. Dependência instalada

- **`@playwright/test`** — `^1.61.1` (devDependency).
- **Browser: Chromium apenas** (`npx playwright install chromium`).
- **Sem Puppeteer.**
- **Sem outros browsers** (Firefox/WebKit não instalados).

> Instalação mínima, só o necessário para rodar o teste em Chromium local.

---

## 11. Limitações atuais (o que ainda NÃO é coberto)

- Cobre **apenas o caminho feliz**.
- **Não** testa exceções.
- **Não** testa **sessão expirada**.
- **Não** testa **arma ambígua** (multi-arma / divergência).
- **Não** testa **erro de GRU** (valor divergente, falha ao gerar).
- **Não** testa **instabilidade fake** do "sistema".
- **Não** mede **retry/retomada**.
- **Não** toca sistema real (por design — e assim permanece).

> Essas lacunas são **intencionais** nesta fase e viram o escopo da **Fase 8C**
> (§14), ainda 100% em página fake.

---

## 12. Critérios para considerar a Fase 8 validada

- [x] Página fake/sintética criada e acessível só a ADMIN/OPERADOR (8A).
- [x] Playwright instalado de forma mínima (Chromium; sem Puppeteer) (8B).
- [x] Automação conduz o **caminho feliz ponta a ponta** contra a página fake.
- [x] **Gates** provados (arma exige seleção; GRU exige checkbox de revisão).
- [x] **Guard de rede** com lista de externas **vazia**.
- [x] `typecheck`, `lint`, `build`, `test:e2e` **todos verdes**.
- [x] Evidências geradas localmente e **fora do git**.
- [x] Nenhum toque em Gov.br/SINARM/site público/dados reais.

**Conclusão:** todos os critérios atendidos → **Fase 8 validada** como prova
técnica segura.

---

## 13. Critérios para NÃO avançar para Gov/SINARM real

A automação **não** pode mirar o sistema real enquanto qualquer um destes estiver
aberto (gates do `docs/26 §19`):

- ❌ **Escopo jurídico por escrito** ausente (server-side operando a sessão gov;
  sem procuração; responsabilidade por erro).
- ❌ **12 pendências do piloto** (`docs/23 §5`) não fechadas — auth real + MFA,
  storage produção + KMS + retenção, Mercado Pago produção + webhook público,
  termos + reembolso, revisão jurídica, política operacional, treinamento.
- ❌ **Segurança de sessão** (efêmera, não persistir cookie/token, isolamento)
  não implementada/revisada.
- ❌ **Caminhos de exceção** ainda não ensaiados no laboratório (Fase 8C).
- ❌ **Confirmação explícita do dono** ausente.

> Enquanto houver **um** item aberto: **nada de Gov.br/SINARM real, nada de dado
> real, nada de protocolo real.**

---

## 14. Próximo passo recomendado — Fase 8C (Caminhos de exceção sintéticos)

Expandir o laboratório **ainda usando apenas a página fake**, para ensaiar a
resiliência e a **degradação para humano** (docs/26 §5/§8):

- **Sessão expirada** (fake) → pedir novo login / retomar do ponto seguro.
- **Campo inválido** → validação e correção.
- **Arma ambígua / multi-arma** → parar e exigir confirmação humana.
- **Falha na GRU** (valor divergente / erro ao gerar) → alerta e bloqueio.
- **Instabilidade fake** do "sistema" → fila/retomada.
- **Pausa para humano** → o teste **para** antes do irreversível (ensaio do gate).
- **Retry/retomada** → medir tentativas e comportamento.

> **Tudo em página fake, em `localhost`. Sem Gov.br/SINARM real.** A Fase 8C não
> altera os gates do §13 — apenas amadurece o laboratório.

---

## 15. Conclusão

- **Fase 8 validada** como **prova técnica segura**: o laboratório sintético existe
  (8A) e a automação determinística conduz o caminho feliz ponta a ponta, com
  gates e prova negativa de rede (8B).
- **Automação real continua bloqueada** pelos gates do `docs/26 §19` (§13).
- **O laboratório sintético está pronto para ser expandido** com **caminhos de
  exceção** (Fase 8C), ainda sem tocar Gov/SINARM real.

---

> **Lembrete permanente:** a Fase 8 é **laboratório sintético em `localhost`**. Não
> autoriza automação real, não toca Gov.br/SINARM, não usa dados reais. Cada
> avanço depende de **confirmação explícita** do dono e dos **gates do
> `docs/26 §19`**.
