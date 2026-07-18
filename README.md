# Plataforma CAC / SINARM

Plataforma web responsiva / PWA para CACs (Colecionadores, Atiradores e Caçadores)
iniciarem e acompanharem processos junto ao SINARM/CAC.

> **Status atual:** Fase 0 — planejamento e arquitetura.
> Nenhum código de aplicação foi construído ainda. Este repositório contém,
> por enquanto, **apenas documentação**.

## Princípio do projeto

O produto será construído **por módulos independentes**, validando primeiro as
partes mais difíceis. A parte mais arriscada e prioritária é a **automação de
emissão de certidões/antecedentes** — por isso ela é a **Fase 1**.

Não construímos o produto inteiro de uma vez. Cada fase valida uma hipótese
técnica antes de investir na próxima.

## Fase atual: Fase 1 — Laboratório de Certidões

Objetivo: provar se é **tecnicamente e juridicamente viável** automatizar a
emissão de certidões/antecedentes, de forma isolada, sem pagamento, Gov.br,
scanner ou SINARM.

## Documentação

> **Comece por [`docs/00-contexto-atual.md`](docs/00-contexto-atual.md)** para
> entender o estado atual do projeto, decisões tomadas e próximos passos. É a
> "memória do projeto" e deve ser lida antes de qualquer outra coisa.

Depois, leia na ordem:

0. [`docs/00-contexto-atual.md`](docs/00-contexto-atual.md) — **memória do projeto: estado atual, decisões e próximo passo**
1. [`docs/01-arquitetura-geral.md`](docs/01-arquitetura-geral.md) — visão do produto final, módulos e ordem das fases
2. [`docs/02-fase1-laboratorio-certidoes.md`](docs/02-fase1-laboratorio-certidoes.md) — arquitetura da Fase 1 e modelo de provedores
3. [`docs/03-stack-automacao.md`](docs/03-stack-automacao.md) — stack e Playwright vs Puppeteer
4. [`docs/04-modelo-dados.md`](docs/04-modelo-dados.md) — banco, PDFs e classificação de resultado
5. [`docs/05-logs-auditoria-lgpd.md`](docs/05-logs-auditoria-lgpd.md) — logs, auditoria e LGPD
6. [`docs/06-riscos-e-escopo.md`](docs/06-riscos-e-escopo.md) — riscos e o que NÃO construir agora
7. [`docs/07-estrutura-pastas.md`](docs/07-estrutura-pastas.md) — estrutura inicial de pastas
8. [`docs/08-inventario-provedores.md`](docs/08-inventario-provedores.md) — inventário de provedores de certidão (Fase 1)
9. [`docs/09-reconhecimento-sinarm-cac.md`](docs/09-reconhecimento-sinarm-cac.md) — reconhecimento do fluxo SINARM/CAC via Gov.br (M4/M5)
- [`docs/legal/analise-termos-de-uso.md`](docs/legal/analise-termos-de-uso.md) — análise jurídica por provedor

## Rodando o esqueleto do app (Fase 1)

> **Esqueleto técnico** do produto (Next.js + TypeScript + Prisma), conforme
> [`docs/16-fase-1-esqueleto-tecnico.md`](docs/16-fase-1-esqueleto-tecnico.md).
> **Sem dados reais, sem PII, sem Pix, sem upload real, sem automação SINARM.**

Pré-requisitos: Node 18.18+ e um **Postgres local** (opcional para navegar; o
healthcheck degrada com elegância se o banco não estiver ativo).

```bash
# 1. Instalar dependências (roda `prisma generate` no postinstall)
npm install

# 2. Configurar ambiente local (NUNCA commitar .env)
cp .env.example .env   # e ajuste DATABASE_URL para seu Postgres local

# 3. Criar o schema local e dados fictícios
#    (necessário para salvar rascunhos de Guia de Tráfego — Fase 3;
#     sem banco, o app navega mas não salva)
npm run db:push        # aplica o schema no Postgres LOCAL (sem migrations)
npm run seed           # dados fictícios (ProcessType + processo de demo)
#    Após alterar prisma/schema.prisma, rode npm run db:push de novo.

# 4. Rodar em desenvolvimento
npm run dev            # http://localhost:3000

# Verificações
npm run typecheck
npm run lint
npm run build
```

Páginas placeholder: `/` (landing), `/login`, `/dashboard`, `/processos/novo`,
`/admin`. Healthcheck: `/api/health`.

