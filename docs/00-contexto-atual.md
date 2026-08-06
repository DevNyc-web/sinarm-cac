# 00 — Contexto Atual do Projeto (memória do projeto)

> **Leia este arquivo primeiro.** Ele resume o estado do projeto, decisões
> tomadas e o próximo passo, para que qualquer pessoa (ou o Claude, numa nova
> sessão) entenda o contexto só lendo os arquivos.
>
> **Última atualização:** 2026-07-21
> **Em andamento (branch `feat/phase-9-controlled-proof-rebased`):** infraestrutura
> segura da Fase 9, rebaseada sobre a `main` atual (até PR #29, com a Fase 8D já
> mergeada). **Não libera execução real:** `PHASE9_REAL_EXECUTION_ENABLED`
> continua `false` hard-coded e os gates 1, 2, 3 e 5 do `docs/26 §19` seguem
> abertos.
> **Estado geral:** **Fases 1–7 implementadas e validadas localmente** com
> **Postgres real** e **dados 100% fictícios** (ver `docs/18`, `docs/19`,
> `docs/20` e `docs/22`). O **ciclo dev/fictício está completo de ponta a
> ponta**: rascunho → documento fictício → Pix sandbox/fake → operação admin
> (fila, responsável, prioridade, checklists, indicadores) → **execução manual
> auditável** (etapas, protocolo, GRU e pagamento da GRU registrados por
> humano).
>
> **Nada real:** sem PII, sem documento real, sem cobrança real, **sem
> Gov.br/SINARM, sem GRU real, sem protocolo real**. Na Fase 7 o app **não
> executa atos no órgão** — ele **registra o trabalho humano feito fora do
> app**, com trilha auditável.

---

## 1. Resumo do produto

- Plataforma **web responsiva / PWA** (funciona em celular e computador).
- Serviço **privado, não oficial** (não é órgão público; não usa identidade
  visual do Gov/PF/SINARM).
- Foco inicial no **CAC final** (Colecionador, Atirador, Caçador).
- **Primeiro processo do MVP: Guia de Tráfego.**
- **Venda direta**; **cobrança por processo** (não assinatura).
- Pagamento: **Pix primeiro**, cartão depois.
- **GRU paga pela empresa**, inicialmente de forma **manual**.
- **Painel admin** interno e **suporte humano**.
- **Automação por módulos** (validar o mais difícil primeiro).

## 2. Decisões já tomadas

- Começar como **site responsivo/PWA**, não app nativo.
- Funcionar em **celular e computador**.
- **Marca neutra.**
- Atende **Brasil todo**.
- **Guia de Tráfego** como primeiro processo provável.
- **Preço inicial provável: R$ 100.**
- **Prazo estimado: 14 dias.**
- **Reembolso:**
  - 100% **apenas antes** do envio de documentos;
  - depois do envio, **depende do estágio**;
  - após **protocolo/GRU, não reembolsável**.
- **Não armazenar senha Gov.br no MVP.**
- Usuário **digita a senha diretamente na janela oficial Gov.br**.
- Se **Gov/SINARM instável antes do pagamento** → **bloquear pagamento**.
- Se **cair depois do pagamento** → processo **fica em fila**.
- **Revisão humana obrigatória** nos primeiros **50–100 processos**.

## 3. Arquitetura por módulos

| Mód. | Nome | Escopo |
|------|------|--------|
| M1 | Certidões / antecedentes | Automação, download e classificação de certidões |
| M2 | Documentos | Upload / scanner / OCR de documentos |
| M3 | Pagamentos | Pix (primeiro), cartão depois |
| M4 | Gov.br / SINARM | Login seguro, autorização de compartilhamento |
| M5 | Protocolo e GRU | Processo (Guia de Tráfego), protocolo, GRU |
| M6 | Status / acompanhamento | Andamento do processo para o usuário |
| M7 | Painel admin / suporte | Operação interna e atendimento humano |
| M8 | LGPD / auditoria / segurança | Transversal a tudo |

> Detalhamento em `docs/01-arquitetura-geral.md`. (Obs.: no doc 01 os módulos
> transversais recebem numeração própria; a tabela acima é a visão de negócio.)

## 4. Estado atual da documentação

Arquivos existentes:

- `README.md`
- `docs/00-contexto-atual.md` (este arquivo)
- `docs/01-arquitetura-geral.md`
- `docs/02-fase1-laboratorio-certidoes.md`
- `docs/03-stack-automacao.md`
- `docs/04-modelo-dados.md`
- `docs/05-logs-auditoria-lgpd.md`
- `docs/06-riscos-e-escopo.md`
- `docs/07-estrutura-pastas.md`
- `docs/08-inventario-provedores.md`
- `docs/09-reconhecimento-sinarm-cac.md`
- `docs/10-mvp-guia-de-trafego.md`
- `docs/11-painel-admin-operacao.md`
- `docs/12-modelo-dados-mvp.md`
- `docs/13-stack-tecnica-mvp.md`
- `docs/14-roadmap-implementacao-mvp.md`
- `docs/15-decisoes-fase-0.md`
- `docs/16-fase-1-esqueleto-tecnico.md`
- `docs/17-decisao-pix-mvp.md`
- `docs/18-validacao-integrada-fases-1-5.md`
- `docs/19-validacao-fase-6-operacao-admin.md`
- `docs/20-validacao-fase-6-5-indicadores-operacionais.md`
- `docs/21-preparacao-fase-7-execucao-assistida-manual.md`
- `docs/22-validacao-fase-7-execucao-manual.md`
- `docs/23-checklist-piloto-real.md`
- `docs/24-revisao-ux-textos-conformidade.md`
- `docs/25-visao-automacao-e-decisoes-negocio.md`
- `docs/26-arquitetura-automacao-hibrida.md`
- `docs/27-fase-8a-laboratorio-sintetico.md`
- `docs/28-fase-8b-playwright-laboratorio-sintetico.md`
- `docs/29-validacao-fase-8-laboratorio-automacao.md`
- `docs/30-fase-8c-excecoes-sinteticas.md`
- `docs/31-material-gate-juridico-automacao.md`
- `docs/32-decisao-gate-juridico-automacao.md`
- `docs/33-plano-fase-9-prova-tecnica-controlada.md`
- `docs/34-checklist-execucao-fase-9.md`
- `docs/35-configuracao-segura-fase-9.md`
- `docs/36-preparacao-infra-fase-9.md`
- `docs/37-fase-8d-log-seguro-e-relatorio.md`
- `docs/legal/analise-termos-de-uso.md`

**Nota (2026-08-04):** lista atualizada com os documentos mais recentes de
cancelamento real, visibilidade ao cliente, relatório financeiro e o gap
anterior de `docs/38` a `docs/53` — todos já existiam no repositório e
ficavam fora desta lista; preenchido nesta atualização (docs-only).

- `docs/38-estado-atual-automacao-e-fase-9.md` — retrato do estado da
  automação após os merges recentes; não libera execução real, não fecha
  gate.
- `docs/39-diagnostico-validacao-real-futura.md` — diagnóstico do que
  falta antes de qualquer validação real futura da Fase 9.
- `docs/40-revisao-gates-validacao-real.md` — revisão dos gates que travam
  automação real: o que cada um exige, o que falta, quem aprova.
- `docs/41-gate-seguranca-credenciais.md` — auditoria de risco de
  credencial/sessão/log sensível antes de qualquer automação real; achados
  reportados, não corrigidos.
- `docs/42-plano-tecnico-ensaio-controlado-futuro.md` — plano técnico de
  como seria um ensaio controlado da Fase 9, se os gates forem aprovados.
- `docs/43-checkpoint-extracao-47d.md` — retrato do estado da extração de
  documentos após a série #47D; insumo da decisão da máquina de estados
  (`docs/44`).
- `docs/44-decisao-maquina-de-estados.md` — decisão arquitetural sobre
  qual campo de status é canônico no `Process`.
