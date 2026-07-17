# 07 — Estrutura de Pastas

## 13. Arquivos de documentação a criar primeiro em /docs

Já criados nesta fase (ordem de leitura):

```
docs/
├── 01-arquitetura-geral.md          # produto final, módulos, ordem das fases
├── 02-fase1-laboratorio-certidoes.md# arquitetura da Fase 1 + provedores + falhas
├── 03-stack-automacao.md            # stack + Playwright vs Puppeteer
├── 04-modelo-dados.md               # banco, PDFs, classificação
├── 05-logs-auditoria-lgpd.md        # logs, auditoria, LGPD
├── 06-riscos-e-escopo.md            # riscos + o que NÃO construir agora
└── 07-estrutura-pastas.md           # este arquivo
```

Documentos a criar **em seguida** (antes do protótipo), ainda sem código:

```
docs/
├── 08-inventario-provedores.md      # tabela: provedor, URL, campos, captcha,
│                                     #  automacaoPermitida (preencher 1 a 1)
├── 09-taxonomia-erros.md            # catálogo fechado de errorCode + significado
├── 10-regras-classificacao.md       # âncoras textuais por provedor
├── adr/                              # Architecture Decision Records
│   ├── 0001-playwright-vs-puppeteer.md
│   ├── 0002-monolito-modular.md
│   └── 0003-storage-por-adapter.md
└── legal/
    └── analise-termos-de-uso.md     # revisão jurídica por provedor (bloqueante)
```

## 14. Estrutura inicial de pastas do projeto

Proposta para quando o **protótipo** começar (ainda NÃO criar código agora —
apenas `/docs` existe hoje). O laboratório da Fase 1 fica isolado em
`labs/certidoes/`, separado de qualquer código de produto futuro.

```
sinarm-cac/
├── README.md
├── docs/                            # ← única pasta com conteúdo hoje
│   └── ... (ver acima)
│
└── labs/
    └── certidoes/                   # LABORATÓRIO ISOLADO DA FASE 1
        ├── README.md
        ├── package.json             # (criado só quando aprovarmos a stack)
        ├── .env.example             # config; segredos fora do git
        │
        ├── src/
        │   ├── input/               # entrada manual (CLI / JSON de teste)
        │   ├── core/
        │   │   ├── queue/           # orquestrador de jobs (retentativa/backoff)
        │   │   ├── automation/      # runner Playwright, contexto, screenshots
        │   │   ├── classification/  # classificador + regras genéricas
        │   │   ├── storage/         # StorageAdapter (FS local -> S3 depois)
        │   │   ├── logging/         # pino + trilha de auditoria
        │   │   └── crypto/          # cifragem de PII
        │   │
        │   ├── providers/           # UM provedor por pasta
        │   │   ├── _registry.ts     # carrega/indexa provedores habilitados
        │   │   └── pf-antecedentes-federal/
        │   │       ├── provider.ts      # config declarativa
        │   │       ├── roteiro.ts       # passos Playwright
        │   │       ├── classificar.ts   # âncoras textuais do provedor
        │   │       └── fixtures/         # PDFs/HTML de teste (consta/nada consta)
        │   │
        │   ├── db/
        │   │   ├── schema/          # Prisma (Person, Request, Attempt, Artifact, Provider)
        │   │   └── migrations/
        │   │
        │   └── index.ts             # ponto de entrada do lab
        │
        ├── storage/                 # PDFs/screenshots/traces locais (git-ignored)
        └── tests/                   # testes do classificador via fixtures
```

Notas:

- **`labs/certidoes/` é descartável/promovível.** Se a Fase 1 validar, o `core/`
  e `providers/` viram base do módulo M1 do produto. Se não, foi barato.
- **`storage/` e `.env` no `.gitignore`.** Nunca versionar PDFs com PII nem
  segredos.
- **Nada em `labs/` roda contra site externo** até: (1) você aprovar a
  arquitetura e (2) o provedor ter `automacaoPermitida = SIM` na análise legal.
