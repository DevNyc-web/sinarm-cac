# 01 — Arquitetura Geral, Módulos e Fases

## 1. Arquitetura geral do produto final (alto nível)

O produto final é um **monólito modular** no início (menos custo, menos
complexidade operacional), preparado para extrair serviços quando um módulo
justificar (ex.: engine de automação). A automação de certidões roda como
**worker assíncrono separado**, porque é lenta, instável e não pode travar a API.

```
┌──────────────────────────────────────────────────────────────┐
│                        Cliente (CAC)                           │
│              PWA responsivo (browser / mobile)                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼──────────────────────────────────┐
│                        API / BFF                               │
│   Auth · Processos · Pagamento · Documentos · Status · Suporte │
└───┬──────────┬──────────┬──────────┬──────────┬───────────────┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────────┐
│Postgres│ │ Object │ │ Fila   │ │ PSP    │ │ Gov.br OAuth     │
│  (DB)  │ │Storage │ │(Redis) │ │(Pix)   │ │ (janela segura)  │
└────────┘ │(S3)    │ └───┬────┘ └────────┘ └──────────────────┘
           └────────┘     │
                          ▼
        ┌─────────────────────────────────────────┐
        │   WORKERS ASSÍNCRONOS                    │
        │  ┌───────────────────────────────────┐  │
        │  │ Engine de Certidões (Playwright)  │◄─┼── FASE 1
        │  │  - provedores                     │  │
        │  │  - classificação                  │  │
        │  │  - retentativa / captcha          │  │
        │  └───────────────────────────────────┘  │
        │  ┌───────────────────────────────────┐  │
        │  │ Protocolo SINARM (assistido)      │  │
        │  └───────────────────────────────────┘  │
        └─────────────────────────────────────────┘

     Transversal: Auditoria/Logs · LGPD · Admin interno · Suporte humano
```

Princípios:

- **PII isolada e cifrada.** CPF, RG, nome da mãe etc. ficam em um domínio
  próprio, cifrados em repouso, com log de acesso separado (LGPD).
- **Automação nunca no caminho síncrono do usuário.** Sempre via fila + worker.
- **Storage por interface** (adapter): local no laboratório → S3/MinIO em produção.
- **Tudo auditável.** Cada tentativa de automação gera trilha reproduzível.

## 2. Quebra em módulos independentes

| Mód. | Nome | Responsabilidade | Depende de |
|------|------|------------------|-----------|
| M0 | Core/Infra | Auth, usuários, DB, storage, fila, config | — |
| **M1** | **Certidões (engine)** | **Automação, download, classificação de certidões** | **isolado na Fase 1** |
| M2 | Documentos | Upload/foto de documentos, storage (OCR depois) | M0 |
| M3 | Pagamento | Pix por processo via PSP | M0 |
| M4 | Gov.br | Login Gov.br em janela segura (sem guardar senha) | M0 |
| M5 | Protocolo SINARM | Guia de Tráfego (1º processo), assistido/automatizado | M0, M1, M4 |
| M6 | Acompanhamento | Status do processo, notificações, PWA | M0 |
| M7 | Admin interno | Painel operacional, fila de trabalho humano | M0 |
| M8 | Suporte | Atendimento humano, tickets | M0 |
| M9 | Auditoria/LGPD | Logs, trilha, consentimento, retenção, exclusão | transversal |

Cada módulo tem contrato de entrada/saída próprio e pode ser desenvolvido,
testado e (se preciso) implantado isoladamente.

## 3. Ordem recomendada das fases

A ordem é guiada por **risco**, não por facilidade. Validamos o que pode matar
o produto primeiro.

1. **Fase 1 — Laboratório de Certidões (M1).**
   Hipótese a validar: *"conseguimos emitir e classificar certidões de forma
   automatizada, legalmente e de forma confiável?"* Se a resposta for "não" ou
   "só parte", isso muda todo o modelo de negócio. Por isso vem antes de tudo.
2. **Fase 2 — Core + Documentos (M0, M2).** Fundação: auth, usuários, storage,
   fila, upload de documentos.
3. **Fase 3 — Pagamento Pix (M3).** Cobrança por processo.
4. **Fase 4 — Gov.br (M4).** Login em janela segura, sem persistir senha.
5. **Fase 5 — Protocolo SINARM: Guia de Tráfego (M5).** Primeiro processo real,
   usando certidões (M1) + Gov.br (M4).

> **Reconhecimento já feito (2026-07-16):** o fluxo SINARM/CAC via Gov.br foi
> mapeado manualmente — ver `docs/09-reconhecimento-sinarm-cac.md`. Classificação
> técnica preliminar de M4+M5: **`SEMIAUTOMATICO`** (login Gov.br do usuário,
> autorização de compartilhamento, possível exigência de foto Gov.br, sessão de
> ~60 min e instabilidade na autorização). A senha Gov.br **nunca** é armazenada.
6. **Fase 6 — Painel do usuário + Status + PWA (M6).**
7. **Fase 7 — Admin + Suporte + endurecimento LGPD (M7, M8, M9).**

> A Fase 1 é deliberadamente **descartável**: é um laboratório. Se validar,
> o código do engine é promovido a módulo M1 do produto. Se não validar,
> aprendemos barato e ajustamos a estratégia (ex.: parte manual assistida).