- `docs/45-decisao-user-facing-status.md` — decisão sobre o destino da
  coluna `userFacingStatus` (não lida por nenhuma tela do cliente).
- `docs/46-inventario-operational-status.md` — inventário de
  `operationalStatus` e decisão de reordenar a Fase 5 (projeção prematura).
- `docs/47-decisao-estados-workflow-humano.md` — decisão sobre os 6
  estados operacionais sem equivalente canônico (Fase 5d).
- `docs/48-decisao-bloqueado-operacional.md` — decisão sobre se
  `BLOQUEADO_OPERACIONAL` vira `InternalStatus` e como o motivo do
  bloqueio é registrado.
- `docs/49-decisao-valores-operacionais-restantes.md` — decisão sobre os
  5 valores operacionais que ainda passam pela linha legada.
- `docs/50-decisao-acoes-explicitas-documento.md` — decisão sobre o que
  substitui o uso bruto de `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO` no
  dropdown manual/admin.
- `docs/51-decisao-cancelamento-real.md` — decisão sobre o fluxo de
  cancelamento real de cliente, distinto de `CANCELADO_DEV`.
- `docs/52-decisao-visibilidade-cancelamento-real.md` — decisão sobre
  como `CANCELADO_OPERACIONAL` aparece para admin e cliente, antes de
  qualquer UI/botão.
- `docs/53-decisao-ux-acao-cancelamento-admin.md` — decisão de UX para o
  botão/ação admin de cancelamento real.
- `docs/54-decisao-politica-reembolso-cancelamento.md` — política de
  reembolso/financeiro do cancelamento real: nunca automático, revisão
  manual via `refund.approve`.
- `docs/55-decisao-fila-revisao-financeira.md` — filtro de revisão
  financeira na fila admin existente, sob `queue.view`.
- `docs/56-decisao-visibilidade-cliente-cancelamento.md` — aviso read-only
  "Processo cancelado" no detalhe do cliente.
- `docs/57-decisao-bloqueio-acoes-cliente-cancelado.md` — bloqueio de
  ações do cliente (pagamento/documento/destino) em processo cancelado.
  **Fechado** — os 4 PRs do §6 implementados e mergeados.
- `docs/58-decisao-visibilidade-cancelamento-dashboard-cliente.md` — badge
  "Processo cancelado" na listagem/dashboard do cliente. **Fechado** — PR
  técnico implementado e mergeado.
- `docs/59-decisao-relatorio-financeiro-cancelados-pagos.md` — relatório
  financeiro dedicado (`/admin/financeiro`), gate `audit.view.financial`,
  incluindo data de cancelamento via `ProcessStatusEvent`. **Fechado no
  escopo read-only** — PR 1 e PR 2 implementados e mergeados. Export CSV,
  `registerRefund`, crédito interno, processo já protocolado e
  reversão/reabertura continuam **fora do escopo**, como decisões futuras
  separadas.
- `docs/60-decisao-estrategia-automated-first-e-ux-cliente.md` — **decisão
  estratégica oficial**: o produto é um **SaaS automatizado-first** (não MVP
  assistido permanente), com suporte humano só por **exceção**; cliente comum
  e admin/equipe interna são **perfis distintos, com entradas distintas**;
  cliente novo é guiado por uma **tela de escolha de processo** em linguagem
  simples, e "Meus processos" só vira destaque **depois do primeiro processo**;
  cada processo tem **número interno próprio do site** (a coluna
  `Process.code` já existe e é única — falta só o formato estável). Define as
  **Fases oficiais de produto 1–5** e o mapeamento delas com a numeração
  técnica 1–9 já usada nestes documentos. **Docs-only:** não altera código,
  UI, rotas, auth, banco ou testes; **Fase 1 no final, mas NÃO encerrada**;
  **Fase 2 NÃO abre execução real**; `PHASE9_REAL_EXECUTION_ENABLED` segue
  `false`.
