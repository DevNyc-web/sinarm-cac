# 15 — Decisões da Fase 0 (antes do código)

> **O que é este documento.** Registra as **decisões mínimas da Fase 0** (doc 14
> §3) que precisam estar fechadas — ou conscientemente adiadas — **antes** de
> escrever a primeira linha de código do MVP Guia de Tráfego.
>
> **Ainda NÃO é código.** Só decisões e pendências.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/10..14` (especialmente `docs/13-stack-tecnica-mvp.md` §20 e
> `docs/12-modelo-dados-mvp.md` §20).
>
> **Como ler:** cada decisão tem **Recomendação padrão**, **Alternativa aceitável**
> e **Decisão escolhida**. Onde ainda não há escolha do usuário, fica **`PENDENTE`**
> (nunca "chutado").

---

## 1. Objetivo da Fase 0

Transformar as recomendações da stack (doc 13) em **escolhas concretas** de
provedores e políticas, e listar o que **bloqueia** ou **não bloqueia** o início
do código — para que a **Fase 1 (esqueleto)** comece sem retrabalho e sem
decisões improvisadas no meio da implementação.

---

## 2. Decisões já tomadas (consolidadas dos docs anteriores)

- **Produto:** plataforma **web responsiva / PWA**, **marca neutra**, atende Brasil.
- **Primeiro processo:** **Guia de Tráfego** (CAC final).
- **Modelo comercial:** cobrança **por processo** (não assinatura); **preço
  provável R$ 100**; **Pix primeiro**, cartão depois.
- **GRU (R$ 20):** **paga manual** pela empresa no MVP.
- **Operação:** **assistida/manual**; **sem automação SINARM/CAC** no MVP.
- **"Gerar GRU e Salvar":** feito **manual pelo operador no SINARM**; o painel só
  **registra** protocolo/GRU/pagamento/status. **Nunca** automatizado no MVP.
- **Pagamento antes do protocolo:** Pix **confirmado** antes de protocolar.
- **Revisão humana obrigatória** nos primeiros **50–100** processos.
- **Segurança/LGPD:** **nunca** armazenar senha Gov.br; **PII cifrada em repouso**;
  **sem PII em logs/prints**; login Gov.br é **humano** na janela oficial.
- **Stack base (doc 13):** **TypeScript ponta a ponta**, **Next.js + React**,
  **PostgreSQL + Prisma**, **BullMQ + Redis**, **Zod**, **pino**, **Playwright**
  (só automação futura), **storage por adapter**, **config via dotenv + Zod**.
- **Certidões (M1):** **fora** do MVP (doc 10 §17).
- **Cadastro inicial PF:** **fallback**, não fluxo obrigatório da Guia.

---

## 3–6. Decisões a fechar antes do código

> Formato por item: **Recomendação padrão** · **Alternativa aceitável** ·
> **Decisão escolhida**. Preencher a "Decisão escolhida" quando o usuário decidir.

### 3.1 Banco de dados
- **Recomendação padrão:** **PostgreSQL gerenciado via Supabase** (Postgres +
  Storage + Auth num só lugar; MCP disponível; rápido p/ MVP) — avaliando
  **região/LGPD**.
- **Alternativa aceitável:** Postgres gerenciado **Neon/RDS** (Storage/Auth à parte)
  ou **Postgres self-hosted** em VPS.
- **Decisão escolhida (2026-07-17):** ✅ **DECIDIDO PARA A FASE 1** —
  **Postgres local em desenvolvimento + Prisma**.
  - **Produção:** ainda `PENDENTE` — a escolher entre **Supabase Postgres**,
    **Neon** ou outro Postgres gerenciado.
  - **Justificativa:** destrava o **esqueleto do app**, a **modelagem inicial** e o
    **desenvolvimento local** sem assumir o fornecedor final de produção.
  - **Restrição:** **não usar dados reais / PII real** ainda.
  - **Efeito:** esta decisão **libera iniciar a Fase 1** do roadmap (doc 14).

### 3.2 Storage de documentos
- **Recomendação padrão:** **Supabase Storage** (se o banco for Supabase), atrás de
  **storage adapter**; URLs assinadas curtas; sha256.
- **Alternativa aceitável:** **S3 / Cloudflare R2 / MinIO** (mesmo adapter).
- **Decisão escolhida:** `PENDENTE`

### 3.3 Redis / fila
- **Recomendação padrão:** **Redis gerenciado** (BullMQ) — ex.: Upstash ou o que o
  provedor de deploy oferecer; **worker separado**.
- **Alternativa aceitável:** Redis no mesmo provedor de deploy (Railway/Render) ou,
  só no início local, fila em memória.
- **Decisão escolhida:** `PENDENTE`

### 3.4 Provedor Pix
- **Recomendação padrão:** **PSP brasileiro com Pix + webhook idempotente**
  (avaliar taxa, suporte, cobertura) — candidatos: Mercado Pago, Asaas, Pagar.me,
  Efí (Gerencianet).
- **Alternativa aceitável:** outro PSP com Pix e webhook confiável; decisão final
  é **comercial** (doc 08).
- **Decisão escolhida:** `PENDENTE` **(bloqueador da Fase 5 — ver §8)**

### 3.5 Provedor de e-mail (transacional)
- **Recomendação padrão:** **Resend** (simples, DX boa) para magic link/OTP e
  notificações.
- **Alternativa aceitável:** **Amazon SES** (mais barato em escala) ou Postmark.
- **Decisão escolhida:** `PENDENTE`

### 3.6 Domínio
- **Recomendação padrão:** registrar **domínio neutro** (sem alusão a Gov/PF/SINARM),
  com subdomínios `app.` (usuário) e `admin.` (painel).
- **Alternativa aceitável:** um domínio único com rotas `/app` e `/admin` no MVP.
- **Decisão escolhida:** `PENDENTE`

### 3.7 Ambiente de deploy
- **Recomendação padrão:** **web (Next) na Vercel** + **worker/Redis/DB
  gerenciados**; ou **tudo em Railway/Render** (mais simples ter web+worker+Redis
  juntos).
- **Alternativa aceitável:** **VPS com Docker Compose** (controle/custo previsível).
- **Decisão escolhida:** `PENDENTE`

### 3.8 Autenticação do usuário
- **Recomendação padrão:** **Auth.js (NextAuth)** ou **Supabase Auth** (casar com o
  banco); login por **e-mail/senha ou magic link/OTP**; sessão em cookie httpOnly.
  **Não** é Gov.br.
- **Alternativa aceitável:** **Lucia** (mais controle manual).
- **Decisão escolhida:** `PENDENTE` (segue a escolha de 3.1)

### 3.9 Autenticação do admin
- **Recomendação padrão:** **mesma tecnologia de 3.8**, em **domínio/rotas
  separados**, com **RBAC** (Admin/Operador/Financeiro/Suporte) e **MFA
  obrigatório** para internos; **segregação de funções**.
- **Alternativa aceitável:** provider dedicado para o painel, se necessário isolar.
- **Decisão escolhida:** `PENDENTE`

### 3.10 Estratégia de criptografia (PII)
- **Recomendação padrão:** **cifra em aplicação** dos campos sensíveis (doc 12 §19)
  com chave em **secret manager/KMS** do provedor; **`cpf_hash`** para busca;
  rotação de chave planejada.
- **Alternativa aceitável:** cifra a nível de coluna no banco (pgcrypto) **se** a
  gestão de chaves for adequada; **não** substitui o segredo fora do repo.
- **Decisão escolhida:** `PENDENTE` **(bloqueador de PII real — ver §8)**

### 3.11 Retenção de documentos
- **Recomendação padrão:** apagar o **arquivo** do Documento de Identificação
  **30–90 dias após a conclusão** do processo, **mantendo metadado + sha256** para
  auditoria; comprovantes/PDF da GRU seguem prazo **fiscal/contábil**; expurgo via
  `data_retention_jobs` (doc 12 §15).
- **Alternativa aceitável:** reter o documento por prazo maior **se** houver base
  legal/necessidade operacional documentada.
- **Decisão escolhida:** `PENDENTE` **(depende de definição jurídica/LGPD)**

---

## 7. Perguntas pendentes do doc 12 §20

Status de cada dúvida do modelo de dados que pode afetar o schema:

| # | Pergunta (doc 12 §20) | Bloqueia schema? | Status |
|---|------------------------|------------------|--------|
| 1 | Formato do **protocolo** e campos do **PDF da GRU**; como aparece **compensação/pagamento** | Parcial (afeta `gru_records`) | `PENDENTE` — depende de mapear pós-protocolo (doc 09 §15.14) |
| 2 | **Certidões** entram em algum ponto? | Não (fora do MVP) | **RESOLVIDO** — fora do MVP (doc 10 §17) |
| 3 | **Múltiplas armas por guia** (1 ou N em `firearms_pce`) | Sim | `PENDENTE` — confirmar no SINARM |
| 4 | **Prazos de retenção** por tipo | Não (política, não schema) | `PENDENTE` — ver §3.11 |
| 5 | **Cadastro inicial PF** vira fluxo? (tabela/campos próprios) | Não no MVP (é fallback) | `PENDENTE` — adiar |
| 6 | **Multi-perfil interno** (role único vs. tabela de papéis) | Pequeno (afeta `admin_users`) | `PENDENTE` — decidir em F2 |
| 7 | **Reembolso parcial** (valor/estágio em `payments`) | Pequeno | `PENDENTE` — decidir com política de reembolso |
| 8 | Campos do **provedor Pix** (`provider_ref`/webhook) | Sim (afeta `payments`) | `PENDENTE` — depende de 3.4 |
| 9 | **Chave de cifra / KMS** | Sim (afeta PII) | `PENDENTE` — ver §3.10 |
| 10 | **Idempotência** de eventos (webhooks/retomadas) | Sim (chave natural) | `PENDENTE` — decidir em F5 |

---

## 8. Bloqueadores reais para iniciar código

**Bloqueiam apenas as fases que dependem deles — não o início geral:**

0. ✅ **Banco de dados (3.1): RESOLVIDO para a Fase 1** — **Postgres local +
   Prisma**. Deixa de ser bloqueador do **início**. Produção segue `PENDENTE`
   (Supabase/Neon/outro), o que **não** bloqueia F1.
1. **Provedor Pix (3.4 / §7 #8):** bloqueia **Fase 5 (Pix)**. Não bloqueia F1–F4.
2. **Estratégia de criptografia + KMS (3.10 / §7 #9):** bloqueia **persistir PII
   real**. Não bloqueia esqueleto/estrutura, mas **precisa estar pronto antes de
   dados reais** (F4 em diante / F11).
3. **Storage de documentos (3.2):** bloqueia **upload real de documentos
   sensíveis** (F4). Não bloqueia F1–F3.
4. **Retenção/LGPD (3.11 / §7 #4):** bloqueia **fechar política de expurgo** (F10),
   não o início.
5. **Multi-arma (§7 #3)** e **campos Pix (§7 #8):** bloqueiam **congelar o schema**
   dessas tabelas — mas o schema pode ser modelado incrementalmente por fase.

> Com **3.1 decidido**, a **Fase 1 (esqueleto)** está **destravada**. Os demais
> itens impõem **ordem**: **Pix** e **cifra/storage** prontos **antes** das fases
> que tocam pagamento e **PII real**.

---

## 9. O que pode começar mesmo com pendências

Com **3.1 decidido (Postgres local + Prisma)**, é seguro avançar (após confirmação
para iniciar código):

- **Fase 0 restante:** estrutura de pastas (doc 07), convenções (lint/commits),
  **`.env.example`** (sem segredos), wireframes.
- **Fase 1 (esqueleto):** Next.js + TS, camadas, healthcheck, **config Zod**,
  conexão com **Postgres local** via Prisma — sem provedor externo.
- **Modelagem incremental** das tabelas **sem PII/pagamento** (ex.: `process_types`,
  estados) atrás do Prisma, com repositórios.
- **UI neutra** e formulários do usuário (F3) com validação Zod, usando **DB local**
  e dados **fictícios** até os provedores serem escolhidos.
- **Design de auditoria/eventos** (doc 12 §12) como contrato, independente do provedor.

> **Regras enquanto storage/criptografia/retenção estiverem `PENDENTE`:**
> - **Não usar dados reais / PII real.**
> - **Não implementar pagamento** (Pix).
> - **Não implementar upload real de documentos sensíveis** (F4).
> - **Não implementar automação SINARM/CAC.**
> - **Não** conectar provedores de **produção**.
> Ou seja: Fase 1 roda **100% com Postgres local e dados fictícios**.

---

## 10. Critério para liberar início da implementação

**Liberar a Fase 1 (código do esqueleto):**
- [x] **Banco (3.1)** escolhido → ✅ **Postgres local + Prisma** (2026-07-17).
- [ ] **Ambiente de deploy (3.7)** ao menos direcionado (pode ser confirmado até F1 fechar).
- [ ] **Estrutura de pastas** e convenções definidas.
- [ ] **`.env.example`** rascunhado (chaves do doc 13 §16, sem valores).
- [ ] Confirmação **explícita** do usuário para começar a codar.

> **Situação:** o único bloqueador técnico do início (banco) está **resolvido para
> a Fase 1**. Falta apenas preparar estrutura/convenções e a **confirmação
> explícita** para começar a codar — sempre com **Postgres local e dados
> fictícios**.

**Liberar fases sensíveis:**
- [ ] **Fase 4/PII real:** **storage (3.2)** + **criptografia + KMS (3.10)** definidos.
- [ ] **Fase 5/Pix:** **provedor Pix (3.4)** e **campos/idempotência (§7 #8/#10)** definidos.
- [ ] **Fase 10/LGPD:** **retenção (3.11)** definida.
- [ ] **Fase 12/piloto:** **hardening (F11)** aprovado; provedores de produção ativos.

> **Resumo:** a **Fase 1 está liberada** (banco decidido) — falta só estrutura +
> confirmação. **Pix, storage, criptografia e retenção** continuam `PENDENTE` e
> **travam** as fases de pagamento, upload real e PII real — devem estar prontos
> **antes** delas.

---

## Quadro-resumo das decisões

| # | Decisão | Recomendação padrão | Escolhida |
|---|---------|---------------------|-----------|
| 3.1 | Banco | Supabase (Postgres gerenciado) | ✅ **Fase 1: Postgres local + Prisma**; produção `PENDENTE` |
| 3.2 | Storage | Supabase Storage (via adapter) | `PENDENTE` |
| 3.3 | Redis/fila | Redis gerenciado + worker | `PENDENTE` |
| 3.4 | Pix | PSP BR com Pix + webhook | `PENDENTE` |
| 3.5 | E-mail | Resend | `PENDENTE` |
| 3.6 | Domínio | Domínio neutro (app./admin.) | `PENDENTE` |
| 3.7 | Deploy | Vercel (web) + gerenciados / Railway | `PENDENTE` |
| 3.8 | Auth usuário | Auth.js ou Supabase Auth | `PENDENTE` |
| 3.9 | Auth admin | Mesma + RBAC + MFA, domínio separado | `PENDENTE` |
| 3.10 | Criptografia | Cifra em app + KMS + `cpf_hash` | `PENDENTE` |
| 3.11 | Retenção docs | Apagar doc 30–90d após conclusão | `PENDENTE` |

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências ou criar projeto. É registro de decisões. A implementação
> só começa após **confirmação explícita** do usuário e o critério do §10.
