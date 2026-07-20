# 27 — Fase 8A: Laboratório de Automação Sintética (página fake)

> **O que é este documento.** Registra a **Fase 8A** — a criação de uma **página
> fake/sintética** que imita o fluxo de Guia de Tráfego para servir de **alvo
> seguro** à automação futura (Fase 8B). Implementado e validado em **dev**, com
> **dados 100% fictícios**.
>
> **Não libera automação real.** Esta fase **não** cria Playwright, **não** toca
> Gov.br/SINARM, **não** acessa site público real, **não** faz upload/pagamento
> real e **não** protocola nada. É apenas o **ambiente fake** que depois será
> automatizado.
>
> **Data:** 2026-07-20
> **Base:** `docs/26` (arquitetura híbrida — §10/§11), `docs/25` (visão),
> `docs/10 §4/§8` e `docs/09 §15` (fluxo da Guia), `docs/21`/`docs/22` (limites da
> execução assistida), `docs/11 §2/§3` (RBAC).

---

## 1. Objetivo da Fase 8A

Criar uma **página sintética** que reproduz **visualmente e em etapas** o fluxo da
Guia de Tráfego (solicitante → serviço → destino → arma → documento →
justificativa → revisão → GRU → sucesso), com **elementos estáveis** (`data-testid`)
para que, na **Fase 8B**, a automação determinística (Playwright/Puppeteer) tenha
**um alvo controlado** — sem nenhum risco de tocar sistema real.

Serve para, mais adiante, **provar** que o sistema consegue **preencher, avançar,
validar, pausar, confirmar, gerar PDF/GRU fake e registrar** — em ambiente
100% controlado (docs/26 §11).

---

## 2. O que foi criado

| Item | Detalhe |
|------|---------|
| **Rota interna** | `/admin/lab/guia-trafego` (grupo `(admin)`) |
| **Server Component** | `src/app/(admin)/admin/lab/guia-trafego/page.tsx` — guard `requireAdminRole(["ADMIN","OPERADOR"])` |
| **Client Component** | `src/app/(admin)/admin/lab/guia-trafego/LabGuiaTrafego.tsx` — wizard sintético (estado 100% local) |
| **Link de acesso** | botão "Laboratório sintético (Fase 8A)" no `/admin`, visível **só** para ADMIN/OPERADOR |

**Etapas do wizard (todas fictícias):**
1. **Aviso do laboratório** — ambiente sintético, não é Gov.br/SINARM, não acessa
   sistema real, não usa dados reais, serve para testar automação.
2. **Solicitante fictício** — Cliente Fictício de Teste · CPF `000.000.000-00` ·
   RG FICTÍCIO · "Cadastro fictício carregado".
3. **Serviço fake** — Emitir Guia de Tráfego PF (CAC) · Taxas Diversas · R$ 20,00 ·
   Tiro Desportivo - Atirador Desportivo · Treinamento Tiro Desportivo · Arma de Fogo.
4. **Destino fake** — campos editáveis (evento/clube, UF, cidade, logradouro,
   número, complemento opcional), com valores fictícios por padrão.
5. **Arma/PCE fake** — tabela com 3 armas fictícias (FICT-001/002/003) + seleção +
   aviso "Em produção, a seleção de arma/PCE exigirá confirmação explícita do usuário."
6. **Documento fake** — Documento de Identificação Pessoal · "documento fictício
   carregado" · `documento-ficticio.pdf` (sem upload real).