- `docs/61-checklist-encerramento-fase-1-base-do-saas.md` — **checklist
  objetivo de encerramento da Fase 1 oficial (Base do SaaS)**, derivado do
  `docs/60 §15`. Registra o que já está pronto (cancelamento, financeiro
  read-only, `Process.code`, execução real bloqueada) e as **pendências
  obrigatórias A–H, todas em aberto**: formato amigável do código interno e
  destino dos `GT-DEV-…`, entrada do cliente novo por escolha de processo,
  nomes amigáveis, separação cliente/admin, estrutura da ajuda, revisão de
  segurança/PII/logs, confirmação de pagamentos base e documentação. Define
  as **9 condições conjuntivas** do §5 e reserva a declaração de encerramento
  a um documento próprio, posterior. **Docs-only:** **NÃO encerra a Fase 1**,
  **NÃO abre a Fase 2** como execução real, não altera código/UI/rotas/auth/
  banco/testes; `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/62-decisao-formato-numero-interno-processo.md` — **decisão do formato
  do número interno** (`Process.code`): **`CAC-YYYY-NNNNNN`** (ex.:
  `CAC-2026-000001`), com **sequência global monotônica** — o ano é rótulo de
  criação e a sequência **não reinicia por ano**. Códigos antigos `GT-DEV-…`
  ficam **preservados**: sem renomeação, sem backfill, sem migration de
  histórico; busca/suporte aceitam os dois formatos (já funciona hoje, filtro
  `contains` case-insensitive). Registra que a **implementação** exigirá fonte
  de sequência concorrente-segura (sequence do Postgres; `count() + 1` é
  *racy*) e **provavelmente migration** — refinando o `docs/60 §8.1`, que
  previa "sem migration" apenas para a coluna. Resolve **A.1–A.3** do
  `docs/61` e satisfaz a condição `docs/61 §5.6`; **A.4–A.6 seguem
  pendentes**. **Docs-only:** **NÃO encerra a Fase 1**, **NÃO abre a Fase 2**,
  não altera código/Prisma/migration/UI/rotas/auth/testes;
  `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/63-decisao-tela-inicial-cliente-novo-escolha-processo.md` — **decisão e
  plano da tela inicial do cliente novo**: cliente **sem processos** é recebido
  pela pergunta **"Qual processo você deseja realizar?"**, com cards simples,
  **nomes amigáveis** ("Tirar ou renovar meu CR", "Emitir Guia de Tráfego"…)
  separados dos códigos técnicos (`GUIA_TRAFEGO_PF_CAC`), o que está
  **disponível agora** distinto do que está **em preparação** (sem CTA, sem
  promessa de prazo ou aprovação) e **ajuda visível com vídeos em destaque**.
  "Meus processos" deixa de ser o foco do cliente novo — a lista vazia vira
  informação **secundária** — e volta a ser destaque a partir do primeiro
  processo (número interno, data, status simples, consulta). Registra que
  ramificação (`semPedidos`), regra de disponibilidade
  (`processAvailability.ts`) e ajuda com vídeos (`/ajuda#videos`) **já
  existem**: o PR técnico futuro (`feat/client-start-process-selection`)
  **evolui** o `ClientStartPanel`/dashboard, sem caminho paralelo. Dá
  **decisão/plano ao bloco B** do `docs/61 §4.B` — **sem fechá-lo**: B só é
  concluído após o PR de UI, e a condição `docs/61 §5.4` **continua não
  satisfeita**. **Docs-only:** **NÃO fecha o bloco B**, **NÃO encerra a Fase
  1**, **NÃO abre a Fase 2**, não altera código/UI/rotas/auth/banco/Prisma/
  migration/testes; `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/64-decisao-login-federado-captcha-rate-limit.md` — **decisão futura**
  de autenticação e proteção contra abuso: o produto caminha para **login
  federado**, começando por **Google/OIDC** para o cliente comum (Microsoft e
  Apple ficam em aberto), **evitando senha própria**; admin mantém **entrada
  separada**, RBAC interno, allowlist e MFA do provedor como requisitos
  futuros. Registra que federar **não** transfere responsabilidade — sessão,
  autorização, auditoria, PII e proteção de rota continuam nossos — e que o
  **banco continua guardando** usuário, vínculo com provider, `providerAccountId`,
  e-mail verificado, perfil, RBAC, processos, documentos, pagamentos e logs.
  **Captcha** (preferência: Cloudflare Turnstile) entra em pontos sensíveis,
  nunca como defesa única. **Corrige duas premissas verificadas no código:**
  o **rate limit JÁ EXISTE** para login e cadastro (`src/server/auth/rateLimit.ts`)
  — o que falta é torná-lo **distribuído** e estendê-lo às demais rotas — e
  `AGUARDANDO_CAPTCHA` no schema **não é captcha de produto**, e sim estado de
  processo sobre o portal Gov.br. Deixa **6 perguntas em aberto** (§13), a
  começar pelo destino das contas que já têm senha. **Alimenta os blocos D e F**
  do `docs/61` **sem concluir nenhum dos dois**. **Docs-only:** **NÃO implementa
  auth**, **NÃO fecha D nem F**, **NÃO reabre o bloco B**, **NÃO encerra a Fase
  1**, **NÃO abre a Fase 2**, não altera código/login/banco/Prisma/migration/
  rotas/UI/testes; **Fase 9 segue bloqueada** e
  `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/65-decisao-transicao-contas-senha-login-federado.md` — **decisão sobre a
  transição das contas com senha própria** para o login federado, respondendo à
  pergunta em aberto do `docs/64 §13.1`. **Cliente novo** futuro entra por
  **login federado**, sem senha própria como fluxo principal, com UX que não
  ofereça escolha confusa entre senha e Google; contas **seed/dev/teste** podem
  ser ajustadas, recriadas ou descartadas **sem migração formal**; **não se cria
  migração complexa para usuário real inexistente**; se surgir **usuário real**
  com senha antes da implementação federada, a migração é **reavaliada e
  decidida antes** do PR técnico; **admin/equipe interna** fica sob **regra
  separada**, sem migração automática, com RBAC interno obrigatório e
  allowlist/MFA como direção futura. A decisão se apoia em premissas
  **verificadas no código**: `passwordHash` é **anulável** e o `prisma/seed.ts`
  **não o preenche** (as contas de dev nascem sem senha), o domínio é
  `example.com` (RFC 2606) e `AUTH_MODE` é `mock` por padrão — **não há
  evidência de base real de clientes**. **Nada é removido:** a estrutura de
  senha própria continua no lugar. Mantém abertas as demais perguntas do
  `docs/64 §13` (13.2–13.6) e **não altera a decisão principal do `docs/64`**.
  **Docs-only:** **NÃO implementa auth**, **NÃO fecha o bloco D** (D.1–D.5
  seguem `[ ]`, condição `§5.5` não satisfeita), **NÃO encerra a Fase 1**,
  **NÃO abre a Fase 2**, não altera código/login/banco/Prisma/migration/
  rotas/UI/testes; **Fase 9 segue bloqueada** e
  `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/67-decisao-pagamentos-gru-admin-mvp.md` — **decisão de pagamentos base e
  GRU administrada internamente**, fechando o **Bloco G** do `docs/61 §4.G`.
  **Meios aceitos:** **Pix** (base atual) e **cartão** (aprovado para a fase
  próxima, **sem implementação**); **boleto fica fora do MVP** por compensação
  lenta, vencimento, inadimplência e custo de suporte. **O gateway NÃO é
  reaberto:** **Mercado Pago** segue como decidido no `docs/17` e refletido em
  `mercadoPagoProvider.ts`. **Cobrança:** o cliente paga à plataforma um preço
  que já embute a GRU, com decomposição interna obrigatória de serviço, GRU
  provisionada, taxas do gateway e margem líquida. **GRU:** o cliente **não
  paga a GRU diretamente** e **não acessa o Banco do Brasil** — o sistema emite
  e organiza, a GRU vai para uma **fila/central administrativa**, a **equipe
  interna paga manualmente**, marca o estado (Pendente, Gerada, Paga, Vencida,
  Erro, Cancelada) e registra o **comprovante** no processo. Registra
  `/admin/grus` como **direção futura, não implementada**. **Automação de
  pagamento no Banco do Brasil fica FORA do MVP**, só estudável depois de vendas
  reais e volume comprovado, sob conta PJ, validação jurídica/contábil,
  auditoria, dupla aprovação, conciliação, limites e prevenção de pagamento
  duplicado. **Corrige premissas verificadas no código:** a decomposição
  serviço/GRU **já existe** (`pricing.ts`), o fluxo de GRU paga pela empresa
  **já está documentado** (`docs/11 §9`) e os campos de GRU **já existem** no
  `ManualExecution` — o trabalho novo é agregação, status explícito e
  comprovante como arquivo. **Fecha o Bloco G** (G.1–G.6 `[x]`, confirmação da
  base e das ausências intencionais). **Docs-only:** **NÃO implementa
  pagamento**, **NÃO integra gateway**, **NÃO cria cartão/boleto/webhook**,
  **NÃO cria `/admin/grus`**, **NÃO cria automação bancária nem reembolso**,
  **NÃO marca D, F nem H**, **NÃO encerra a Fase 1**, **NÃO abre a Fase 2**, não
  altera código/banco/Prisma/migration/rotas/UI/testes; **Fase 9 segue
  bloqueada** e `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/68-revisao-seguranca-pii-logs-fase-1.md` — **revisão de segurança, PII,
  logs e permissões** do **Bloco F** da Fase 1, sobre o código como ele está.
  **NENHUM achado bloqueante.** Confirmados seguros: cliente **sem permissão
  interna por construção** (`USER: []`) com a matriz como fonte única;
  **segregação de funções** real (OPERADOR não confirma Pix, FINANCEIRO não
  executa SINARM, `process.cancel` só ADMIN); **não há CPF no schema** e
  `Process` é sem PII por contrato; DTOs com `USER_SELECT` explícito e
  `passwordHash` **barrado pelo tipo**; **permissão na query, não no filtro**
  (consultas do cliente escopadas por dono no `where`); **`storageKey` ausente
  de todo `.tsx`**; rota de arquivo respondendo **404 igual para inexistente e
  não autorizado** (sem oráculo de existência), tocando o storage só após
  autorizar; **payload cru do PSP fora do domínio** e token do Mercado Pago
  recusado se não for `TEST-`; sessão com **token opaco de 256 bits e apenas o
  SHA-256 no banco**; **zero `console.*` em todo o `src/`**; e **trava dura de
  rede** que bloqueia Gov.br/SINARM/PF **mesmo que alguém os adicione à
  allowlist**. **Achados importantes, reportados sem correção** (método do
  `docs/41`): `audit.view.all` e `audit.view.own` **não têm ponto de aplicação**
  e não existe modelo de auditoria dedicado; e o **rate limit é por instância**
  (zera no restart, DoS de conta por e-mail) — pré-condição de **produção**.
  **Marca F.1–F.7 `[x]`** e **mantém F.8 `[ ]`**, porque a lacuna de auditoria é
  interna ao próprio item revisado. Recomenda **seguir para o Bloco D**, com
  F.8 resolvível em paralelo por decisão curta. **Docs-only:** **NÃO corrige
  nenhum achado**, **NÃO fecha o bloco F** (F.8 pendente), **NÃO fecha D nem
  H**, **NÃO encerra a Fase 1** (segue aberta até D/F/H), **NÃO abre a Fase 2**,
  não altera código/auth/login/banco/Prisma/migration/rotas/UI/testes; **Fase 9
  segue bloqueada** e `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
- `docs/69-decisao-escopo-auditoria-fase-1.md` — **decisão de escopo da
  auditoria**, resolvendo o **F.8** que o `docs/68` deixou aberto. **Não cria
  auditoria ampla**: `audit.view.financial` **permanece aplicado e válido**
  (protege `/admin/financeiro`), enquanto `audit.view.all` e `audit.view.own`
  passam a ser lidos como **reserva de vocabulário** — nomeiam capacidade ainda
  não construída e **não concedem acesso a nada**. A **Fase 1 não precisa
  construir auditoria ampla dedicada**; a lacuna é **aceita como escopo
  futuro**, e a condição para aceitá-la é justamente estar documentada.
  **Nenhuma permissão é removida** e nenhum código é alterado. Registra a
  leitura oficial das três permissões, o que a trilha atual **cobre**
  (`ProcessStatusEvent`: status interno/operacional, prioridade, responsável,
  nota, execução manual, protocolo, GRU e pagamento da GRU — append-only, por
  processo, com ator e papel, sem PII) e o que **não cobre** (acesso a arquivo,
  eventos de autenticação, mudança de permissão, acesso ao relatório
  financeiro, visão consolidada, retenção). Define **8 requisitos** para a
  auditoria ampla futura, que exige decisão e PR próprios. **Achado adicional
  registrado:** a rota de arquivo de documento **não registra acesso algum**, e
  o `docs/05 §11b` exige **log de acesso a PII separado** — item mantido aberto
  como **pré-condição de produção**, não de Fase 1 (hoje o impacto é baixo: sem
  cliente real e sem CPF no schema). **Fecha F.8 e com ele o Bloco F**
  (F.1–F.8), por **revisão + decisão de escopo**; a condição `docs/61 §5.7`
  passa a estar satisfeita. **Docs-only:** **NÃO cria modelo nem tela de
  auditoria**, **NÃO altera permissões/RBAC**, **NÃO fecha D nem H**, **NÃO
  encerra a Fase 1** (segue aberta por D e H), **NÃO abre a Fase 2**, não altera
  código/banco/Prisma/migration/rotas/UI/testes; **Fase 9 segue bloqueada** e
  `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.

