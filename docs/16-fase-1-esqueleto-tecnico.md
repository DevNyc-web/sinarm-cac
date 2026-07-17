# 16 — Fase 1: Esqueleto Técnico (preparação)

> **O que é este documento.** Prepara a **Fase 1 (esqueleto do app)** do roadmap
> (doc 14 §4): estrutura de pastas, convenções, `.env.example`, scripts,
> dependências previstas, páginas/componentes placeholder e Prisma inicial —
> **antes** de criar o projeto ou instalar qualquer coisa.
>
> **Ainda NÃO é código.** Nada aqui cria projeto, instala dependência, gera
> migration ou escreve app. É o **plano de execução** da Fase 1.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/13-stack-tecnica-mvp.md` (stack), `docs/14-roadmap-implementacao-mvp.md`
> (fases), `docs/15-decisoes-fase-0.md` (banco = Postgres local + Prisma),
> `docs/12-modelo-dados-mvp.md` (modelo), `docs/07-estrutura-pastas.md` (separação
> do laboratório de certidões).
>
> **Restrições herdadas do doc 15 (valem para toda a Fase 1):**
> Postgres **local**; **sem dados reais / PII real**; **sem Pix**; **sem upload
> real de documento sensível**; **sem automação SINARM/CAC**; **não protocolar nada**.

---

## 1. Objetivo da Fase 1

Ter um **app Next.js + TypeScript que sobe localmente**, com:
- **camadas** organizadas (`web → services/domínio → repositórios → db`);
- **config validada por Zod** no boot;
- **healthcheck** e conexão com **Postgres local** via **Prisma**;
- **páginas placeholder** navegáveis (usuário e admin);
- **nada de negócio real** ainda (sem Pix, sem PII, sem automação).

É o **andaime**: prova que a stack escolhida roda e que a estrutura comporta as
fases seguintes, sem tocar em dados sensíveis.

---

## 2. Escopo permitido da Fase 1

- Criar o **projeto Next.js (App Router) + TypeScript** (quando autorizado).
- **Tailwind** + componentes base neutros.
- **Config por schema Zod** (falha se faltar env).
- **Prisma** apontando para **Postgres local**; schema inicial **mínimo**
  (ex.: `process_types`, enums de estado) **sem PII**.
- **Healthcheck** (`/api/health` ou route handler equivalente).
- **Páginas placeholder** (landing, login, dashboard, novo processo, admin).
- **Componentes base** (layout, botão, input, card, etc.).
- **Dados fictícios** para navegação (seed opcional, sem PII — §12).
- **pino** para logs de aplicação.

---

## 3. Escopo proibido da Fase 1

- ❌ **Pix / pagamento** (Fase 5).
- ❌ **Upload real de documento sensível** (Fase 4).
- ❌ **PII real** em qualquer tabela/arquivo (usar dados fictícios).
- ❌ **Automação SINARM/CAC** / Playwright de produção.
- ❌ **Protocolar** ou registrar processo real.
- ❌ **Provedores de produção** (Supabase/S3/Redis gerenciado/PSP/e-mail).
- ❌ **Cifra de PII "de verdade"** dependente de KMS (decisão 3.10 ainda `PENDENTE`).
- ❌ **Segredos no repositório** (só `.env.example` sem valores).
- ❌ **Login Gov.br** (é humano; nem simular fluxo real aqui).

---

## 4. Estrutura de pastas proposta

App do **produto** na raiz do repositório, **separado** do laboratório de
certidões (`labs/`, doc 07) e da documentação (`docs/`).

```
sinarm-cac/
├── README.md
├── docs/                         # documentação (já existe)
├── labs/                         # laboratório de certidões (futuro, doc 07)
│
├── package.json                  # (criado só quando a Fase 1 iniciar)
├── .env.example                  # chaves sem valores (§6)
├── .gitignore                    # inclui .env, /node_modules, /storage-local
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── prisma/
│   └── schema.prisma             # schema inicial mínimo (§11), SEM migration ainda
│
└── src/
    ├── app/                      # Next.js App Router
    │   ├── (public)/
    │   │   ├── page.tsx          # landing simples
    │   │   └── login/page.tsx    # login placeholder
    │   ├── (user)/
    │   │   ├── dashboard/page.tsx        # dashboard usuário placeholder
    │   │   └── processos/novo/page.tsx   # novo processo Guia de Tráfego placeholder
    │   ├── (admin)/
    │   │   └── admin/page.tsx    # painel admin placeholder
    │   ├── api/
    │   │   └── health/route.ts   # healthcheck
    │   └── layout.tsx            # layout raiz (marca neutra)
    │
    ├── components/               # componentes base (§10)
    │   └── ui/
    │
    ├── server/                   # camada de domínio (não é rota)
    │   ├── config/               # env + schema Zod
    │   ├── db/                   # cliente Prisma
    │   ├── services/             # casos de uso (vazios/placeholder na F1)
    │   └── repositories/         # acesso a dados via Prisma
    │
    ├── lib/                      # utilitários (logger pino, helpers)
    │
    └── styles/                   # globais/Tailwind
