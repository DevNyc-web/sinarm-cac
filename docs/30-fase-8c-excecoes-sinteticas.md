# 30 — Fase 8C: Caminhos de Exceção Sintéticos no Laboratório

> **O que é este documento.** Registra a **Fase 8C** — a expansão do laboratório
> sintético (Fase 8A) com **modos de simulação de falha** e os **testes Playwright**
> que provam que o sistema **falha com segurança**: para, não avança indevidamente,
> registra o erro, pede intervenção humana quando necessário, permite retry só
> quando explícito, e **nunca gera sucesso fake quando o fluxo falhou**.
>
> **Continua 100% sintético.** Tudo em `localhost`, dados fictícios. **Não** toca
> Gov.br/SINARM, **não** acessa site público real, **não** faz upload/pagamento/
> protocolo real, **não** usa IA para controlar o navegador.
>
> **Data:** 2026-07-20
> **Commit base:** `54d6e6d` — *docs: validate phase 8 synthetic automation lab*
> **Base:** `docs/26` (arquitetura híbrida §5/§8), `docs/27` (Fase 8A), `docs/28`
> (Fase 8B), `docs/29` (validação da Fase 8).

---

## 1. Objetivo da Fase 8C

Provar, em ambiente controlado, o comportamento de **segurança sob falha**: que a
automação **para** quando algo dá errado, **mostra o erro**, **não gera protocolo/
sucesso fictício** e só **retoma (retry)** quando isso é **explícito**. É o ensaio
da **degradação para humano** prevista em `docs/26 §5/§8` — ainda sem tocar sistema
real.

---

## 2. Escopo

- **Alvo único:** `/admin/lab/guia-trafego` (página fake), em `localhost`.
- **Seleção de cenário:** query param `?scenario=<id>` (lido no server e passado ao
  componente) **e** um **seletor visível** na própria rota fake.
- **Motor de teste:** `@playwright/test` (Chromium apenas) — já instalado na 8B.
- **Fora do escopo:** Gov.br/SINARM; site público; dados reais; upload/pagamento/
  protocolo reais; IA no controle do navegador; qualquer rota fora do laboratório.

---

## 3. Cenários sintéticos adicionados

Seletor com `data-testid="scenario-selector"`; cada modo tem seu botão/testid:

| Cenário | Query param / testid | Comportamento sintético |
|---------|----------------------|-------------------------|
| Modo normal | `normal` / `scenario-normal` | caminho feliz (inalterado) |
| Sessão expirada fake | `session-expired` / `scenario-session-expired` | ao iniciar, pausa segura; não continua para a GRU |
| Campo obrigatório inválido | `invalid-field` / `scenario-invalid-field` | Cidade vazia → erro, não avança |
| Arma ambígua | `weapon-ambiguous` / `scenario-weapon-ambiguous` | aviso de revisão humana; exige seleção manual |
| Documento fictício ausente | `missing-document` / `scenario-missing-document` | documento ausente → bloqueia continuidade |
| Falha ao gerar GRU fake | `gru-failure` / `scenario-gru-failure` | erro ao gerar; sem protocolo; retry visível |
| Instabilidade fake do órgão | `external-instability` / `scenario-external-instability` | bloqueia o início do fluxo |
| Pausa para humano | `human-pause` / `scenario-human-pause` | pausa antes do ato sensível |
| Retry permitido | `retry` / `scenario-retry` | 1ª tentativa falha; sucesso só após retry explícito |
| Bloqueio operacional | `operational-block` / `scenario-operational-block` | exige motivo; não gera sucesso |

**Outros `data-testid` da fase:** `exception-banner`, `exception-message`,
`retry-button`, `human-review-required`, `operational-block-message`,
`no-success-assertion-marker`.

---

## 4. Como cada cenário falha com segurança

- **Sessão expirada:** ao clicar em iniciar, mostra "Sessão fictícia expirada. A
  automação foi pausada com segurança."; oferece "Reiniciar laboratório" e
  "Solicitar nova autorização fictícia"; **`fake-success` nunca aparece**.
- **Campo inválido:** Cidade começa vazia; ao "Continuar", mostra "Campo obrigatório
  fictício ausente…" e **permanece na etapa** (não vai a revisão/GRU).
- **Arma ambígua:** exibe "A automação não conseguiu decidir com segurança. Confirme
  manualmente…"; **não seleciona sozinha**; "Continuar" fica desabilitado sem seleção.
- **Documento ausente:** mostra "Documento fictício ausente. Não é seguro
  continuar."; "Continuar" **desabilitado** → não chega à GRU.
- **Falha na GRU:** "Falha fictícia ao gerar GRU. Nenhum protocolo foi criado.";
  **não mostra `PROT-FICT-0001` nem `fake-success`**; oferece **retry seguro**.
- **Instabilidade fake:** "Serviço externo fictício indisponível…" + status
  "Bloqueado por instabilidade fictícia."; **o fluxo não inicia** (sem `lab-start`).
- **Pausa para humano:** "Intervenção humana necessária." **antes** do ato sensível;
  não continua sozinho; **sem GRU, sem sucesso**.