- `docs/70-encerramento-fase-1-base-do-saas.md` — **ENCERRAMENTO OFICIAL DA
  FASE 1 (Base do SaaS)**, o único documento capaz de declará-la encerrada
  (`docs/61 §5`). Percorre o **§4 bloco a bloco** (A–H, **45 itens, todos
  fechados**) e o **§5 condição a condição** (as 9, todas satisfeitas, com
  evidência), incluindo a justificativa da **5.3**: os fluxos manuais que
  existem — execução no SINARM por pessoa e **pagamento manual da GRU** — são o
  **modelo decidido desta fase** (`docs/25 §2`, `docs/67 §5`), não remendo de
  produto faltando, porque o escopo da Fase 1 (`docs/61 §2`) **não inclui
  automação**. **Encerrar NÃO libera nada:** **a Fase 2 NÃO é aberta como
  execução real** — pode começar apenas como **preparação, laboratório e teste
  interno**, com Playwright somente em `localhost`/sintético; **execução real de
  Gov.br/SINARM/PF continua bloqueada**; `PHASE9_REAL_EXECUTION_ENABLED` segue
  `false as const`; os gates do `docs/26 §19` seguem íntegros; e as **12
  pendências do `docs/23 §5` continuam abertas** — encerrar a Fase 1 **não
  libera cliente real**. Registra as **pendências futuras** fora da Fase 1
  (§6.1): log de acesso a PII e PII/KMS **antes** do CPF, rate limit
  distribuído, auditoria ampla, `/admin/grus`, cartão, automação BB, login
  federado, descoberta dos portais de certidões externas e do laboratório
  sintético, mais dois polimentos. Reafirma que a regra de **nunca burlar
  captcha** continua valendo integralmente e que qualquer discussão de política
  exige **PR próprio**. Registra que o **`docs/66` existe apenas como arquivo
  local untracked, fora da `main` e de todo o histórico** — não faz parte deste
  encerramento e ainda aguarda destino. Aponta como próximo passo real decidir
  **como a sessão autenticada do cliente chega ao servidor**, hoje não
  especificada em nenhum documento. **Docs-only:** não altera
  código/`src`/`prisma`/testes/`package.json`/migration/auth/captcha/Fase 9.

- `docs/71-decisao-arquitetura-sessao-fase-2.md` — **primeira decisão da Fase 2**,
  respondendo ao `docs/70 §7.6`: **como a sessão autenticada do cliente no
  Gov.br/SINARM/PF poderia chegar ao ambiente de automação de forma segura**.
  Compara quatro opções — **A** (o cliente executa a etapa autenticada no próprio
  navegador; o servidor orienta e recebe só o resultado/protocolo/documento — é o
  **piso** e o que o produto entrega hoje), **B** (**handoff assistido**: o
  cliente autentica, a automação continua em ambiente controlado — **alvo futuro,
  não autorizado**, exige escopo jurídico, consentimento, política de sessão,
  isolamento e auditoria), **C** (execução remota com senha, OTP, cookie ou
  credencial Gov.br — **rejeitada sob as regras atuais**; não pode reaparecer
  como "detalhe técnico" em PR futuro, e qualquer reabertura exigiria **decisão
  formal própria**, com revisão jurídica, revisão de segurança, análise LGPD,
  consentimento, retenção, auditoria, KMS/segredos e **revogação explícita** das
  regras que hoje proíbem armazenar ou repassar credencial; nenhum campo de
  credencial pode nascer em request, tipo ou schema) e **D** (API oficial
  ou integração permitida — **melhor caminho se existir**, exige descoberta e
  documentação oficial). **Recomendação:** preparar **B em laboratório
  sintético**, com **contrato de sessão abstrato**, **sem dado real** e **apenas
  contra `localhost`**, mantendo **A** como entrega de curto prazo e abrindo a
  **descoberta de D** em paralelo ao gate jurídico. Lista **13 gates mínimos,
  todos abertos**, antes de qualquer sessão real. **A Fase 2 começou apenas como
  decisão, preparação, laboratório e desenho técnico — a execução real continua
  bloqueada:** nada de Gov.br/SINARM/PF, CPF real, senha, cookie real, bypass de
  captcha, produção, cliente real, automação do Banco do Brasil ou certidões
  externas reais. **Fase 9 segue bloqueada**,
  `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const`, os gates do
  `docs/26 §19` seguem íntegros e as 12 pendências do `docs/23 §5` seguem
  abertas. **Docs-only:** não altera
  código/`src`/`prisma`/testes/`package.json`/migration/captcha/Fase 9.

- `docs/72-desenho-laboratorio-sintetico-automacao-fase-2.md` — **desenho do
  laboratório sintético da Fase 2**, o passo previsto no `docs/71 §9.1`.
  Registra que o laboratório **não começa do zero**: as Fases técnicas **8A–8D**
  (`docs/27`, `docs/28`, `docs/30`, `docs/37`) já entregaram portal sintético,
  Playwright contra `localhost`, dez exceções sintéticas e log redigido — e
  desenha **apenas as lacunas** da Fase 2: **login sintético** (sem campo de
  senha), **handoff**, **contrato abstrato de sessão** com `sessionHandle`
  **opaco** (mais `processId`, `actorId`, escopo, expiração curta, ambiente,
  consentimento e eventos), **timeout sintético**, **expiração de handle** e
  **captcha sintético que apenas bloqueia e degrada para humano — nunca é
  contornado**. Define **9 eventos**, as **evidências permitidas** (screenshot,
  HTML e log redigidos, protocolo `PROT-FICT-*`, timestamps) e as **proibidas**
  (PII real, cookie, senha/OTP/credencial, documento real), mais a
  testabilidade (unitários puros, integração local, Playwright só `localhost`,
  fixtures sintéticas, snapshots sem PII, falhas determinísticas e **asserção
  negativa** nos bloqueios). O contrato **nunca** carrega senha, OTP, cookie,
  credencial, CPF ou `storageState` — é a ausência que impede a **Opção C** de
  voltar como detalhe técnico (`docs/71 §4.3`). **É desenho, não construção: não
  abre execução real** — nada de Gov.br/SINARM/PF, `acesso.gov.br`, Banco do
  Brasil, Mercado Pago, CPF real, senha, OTP, cookie, credencial, captcha real,
  bypass de captcha, produção ou cliente real. **Mantém a Fase 9 bloqueada** —
  `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const`, os configs do
  laboratório e da Fase 9 seguem separados, os gates do `docs/26 §19` seguem
  íntegros e as 12 pendências do `docs/23 §5` seguem abertas. Próximo passo
  sugerido: `docs: specify synthetic session contract`. **Docs-only:** não
  altera código/`src`/`prisma`/`tests`/`package.json`/`package-lock.json`/`.env`/
  migration/captcha/Fase 9/`docs/25`/`docs/26`/`docs/70`.

