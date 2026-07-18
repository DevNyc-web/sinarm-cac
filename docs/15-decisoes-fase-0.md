# 15 — Decisões da Fase 0 (antes do código)

> **O que é este documento.** Registra as **decisões mínimas da Fase 0** (doc 14
> §3) que precisam estar fechadas — ou conscientemente adiadas — **antes** de
> escrever a primeira linha de código do MVP Guia de Tráfego.
>
> **Ainda NÃO é código.** Só decisões e pendências.
>
> **Última atualização:** 2026-07-18
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
- **Decisão escolhida (2026-07-18):** 🟡 **PRELIMINAR PARA A FASE 4** —
  criar **camada adapter de storage**, começando com **storage local/dev** para
  **arquivos fictícios**.
  - **Produção:** segue `PENDENTE` — a escolher entre **Supabase Storage** e
    **S3 compatível** (mesmo adapter).
  - **Restrição:** **não usar documento real nem PII real** enquanto storage de
    produção, criptografia (3.10) e retenção definitiva (3.11) não estiverem
    fechados.
  - **Objetivo:** desenvolver **fluxo, validação, estados e painel** de upload
    sem travar no fornecedor final.
  - **Efeito:** libera iniciar a **Fase 4 em modo dev/fictício**. Upload real
    fica para depois das decisões finais.

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
- **Decisão escolhida (2026-07-18):** 🟡 **RECOMENDAÇÃO REGISTRADA** — ver
  comparativo completo em **`docs/17-decisao-pix-mvp.md`**.
  - **Recomendação: Mercado Pago** (facilidade p/ MVP, sandbox, webhook,
    marca reconhecida pelo pagador); **alternativa aceitável: Asaas**;
    plano B técnico: OpenPix/Woovi; **Stripe descartado** (Pix no BR só por
    convite); Efí preterido (mTLS sem benefício neste volume).
  - **Confirmação do usuário:** `PENDENTE` — a escolha vira **DECIDIDO** com a
    confirmação explícita (**segue bloqueador do início da F5**).
  - **Restrição:** F5 começa **em sandbox/dev** (nenhum Pix real); Pix real em
    produção só após **conta validada, webhook testado, reembolso revisado e
    termos prontos** (doc 17 §5).
  - **Taxas:** valores citados são referência — **confirmar no site oficial**.
  - **Arquitetura:** implementar atrás de **payment adapter** (como o storage
    adapter da F4) para não travar a troca de PSP.

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
- **Decisão escolhida (2026-07-17):** 🟡 **PRELIMINAR PARA A FASE 2** —
  implementar a **estrutura interna preparada para autenticação**, mas **começar
  com auth de desenvolvimento/mock** (ou sessão local controlada).
  - **Provedor real de produção:** ainda `PENDENTE`. Candidatos futuros:
    **Supabase Auth**, **Auth.js/NextAuth** ou provedor dedicado (segue 3.1).
  - **Restrição:** **não usar dados reais**, **não coletar CPF real**, **não usar
    PII real**.
  - **Objetivo:** liberar **guards**, **layout autenticado**, **dashboard** e o
    **fluxo de processo** com **dados fictícios**.
  - **Efeito:** libera iniciar a **Fase 2** (auth mock/dev). Provedor real fica
    para antes de produção.

### 3.9 Autenticação do admin
- **Recomendação padrão:** **mesma tecnologia de 3.8**, em **domínio/rotas
  separados**, com **RBAC** (Admin/Operador/Financeiro/Suporte) e **MFA
  obrigatório** para internos; **segregação de funções**.
- **Alternativa aceitável:** provider dedicado para o painel, se necessário isolar.
- **Decisão escolhida (2026-07-17):** 🟡 **PRELIMINAR PARA A FASE 2** —
  criar a **estrutura de RBAC/admin** no **modelo** e no **app**, **sem**
  autenticação real de produção ainda.
  - **Perfis previstos:** **admin · operador · financeiro · suporte**.
  - **MFA:** **obrigatório antes de produção**.
  - **Segregação de perfis:** deve seguir `docs/11-painel-admin-operacao.md` (§2/§3).
  - **Restrição:** o painel admin pode funcionar em **modo dev/mock** apenas para
    **validar navegação e permissões fictícias** — sem dados reais/PII.
  - **Efeito:** libera iniciar a **Fase 2** (RBAC estrutural + mock). Auth real e
    MFA ficam para antes de produção.

### 3.10 Estratégia de criptografia (PII)
- **Recomendação padrão:** **cifra em aplicação** dos campos sensíveis (doc 12 §19)
  com chave em **secret manager/KMS** do provedor; **`cpf_hash`** para busca;
  rotação de chave planejada.
