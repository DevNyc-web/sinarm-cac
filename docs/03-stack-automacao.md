# 03 — Stack e Abordagem de Automação

## 5. Stack recomendada para automação de sites externos

Foco: robustez de scraping, bom ferramental de depuração (o site externo é a
parte instável) e time de um só stack (TS ponta a ponta no futuro).

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Linguagem | **TypeScript / Node.js** | Mesmo stack do futuro backend/PWA; ecossistema de automação maduro |
| Automação web | **Playwright** | Ver §6 |
| Fila / jobs | **BullMQ + Redis** | Retentativa, backoff, concorrência, dead-letter prontos. No lab, dá pra começar com fila em memória |
| Banco | **PostgreSQL + Prisma** | Tipado, migrations versionadas. No lab isolado, SQLite via Prisma serve para arrancar rápido |
| Validação de input | **Zod** | Valida CPF/RG/datas antes de gastar uma tentativa |
| Logs | **pino** (JSON estruturado) | Correlação por `attemptId`, fácil de filtrar |
| Extração de texto do PDF | **pdf-parse / pdfjs** | Classificar "nada consta" vs "consta" |
| Storage | **Adapter**: FS local no lab → S3/MinIO depois | Troca sem mexer no engine |
| Config de ambiente | **dotenv + schema Zod** | Segredos fora do código |

> **Nota sobre banco:** existe um MCP de **Supabase** disponível neste ambiente
> (Postgres gerenciado + storage). É uma opção válida para produção — mas **na
> Fase 1 não vamos plugar nada externo ainda**; o laboratório roda local
> (SQLite/Postgres local + FS). Decisão de storage gerenciado fica para a Fase 2.

Não instalar nada ainda. Isto é a proposta; a instalação vem depois da sua
aprovação da arquitetura.

## 6. Playwright, Puppeteer ou outra abordagem?

**Recomendação: Playwright.**

| Critério | Playwright | Puppeteer | HTTP puro (sem browser) |
|----------|-----------|-----------|-------------------------|
| Auto-wait de elementos | ✅ nativo, reduz flakiness | ⚠️ manual | — |
| Multi-browser (Chromium/Firefox/WebKit) | ✅ | ❌ (Chrome) | — |
| **Trace viewer / vídeo / screenshot em falha** | ✅ excelente p/ depurar site externo | ⚠️ básico | ❌ |
| Interceptação de rede | ✅ | ✅ | é o próprio meio |
| Contextos isolados (sessão limpa por job) | ✅ | ⚠️ | — |
| Resiliência a mudança de layout | média (é DOM) | média | frágil |
| Robusto contra sites JS-pesados / gov | ✅ | ✅ | ❌ muitos exigem JS |

- **HTTP puro (requests + parse de HTML)** é mais rápido e barato, mas quebra em
  sites gov com JS, tokens de sessão e antibot. Usar **só** onde o provedor
  expõe fluxo simples e estável — como otimização pontual, não como base.
- **Puppeteer** é competente, mas o **trace viewer** e o auto-wait do Playwright
  fazem muita diferença justamente na parte mais dolorosa: depurar por que o
  site externo falhou numa tentativa de ontem.

**Decisão:** Playwright como padrão; HTTP puro como otimização opcional por
provedor quando comprovadamente estável e permitido.

### Anti-bot — aviso importante

Sites com Cloudflare/anti-bot podem bloquear automação headless. **Não** vamos
investir em técnicas de evasão (stealth, rotação de IP, fingerprint spoofing)
para contornar proteção antifraude: além de frágil, entra em zona jurídica
ruim. Se um provedor bloqueia automação, isso é um **achado da Fase 1** (esse
provedor fica manual/assistido), não um problema a "hackear".