- `docs/73-contrato-sessao-sintetica-fase-2.md` — **especificação do contrato de
  sessão sintética** da Fase 2, prevista no `docs/72 §13.1`. É **contrato
  SINTÉTICO, não real**: descreve o que o motor do **laboratório local** pode
  receber. Define **11 campos permitidos**, em **lista fechada** —
  `sessionHandle` (opaco, não derivado de cookie, não reversível, prazo curto),
  `processId`, `actorId`, `scope` (ex. `LAB_GUIA_TRAFEGO_SYNTHETIC`, que **não
  representa permissão em portal real**), `expiresAt`, `issuedAt`,
  `environment` (só `synthetic`/`local`/`test`, **nunca `production`**),
  `consentMarker` (sintético, **não substitui** consentimento real),
  `handoffState`, `auditCorrelationId` e `allowedSyntheticProcessCode` (só
  `PROT-FICT-*` ou `CAC-*` local) — e **17 famílias de campo proibidas**: senha,
  OTP, token Gov.br, cookie, `storageState`, refresh/access token, credencial
  Gov.br, CPF/RG reais, nome da mãe, data de nascimento, documento e PDF reais,
  HTML real de Gov.br/SINARM/PF, screenshot real de portal externo, qualquer
  segredo que exija KMS e qualquer identificador de sessão real externo. O
  **ciclo de vida** tem 7 estados (`CREATED`, `CLAIMED`, `IN_PROGRESS`,
  `COMPLETED`, `EXPIRED`, `CANCELLED`, `BLOCKED`), quatro deles **terminais**,
  **sem renovação silenciosa** e com **descarte verificado**. A **validação é
  allow-list** (campo não listado é rejeitado, não ignorado) e registra
  **achado verificado no código**: a `isSecretKey` de `redaction.ts` cobre
  senha/token/cookie/credential/otp/session, mas **não cobre `cpf` nem
  `storageState`** — que exigem checagem própria. Define **9 eventos de
  auditoria sintéticos**, as evidências permitidas, **9 estados de falha** e as
  regras de determinismo. **Não implementa nada e não abre execução real.**
  **Fase 9 segue bloqueada** — `PHASE9_REAL_EXECUTION_ENABLED` segue
  `false as const`, nenhum campo do contrato pode ser usado para contorná-la, a
  implementação futura deve continuar **estruturalmente incapaz** de apontar
  para Gov.br/SINARM/PF, os gates do `docs/26 §19` seguem íntegros e as 12
  pendências do `docs/23 §5` seguem abertas. Próximo passo recomendado:
  `docs: define synthetic automation state machine` (docs-only) **antes** de
  `feat: add synthetic session contract types`. **Docs-only:** não altera
  código/`src`/`prisma`/`tests`/`package.json`/`package-lock.json`/`.env`/
  migration/captcha/Fase 9/`docs/25`/`docs/26`/`docs/70`.

- `docs/74-maquina-estados-automacao-sintetica-fase-2.md` — **máquina de estados
  da automação sintética** da Fase 2, prevista no `docs/73 §12.1`. Define **8
  estados de sessão** (`CREATED`, `CLAIMED`, `IN_PROGRESS`, `COMPLETED`,
  `EXPIRED`, `CANCELLED`, `BLOCKED`, `FAILED`), **9 de run** (incluindo
  `WAITING_SYNTHETIC_HANDOFF`, `WAITING_SYNTHETIC_STEP` e
  `BLOCKED_BY_SYNTHETIC_CAPTCHA`) e **7 de etapa**, mais as cinco entidades
  conceituais (`syntheticSession`, `syntheticRun`, `syntheticStep`,
  `syntheticEvidence`, `syntheticAuditEvent`), com **um run por sessão** —
  retentar exige **nova sessão**. São **14 transições permitidas** e **11
  proibidas**, entre elas toda aresta para **execução real**, para
  **Gov.br/SINARM/PF** e para **uso de senha, cookie, OTP ou credencial**, além
  de `COMPLETED`/`FAILED`/`EXPIRED`/`CANCELLED` → `IN_PROGRESS`. **Terminais:**
  `COMPLETED`, `FAILED`, `EXPIRED`, `CANCELLED` — não reabrem, não renovam, não
  reexecutam. **`BLOCKED` não tem saída para frente:** captcha sintético é
  bloqueio, não desafio; **não existe evento de desbloqueio, bypass nem "modo
  teste que pula"**, e o resultado esperado é `BLOCKED`, nunca `COMPLETED`. Cada
  transição emite um dos **9 eventos** do `docs/73 §7`, sempre com **estado
  anterior e estado novo**, `auditCorrelationId`, `processId`, `actorId`,
  timestamp e motivo redigido — **nunca** PII, segredo, cookie, senha ou
  screenshot real. Define ainda **10 falhas sintéticas** e as evidências
  admitidas por estado (só `COMPLETED` admite protocolo, e só `PROT-FICT-*`).
  **Declara duas extensões ao `docs/73`** (§14.1): `FAILED` acrescentado como
  estado de sessão e `BLOCKED` deixando de ser terminal — **nenhuma afrouxa
  trava** (`BLOCKED` segue sem saída para frente). **Este mesmo PR reconcilia o
  `docs/73`**, que passa a ter os **8 estados**, os terminais
  `COMPLETED`/`FAILED`/`EXPIRED`/`CANCELLED`, a regra de desfecho do bloqueio
  (§5.12) e a justificativa (§5.13) — **sem tocar nas listas de campos
  permitidos (11) e proibidos (17)**, que ficam inalteradas. Assim a `main` não
  recebe dois documentos discordando em ponto normativo. **Não implementa nada e
  não abre execução
  real. Fase 9 segue bloqueada** — `PHASE9_REAL_EXECUTION_ENABLED` segue
  `false as const`, **allowlist e `networkGuard` intocados**, nenhum estado tem
  aresta para o real, os gates do `docs/26 §19` seguem íntegros e as 12
  pendências do `docs/23 §5` seguem abertas. Próximo passo sugerido:
  `feat: add synthetic session contract types` — **local/sintético, sem portal
  real, sem Fase 9, sem Prisma/migration** salvo decisão posterior. **Docs-only:**
  não altera código/`src`/`prisma`/`tests`/`package.json`/`package-lock.json`/
  `.env`/migration/captcha/Fase 9/`docs/25`/`docs/26`/`docs/70`/`docs/73`.