- **Alternativa aceitável:** cifra a nível de coluna no banco (pgcrypto) **se** a
  gestão de chaves for adequada; **não** substitui o segredo fora do repo.
- **Decisão escolhida (2026-07-18):** 🟡 **PRELIMINAR PARA A FASE 4** —
  **não usar documentos reais**; preparar a arquitetura para **metadados
  protegidos, hashes (sha256) e storage privado**.
  - **KMS/criptografia final:** segue `PENDENTE` — obrigatória **antes de
    produção** (continua **bloqueador de PII real**).
  - **Restrição:** **não armazenar CPF real, RG real, imagem real de documento
    ou qualquer PII real**.
  - **Produção exigirá:** bucket **privado**, controle de acesso, **URLs
    assinadas/temporárias**, **logs de acesso** e política de retenção (3.11).
  - **Efeito:** libera a **Fase 4 em modo dev/fictício** sem tocar em PII real.

### 3.11 Retenção de documentos
- **Recomendação padrão:** apagar o **arquivo** do Documento de Identificação
  **30–90 dias após a conclusão** do processo, **mantendo metadado + sha256** para
  auditoria; comprovantes/PDF da GRU seguem prazo **fiscal/contábil**; expurgo via
  `data_retention_jobs` (doc 12 §15).
- **Alternativa aceitável:** reter o documento por prazo maior **se** houver base
  legal/necessidade operacional documentada.
- **Decisão escolhida (2026-07-18):** 🟡 **PRELIMINAR PARA O MVP** —
  documentos mantidos **apenas pelo tempo necessário** para execução e
  conferência do processo.
  - **Proposta inicial:** manter até **conclusão do processo + 30 dias** de
    janela operacional/contestação; depois **expurgar o arquivo**, preservando
    apenas **logs mínimos, status, protocolo e registros
    financeiros/legalmente necessários**.
  - **Decisão final:** segue `PENDENTE` (definição jurídica/LGPD) — obrigatória
    **antes de produção**.
  - **Fase 4 dev:** usar **apenas arquivos fictícios**, com liberdade de
    **apagar/reprocessar** sem compromisso legal.

---

## 7. Perguntas pendentes do doc 12 §20

Status de cada dúvida do modelo de dados que pode afetar o schema:

| # | Pergunta (doc 12 §20) | Bloqueia schema? | Status |
|---|------------------------|------------------|--------|
| 1 | Formato do **protocolo** e campos do **PDF da GRU**; como aparece **compensação/pagamento** | Parcial (afeta `gru_records`) | `PENDENTE` — depende de mapear pós-protocolo (doc 09 §15.14) |
| 2 | **Certidões** entram em algum ponto? | Não (fora do MVP) | **RESOLVIDO** — fora do MVP (doc 10 §17) |
| 3 | **Múltiplas armas por guia** (1 ou N em `firearms_pce`) | Sim | `PENDENTE` — confirmar no SINARM |
| 4 | **Prazos de retenção** por tipo | Não (política, não schema) | 🟡 **Preliminar (2026-07-18)** — conclusão + 30d (§3.11); final `PENDENTE` (jurídico) |
| 5 | **Cadastro inicial PF** vira fluxo? (tabela/campos próprios) | Não no MVP (é fallback) | `PENDENTE` — adiar |
| 6 | **Multi-perfil interno** (role único vs. tabela de papéis) | Pequeno (afeta `admin_users`) | 🟡 **Em andamento na F2** — perfis definidos (admin/operador/financeiro/suporte, §3.9); modelagem role único vs. tabela ainda a fechar |
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
0b. ✅ **Auth usuário/admin (3.8/3.9): RESOLVIDO para a Fase 2 (preliminar)** —
   **auth mock/dev + RBAC estrutural**. Deixa de bloquear o **início da F2**.
   **Provedor real de auth** e **MFA** seguem `PENDENTE` — obrigatórios **antes de
   produção**.
0c. ✅ **Storage/criptografia/retenção (3.2/3.10/3.11): RESOLVIDOS PARA A FASE 4
   (preliminares)** — **adapter de storage local/dev + arquivos fictícios +
   proposta de retenção**. Deixam de bloquear o **início da F4 em modo
   dev/fictício**. **Storage de produção, KMS/criptografia final e retenção
   definitiva** seguem `PENDENTE` — obrigatórios **antes de upload real /
   documento real**.