7. **Justificativa fake** — "Guia para treino".
8. **Revisão antes da GRU** — resumo completo + **checkbox obrigatório** ("Confirmo
   que revisei os dados fictícios deste laboratório e autorizo continuar para a
   simulação da GRU."); sem o checkbox, o botão de avanço fica **desabilitado**.
9. **Tela fake "Dados da GRU"** — contribuinte, CPF `000.000.000-00`, UG/Gestão
   `167086/00001`, Fundo do Exército, código `11300-0`, referência `REF-FICT-0001`,
   vencimento `31/12/2099 (fictícia)`, valores R$ 20,00 + aviso "Esta GRU é
   fictícia. Não pague. Não possui validade."
10. **Botão final** — "Gerar GRU fictícia e salvar laboratório" (não gera
    pagamento/protocolo real; só avança para o sucesso fake).
11. **Sucesso fake** — Protocolo `PROT-FICT-0001` · GRU `REF-FICT-0001` · "Laboratório
    concluído" · "Este resultado é sintético. Nenhum processo real foi protocolado."
12. **Log visual lateral** — 8 marcos (cadastro → serviço → destino → arma →
    documento → revisão → GRU → concluído) com status conforme o avanço.

**`data-testid` estáveis para a Fase 8B:** `lab-start`, `service-select`,
`destination-form`, `weapon-table`, `weapon-select-fict-001` (e `-002`/`-003`),
`fake-document-status`, `review-confirm-checkbox`, `continue-to-gru`,
`fake-gru-screen`, `generate-fake-gru`, `fake-success`, `fake-protocol-number`,
`fake-gru-reference`.

---

## 3. O que NÃO foi criado

- ❌ **Nenhum script Playwright/Puppeteer** — a automação é a **Fase 8B**.
- ❌ **Nenhuma chamada de rede** — o wizard roda 100% no cliente (`useState`), sem
  `fetch`, sem server action, sem endpoint.
- ❌ **Nenhum acesso a Gov.br/SINARM** nem a qualquer site público real.
- ❌ **Nenhum upload real** — a etapa de documento é só exibição de status.
- ❌ **Nenhum pagamento real** — a GRU é fictícia.
- ❌ **Nenhum protocolo real** — o "sucesso" é sintético.
- ❌ **Nenhuma persistência** — nada é gravado no banco (é um laboratório de UI).
- ❌ **Nenhuma dependência nova** instalada.

---

## 4. Limites de segurança (confirmados no código e em runtime)

- **Sem sistema real:** as únicas ocorrências de "Gov.br"/"SINARM" nos arquivos do
  lab são **texto de aviso** e comentários; **zero** URL/`fetch`.
- **Sem PII real:** todos os dados são fictícios (nome "Cliente Fictício de Teste",
  CPF `000.000.000-00`, armas FICT-00x sem série/SIGMA reais).
- **Sem Playwright/Puppeteer/Selenium** — ausentes de `package.json` e de
  `node_modules`.
- **Acesso restrito:** guard `requireAdminRole(["ADMIN","OPERADOR"])`.
- **Comunicação honesta:** marcador permanente "Laboratório sintético" visível em
  toda etapa; textos "sintético/fictício/não oficial/não acessa sistema real".

---

## 5. Rota criada

- **URL:** `/admin/lab/guia-trafego`
- **Acesso:** **ADMIN** e **OPERADOR** apenas (docs/21 §10).
- **Bloqueio:** USER, FINANCEIRO e SUPORTE são redirecionados para
  `/login?motivo=perfil`; sem sessão → `/login?motivo=sessao`.

---

## 6. Dados fictícios usados

| Bloco | Valores |
|-------|---------|
| Solicitante | Cliente Fictício de Teste · CPF `000.000.000-00` · RG FICTÍCIO |
| Serviço | Guia de Tráfego PF (CAC) · Taxas Diversas · R$ 20,00 · Tiro Desportivo - Atirador Desportivo · Treinamento Tiro Desportivo · Arma de Fogo |
| Destino (padrão) | Clube de Tiro Fictício Alfa · SP · Cidade Fictícia · Rua Sintética de Teste · 100 |
| Armas | FICT-001 Pistola/Marca Teste/Modelo Alfa/9mm · FICT-002 Carabina/.22 · FICT-003 Revólver/.38 |
| Documento | Documento de Identificação Pessoal · `documento-ficticio.pdf` |
| Justificativa | Guia para treino |
| GRU | UG/Gestão `167086/00001` · Fundo do Exército · `11300-0` · ref `REF-FICT-0001` · venc. `31/12/2099 (fictícia)` · R$ 20,00 |
| Resultado | Protocolo `PROT-FICT-0001` · GRU `REF-FICT-0001` |

> Nenhum desses valores corresponde a pessoa, arma, protocolo ou GRU reais. Datas e
> números são fixos e marcados como fictícios (determinismo p/ a Fase 8B).

---

## 7. Verificações executadas

| Verificação | Resultado |
|-------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ (sem warnings/erros) |
| `npm run build` | ✅ (rota `/admin/lab/guia-trafego` compilada, dinâmica) |
| Acesso ADMIN | ✅ HTTP 200 |
| Acesso OPERADOR | ✅ HTTP 200 |
| Bloqueio USER | ✅ 307 → `/login?motivo=perfil` |
| Bloqueio SUPORTE | ✅ 307 → `/login?motivo=perfil` |
| Sem sessão | ✅ 307 → `/login?motivo=sessao` |
| Marcadores sintéticos + 8 marcos no HTML | ✅ presentes |
| Sem chamada de rede / URL no lab | ✅ nenhuma |
| Sem upload real / sem pagamento | ✅ confirmado |
| Sem Playwright em `package.json`/`node_modules` | ✅ ausente |

---

## 8. Critérios para passar à Fase 8B

- [ ] Página fake estável e revisada (esta Fase 8A) — **concluída**.
- [ ] Decisão explícita do dono de **instalar Playwright/Puppeteer** (dependência nova).
- [ ] Escopo da 8B: **automatizar apenas a página fake** (`/admin/lab/guia-trafego`),
      medir tempo por etapa, logs, falhas, retries e screenshots (mascarados).
- [ ] **Nada** de Gov.br/SINARM/site público real na 8B — o alvo é a página local.
- [ ] Confirmar que a automação **para na confirmação sensível** (checkbox de
      revisão) como ensaio do gate humano (docs/25 §4.3, docs/26 §5).

---

## 9. Confirmações finais

- **Não há Gov.br/SINARM real** nesta fase (verificado no código e em runtime).
- **Não há Playwright ainda** (verificado em `package.json` e `node_modules`).
- **Não há dados reais** (tudo fictício e marcado como tal).
- **Não há upload/pagamento/protocolo real.**
- **Automação real segue bloqueada** pelos gates do `docs/26 §19` (escopo jurídico
  por escrito + 12 pendências do `docs/23 §5` + segurança de sessão + confirmação).

---

## 10. Próximo passo

**Fase 8B — Automação Playwright contra a página fake.** Mediante **confirmação
explícita** do dono (inclui aprovar a dependência), automatizar **somente**
`/admin/lab/guia-trafego`, provando preenchimento/avanço/validação/pausa/confirmação/
geração de PDF-GRU fake/auditoria, com medição de tempo, logs, falhas e screenshots.
**Nenhum toque em sistema real** — o alvo é a página sintética desta fase.

---

> **Lembrete permanente:** a Fase 8A é **ambiente fake**. Não autoriza automação
> real, não instala Playwright, não toca Gov.br/SINARM, não usa dados reais. Cada
> avanço depende de **confirmação explícita** do dono e dos **gates do `docs/26 §19`**.