**Bloco D implementado em 2026-08-05** (PR técnico
`feat/separate-client-admin-entry`): a entrada do cliente e a da equipe interna
passaram a ser **portas distintas**. `/login` é a do **cliente** — conta,
cadastro, ajuda e o aviso permanente de que **não é o Gov.br** —, e o atalho de
desenvolvimento lista **apenas o perfil cliente**. A nova rota **`/equipe`** é a
da **equipe interna**: sem cadastro, sem jornada de cliente, com aviso de que o
acesso depende das permissões do perfil. **A rota `/equipe` é apenas uma porta
de entrada interna dentro do mesmo sistema: não cria segundo site, segundo
banco, segundo produto ou auth paralela.** Ela reusa a mesma Server Action,
sessão e política de `authenticate.ts`; **nada de senha, OAuth, captcha, rate
limit, banco, Prisma ou migration foi tocado**. O
roteamento por perfil saiu do id literal e virou regra no módulo puro
`src/server/auth/entryPaths.ts` (`destinationFor` / `entryPathFor`); o
**logout** devolve o interno para `/equipe` e o cliente para `/login`; e o
**erro de login volta à porta de origem** por **allowlist** (nunca redirect com
string crua). A separação é de **experiência**: `/equipe` **não concede nada** —
`USER: []`, `requireAdminRole` e `requirePermission` seguem intactos. **Fecha o
bloco D** (D.1–D.5) e satisfaz a condição `docs/61 §5.5`; **a Fase 1 continua
aberta pelo bloco H**. `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.

**Código de aplicação:** o app do MVP existe (Next.js + TypeScript + Prisma),
com as **Fases 1–7** implementadas e **validadas localmente com dados
fictícios** (`docs/18`, `docs/19`, `docs/20` e `docs/22`). Roda com **Postgres
local**, **auth mock/dev**, **storage local/dev** e **Pix em modo fake/sandbox**
— nenhum provedor de produção conectado. **Gov.br, SINARM/CAC, GRU real e
protocolo real continuam FORA** do app: o protocolo é humano, manual e externo,
e o painel apenas **registra e audita** o que a pessoa fez.

## 5. O que já foi descoberto sobre o SINARM/CAC

Reconhecimento manual em 2026-07-16 (detalhes em `docs/09-reconhecimento-sinarm-cac.md`):

- **URL inicial observada:** `https://servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/`
- **Login via Gov.br confirmado.**
- **Redireciona** para `sso.acesso.gov.br`.
- Sequência de telas: **CPF** → **senha** → **autorização de compartilhamento**.
- **Serviço exibido:** "Serviços da Polícia Federal".
- **Dados compartilhados (via Gov.br):** identidade gov.br, nome e foto, e-mail,
  telefone celular, dados de vinculação de empresas.
- Após autorização, **volta para o sistema SINARM/CAC**.
- **Sessão expira em ~60 minutos.**
- **Captcha NÃO observado** neste reconhecimento (risco mantido para o futuro).
- **Instabilidade:** a **autorização precisou ser clicada duas vezes**.
- **Classificação técnica atual do módulo: `SEMIAUTOMATICO`.**

### 5.1 Guia de Tráfego — reconhecimento (2026-07-17)

Fluxo mapeado até o **checkpoint final** (detalhes em `docs/09-reconhecimento-sinarm-cac.md §15`):

- **Caminho:** Solicitação de Serviço → Pessoa Física (PF) → **Preencher
  Formulário (Requerimento)**. URL: `.../#/preencher-formulario`.
- **Não é tela isolada:** é um serviço dentro do formulário genérico, com
  **5 etapas** (Solicitante → Atividades/Serviços → Condições de Exigências →
  Info. adicionais → **Gere GRU**).
- **Serviço:** "Emitir Guia de Tráfego Pessoa Física (CAC)" · **Taxa R$ 20** ·
  Atividade "Tiro Desportivo - Atirador Desportivo" · PCE "ARMA DE FOGO" ·
  Finalidade "TREINAMENTO TIRO DESPORTIVO".
- **Único anexo observado:** Documento de Identificação Pessoal (item 42).
- **Certidões/antecedentes NÃO observadas** neste fluxo (pendente confirmação final).
- **Origem:** campo "Endereço SIGMA" (vem do acervo — exige CR/arma já cadastrada).
- **Destino:** Nome Evento, UF, Cidade, Logradouro, Número (informados pelo usuário).
- **Armamento:** tabela PCE (Nº SIGMA, Código PCE, Espécie, Marca, Modelo, Calibre,
  Nº Série, Nº Lote, Qtde) + seleção do acervo — **exige validação forte**.
- **Justificativa:** texto livre; padrão "Guia para treino".
- **Validade da Guia observada:** 17/01/2027 (ler **dinamicamente**, nunca hardcoded).
- **"Gere GRU" NÃO protocola direto:** abre a tela **"Dados da GRU"** (checkpoint).
- **Tela "Dados da GRU" mapeada:** exibe contribuinte, CPF, **UG/Gestão 167086/00001**,
  **Fundo do Exército**, **Código de Recolhimento 11300-0**, nº de referência,
  vencimento, **Valor 20,00**, instruções e seção **"Acompanhamento da GRU"**
  (vazia antes de gerar). Botões: **Cancelar** · **Gerar GRU e Salvar**.
- **Botão final = "Gerar GRU e Salvar"** → ação **irreversível**: protocola, gera o
  **PDF da GRU**, salva e cria o **número de protocolo**. É o **checkpoint seguro**
  antes do protocolo — **não clicar em teste**.
- **Classificação da Guia de Tráfego: `SEMIAUTOMATICO`** com **alta chance de
  automação futura** (fluxo fixo, sem certidões, taxa baixa); **risco operacional
  reduzido** pela existência do checkpoint.

## 6. Cadastro inicial PF

- Tela: **"Cadastro Inicial do Solicitante de Pessoa Física (PF)"**
- URL: `https://servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/cadastro/manter-cadastro-inicial`
- Botões: **Incluir** · **Editar** · **Visualizar** Cadastro Inicial
- Campos citados operacionalmente: nome completo, data de nascimento, título de
  eleitor, RG, CPF, cidade de nascimento, endereço, CEP, número, latitude,
  longitude, profissão, nome da mãe, nome do pai.
- **Observações:** para o **primeiro processo** pode ser necessário criar o
  cadastro inicial; pode ser necessário que a conta Gov.br **tenha foto válida**.
- **Atualização (2026-07-17):** para a **Guia de Tráfego**, o cadastro inicial PF
  fica como **risco/fallback, NÃO como fluxo obrigatório** do MVP — quem gera Guia
  de Tráfego **já possui CR/arma** (endereço vem do "Endereço SIGMA" do acervo) e,
  portanto, **já deve ter cadastro inicial**.

## 7. Próximo passo planejado