1. **Provedor Pix (3.4 / §7 #8):** bloqueia **Fase 5 (Pix)**. Não bloqueia F1–F4.
   🟡 Recomendação registrada (doc 17: **Mercado Pago**; alt. Asaas) —
   **falta confirmação do usuário**; F5 iniciará **em sandbox**.
2. **Estratégia de criptografia + KMS (3.10 / §7 #9):** bloqueia **persistir PII
   real** e **documento real**. Não bloqueia a **F4 dev/fictícia**, mas
   **precisa estar pronta antes de dados reais** (upload real / F11).
3. **Storage de documentos (3.2):** o fornecedor de **produção** bloqueia o
   **upload real de documentos sensíveis**. Não bloqueia a **F4 dev/fictícia**
   (adapter local/dev).
4. **Retenção/LGPD (3.11 / §7 #4):** a decisão **final** bloqueia **fechar a
   política de expurgo** (F10) e o **upload real**; a preliminar orienta o
   desenho desde a F4.
5. **Multi-arma (§7 #3)** e **campos Pix (§7 #8):** bloqueiam **congelar o schema**
   dessas tabelas — mas o schema pode ser modelado incrementalmente por fase.
6. **Provedor real de auth + MFA (3.8/3.9):** bloqueiam **ir a produção** com
   contas reais. **Não** bloqueiam a **Fase 2** (que roda mock/dev).

> Com **3.1 decidido**, a **Fase 1 (esqueleto)** está **destravada**; com
> **3.8/3.9 preliminares**, a **Fase 2 (auth/perfis)** também. Os demais itens
> impõem **ordem**: **Pix** e **cifra/storage** prontos **antes** das fases que
> tocam pagamento e **PII real**; **auth real + MFA** prontos **antes de produção**.

---

## 9. O que pode começar mesmo com pendências

Com **3.1 decidido (Postgres local + Prisma)** e **3.8/3.9 preliminares (auth
mock/dev + RBAC estrutural)**, é seguro avançar (após confirmação para iniciar código):

- **Fase 0 restante:** estrutura de pastas (doc 07), convenções (lint/commits),
  **`.env.example`** (sem segredos), wireframes.
- **Fase 1 (esqueleto):** Next.js + TS, camadas, healthcheck, **config Zod**,
  conexão com **Postgres local** via Prisma — sem provedor externo. **(FEITO)**
- **Fase 2 (auth/perfis):** **estrutura interna de autenticação** + **guards** +
  **layout autenticado** + **dashboard** + **fluxo de processo**, com **auth
  mock/dev** (sessão local controlada). **RBAC estrutural** com perfis
  **admin/operador/financeiro/suporte** e **segregação** conforme doc 11 — em
  **modo dev/mock**, validando **navegação e permissões fictícias**.
- **Modelagem incremental** das tabelas **sem PII/pagamento** (ex.: `process_types`,
  estados, `admin_users`/papéis) atrás do Prisma, com repositórios.
- **UI neutra** e formulários do usuário (F3) com validação Zod, usando **DB local**
  e dados **fictícios** até os provedores serem escolhidos. **(FEITO — F3/F3.5/F3.6:
  rascunho, revisão, fila admin, histórico e checklist.)**
- **Fase 4 (upload) em modo dev/fictício:** **camada adapter de storage** com
  **storage local/dev**, upload de **arquivos fictícios** (nunca documento real),
  **sha256/metadados**, estados do documento (doc 12 §10) e validação no painel —
  conforme preliminares 3.2/3.10/3.11. **Upload real** só após storage de
  produção + KMS + retenção definitiva.
- **Design de auditoria/eventos** (doc 12 §12) como contrato, independente do provedor.

> **Regras enquanto auth real/storage de produção/criptografia/retenção final
> estiverem `PENDENTE`:**
> - **Não usar dados reais / PII real** (nem CPF real, RG real ou **imagem real
>   de documento**).
> - **Não** usar **provedor de auth real** nem contas reais (só mock/dev).
> - **Não implementar pagamento** (Pix) nem **GRU**.
> - **Não implementar upload real de documentos sensíveis** — na F4, **apenas
>   arquivos fictícios** no **storage local/dev**.
> - **Não implementar automação SINARM/CAC** nem **Gov.br**.
> - **Não** conectar provedores de **produção** nem **integração externa real**.
> Ou seja: Fases 1–4 rodam **100% com Postgres local, auth mock/dev, storage
> local/dev e dados fictícios**.

---

## 10. Critério para liberar início da implementação

**Liberar a Fase 1 (código do esqueleto):** ✅ **CONCLUÍDA**
- [x] **Banco (3.1)** escolhido → ✅ **Postgres local + Prisma** (2026-07-17).
- [x] **Estrutura de pastas** e convenções definidas (doc 16 / esqueleto criado).
- [x] **`.env.example`** rascunhado (sem valores).
- [x] Confirmação **explícita** do usuário → esqueleto Next.js implementado e versionado.
- [ ] **Ambiente de deploy (3.7)** ao menos direcionado (segue `PENDENTE`, não bloqueia).

**Liberar a Fase 2 (auth e perfis):** ✅ **CONCLUÍDA**
- [x] **Auth usuário (3.8)** definida (preliminar) → **mock/dev + estrutura interna**.
- [x] **Auth admin (3.9)** definida (preliminar) → **RBAC estrutural + perfis**
      admin/operador/financeiro/suporte, **modo dev/mock**.
- [x] Confirmação **explícita** do usuário → F2 implementada e versionada
      (seguida de F3, F3.5 e F3.6 — rascunho, revisão, fila admin, histórico,
      checklist).

**Liberar a Fase 4 (upload) em modo dev/fictício:**
- [x] **Storage (3.2)** definido (preliminar) → **adapter + storage local/dev**;
      produção `PENDENTE` (Supabase Storage vs. S3 compatível).
- [x] **Criptografia (3.10)** definida (preliminar) → **sem documento real**;
      arquitetura preparada para **metadados protegidos, hashes e storage
      privado**; KMS final `PENDENTE`.
- [x] **Retenção (3.11)** definida (preliminar) → **conclusão + 30 dias** e
      expurgo (proposta); decisão final `PENDENTE`; na F4 dev, **arquivos
      fictícios** apagáveis livremente.
- [ ] Confirmação **explícita** do usuário para iniciar a Fase 4.

> **Situação:** **Fases 1–3.6 concluídas**; **Fase 4 liberada** para começar
> **apenas em modo dev/fictício** — storage local/dev via adapter, arquivos
> fictícios, sem documento real, **sem CPF/PII real**, sem integração externa
> real, sem Gov.br/SINARM, sem Pix/GRU. **Upload real de documento pessoal
> continua bloqueado** até fechar **storage de produção (3.2)**,
> **criptografia/KMS (3.10)** e **retenção definitiva (3.11)**.

**Liberar fases sensíveis:**
- [ ] **Produção com contas reais:** **provedor de auth real (3.8/3.9)** + **MFA** ativos.
- [ ] **Upload real / PII real:** **storage de produção (3.2)** + **criptografia +
      KMS (3.10)** + **retenção final (3.11)** definidos.
- [ ] **Fase 5/Pix:** **provedor Pix (3.4)** e **campos/idempotência (§7 #8/#10)** definidos.
- [ ] **Fase 10/LGPD:** **retenção (3.11)** final homologada (jurídico).
- [ ] **Fase 12/piloto:** **hardening (F11)** aprovado; provedores de produção ativos.

> **Resumo:** **Fases 1–4 liberadas** (banco + auth + storage/criptografia/retenção
> preliminares) — a F4 **só em modo dev/fictício**. **Auth real + MFA** antes de
> **produção**; **Pix (3.4)** trava a F5; **storage de produção, KMS e retenção
> final** travam o **upload real / PII real** — devem estar prontos **antes** deles.

---

## Quadro-resumo das decisões

| # | Decisão | Recomendação padrão | Escolhida |
|---|---------|---------------------|-----------|
| 3.1 | Banco | Supabase (Postgres gerenciado) | ✅ **Fase 1: Postgres local + Prisma**; produção `PENDENTE` |
| 3.2 | Storage | Supabase Storage (via adapter) | 🟡 **Fase 4: adapter + storage local/dev (arquivos fictícios)**; produção `PENDENTE` (Supabase vs. S3) |
| 3.3 | Redis/fila | Redis gerenciado + worker | `PENDENTE` |
| 3.4 | Pix | PSP BR com Pix + webhook | 🟡 **Recomendação: Mercado Pago (alt.: Asaas)** — doc 17; confirmação `PENDENTE`; F5 só em sandbox |
| 3.5 | E-mail | Resend | `PENDENTE` |
| 3.6 | Domínio | Domínio neutro (app./admin.) | `PENDENTE` |
| 3.7 | Deploy | Vercel (web) + gerenciados / Railway | `PENDENTE` |
| 3.8 | Auth usuário | Auth.js ou Supabase Auth | 🟡 **Fase 2: mock/dev + estrutura**; provedor real `PENDENTE` |
| 3.9 | Auth admin | Mesma + RBAC + MFA, domínio separado | 🟡 **Fase 2: RBAC estrutural + mock**; auth real + MFA `PENDENTE` (antes de produção) |
| 3.10 | Criptografia | Cifra em app + KMS + `cpf_hash` | 🟡 **Fase 4: sem doc real; arquitetura p/ hashes + storage privado**; KMS final `PENDENTE` (bloqueia PII real) |
| 3.11 | Retenção docs | Apagar doc 30–90d após conclusão | 🟡 **MVP: conclusão + 30d e expurgo (proposta)**; final `PENDENTE` (jurídico/LGPD) |

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências ou criar projeto. É registro de decisões. A implementação
> só começa após **confirmação explícita** do usuário e o critério do §10.