- **Retry permitido:** 1ª tentativa mostra "Tentativa 1 falhou"; o **sucesso só
  aparece após clicar em retry** ("Tentativa 2 concluída") — nada é reprocessado de
  forma invisível.
- **Bloqueio operacional:** "Laboratório bloqueado operacionalmente."; exige
  **motivo fictício**; **não gera sucesso**.

> Em todos os estados de falha há o marcador `no-success-assertion-marker` — âncora
> positiva para os testes confirmarem que aquele é um estado **sem sucesso**.

---

## 5. O que foi testado com Playwright

`tests/e2e/lab-guia-trafego.spec.ts` — **10 testes** (1 caminho feliz + 9 exceções).
Cada teste de exceção prova que:

- o **erro aparece** (banner/mensagem específica);
- o **fluxo não avança** indevidamente;
- **`fake-success` não aparece** quando não deve (`toHaveCount(0)`);
- o **protocolo fictício não aparece** quando não deve;
- o **retry** só conclui quando **explicitamente** clicado (cenário retry);
- a **pausa humana** realmente pausa (sem GRU/sucesso);
- o **guard de rede** continua com a lista de externas **vazia**.

O **caminho feliz continua passando** e gerando a evidência (screenshot).

---

## 6. O que NÃO foi feito

- ❌ Nenhum acesso a Gov.br/SINARM/PF ou site público real.
- ❌ Nenhuma URL externa (só `localhost`).
- ❌ Nenhum dado real; nenhum upload/pagamento/protocolo real.
- ❌ Nenhuma IA controlando o navegador.
- ❌ Nenhuma automação fora do laboratório sintético.
- ❌ Nenhuma dependência nova (Playwright já estava instalado na 8B).

---

## 7. Garantias de segurança confirmadas

- ✅ **Apenas `localhost`** (guard de rede em todos os 10 testes).
- ✅ **Lista de requisições externas vazia** em todos os testes.
- ✅ **Sem Gov.br/SINARM real** (nomes só em texto de aviso e na denylist do guard).
- ✅ **Sem site público real.**
- ✅ **Sem dados reais** (fictícios; CPF placeholder `000.000.000-00`).
- ✅ **Sem upload/pagamento/protocolo real.**
- ✅ **Sem IA** controlando navegador (automação determinística).
- ✅ **Artifacts fora do git** (screenshot/vídeo/trace/report ignorados).
- ✅ **Nenhum screenshot de dado sensível** — a tela é 100% fictícia.

---

## 8. Confirmação: tudo em localhost

`playwright.config.ts` aponta `baseURL` e `webServer` para `http://localhost:3000`.
O guard de rede de cada teste **falha** se qualquer requisição sair de
`localhost`/`127.0.0.1` — e a lista ficou **vazia** nos 10 testes.

## 9. Confirmação: não toca Gov.br/SINARM

Nenhuma navegação/requisição a domínios `gov.br`, `servicos.pf`, `sinarm` ou
`acesso.gov`. Esses nomes aparecem apenas (a) no **texto de aviso** da página fake e
(b) na **denylist** do guard de rede (para *rejeitar*), nunca como destino.

## 10. Confirmação: não há dados reais

Solicitante, CPF, armas, documento, GRU e protocolo são **fictícios e fixos**
(`Cliente Fictício de Teste`, `000.000.000-00`, `FICT-001/002/003`, `REF-FICT-0001`,
`PROT-FICT-0001`, vencimento `31/12/2099 (fictícia)`).

---

## 11. Resultado dos comandos

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ passou |
| `npm run lint` | ✅ passou (sem warnings/erros) |
| `npm run build` | ✅ passou |
| `npm run test:e2e` | ✅ **10 passed** (caminho feliz + 9 exceções) |

---

## 12. Limitações atuais

- Cenários **sintéticos e determinísticos** — não reproduzem o comportamento real
  do órgão (só a **forma** da falha e a resposta segura).
- **Não** há automação real; **não** há sessão/credencial real; **não** há rede
  externa.
- **Não** cobre toda combinação de falhas encadeadas (uma falha por cenário).
- **Não** mede tempo/telemetria de produção — apenas prova comportamental local.

---

## 13. Próximo passo recomendado

- **Observabilidade sintética (opcional):** medir tempo por etapa e taxa de falha na
  página fake (docs/26 §16), ainda em `localhost`.
- **Fechar os gates do `docs/26 §19`** — fora do código — especialmente o **escopo
  jurídico por escrito**, que é o que destrava (no futuro) a **Fase 9** (prova
  técnica controlada em conta própria/autorizada).
- **Não** avançar para Gov/SINARM real enquanto os gates não estiverem fechados.

---

> **Lembrete permanente:** a Fase 8C é **laboratório sintético em `localhost`**. Não
> autoriza automação real, não toca Gov.br/SINARM, não usa dados reais. A automação
> real continua **bloqueada** pelos **gates do `docs/26 §19`** (escopo jurídico por
> escrito + 12 pendências do `docs/23 §5` + segurança de sessão + confirmação
> explícita). Cada avanço depende de **confirmação explícita** do dono.