> **Estado da implementação (2026-07-18):** Fases 1–7 concluídas, testadas e
> versionadas — ver `docs/18`, `docs/19` (commit `4634e5b`), `docs/20`
> (commit `79bc3b8`) e `docs/22` (commit `75a78b0`).
> Fluxo fictício completo: login mock → rascunho → revisão → documento fictício
> → fila admin **com filtros e indicadores** → aprovação/rejeição → checklists
> (revisão e checkpoint GRU fictício) → Pix sandbox → processo em fila, com
> **responsável, prioridade, status operacional, notas/mensagens**, histórico
> auditável, **prontidão operacional** (o que falta, quem atua, quão perto está)
> e, por fim, **execução manual auditável** — etapas, protocolo, GRU e pagamento
> da GRU **registrados por humano**, nunca executados pelo app.
>
> **F7 — EXECUÇÃO ASSISTIDA MANUAL: implementada, testada e versionada**
> (commit `75a78b0`; plano em `docs/21`, validação em `docs/22`).
> **Conceito em vigor:** o app **guia**, o **humano executa fora do app** na
> janela oficial, o humano **registra** no painel e o app **audita**.
> **O sistema NÃO acessa Gov.br, NÃO acessa SINARM/CAC, NÃO automatiza (sem
> Playwright/Puppeteer/Selenium), NÃO protocola e NUNCA clica em "Gerar GRU e
> Salvar"** — nem guarda credencial ou senha do Gov.br.
>
> **➡️ Bloco atual: NÃO é nova funcionalidade — é PREPARAÇÃO DE PILOTO REAL +
> REVISÃO DE COMUNICAÇÃO.** Não é hora de adicionar funcionalidade sensível
> (`docs/22 §13`).
> - `docs/23-checklist-piloto-real.md` — escopo do piloto, checklists
>   (técnico/jurídico/financeiro/operacional/UX/segurança/suporte), critérios de
>   aceite e recusa de cliente, fluxo controlado, responsáveis, evidências,
>   rollback e critérios de sucesso/pausa.
> - `docs/24-revisao-ux-textos-conformidade.md` — **revisão de UX e textos tela
>   a tela** (feita, nenhuma tela alterada): frases proibidas/recomendadas,
>   microcopy proposta e **7 avisos obrigatórios**. Achados de prioridade alta a
>   corrigir antes do piloto: **termos/privacidade/reembolso ausentes nas telas**,
>   **composição de preço (serviço + GRU) não explicada**, **jargão dev e status
>   cru visíveis ao usuário**, **erro técnico exposto no dashboard** e
>   **"protocolado ≠ aprovado"** não dito.
>
> **Produção e piloto seguem BLOQUEADOS** pelas 12 pendências do `docs/23 §5`:
> auth real · MFA admin · storage de produção · KMS/criptografia · retenção
> final · Mercado Pago produção · webhook público · termos de uso · política de
> reembolso · revisão jurídica · política operacional · treinamento do operador.
> **Regra:** o piloto só começa com os 12 fechados — não há "resolve durante o
> piloto".
>
> **Pendências que travam produção** (docs/20 §11): auth real + MFA, storage de
> produção + KMS + retenção, conta Mercado Pago de produção + webhook público
> real, termos/reembolso, revisão jurídica.
>
> **➡️ Próximo bloco planejado: ARQUITETURA / LABORATÓRIO DE AUTOMAÇÃO HÍBRIDA
> (planejamento, não implementação).**
> - `docs/25-visao-automacao-e-decisoes-negocio.md` — **visão futura**: automação
>   **server-side autorizada**, com consentimento e presença do usuário, atrás de
>   **gates** jurídico/segurança/produção/validação. Registra decisões do dono e
>   go-to-market (clube).
> - `docs/26-arquitetura-automacao-hibrida.md` — **arquitetura híbrida (Caminho
>   3)**: **Playwright/Puppeteer** como motor determinístico previsível, **backend
>   orquestrando**, **IA só em exceção/validação/diagnóstico** (fora do caminho
>   crítico), **humano** confirmando atos sensíveis. Propõe **Fase 8 — Laboratório
>   de Automação Sintética** (página **fake/sintética**, dados fictícios) e
>   **Fase 9 — Prova técnica controlada** (só após os gates).
> - `docs/27-fase-8a-laboratorio-sintetico.md` — **Fase 8A IMPLEMENTADA e validada
>   (dev)**: rota interna `/admin/lab/guia-trafego` (ADMIN/OPERADOR) — uma **página
>   fake/sintética** que imita o fluxo da Guia de Tráfego, com dados **100%
>   fictícios** e `data-testid` estáveis, para servir de **alvo** à automação
>   futura. **Sem Playwright, sem Gov.br/SINARM, sem rede, sem upload/pagamento/
>   protocolo real.** Próximo: **Fase 8B** (automação Playwright **só** contra essa
>   página fake), mediante confirmação.
> - `docs/28-fase-8b-playwright-laboratorio-sintetico.md` — **Fase 8B IMPLEMENTADA
>   e validada (dev)**: primeira automação **Playwright** do projeto (Chromium),
>   rodando **exclusivamente** contra a página fake `/admin/lab/guia-trafego` em
>   `localhost`. Prova o fluxo ponta a ponta (login mock → destino → arma → revisão
>   → GRU fake → protocolo fake), inclusive os **gates** (arma/checkbox) e uma
>   **prova negativa de rede** (o teste falha se houver requisição externa/Gov).
>   Evidências (screenshot/vídeo/trace) **não versionadas**. **Sem Gov.br/SINARM,
>   sem site público, sem dados reais, sem Puppeteer.**
> - `docs/29-validacao-fase-8-laboratorio-automacao.md` — **Fase 8 VALIDADA** como
>   prova técnica segura: consolida 8A (página fake) + 8B (automação). Caminho feliz
>   ponta a ponta verde (`typecheck`/`lint`/`build`/`test:e2e`), gates provados
>   (arma/checkbox), **guard de rede com lista de externas VAZIA**. Registra as
>   **limitações** (só caminho feliz — sem exceções/sessão expirada/arma
>   ambígua/erro de GRU/instabilidade/retry) e aponta a **Fase 8C**.
> - `docs/30-fase-8c-excecoes-sinteticas.md` — **Fase 8C IMPLEMENTADA e validada
>   (dev)**: o laboratório fake ganhou **modos de simulação de exceção** (sessão
>   expirada, campo inválido, arma ambígua, documento ausente, falha de GRU,
>   instabilidade fake, pausa para humano, retry, bloqueio operacional), via
>   `?scenario=` + seletor. **10 testes Playwright** (caminho feliz + 9 exceções)
>   provam que cada falha **para com segurança**, não gera sucesso/protocolo fake, e
>   que **retry só conclui quando explícito**. Guard de rede **vazio** nos 10.
>   **Sem Gov.br/SINARM, sem rede externa, sem dados reais.**
>
> **Automação real NÃO está liberada.** O laboratório roda em **página
> fake/sintética** com **dados fictícios** — **sem tocar Gov.br/SINARM real, sem
> site público real, sem dados reais**. O **Playwright** já existe, mas **só** mira
> o laboratório local (`docs/28`–`docs/30`). O laboratório agora cobre **caminho
> feliz + exceções sintéticas** (docs/30).
>
> **Gate jurídico: VALIDADO (retorno positivo).** O material de pedido de análise
> (`docs/31`) foi levado ao jurídico e o **modelo pretendido foi aprovado**,
> conforme retorno reportado pelo dono — decisão registrada em
> `docs/32-decisao-gate-juridico-automacao.md`: **execução server-side**, **sessão
> efêmera**, **login/autorização pelo usuário**, **sem armazenar senha/OTP/token/
> cookie**, **consentimento**, **confirmação antes do irreversível**, **sem
> procuração**, **serviço privado sem promessa de aprovação**. A **redação final**
> (termos/privacidade/consentimento/responsabilidade) ainda será assinada pelo
> advogado antes de cliente real.
>
> **➡️ Plano da Fase 9 (`docs/33`) + Checklist de execução (`docs/34`): ESCRITOS
> (aguardando aprovação).** O plano descreve a **prova técnica controlada** (um
> processo, conta própria/autorizada, sem cliente real) e o checklist (`docs/34`) é
> o **portão final** item a item — pré-checks jurídico/técnico/segurança/dados,
> health check, execução passo a passo, evidências permitidas/proibidas, rollback,
> critérios de sucesso/falha e um **bloco de aprovação explícita** que precisa ser
> assinado antes de qualquer código. **Ponto de parada obrigatório da Fase 9: a tela
> "Dados da GRU" — SEM clicar "Gerar GRU e Salvar", sem gerar protocolo, sem pagar
> taxa.** **A execução da Fase 9 continua NÃO autorizada:** só começa com o bloco
> §16 do `docs/34` assinado — então a menor automação possível é implementada,
> primeiro em conta própria, **sem clientes reais**.
>
> **➡️ Revisão dos pré-checks (`docs/34 §5/§6`) encontrou BLOQUEIOS técnicos.** A
> infra está boa (Playwright instalado, Chromium, env controlado, artifacts
> gitignored, schema sem persistência de sessão), **mas** a config atual do
> Playwright grava **screenshot/video/trace** — ok para o sintético, **inseguro para
> tela real com PII** — e faltam **ambiente isolado** e **branch dedicada**. A
> decisão técnica está em `docs/35-configuracao-segura-fase-9.md`: **config separada
> `playwright.phase9.config.ts`** (trace/vídeo off, screenshot mascarado/desativado,
> contexto efêmero, allowlist de rede), evidências sem PII, sessão efêmera, logs
> mascarados, ambiente isolado e branch `feat/phase-9-controlled-proof`. **O
> `docs/34 §16` NÃO deve ser assinado** até esses itens fecharem (docs/35 §11).
> **Próximo passo:** criar a branch e implementar **só a config segura** (sem
> automação real), rodar os testes do sintético para garantir que não quebrou, e só
> então revisar o §16. O `docs/36` ficou com a **preparação/infra segura** da Fase 9;
> a **validação** da execução real irá para `docs/38` (futuro) — o `docs/37` **já
> existe** e é a **Fase 8D** (log seguro e relatório do laboratório).
>
> **➡️ INFRA SEGURA DA FASE 9 INICIADA (2026-07-21) — `docs/36`, branch
> `feat/phase-9-controlled-proof`.** Criada a **primeira infraestrutura real da Fase
> 9**, **sem tocar Gov.br/SINARM e sem dados reais**: config Playwright segura
> (`playwright.phase9.config.ts` — trace/vídeo/screenshot **off**, contexto efêmero,
> `outputDir` gitignored), módulo `src/server/automation/phase9/` (types, safety,
> networkGuard, auditLogger, runner, index), **guard de rede só localhost** (Gov/SINARM
> em trava dura, **fora** da allowlist), **logs de auditoria em memória** com máscara,
> **feature flag `PHASE9_REAL_EXECUTION_ENABLED = false`** e **28 testes** (25
> unitários + 3 smoke). O **runner real está BLOQUEADO por padrão**: retorna resultado
> seguro com `sessionDiscarded: true` e a mensagem *“Execução real da Fase 9 ainda não
> autorizada. docs/34 §16 pendente.”* — **não abre navegador real, não faz rede
> externa, não gera GRU/protocolo**. Verde em `typecheck`/`lint`/`build`, laboratório
> sintético intacto. **A execução real da Fase 9 ainda NÃO começou** — segue
> dependendo do `docs/34 §16` assinado (pendências em `docs/36 §12`). A validação da
> execução real irá para `docs/38` (futuro).
>
> **➡️ REBASE SOBRE A FASE 8D (2026-07-25) — branch
> `feat/phase-9-controlled-proof-rebased`.** A infra da Fase 9 foi rebaseada sobre a
> `main` (até PR #29). A sanitização própria da Fase 9 (`sanitizeMeta`/`maskValue`)
> foi **removida** e substituída pelo `labRedaction` da Fase 8D (`docs/37`), que é
> mais forte: cobre e-mail, telefone e RG formatado, percorre objetos aninhados e
> arrays, trata ciclo/profundidade e não confunde `passo`/`author` com segredo.
> Conforme a decisão da Fase 8D, a **chave** sensível permanece com valor
> `[REDACTED]` (evidência de auditoria) — o **valor original nunca aparece**.
> **Nada disso libera execução:** a flag continua `false` e os gates seguem abertos.
>
> **Produção e piloto amplo continuam BLOQUEADOS** pelas pendências técnicas/
> operacionais (docs/32 §7, docs/23 §5): auth real + MFA, storage + KMS + retenção,
> Mercado Pago produção + webhook público, termos/privacidade/reembolso finais,
> política operacional, treinamento, monitoramento, suporte. **Regra mantida:** não
> há "resolve durante". As **regras permanentes** (§8) e os **bloqueios de fase**
> (docs/15) seguem valendo integralmente.

**Reconhecimento da Guia de Tráfego MAPEADO até o checkpoint final** — inclui a
tela **"Dados da GRU"** e o botão **"Gerar GRU e Salvar"**. Detalhes em
`docs/09-reconhecimento-sinarm-cac.md §15`.

**Conclusões:**
- **Guia de Tráfego parece VIÁVEL para o MVP.**
- **Certidões/antecedentes NÃO observadas** neste fluxo → **M1 provavelmente NÃO
  é bloqueador** para o MVP da Guia (pode ficar para CR novo/renovação/processos
  maiores, salvo reconhecimento posterior em contrário).
- **Cadastro inicial PF = fallback**, não fluxo obrigatório da Guia.
- **Tela "Dados da GRU" é o checkpoint seguro** antes do protocolo; o botão final
  **"Gerar GRU e Salvar"** é **irreversível** (protocola + gera PDF + cria protocolo).
  Isso **reduz o risco operacional** da automação futura.

**Próximo reconhecimento — mapear o PÓS-PROTOCOLO** (o que aparece **depois** de
clicar em "Gerar GRU e Salvar), **apenas em processo real/controlado** (ver §15.14).
Observar: número de protocolo, PDF da GRU, onde baixar/imprimir, status inicial,
se aparece em "Listar Processo" e "Acompanhamento da GRU", como consultar depois
e como identificar compensação/pagamento. **Por enquanto NÃO seguir para automação.**

## 8. Regras permanentes de segurança

- ❌ Não commitar screenshots com CPF, nome, empresa ou qualquer PII.
- ❌ Não armazenar senha Gov.br.
- ❌ Não burlar captcha.
- ❌ Não tentar contornar anti-bot.
- ❌ Não protocolar processo real em ambiente de teste.
- ❌ Não prometer aprovação.
- ❌ Não parecer órgão oficial.
- ❌ Não usar identidade visual oficial do Gov/PF/SINARM.
- ❌ Não consultar dados sem consentimento.
- ❌ Não classificar certidão negativa por ausência de erro.
- ✅ Ambíguo / inconclusivo vai para **revisão humana**.

## 9. Para retomar

**Sequência de leitura ao abrir o projeto na próxima sessão:**

1. Leia **este arquivo** (`docs/00-contexto-atual.md`) primeiro.
2. Depois as validações, na ordem: `docs/18` (Fases 1–5), `docs/19` (Fase 6),
   `docs/20` (Fase 6.5) e `docs/22` (Fase 7) — o que já está pronto e validado,
   e o que trava produção.
3. Depois `docs/15-decisoes-fase-0.md` (decisões e pendências) e
   `docs/09-reconhecimento-sinarm-cac.md` (fluxo SINARM).

### ➡️ PRÓXIMO PASSO (explícito)

> **Reconhecimento da Guia de Tráfego consolidado** em
> `docs/09-reconhecimento-sinarm-cac.md §15` — **fluxo mapeado até o checkpoint
> final** (tela "Dados da GRU" + botão "Gerar GRU e Salvar", §15.11).
>
> **Próximo passo (futuro):** **mapear o PÓS-PROTOCOLO** — o que aparece **depois**
> de clicar em "Gerar GRU e Salvar" — **apenas em processo real/controlado**
> (isso protocola de verdade). **Por enquanto NÃO seguir para automação.**

**O que observar no pós-protocolo (§15.14):**
1. **Número de protocolo** gerado.
2. **PDF da GRU** (conteúdo).
3. **Local onde baixar/imprimir** a GRU.
4. **Status inicial** do processo.
5. Se aparece em **"Listar Processo"**.
6. Se aparece em **"Acompanhamento da GRU"**.
7. **Como consultar depois.**
8. **Como identificar compensação/pagamento.**

→ Screenshot esperado: `gt-07-pos-protocolo.png` (**só em processo real; mascarar PII**).

**Ao voltar:** preencher §15.14 com os achados; onde não observar, "não
observado"; onde houver dúvida, "inconclusivo — confirmar".

### Regras de retomada (permanentes)

- ❌ **Não automatizar Gov.br/SINARM.** O MVP é **assistido/manual**.
- ❌ **Não usar dados reais / PII real** (CPF, RG, documento, cliente real).
- ❌ **Não gerar cobrança Pix real** nem conectar provedor de produção.
- ❌ **Não protocolar** processo real.
- ✅ **Documentar a decisão antes de implementar** a fase que depende dela.
- ✅ Código, dependências, mudança de fase ou provedor **só com confirmação
  explícita** do usuário.
- ✅ Ao criar tela nova, aplicar **permissão na query + DTO redigido**
  (docs/18 §6).

> **Nota:** a regra anterior "não implementar código ainda" valia até a Fase 0.
> As Fases 1–5 já foram implementadas **com confirmação explícita** e validadas
> em modo dev/fictício (docs/18).