```

Notas:
- **`storage-local/`** (quando existir) fica **git-ignored** — mas na F1 **não há
  upload** (§3).
- O app do produto **não** vive dentro de `labs/`; `labs/` é descartável/promovível
  (doc 07).

---

## 5. Convenções de nomenclatura

- **Idioma:** código/identificadores em **inglês**; textos de UI em **português**.
- **Arquivos de rota (Next):** convenção do App Router (`page.tsx`, `route.ts`,
  `layout.tsx`).
- **Componentes React:** `PascalCase` (`ProcessCard.tsx`).
- **Funções/variáveis:** `camelCase`.
- **Tipos/interfaces/enums:** `PascalCase`.
- **Constantes:** `UPPER_SNAKE_CASE`.
- **Tabelas/colunas (Prisma/DB):** `snake_case` (via `@@map`/`@map`), modelos
  Prisma em `PascalCase`.
- **Pastas:** `kebab-case`.
- **Enums de estado:** alinhados ao doc 12 (ex.: `RASCUNHO`, `PAGO_EM_FILA`).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- **Sem PII** em nomes de arquivo, seed ou fixture.

---

## 6. Variáveis de ambiente previstas (`.env.example`, sem segredos)

Apenas o necessário para a **Fase 1** (subconjunto do doc 13 §16). **Sem valores**
no repositório.

```
# App
NODE_ENV=development
APP_URL=http://localhost:3000

# Banco (Postgres LOCAL — decisão 3.1 / doc 15)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/sinarm_cac_dev