## Autenticação mock/dev e RBAC (Fase 2)

> **Isto não é autenticação.** Não há senha, token assinado, MFA nem provedor
> real — apenas um cookie com o id de um usuário **fictício**, para destravar
> guards, layout autenticado e navegação. Decisão preliminar em
> [`docs/15-decisoes-fase-0.md`](docs/15-decisoes-fase-0.md) §3.8/§3.9.
>
> **Antes de produção são obrigatórios:** provedor real de auth + **MFA** para
> perfis internos. Nunca usar dados reais, CPF real ou PII real neste modo.

### Como usar

1. Abra `/login`.
2. Escolha um dos perfis fictícios — nenhum campo é preenchido:

| Perfil mock | Papel | Acesso |
|-------------|-------|--------|
| Usuario Exemplo | `USER` | `/dashboard`, `/processos/novo` |
| Admin Exemplo | `ADMIN` | `/admin` — vê tudo |
| Operador Exemplo | `OPERADOR` | `/admin` — revisão/execução SINARM |
| Financeiro Exemplo | `FINANCEIRO` | `/admin` — Pix/GRU/reembolso |
| Suporte Exemplo | `SUPORTE` | `/admin` — atendimento/status |

3. O cabeçalho mostra o perfil ativo e um botão **Sair**.
4. `/admin` lista as permissões concedidas e negadas do perfil ativo.

Trocar de perfil = sair e entrar com outro. Rotas de usuário exigem sessão;
rotas admin exigem perfil interno permitido — quem não tem acesso volta para
`/login` com o motivo.

### Onde fica o código

| Arquivo | Papel |
|---------|-------|
| `src/server/auth/roles.ts` | Perfis (`USER` + internos) e rótulos |
| `src/server/auth/permissions.ts` | Matriz RBAC por perfil (docs/11 §3) |
| `src/server/auth/mockUsers.ts` | Usuários fictícios — **deletar** ao entrar auth real |
| `src/server/auth/session.ts` | Leitura/escrita do cookie de sessão mock |
| `src/server/auth/guards.ts` | `getCurrentUser`, `requireUser`, `requireAdminRole`, `requirePermission`, `hasRole`, `hasPermission` |
| `src/server/auth/config.ts` | `AUTH_MODE` — hoje sempre `"mock"` |

**Ponto de substituição:** ao adotar o provedor real, só `session.ts`
(`getCurrentUser`) muda; `guards.ts` e `permissions.ts` continuam válidos.
Páginas nunca comparam `role` diretamente — sempre via guard/permissão.

## Cadastro de Guia de Tráfego — rascunho (Fase 3)

> Rascunhos com **dados 100% fictícios**: destino/evento, arma/PCE de um
> **catálogo mock** (sem nº de série, SIGMA ou lote — bloqueados até a decisão
> de criptografia, docs/15 §3.10) e justificativa padrão "Guia para treino".
> **Sem** upload, Pix, GRU, Gov.br, SINARM ou protocolo real — o código
> `GT-DEV-xxxx` é só um identificador de desenvolvimento.

Fluxo: entrar como **Usuario Exemplo** → `/processos/novo` → preencher →
**Salvar rascunho** → tela de sucesso → **Revisar processo** (`/processos/[id]`)
→ rascunhos listados em `/dashboard`.

**Fila admin (Fase 3.5):** perfis internos veem a fila em `/admin/processos` e
o detalhe em `/admin/processos/[id]` (dados, destino, arma fictícia,
justificativa, permissões do perfil e checklist).
Need-to-know: SUPORTE não vê o bloco de arma/PCE (mínimo necessário,
docs/11 §3). Nenhuma ação de protocolo/pagamento existe nesta fase.

**Checklist e histórico (Fase 3.6):** no detalhe admin, ADMIN e OPERADOR
marcam o checklist de revisão (cada marcação grava quem/perfil/quando —
`process_checklist_items`); FINANCEIRO e SUPORTE só visualizam. O histórico
mostra a criação do rascunho, eventos de status (`process_status_events`,
append-only) e as marcações de checklist. Após atualizar o schema, rode
`npm run db:push` de novo.

## Upload fictício de documento (Fase 4 — modo dev)

> ⚠️ **NÃO envie documento real.** Nada de RG, CPF, CNH ou foto/scan de
> documento verdadeiro — nem do próprio time. Use somente arquivos
> **fictícios** (um PDF/JPG/PNG qualquer, sem PII). Decisões preliminares em
> docs/15 §3.2/§3.10/§3.11: storage de produção, criptografia/KMS e retenção
> final seguem PENDENTES e **bloqueiam upload real**.

