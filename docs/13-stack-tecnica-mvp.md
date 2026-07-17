# 13 — Stack Técnica do MVP (Guia de Tráfego)

> **O que é este documento.** Define a **stack técnica recomendada** para o MVP da
> Guia de Tráfego: frontend, backend, banco, storage, auth, Pix, filas, automação
> futura, logs, segurança/LGPD, deploy e ambientes. Compara opções onde faz
> sentido e termina com uma **recomendação clara**.
>
> **Ainda NÃO é código.** Nada aqui instala dependência, cria projeto, migration
> ou schema. Só decisão de arquitetura.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/03-stack-automacao.md` (decisões já tomadas), `docs/08-...`,
> `docs/09-reconhecimento-sinarm-cac.md`, `docs/10-mvp-guia-de-trafego.md`,
> `docs/11-painel-admin-operacao.md`, `docs/12-modelo-dados-mvp.md`.
>
> **Coerência com o que já foi decidido (doc 03):** TypeScript ponta a ponta,
> **PostgreSQL + Prisma**, **BullMQ + Redis** (filas), **Playwright** (automação
> futura), **Zod** (validação), **pino** (logs), **storage por adapter**,
> **dotenv + schema Zod** (config). Este doc **estende** isso ao produto (PWA +
> painel + Pix), sem contradizer.

---

## 1. Objetivo da stack

Escolher uma stack **única, coesa e de baixo custo operacional** para entregar o
MVP com:
- **Web responsiva / PWA** para o usuário CAC;
- **painel admin** interno com perfis e auditoria;
- **pagamento Pix**;
- **armazenamento seguro de documentos**;
- **logs/auditoria LGPD**;
- **operação humana assistida** e **espaço para automação SINARM/CAC futura**.

**Princípios:** um só stack (**TypeScript**), poucas peças móveis, segurança/LGPD
desde o início, e **não** acoplar o produto à automação (que é assistida e evolui
por módulos).

---

## 2. Requisitos técnicos do MVP

- **Responsivo/PWA** (celular e computador — doc 00).
- **Marca neutra**, sem identidade oficial.
- **Fluxo do usuário** (doc 10 §6) + **painel/operação** (doc 11).
- **Pix primeiro** (cartão depois); **GRU paga manual** pela empresa.
- **PII cifrada em repouso**, **nunca senha Gov.br** (doc 12 §18/§19).
- **Auditoria append-only** de atos sensíveis (doc 12 §12).
- **Filas/retomada** (sessão SINARM ~60 min; instabilidade; dupla autorização).
- **Storage por adapter** para documentos/PDF (bytes fora do banco).
- **Ambientes** local/staging/produção com segredos fora do código.
- **Espaço para Playwright** na automação futura, sem exigir automação no MVP.

---

## 3. Stack frontend recomendada

| Opção | Prós | Contras |
|-------|------|---------|
| **Next.js (React) + TypeScript** | SSR/SSG, PWA, rotas de API no mesmo projeto, ecossistema enorme, deploy fácil | Framework opinativo |
| Vite + React SPA | Simples, leve | Sem SSR/rotas de API; PWA e SEO por conta própria |
| SvelteKit | Ótimo DX, leve | Ecossistema menor; time provavelmente já pensa em React |

**Recomendação: Next.js (App Router) + TypeScript + React**, com:
- **PWA** (manifest + service worker) para instalar no celular;
- **UI:** Tailwind CSS + biblioteca de componentes acessível (ex.: shadcn/ui) —
  **marca neutra**;
- **Formulários/validação:** React Hook Form + **Zod** (mesmo Zod do backend);
- **Estado/dados:** TanStack Query (fetch/cache) — evitar estado global pesado.

> O mesmo projeto Next.js pode servir **usuário** e **painel admin** (rotas
> separadas + guards por perfil), reduzindo peças no MVP.

---

## 4. Stack backend recomendada

| Opção | Prós | Contras |
|-------|------|---------|
| **Next.js API routes / Route Handlers** | Um só deploy, TS compartilhado, rápido p/ MVP | Menos estrutura p/ domínio complexo |
| **NestJS** (Node/TS separado) | Estrutura, DI, testável, escala organizacional | Mais cerimônia; 2º deploy |
| Fastify (Node/TS) | Leve, rápido | Estrutura por conta própria |

**Recomendação para o MVP: começar no próprio Next.js (Route Handlers) + camada
de serviços/domínio bem separada** (pasta `server/` com casos de uso, validação
Zod, e acesso a dados via Prisma). Se/ quando a complexidade crescer, **extrair
para um serviço Node dedicado (NestJS/Fastify)** sem reescrever o domínio.

- **Validação:** Zod em toda entrada (API e forms).
- **Camadas:** `web (Next) → services/use-cases → repositórios (Prisma) → db`.
- **Jobs/automação** ficam **fora** do request (worker separado — §10/§11).

---

## 5. Banco de dados recomendado

**PostgreSQL + Prisma** (já decidido no doc 03).

| Onde rodar | Prós | Contras |
|------------|------|---------|
| **Supabase (Postgres gerenciado)** | Postgres + Storage + Auth num só lugar; MCP disponível neste ambiente; rápido p/ MVP | Acoplamento ao fornecedor; revisar região/LGPD |
| Neon / RDS / Postgres gerenciado | Postgres puro, portável | Storage/Auth por conta própria |
| Postgres self-hosted (VPS) | Controle total, custo previsível | Você opera backup/patch |

**Recomendação:** **PostgreSQL gerenciado**; **Supabase é a opção mais rápida**
para o MVP (Postgres + Storage + Auth integrados) — **desde que** a região e o
tratamento de dados atendam à LGPD (§13). Manter **Prisma** como ORM e o **acesso
por repositórios**, de modo que trocar de provedor Postgres depois seja barato.

> Modelagem já está em `docs/12-modelo-dados-mvp.md`. **Não** criar migration/
> schema agora.

---

## 6. Storage de documentos

Requisito: **bytes fora do banco**, **sha256** de integridade, acesso restrito,
retenção/expurgo LGPD (doc 12 §15/§19; doc 04 §9).

| Opção | Prós | Contras |
|-------|------|---------|
| **Supabase Storage** | Integra com o mesmo stack; políticas de acesso | Acoplamento |
| **S3 / R2 / MinIO** | Padrão de mercado, portável | Mais setup |

**Recomendação:** **storage por adapter** (interface `put/get/exists`, como no doc
03/04). No MVP, usar **Supabase Storage** (se o banco for Supabase) **ou S3/R2**;
o adapter permite trocar sem mexer no domínio. **URLs assinadas** de curta duração
para acesso; **nunca** servir documento com PII publicamente.

---

## 7. Autenticação do usuário

| Opção | Prós | Contras |
|-------|------|---------|
| **Auth.js (NextAuth)** | Integra com Next; e-mail/OAuth; sessão | Config de segurança por conta |
| **Supabase Auth** | Pronto, integra com o DB; e-mail/OTP | Acoplamento |
| Lucia | Leve, control total | Mais manual |

**Recomendação:** **Auth.js (NextAuth) ou Supabase Auth** — o que casar com o
banco escolhido. Login por **e-mail/senha ou magic link/OTP**; sessão segura
(cookies httpOnly). **Importante:** esta é a conta **do nosso app**, **não** é o
Gov.br. **O login Gov.br é sempre feito pelo usuário na janela oficial** — o app
**nunca** vê a senha Gov.br (doc 12 §18).

---

## 8. Autenticação do painel admin

**Recomendação:** **mesma tecnologia de auth do usuário, mas domínio/rotas
separados e RBAC por perfil** (Admin/Operador/Financeiro/Suporte — doc 11 §2/§3).

- **Contas internas** em `admin_users` (doc 12 §3.12), **isoladas** das contas de
  usuário final.
- **MFA obrigatório** para perfis internos (especialmente quem clica
  "Gerar GRU e Salvar" e quem libera pagamento).
- **Segregação de funções** refletida em permissões (doc 11 §3).
- **Toda ação sensível** vira `admin_actions`/`audit_logs` (doc 12 §12).

---

## 9. Pagamento Pix

Requisito: **Pix do cliente → empresa**, **por processo**, com webhook de
confirmação; **bloquear cobrança se Gov/SINARM instável** (doc 10 §9).

| Opção | Observação |
|-------|-----------|
| **PSP/gateway com Pix** (ex.: Mercado Pago, Asaas, Pagar.me, Gerencianet/Efí, Stripe BR) | API + webhook + conciliação; escolher por taxa, suporte e cobertura Pix |
| Pix direto via PSP bancário | Possível, porém mais integração/*compliance* |

**Recomendação:** integrar um **PSP brasileiro com Pix e webhook** (decisão final
depende do inventário de provedores/comercial — doc 08). No modelo:
- `payments` guarda `provider_ref`, status e comprovante (doc 12 §3.9/§8);
- **webhook idempotente** confirma o pagamento;
- **não** confundir com a **GRU** (paga manual pela empresa — doc 11 §9).
- **Cartão fica fora do MVP** (§18).

---

## 10. Fila / jobs

**BullMQ + Redis** (já decidido no doc 03).

Usos no MVP:
- **Fila de operação** (processos pagos aguardando execução assistida);
- **retomada** após instabilidade / sessão expirada (doc 11 §12/§13);
- **jobs de retenção/expurgo** (`data_retention_jobs` — doc 12 §3.18/§15);
- **envio de notificações** ao usuário (mudança de status).

**Recomendação:** **worker separado** (processo Node dedicado) consumindo o Redis,
para não bloquear o request. No MVP dá para começar simples, mas **já isolado** do
web.

---

## 11. Automação SINARM/CAC futura

- **Playwright** é o padrão já decidido (doc 03 §6) — auto-wait, trace viewer,
  contexto isolado por job.
- No MVP a operação é **assistida** (humano); a automação entra **por módulos**,
  validando o mais difícil primeiro (preenchimento do formulário, seleção de
  armamento).
- **Regras herdadas:** não burlar captcha, não evadir anti-bot, **nunca** clicar
  "Gerar GRU e Salvar" sem revisão humana nos primeiros 50–100 (doc 11 §12).
- A automação roda **no worker** (§10), **nunca** dentro do request web.
- **Login Gov.br continua humano** (janela oficial) — a automação **assiste**.

---

## 12. Logs e auditoria

- **pino** (JSON estruturado) para logs de aplicação — correlação por
  `processId`/`jobId` (doc 03).
- **Auditoria de negócio** em tabelas **append-only** (`audit_logs`,
  `admin_actions`, `process_status_events` — doc 12 §12/§17).
- **Destaque** para o evento `GERAR_GRU_SALVAR` (ato irreversível).
- **Sem PII em claro** em logs (`reason`/`detail`/`body`).
- Considerar coletor de logs/observabilidade (ex.: Grafana/Loki, Sentry para
  erros) — **opcional** no MVP, útil cedo.

---

## 13. Segurança / LGPD

Base: `docs/05-logs-auditoria-lgpd.md`, doc 12 §13–§19.

- **PII cifrada em repouso** (campos do doc 12 §19); **`cpf_hash`** para busca.
- **Segredos fora do código:** `.env` + **schema Zod** validando no boot.
- **Gestão de chaves de cifra** (KMS/secret manager do provedor) — decidir cedo.
- **HTTPS/TLS** ponta a ponta; cookies `httpOnly`+`secure`; CSRF nos formulários.
- **RBAC** e **MFA** no painel; **acesso mínimo** à PII (need-to-know).
- **URLs assinadas** e curtas para documentos; **nunca** público.
- **Retenção/expurgo** por política (doc 12 §15) via jobs.
- **Nunca**: senha Gov.br, PII em log, arquivo como blob no banco, print com PII
  versionado (doc 12 §18).
- **Região dos dados**: preferir hospedagem/DB com dados no Brasil ou com base
  legal adequada (avaliar por provedor).

---

## 14. Deploy recomendado

| Opção | Prós | Contras |
|-------|------|---------|
| **Vercel (web/Next) + worker/Redis/DB gerenciados** | Deploy do front trivial; escala | Worker/Redis ficam fora da Vercel |
| **Railway / Render / Fly.io** (web + worker + Redis + Postgres) | Tudo num lugar, simples p/ MVP | Menos "serverless" |
| VPS (Docker Compose) | Controle e custo previsível | Você opera tudo |

**Recomendação p/ MVP:** **web (Next) na Vercel** *ou* **tudo em Railway/Render**
(mais simples ter web+worker+Redis juntos). **DB e Storage gerenciados**
(Supabase ou equivalente). Priorizar **simplicidade operacional** e **backup
automático** do Postgres.

---

## 15. Ambientes

**local / staging / produção**, com **segredos separados** e **dados isolados**.

- **Local (dev):**
  - Postgres local ou Supabase de dev; Redis local (Docker) ou em memória p/
    começar; storage = FS local (adapter).
  - **Nunca** dados reais de terceiros; sem automação real do SINARM.
- **Staging:**
  - Espelho de produção com **dados fictícios**; Pix em **sandbox**; sem
    protocolar processo real; sem "Gerar GRU e Salvar" real.
  - Serve para validar fluxo, painel e integrações.
- **Produção:**
  - DB/Storage gerenciados com **backup**; Pix **produção**; segredos em secret
    manager; **revisão humana** ativa nos primeiros 50–100 processos.

> Regra: **staging não protocola** e **não paga** de verdade. Ambientes têm
> **credenciais e bancos distintos**.

---

## 16. Variáveis de ambiente previstas

Validadas por **schema Zod** no boot (nomes ilustrativos):

```
# App
NODE_ENV=                # development | staging | production
APP_URL=
SESSION_SECRET=