# Logs
LOG_LEVEL=debug
```

> Chaves de **Redis, Storage, Auth, Pix, e-mail, cifra** **não** entram na F1
> (decisões `PENDENTE` no doc 15). Serão adicionadas ao `.env.example` **na fase
> que as introduzir**.

---

## 7. Scripts previstos no `package.json`

(Ilustrativo — criados quando a F1 iniciar.)

```
dev        -> next dev            # sobe o app local
build      -> next build
start      -> next start
lint       -> eslint .
typecheck  -> tsc --noEmit
format     -> prettier --write .
db:generate-> prisma generate     # gera client (SEM aplicar migration ainda)
db:studio  -> prisma studio        # inspeção local (dados fictícios)
seed       -> tsx prisma/seed.ts   # dados fictícios (opcional, §12)
```

> **`db:migrate` fica de fora da F1** enquanto o schema não é congelado
> (dúvidas do doc 12 §20 / doc 15 §7). Usar `prisma generate` e, se preciso,
> `db push` **local** para prototipar — **nunca** em banco de produção.

---

## 8. Dependências previstas (ainda NÃO instaladas)

**Runtime:**
- `next`, `react`, `react-dom` — app/PWA (doc 13 §3).
- `typescript` + tipos.
- `zod` — validação e config.
- `@prisma/client` — acesso ao banco.
- `pino` — logs estruturados.
- `tailwindcss`, `postcss`, `autoprefixer` — estilo.
- (opcional) `clsx`/`tailwind-merge` — utilitários de classe.

**Dev:**
- `prisma` (CLI).
- `eslint` + config, `prettier`.
- `tsx` (rodar scripts TS, ex.: seed).

**Fora da F1** (introduzir na fase que precisar): Auth.js/Supabase Auth,
BullMQ/`ioredis`, SDK do PSP Pix, SDK de e-mail, libs de cifra, Playwright.

> **Não instalar nada agora.** Esta lista é a **proposta**; a instalação ocorre
> só após confirmação para iniciar a Fase 1.

---

## 9. Páginas iniciais previstas (placeholders)

Todas **navegáveis**, **neutras** e **sem lógica de negócio real**:

| Página | Rota | Conteúdo placeholder |
|--------|------|----------------------|
| **Landing simples** | `/` | Proposta neutra do serviço + CTA "Entrar"/"Começar". Sem identidade oficial. |
| **Login placeholder** | `/login` | Formulário visual (e-mail) **sem** auth real; botão desabilitado/mock. |
| **Dashboard usuário** | `/dashboard` | Lista vazia de processos + botão "Novo processo". Dados fictícios. |
| **Novo processo Guia de Tráfego** | `/processos/novo` | Formulário visual dos campos (destino, arma/PCE, justificativa) **sem** salvar PII; validação Zod de forma/UX. |
| **Painel admin** | `/admin` | Tabela vazia de fila + placeholders de detalhe. Sem RBAC real ainda. |

> Mensagens honestas, **marca neutra**, **sem prometer aprovação** (doc 10 §14).
> Nenhum campo coleta/persiste **PII real** na F1.

---

## 10. Componentes base previstos

- **Layout:** `RootLayout`, `Header` (marca neutra), `Container`.
- **UI:** `Button`, `Input`, `Textarea`, `Select`, `Card`, `Badge` (status),
  `Table`, `EmptyState`, `Alert`/`Callout`.
- **Formulário:** wrapper com **React Hook Form + Zod** (validação de UX; sem
  persistência real).
- **Feedback:** `Toast`/`Notice` simples.

> Todos **acessíveis** e **responsivos** (doc 13 §3). Sem dependência de provedor.

---

## 11. Prisma inicial previsto (sem migrations ainda)

- Criar `prisma/schema.prisma` com **datasource** = Postgres local e **generator**
  do client.
- Modelar **apenas o mínimo sem PII** para provar a stack, por exemplo:
  - `ProcessType` (`code`, `name`, `base_fee_cents`, `active`) — doc 12 §3.4.
  - **Enums de estado** como referência (interno/usuário) — doc 12 §6/§7.
  - (Opcional) um `Process` **esqueleto** **sem** campos de PII/pagamento, só para
    validar relacionamento básico.
- **NÃO** modelar ainda: `user_profiles`, `process_documents`, `payments`,
  `gru_records`, `firearms_pce`, `gov_sessions` com **PII/segredos** — dependem de
  storage/cifra/Pix (`PENDENTE` no doc 15).
- **Sem `prisma migrate`** (schema não congelado). Prototipar com `db push` local
  se necessário; **nunca** contra produção.

---

## 12. Dados fictícios permitidos

- **Permitido:** dados claramente **falsos/sintéticos** para navegar a UI
  (ex.: "Clube de Tiro Exemplo", UF "SP", processo "GT-DEMO-001").
- **Proibido:** **CPF, nome, RG, nº de série de arma reais**, endereços reais,
  qualquer PII de pessoa real (nem do próprio time).
- **Seed opcional** (`prisma/seed.ts`) só com `ProcessType` e exemplos genéricos.
- Fixtures/exemplos **nunca** contêm PII (doc 12 §18).

---

## 13. Checklist de aceite da Fase 1

- [ ] `npm run dev` (ou equivalente) **sobe o app** local sem erros.
- [ ] **Config Zod** falha o boot se faltar `DATABASE_URL`/env obrigatória.
- [ ] **Healthcheck** responde OK e confirma conexão com **Postgres local**.
- [ ] As **5 páginas placeholder** (§9) abrem e navegam entre si.
- [ ] **Componentes base** (§10) renderizam, responsivos.
- [ ] **Prisma client** gera; schema mínimo (§11) válido; **sem migration**.
- [ ] **pino** registra logs (sem PII).
- [ ] **Nenhum segredo** no repo; `.env.example` sem valores; `.env` no `.gitignore`.
- [ ] **Nada** de Pix, upload real, PII real, automação ou protocolo.
- [ ] `lint` e `typecheck` passam.

---

## 14. O que deve ser commitado na primeira implementação

- `package.json` / `package-lock.json` (ou lockfile equivalente).
- `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, config de ESLint/Prettier.
- `.env.example` (**sem valores**), `.gitignore`.
- `prisma/schema.prisma` (schema mínimo, **sem** migration).
- `src/` com páginas placeholder, componentes base, `server/config` (Zod),
  `server/db` (cliente Prisma), `lib/logger`.
- (Opcional) `prisma/seed.ts` com dados **fictícios**.
- Atualização do `README.md` com "como rodar local".

---

## 15. O que NÃO deve entrar no primeiro commit de código

- ❌ **`.env`** ou qualquer **segredo/credencial**.
- ❌ **`node_modules/`**, artefatos de build.
- ❌ **Migrations** (schema ainda não congelado).
- ❌ **PII real** em seed, fixture ou comentário.
- ❌ Código de **Pix, upload real, cifra KMS, Auth de produção, automação**.
- ❌ **Documentos/prints** com dados reais.
- ❌ Conexão/credenciais de **provedores de produção**.
- ❌ `storage-local/` com qualquer conteúdo sensível.

---

## 16. Próximo passo após este documento

1. **Confirmar** os itens finais da Fase 0 pendentes que ajudam a F1: nome do
   **repo/pastas**, e (se quiser) **deploy alvo** — nada disso bloqueia começar.
2. Mediante **confirmação explícita**, **iniciar a Fase 1**: criar o projeto
   Next.js + TS, instalar as dependências previstas (§8), e implementar o
   esqueleto conforme §4–§12.
3. Rodar o **checklist de aceite** (§13) e abrir o primeiro commit conforme §14/§15.
4. Só então planejar a **Fase 2 (auth/perfis)** — que dependerá de decidir
   **auth do usuário/admin** (doc 15 §3.8/§3.9), ainda `PENDENTE`.

---

> **Lembrete permanente:** este documento **não** autoriza criar projeto, instalar
> dependências ou escrever código. É preparação. A Fase 1 só começa após
> **confirmação explícita** do usuário.
