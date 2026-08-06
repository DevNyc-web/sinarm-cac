# 72 — Desenho do laboratório sintético de automação — Fase 2

> **O que é este documento.** O **desenho** do laboratório sintético da Fase 2,
> previsto no [`docs/71 §9.1`](71-decisao-arquitetura-sessao-fase-2.md) como o
> passo seguinte à decisão de arquitetura de sessão. Descreve o que o
> laboratório precisa passar a cobrir — **handoff sintético**, **contrato
> abstrato de sessão**, eventos, evidências e testabilidade — **sem construir
> nada**.
>
> **Um laboratório já existe.** As Fases técnicas **8A–8D** (`docs/27`, `docs/28`,
> `docs/30`, `docs/37`) entregaram portal sintético, automação Playwright contra
> `localhost`, exceções sintéticas e log seguro. Este documento **não recomeça**
> o laboratório: mapeia o que já está pronto (§3) e desenha **só as lacunas** que
> a Fase 2 acrescenta (§7).
>
> - ❌ **NÃO implementa** código, Playwright real, portal, contrato ou evento.
> - ❌ **NÃO acessa** Gov.br/SINARM/PF e **NÃO abre** execução real.
> - ❌ **NÃO usa** CPF real, senha, OTP, cookie ou credencial Gov.br real.
> - ❌ **NÃO altera** a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED` — segue
>   `false as const`.
> - ❌ **NÃO altera** `src`, `prisma`, `tests`, `package.json`,
>   `package-lock.json`, `.env`, `docs/25`, `docs/26` ou `docs/70`.
> - ❌ **NÃO libera** cliente real nem produção.
>
> **Data:** 2026-08-05
> **Base da `main`:** `f248df7` — *docs: decide phase 2 session architecture (#140)*
> **Referências:** [`docs/71`](71-decisao-arquitetura-sessao-fase-2.md) (a decisão
> que este desenho executa), [`docs/27`](27-fase-8a-laboratorio-sintetico.md)
> (portal sintético 8A), [`docs/28`](28-fase-8b-playwright-laboratorio-sintetico.md)
> (Playwright em `localhost` 8B), [`docs/30`](30-fase-8c-excecoes-sinteticas.md)
> (10 exceções sintéticas 8C), [`docs/37`](37-fase-8d-log-seguro-e-relatorio.md)
> (redação e relatório 8D), [`docs/26 §19`](26-arquitetura-automacao-hibrida.md)
> (gates), [`docs/23 §5`](23-checklist-piloto-real.md) (12 pendências de produção),
> [`docs/05 §11b`](05-logs-auditoria-lgpd.md) (log de acesso a PII).

---

## 1. Status

| # | Registro |
|---|---|
| 1.1 | **A Fase 2 segue como laboratório e preparação** — este documento não a promove a execução. |
| 1.2 | **Baseado no `docs/71`**, que decidiu preparar a **Opção B (handoff assistido)** em ambiente sintético, mantendo a **Opção A** como entrega de curto prazo. |
| 1.3 | **Desenho, não construção.** Docs-only; nenhuma linha de código, teste ou dependência. |
| 1.4 | **Não executa portal real** — nem uma requisição a Gov.br/SINARM/PF. |
| 1.5 | **Não usa CPF real**, nem senha, OTP, cookie ou credencial Gov.br real. |
| 1.6 | **Não altera a Fase 9** (§12). |
| 1.7 | **Não libera cliente real** nem produção. |
| 1.8 | **Nenhum gate do `docs/26 §19` é fechado aqui**; nenhuma pendência do `docs/23 §5` é fechada. |

---

## 2. Objetivo do laboratório sintético

| # | Objetivo |
|---|---|
| 2.1 | **Simular o fluxo de automação sem Gov.br/SINARM/PF real** — o alvo é sempre uma página do próprio projeto. |
| 2.2 | **Validar a arquitetura de handoff sintético** — a automação abre, **para**, espera um sinal de sessão pronta e continua, sem nunca digitar credencial (`docs/71 §4.2`, `docs/42 §6`). |
| 2.3 | **Validar o contrato abstrato de sessão** — provar que o motor funciona recebendo **apenas um handle opaco**, e que nada além disso é necessário (§5). |
| 2.4 | **Validar logs, eventos, estados, erros e evidências** — que a trilha seja suficiente para auditar e insuficiente para vazar. |
| 2.5 | **Permitir testes reprodutíveis em `localhost`** — mesma entrada, mesmo resultado, sem rede externa. |

> **O objetivo real não é "automatizar a página falsa".** Isso o `docs/28` já
> faz. É **provar que o desenho de sessão da Opção B se sustenta** — e produzir
> a evidência que o gate jurídico e o dono vão avaliar (`docs/71 §5`). Um
> laboratório que só repete o caminho feliz não decide nada.

---

## 3. Ponto de partida — o que já existe

Verificado na `main` `f248df7`. **Nada aqui precisa ser reconstruído.**

| # | Já existe | Onde |
|---|---|---|
| 3.1 | **Portal sintético completo** — wizard de 12 etapas, do aviso de laboratório ao sucesso fake, com `data-testid` estáveis | `src/app/(admin)/admin/lab/guia-trafego/` (`docs/27 §2`) |
| 3.2 | **Dados fictícios** — CPF `000.000.000-00`, armas `FICT-001/002/003`, GRU `REF-FICT-0001`, protocolo `PROT-FICT-0001` | `docs/27 §6` |
| 3.3 | **Automação Playwright contra `localhost`** — `baseURL: "http://localhost:3000"`, `webServer` local | `playwright.config.ts:31`, `tests/e2e/lab-guia-trafego.spec.ts` (14 testes) |
| 3.4 | **10 cenários de exceção sintética** — sessão expirada, campo inválido, arma ambígua, documento ausente, falha de GRU, instabilidade, pausa humana, retry, bloqueio operacional | `docs/30 §3` |
| 3.5 | **Redação de log** — `isSecretKey`, `redactLabText`, `redactLabError`, `redactLabMeta`, modos `full`/`identifiers` | `src/server/automation/redaction.ts` |
| 3.6 | **Relatório de execução seguro** — módulo **puro e determinístico**, marca `LAB_SINTETICO`, protocolo só com prefixo `PROT-FICT-`, artefato só sob `tests/e2e/artifacts` | `src/server/automation/lab/labRunReport.ts` |
| 3.7 | **Garantias já provadas** — falha nunca produz protocolo; nenhum segredo atravessa o relatório | `docs/37 §4/§5/§6` |

### 3.1 A Fase 2 estende o laboratório existente

> **O laboratório existente é a base da Fase 2. A Fase 2 NÃO cria um segundo
> laboratório paralelo.** Ela **estende** o laboratório sintético já existente,
> preservando sua natureza **local, fictícia e controlada**. A extensão
> acrescenta **apenas** o desenho do **handoff sintético** e do **contrato
> abstrato de sessão**; **não** transforma o laboratório em execução real,
> **não** autoriza portal Gov.br/SINARM/PF real e **não** altera a trava da
> Fase 9.

| # | Consequência normativa |
|---|---|
| 3.1.1 | **Não se cria segundo laboratório.** Duplicar seria desperdício e, pior, espalharia as garantias de segurança por dois lugares que podem divergir. |
| 3.1.2 | **A extensão é de escopo, não de natureza** — o laboratório continua sintético depois dela, exatamente como antes. |
| 3.1.3 | **Nada do laboratório pode ser apontado para Gov.br/SINARM/PF real** — nem como "teste rápido", nem por configuração, nem por variável de ambiente. |
| 3.1.4 | **Playwright continua limitado a `localhost`/sintético** (`playwright.config.ts:31`), sem exceção. |
| 3.1.5 | **A Fase 9 continua bloqueada** — estender o laboratório não a toca (§12). |
| 3.1.6 | As garantias herdadas de 8A–8D — falha nunca gera protocolo, protocolo só `PROT-FICT-*`, artefato só sob `tests/e2e/artifacts`, tudo redigido — **valem integralmente sobre o que for acrescentado**. |

---

## 4. Ambiente permitido

| # | Permitido |
|---|---|
| 4.1 | **`localhost`** — e somente ele (`playwright.config.ts:31`) |
| 4.2 | **Páginas sintéticas controladas pelo próprio projeto** — servidas pelo app, versionadas, revisáveis |
| 4.3 | **Dados fictícios** — CPF `000.000.000-00`, nomes explicitamente fictícios |
| 4.4 | **Processos fictícios** — nenhum processo de cliente, nem em dev |
| 4.5 | **Sessão sintética** — handle opaco gerado pelo próprio laboratório (§5) |
| 4.6 | **Documentos fictícios** — sem upload real, sem arquivo de cliente |
| 4.7 | **Nenhum endpoint real externo** — nem leitura, nem "só para ver se responde" |

---

## 5. Ambiente proibido

Lista **normativa**. Vale para código, teste, fixture, screenshot e exemplo de
documentação.

| # | Proibido |
|---|---|
| 5.1 | `gov.br` |
| 5.2 | `servicos.pf.gov.br` |
| 5.3 | **SINARM/PF real** |
| 5.4 | `acesso.gov.br` |
| 5.5 | **Banco do Brasil real** |
| 5.6 | **Mercado Pago real** — inclusive sandbox apontando para conta real |
| 5.7 | **CPF real** — de cliente, de sócio, de quem estiver testando |
| 5.8 | **Senha real** |
| 5.9 | **OTP real** |
| 5.10 | **Cookie real** |
| 5.11 | **Credencial Gov.br real** |
| 5.12 | **Captcha real** — o laboratório usa captcha **sintético**, e apenas como bloqueio (§6.9) |
| 5.13 | **Bypass de captcha** — sem 2captcha, anti-captcha, resolvedor externo ou evasão |
| 5.14 | **Produção** |
| 5.15 | **Cliente real** |

> **O guard que já existe.** `networkGuard.ts:22` bloqueia `gov.br`,
> `servicos.pf`, `sinarm` e `acesso.gov` **mesmo se adicionados à allowlist**.
> O desenho da Fase 2 **não deve enfraquecê-lo** — deve, se algo, estendê-lo ao
> caminho do laboratório.

---

## 6. Contrato abstrato de sessão

Descrição **conceitual**. Não é schema, não é tipo TypeScript, não é migration —
a especificação com campos permitidos e proibidos é o **PR seguinte** (§11).

### 6.1 O que o contrato carrega

| Elemento | Natureza | Observação |
|---|---|---|
| **`sessionHandle`** | Referência **opaca** | Um identificador que **não contém nem deriva** de cookie, token ou credencial. Quem tem o handle sabe *qual* sessão, nunca *como* autenticar. |
| **`processId`** | Identificador **interno** | O processo do nosso produto, não do órgão. |
| **`actorId`** | Identificador **interno** | Quem autorizou — cliente ou operador, do nosso sistema. |
| **`escopo`** | Lista fechada de etapas | O que aquela sessão pode fazer. Fora do escopo, o motor para. |
| **`expiração`** | Prazo **curto**, absoluto | Vencida, o handle não vale mais — sem renovação silenciosa. |
| **`ambiente`** | Marcação obrigatória | `sintético` no laboratório. Um handle sintético **nunca** pode ser aceito como real, nem o contrário. |
| **`consentimento`** | Referência ao consentimento | No laboratório, **sintético**; no futuro real, o consentimento explícito do `docs/39 §5`. |
| **`eventos de auditoria`** | Trilha append-only | Cada uso do handle gera evento (§8). |

### 6.2 O que o contrato **nunca** carrega

| # | Proibido no contrato |
|---|---|
| 6.2.1 | **Nenhum segredo real** — de qualquer natureza |
| 6.2.2 | **Nenhum cookie bruto** — nem "só o de sessão", nem serializado, nem hasheado |
| 6.2.3 | **Nenhum campo de senha, OTP ou credencial** |
| 6.2.4 | **Nenhum CPF** — o `processId` já identifica internamente |
| 6.2.5 | **Nenhum `storageState`** persistido nem compartilhado entre execuções |

> **Por que o handle é opaco.** É o que impede a Opção C de voltar disfarçada
> (`docs/71 §4.3.5`, `§4.3.6`). Se o contrato aceitasse "só o cookie", o campo
> de credencial teria nascido — e a discussão viraria implementação em vez de
> decisão. **O tipo é a barreira mais barata** (`docs/42 §6/§7`).

### 6.3 A propriedade que o laboratório precisa provar

> Que o motor **funciona inteiro** recebendo apenas o handle opaco — ou seja,
> que nenhuma etapa do fluxo exige, de fato, ver a credencial. Se alguma exigir,
> **isso é achado do laboratório**, não motivo para afrouxar o contrato.

---

## 7. Portal sintético — o que falta

O portal do `docs/27 §2` já cobre serviço, solicitante, documentos, revisão,
resultado e erro. As telas abaixo são as **lacunas da Fase 2**.

| # | Tela / etapa | Estado | Desenho |
|---|---|---|---|
| 7.1 | **Login sintético** | **falta** | Tela falsa de autenticação, visivelmente sintética. A automação **abre e para** — quem "autentica" é o teste, simulando o humano. **Nenhum campo real de senha**; o desenho preferido é um botão "simular sessão pronta", sem input de credencial, para que nem exista onde digitar. |
| 7.2 | **Handoff** | **falta** | Momento em que a sessão sintética passa ao motor: o portal emite o `sessionHandle`, o motor recebe e continua. É **a peça central** da Fase 2. |
| 7.3 | Seleção de serviço | existe | `docs/27 §2` etapa 3 |
| 7.4 | Dados do solicitante fictícios | existe | etapa 2 — CPF `000.000.000-00` |
| 7.5 | Documentos fictícios | existe | etapa 6 — sem upload real |
| 7.6 | Revisão | existe | etapa 8 — checkbox obrigatório antes do ato sensível |
| 7.7 | Resultado sintético | existe | etapa 11 — `PROT-FICT-0001` |
| 7.8 | Erro sintético | existe | 10 cenários do `docs/30 §3` |
| 7.9 | **Timeout sintético** | **falta** | Sessão que **não responde** — distinto de "erro" e de "instabilidade": o motor precisa parar por prazo, não por resposta negativa. |
| 7.10 | **Captcha sintético** | **falta** | Aparece, **bloqueia** e **degrada para humano**. É a única forma permitida: o laboratório existe para provar que a automação **para** diante de captcha, nunca para exercitar contorno. Nenhum resolvedor, nenhum "modo teste que pula". |
| 7.11 | **Expiração do handle** | **falta** | Handle vencido no meio do fluxo → o motor para e registra; não renova sozinho. |

> **Sobre 7.10.** A tentação de "no laboratório é fake, então pode passar
> direto" é exatamente o que não pode existir: o caminho de bypass, uma vez
> escrito, é o mesmo que serviria contra captcha real. O cenário sintético deve
> **terminar em bloqueio**, e o teste deve **afirmar o bloqueio** como sucesso.

---

## 8. Estados e eventos

Eventos que o laboratório deve produzir **futuramente** — nenhum é implementado
aqui. Todos passam pela redação existente (`docs/37 §4`) e nenhum carrega
credencial.

| # | Evento | O que registra |
|---|---|---|
| 8.1 | **Sessão sintética iniciada** | handle criado, escopo, expiração, ambiente `sintético` |
| 8.2 | **Handoff sintético recebido** | motor assumiu a continuidade; sem credencial no payload |
| 8.3 | **Etapa acessada** | qual etapa do escopo, em que ordem |
| 8.4 | **Documento fictício anexado** | referência ao documento fake, nunca conteúdo |
| 8.5 | **Protocolo sintético gerado** | só com prefixo `PROT-FICT-` (`labRunReport.ts`) |
| 8.6 | **Erro sintético registrado** | erro redigido, sem stack com dado sensível |
| 8.7 | **Timeout sintético** | prazo estourado, etapa em que parou |
| 8.8 | **Bloqueio por captcha sintético** | degradação para humano — **evento de sucesso do desenho**, não de falha |
| 8.9 | **Encerramento da sessão** | handle invalidado e descartado — o evento deve refletir o **resultado do descarte**, não uma constante (`docs/42 §8`) |

> **Invariante herdado.** `docs/37`: **falha nunca produz protocolo**. Os eventos
> novos não podem abrir exceção — 8.6, 8.7 e 8.8 terminam sem protocolo, sempre.

---

## 9. Evidências

| Permitido | Condição |
|---|---|
| **Screenshot sintético** | só de página `localhost` do próprio laboratório; sob `tests/e2e/artifacts` (`labRunReport.ts`), não versionado |
| **HTML sintético redigido** | passa pela redação antes de virar artefato |
| **Log redigido** | `redactLabText`/`redactLabMeta`/`redactLabError` (`docs/37 §4`) |
| **Protocolo sintético** | apenas `PROT-FICT-*` |
| **Timestamps** | do laboratório, sem correlação com pessoa real |

| Nunca | Motivo |
|---|---|
| **PII real** | regra permanente (`docs/00 §8`) |
| **Cookie** | nem bruto, nem serializado, nem em screenshot |
| **Senha, OTP, credencial** | não existe onde guardar, e deve continuar assim (`docs/41 §3`) |
| **Documento real** | nenhum arquivo de cliente entra no laboratório |

> **Uma evidência que hoje falta:** o **log de acesso a PII** do `docs/05 §11b`
> continua aberto (`docs/70 §6.1.1`). O laboratório não o resolve — mas é o
> lugar barato de **exercitá-lo** antes de existir PII real.

---

## 10. Testabilidade

| # | Como o laboratório será testável |
|---|---|
| 10.1 | **Testes unitários** — contrato de sessão, redação e relatório são módulos **puros**; o padrão do `labRunReport.ts` (sem `Date.now()`, sem `Math.random()`, sem env) deve valer para o que vier. |
| 10.2 | **Testes de integração local** — fluxo do handoff ponta a ponta, sem navegador. |
| 10.3 | **Playwright somente contra `localhost`** — `baseURL` local, `webServer` local, nenhum alvo externo (`playwright.config.ts:31`). |
| 10.4 | **Fixtures sintéticas** — dados fictícios versionados e explicitamente marcados; nenhuma fixture derivada de caso real. |
| 10.5 | **Snapshots sem PII** — snapshot é artefato: passa pela redação como qualquer outro. |
| 10.6 | **Falhas determinísticas** — cada cenário de erro, timeout e captcha falha **sempre do mesmo jeito**; teste que às vezes passa não prova nada sobre segurança. |
| 10.7 | **Asserção negativa obrigatória** — nos cenários de bloqueio, o teste afirma **ausência** de protocolo e de sucesso (o marcador `no-success-assertion-marker` do `docs/30 §3` já faz isso; estender aos novos). |

---

## 11. Gates para sair do laboratório

Nenhum fecha aqui. São os mesmos 13 do [`docs/71 §6`](71-decisao-arquitetura-sessao-fase-2.md),
repetidos para que este documento não seja lido como atalho:

| # | Gate | Estado |
|---|---|---|
| 11.1 | Decisão jurídica por escrito (`docs/26 §19.1`) | ❌ aberto |
| 11.2 | Política de sessão escrita (`docs/26 §15`) | ❌ aberto |
| 11.3 | Análise LGPD | ❌ aberto |
| 11.4 | Consentimento explícito, específico e revogável (`docs/39 §5`) | ❌ aberto |
| 11.5 | KMS/segredos — **se e somente se** algum segredo passar a existir; o padrão é **não haver** | ❌ aberto |
| 11.6 | Log de acesso a PII (`docs/05 §11b`) | ❌ aberto |
| 11.7 | Redação verificada no caminho real | ❌ aberto |
| 11.8 | Retenção e expurgo (`docs/15 §3.11`) | ❌ aberto |
| 11.9 | Revisão de captcha e anti-bot | ❌ aberto |
| 11.10 | Autorização explícita do dono (`docs/26 §19.5`) | ❌ aberto |
| 11.11 | **Alteração futura e controlada da Fase 9** — em PR próprio, sob revisão, com o bloco `docs/34 §16` assinado | 🔒 travado |
| 11.12 | Gates do `docs/26 §19`, todos | ❌ abertos |
| 11.13 | As 12 pendências do `docs/23 §5` | ❌ abertas |

> **Concluir o laboratório não abre nenhum gate.** Ele **produz evidência** para
> o gate ser decidido — que é coisa diferente (`docs/26 §19.4`).

---

## 12. Relação com a Fase 9

| # | Registro |
|---|---|
| 12.1 | **`PHASE9_REAL_EXECUTION_ENABLED = false as const`** — `src/server/automation/phase9/safety.ts:32`. Não alterado. |
| 12.2 | O laboratório da Fase 2 é **outra coisa** que a Fase 9: laboratório é sintético e local; a Fase 9 é a prova controlada contra o real, e segue bloqueada. |
| 12.3 | `playwright.config.ts` (laboratório) e `playwright.phase9.config.ts` (Fase 9) são **arquivos separados** — o desenho da Fase 2 não deve fundi-los. |
| 12.4 | O **guard de rede** continua bloqueando `gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` mesmo via allowlist (`networkGuard.ts:22`). |
| 12.5 | Os gates do `docs/26 §19` seguem **íntegros**. |
| 12.6 | Nenhuma das 12 pendências do `docs/23 §5` é fechada. |

---

## 13. Próximo PR depois deste

| # | Passo |
|---|---|
| 13.1 | **Próximo PR, docs-only:** `docs: specify synthetic session contract` — especificar o contrato sintético com a **lista fechada de campos permitidos** e a **lista explícita de campos proibidos** (senha, OTP, cookie, credencial, CPF, `storageState`), mais o ciclo de vida do handle: criação, uso, expiração, invalidação e descarte. |
| 13.2 | Só **depois** da especificação faz sentido um PR de código — e ele será **contra `localhost`**, dentro do laboratório existente. |
| 13.3 | **Em paralelo, fora do código:** seguem a descoberta da Opção D e o gate jurídico (`docs/71 §9.3`) — continuam sendo os itens de maior alavancagem. |

---

## 14. Proibições deste PR

Este PR **não**:

- ❌ altera código, `src`, `prisma`, `tests`, `package.json`, `package-lock.json` ou `.env`;
- ❌ cria migration nem usa `db:push`;
- ❌ implementa portal, handoff, contrato, evento ou teste;
- ❌ instala ou configura Playwright;
- ❌ acessa Gov.br, SINARM, PF, Banco do Brasil ou Mercado Pago;
- ❌ usa CPF, senha, OTP, cookie ou credencial reais;
- ❌ altera a política de captcha — que continua **nunca burlar**;
- ❌ altera a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED`;
- ❌ altera `docs/25`, `docs/26` ou `docs/70`;
- ❌ abre execução real, cliente real ou produção;
- ❌ fecha gate do `docs/26 §19` nem pendência do `docs/23 §5`.

---

> **Fecho.** O laboratório sintético **não começa do zero**: 8A–8D já entregaram
> portal fake, Playwright em `localhost`, dez exceções e log redigido. O que a
> Fase 2 acrescenta é o que o `docs/71` decidiu preparar — **login sintético,
> handoff, contrato abstrato de sessão com handle opaco, timeout, expiração de
> handle e captcha sintético que bloqueia** —, mais os nove eventos da §8 e as
> asserções negativas da §10. O contrato **nunca** carrega senha, OTP, cookie,
> credencial ou CPF, e é essa ausência que impede a Opção C de voltar disfarçada
> de detalhe técnico. Tudo em `localhost`, com dado fictício, sem endpoint
> externo. **Nada aqui é implementado**, os **13 gates seguem abertos**,
> `PHASE9_REAL_EXECUTION_ENABLED` continua `false as const`, os gates do
> `docs/26 §19` seguem íntegros e as 12 pendências do `docs/23 §5` seguem
> abertas. O próximo passo é **especificar o contrato** — ainda docs-only.
