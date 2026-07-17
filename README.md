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

## O que NÃO existe / NÃO será construído agora

- App/telas finais
- Login Gov.br
- Pagamento Pix
- Scanner / OCR
- Protocolo SINARM
- Automação real de certidões (só depois de aprovada a arquitetura)

Ver [`docs/06-riscos-e-escopo.md`](docs/06-riscos-e-escopo.md).