- Onde: tela de revisão do processo (`/processos/[id]`), logado como
  **Usuario Exemplo**. Aceita PDF/JPG/PNG até **2 MB**.
- Os **bytes** vão para **`storage-local/`** (raiz do projeto, **git-ignored**
  — nunca commitado); o banco guarda só **metadados + sha256**
  (`process_documents`). Pode apagar a pasta livremente (dev).
- Estados: `PENDENTE → ENVIADO → EM_ANALISE → APROVADO/REJEITADO`.
- Revisão: ADMIN/OPERADOR aprovam/rejeitam no detalhe admin (rejeição exige
  motivo, sem reproduzir dados do documento); FINANCEIRO/SUPORTE não revisam
  (SUPORTE vê só o status). Envio e revisão aparecem no histórico.
- Schema mudou: rode `npm run db:push` antes de usar.
- Código: adapter em `src/server/storage/` (interface + implementação
  local/dev; provedor real de produção entra como nova implementação),
  services `uploadProcessDocument.ts` / `reviewProcessDocument.ts`.

## Pagamento Pix sandbox/dev (Fase 5)

> ⚠️ **Pagamento fictício/sandbox. Não pague Pix real.** Nenhuma cobrança
> real existe nesta fase. PSP decidido: **Mercado Pago** (alt.: Asaas) — ver
> docs/17. Pix real em produção segue **bloqueado** (docs/15 §3.4) até conta
> PJ validada, credenciais de produção, webhook testado, reembolso, termos e
> revisão de segurança.

**Modo fake/dev (padrão — sem credencial nenhuma):**
1. `.env`: `PAYMENT_PROVIDER=fake` (ou omita — é o default). Rode
   `npm run db:push` (schema ganhou a tabela `payments`).
2. Logado como **Usuario Exemplo**, abra a revisão do processo
   (`/processos/[id]`) → **"Gerar cobrança Pix (sandbox/dev)"** — valor
   fictício R$ 100,00; o "copia e cola" gerado é deliberadamente **não
   pagável** (`PIX-FICTICIO-DEV|...`).
3. Confirme com **"Simular pagamento aprovado (dev)"** (idempotente — clicar
   de novo não duplica) **ou** via webhook dev:
   `POST /api/payments/webhook` com
   `{ "eventId": "evt-1", "providerPaymentId": "FAKE-...", "type": "payment.paid" }`.
   Reenvio do mesmo `eventId` responde `alreadyProcessed: true`.
4. Pagamento `PAGO` move o processo para **Pago / em fila**
   (`PAGO_EM_FILA`), registra evento no histórico e aparece no dashboard, na
   revisão e no detalhe admin (fila do Financeiro/Admin).

**Sandbox Mercado Pago (futuro, opcional):** `PAYMENT_PROVIDER=mercadopago` +
`MERCADO_PAGO_ACCESS_TOKEN` com token de **TESTE** (`TEST-...`; token de
produção é **recusado** pelo código). `MERCADO_PAGO_WEBHOOK_SECRET` protege o
webhook dev (header `x-dev-webhook-secret`); a validação de assinatura oficial
do MP entra antes de expor o webhook publicamente. **Nunca** commitar `.env`.

Código: adapter em `src/server/payments/` (`fake` e `mercadopago` — trocar de
PSP = nova implementação), services `createPixPayment.ts` /
`confirmPixPayment.ts`, webhook em `src/app/api/payments/webhook/route.ts`.
Requer Postgres local com `npm run db:push && npm run seed` (o seed cria o
`ProcessType` da Guia de Tráfego que o formulário usa).

Código: validação em `src/server/processes/guiaTrafegoSchema.ts` (Zod),
catálogo mock em `src/server/processes/mockFirearms.ts`, caso de uso em
`src/server/services/createGuiaTrafegoDraft.ts`, persistência em
`src/server/repositories/processRepository.ts`.

## O que NÃO existe / NÃO será construído agora

- App/telas finais
- Login Gov.br
- Pagamento Pix
- Scanner / OCR
- Protocolo SINARM
- Automação real de certidões (só depois de aprovada a arquitetura)

Ver [`docs/06-riscos-e-escopo.md`](docs/06-riscos-e-escopo.md).