# Banco / ORM
DATABASE_URL=            # Postgres

# Redis / filas
REDIS_URL=

# Storage
STORAGE_DRIVER=          # supabase | s3 | fs
STORAGE_BUCKET=
S3_ENDPOINT=             # se S3/R2/MinIO
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Auth
AUTH_SECRET=
AUTH_PROVIDER_*=         # conforme Auth.js/Supabase

# Cifra de PII
DATA_ENCRYPTION_KEY=     # via KMS/secret manager (não no repo)

# Pix (PSP)
PIX_PROVIDER=
PIX_API_KEY=
PIX_WEBHOOK_SECRET=

# Observabilidade (opcional)
SENTRY_DSN=
LOG_LEVEL=               # pino
```

> **Nenhum segredo no repositório.** `.env.example` documenta as chaves **sem
> valores**. Segredos reais em secret manager do provedor.

---

## 17. Serviços externos necessários

- **Postgres gerenciado** (+ backup) — ex.: Supabase/Neon/RDS.
- **Storage de objetos** — Supabase Storage / S3 / R2.
- **Redis gerenciado** — para BullMQ.
- **PSP com Pix** (+ webhook) — provedor a definir (doc 08/comercial).
- **E-mail transacional** (magic link/OTP, notificações) — ex.: Resend/SES.
- **Secret manager / KMS** — para chave de cifra e segredos.
- **(Opcional) Observabilidade** — Sentry (erros), Loki/Grafana (logs).
- **Gov.br/SINARM** — **não** é integração automatizada no MVP (login humano).

---

## 18. O que NÃO usar no MVP

- ❌ **Automação ponta a ponta** do SINARM/CAC (é assistida — doc 11 §20).
- ❌ **Cartão de crédito** (só Pix no MVP).
- ❌ **Pagamento automático/conciliação da GRU** (empresa paga manual).
- ❌ **Microserviços** / arquitetura distribuída (mono-repo/monólito modular basta).
- ❌ **Múltiplos bancos/poliglota**; **NoSQL** como principal (Postgres resolve).
- ❌ **ORM/stack fora de TS** (mantém time em um só stack).
- ❌ **Técnicas de evasão anti-bot** (proibidas — doc 03/08).
- ❌ **Módulo de certidões (M1)** e provedores externos (fora do MVP — doc 10 §17).
- ❌ **Armazenar senha Gov.br** (jamais).

---

## 19. Riscos técnicos

| Risco | Mitigação |
|-------|-----------|
| **Acoplamento a um provedor** (Supabase etc.) | Prisma + repositórios + storage adapter → troca barata |
| **Cifra/gestão de chaves mal feita** | KMS/secret manager desde o início; revisar §13 |
| **Webhook Pix duplicado/perdido** | Idempotência por `provider_ref`; reconciliação manual no MVP |
| **Sessão SINARM ~60 min / dupla autorização** | Filas + retomada; não tratar 1º retorno como erro (doc 11 §12/§13) |
| **Vazamento de PII em logs/prints** | pino sem PII; regra de não versionar PII; URLs assinadas |
| **Automação futura frágil/anti-bot** | Playwright + human-in-the-loop; sem evasão; achado vira "manual" |
| **Custos escalando** (Redis/Storage/DB) | Começar gerenciado simples; medir antes de otimizar |
| **Região de dados / LGPD** | Preferir dados no BR ou base legal; avaliar por provedor |
| **Complexidade prematura** | Monólito modular no Next; extrair serviço só quando doer |

---

## 20. Decisão recomendada final

**Stack do MVP Guia de Tráfego:**

- **Frontend/PWA:** **Next.js (App Router) + TypeScript + React**, Tailwind +
  componentes acessíveis (marca neutra), React Hook Form + **Zod**, TanStack Query.
- **Backend:** **Route Handlers do próprio Next**, com **camada de serviços/domínio
  separada** (Zod + repositórios Prisma); extrair para serviço Node dedicado só se
  crescer.
- **Banco:** **PostgreSQL + Prisma** (gerenciado; **Supabase** como opção mais
  rápida, avaliando região/LGPD).
- **Storage:** **adapter** (Supabase Storage **ou** S3/R2), URLs assinadas, sha256.
- **Auth usuário:** **Auth.js/Supabase Auth** (conta do app; **Gov.br é humano**).
- **Auth admin:** mesma base, **domínio separado + RBAC + MFA** e segregação de
  funções.
- **Pix:** **PSP brasileiro com Pix + webhook idempotente** (provedor a definir).
- **Filas/jobs:** **BullMQ + Redis** em **worker separado**.
- **Automação futura:** **Playwright** no worker, **assistida**, sem evasão.
- **Logs/auditoria:** **pino** + tabelas **append-only**; destaque a
  `GERAR_GRU_SALVAR`.
- **Segurança/LGPD:** PII cifrada, `cpf_hash`, segredos via secret manager,
  retenção por jobs, **nunca** senha Gov.br.
- **Deploy:** **web na Vercel** *ou* **tudo em Railway/Render**; DB/Storage/Redis
  gerenciados com backup.
- **Ambientes:** **local / staging / produção** isolados; **staging não protocola
  nem paga de verdade**.

**Resumo em uma frase:** *um monólito modular TypeScript (Next.js) com Postgres/
Prisma, storage por adapter, filas BullMQ/Redis e Playwright reservado para a
automação assistida futura — priorizando simplicidade, segurança/LGPD e baixo
custo operacional.*

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências, criar projeto, migration ou schema. É decisão de stack.
> Próximas ações dependem de **confirmação explícita** do usuário.
