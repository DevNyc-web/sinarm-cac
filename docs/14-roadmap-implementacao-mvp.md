# 14 — Roadmap de Implementação do MVP (Guia de Tráfego)

> **O que é este documento.** Define a **ordem segura de implementação** do MVP da
> Guia de Tráfego, em **fases**, com dependências, critérios de aceite, riscos e a
> **definição de MVP entregável**.
>
> **Ainda NÃO é código.** Nada aqui cria projeto, instala dependência, migration
> ou schema. É plano.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/09-reconhecimento-sinarm-cac.md`, `docs/10-mvp-guia-de-trafego.md`,
> `docs/11-painel-admin-operacao.md`, `docs/12-modelo-dados-mvp.md`,
> `docs/13-stack-tecnica-mvp.md`.
>
> **Premissa central:** a **primeira versão é assistida/manual**. **Sem automação
> SINARM/CAC.** Ninguém — humano do produto ou robô — clica em **"Gerar GRU e
> Salvar"** pelo sistema; o operador faz o processo **direto no SINARM** e o painel
> **registra** protocolo, GRU, pagamento da GRU e status. **Pix confirmado antes do
> protocolo**; **GRU paga manual** pela empresa; **revisão humana obrigatória** nos
> primeiros processos.

---

## 1. Objetivo do roadmap

Levar o projeto de "documentação pronta" a um **MVP operável com segurança**,
construindo na **ordem que reduz risco**: primeiro o esqueleto e a segurança,
depois o fluxo do usuário, o pagamento, o painel de operação e, por fim, o
**piloto controlado**. Cada fase entrega algo **verificável** e **não avança**
sem critério de aceite.

---

## 2. Princípios de implementação

- **Assistido antes de automático.** O MVP registra o trabalho humano; automação
  fica para depois (§21).
- **Segurança/LGPD desde o início**, não no fim (mas com hardening dedicado na F11).
- **Pagamento antes do ato irreversível.** Pix confirmado **antes** de protocolar.
- **Nada ambíguo passa sozinho** — vai para revisão humana (doc 00 §8).
- **Fases finas e verificáveis**; cada uma tem critério de aceite (§18).
- **Não construir o que o MVP não precisa** (§16).
- **Mono-repo modular TS** (doc 13); trocar peças por adapter, não por reescrita.
- **Marca neutra**, sem identidade oficial; mensagens honestas.

---

## 3. Fase 0 — Preparação do repositório e decisões finais

**Objetivo:** fechar decisões e preparar terreno **sem** ainda escrever app.

- Confirmar **stack final** (doc 13 §20) e **provedores**: Postgres gerenciado,
  storage, Redis, **PSP Pix**, e-mail transacional.
- Resolver **dúvidas em aberto** do modelo (doc 12 §20) que travam o schema
  (ex.: múltiplas armas por guia, reembolso parcial, retenção).
- Definir **estrutura de pastas** (doc 07) e convenções (lint, commits).
- Preparar **`.env.example`** (sem segredos) e escolher **secret manager/KMS**.
- Definir **ambientes** local/staging/produção (doc 13 §15) e contas separadas.

**Entrega:** decisões registradas; repositório pronto para receber o esqueleto.
**Não faz:** nenhum código de aplicação ainda.

---

## 4. Fase 1 — Esqueleto do app

**Objetivo:** projeto **Next.js + TS** que sobe, com camadas e config validada.

- Bootstrap do **Next.js (App Router) + TypeScript**, Tailwind, Zod.
- Estrutura `web → services/domínio → repositórios (Prisma) → db` (doc 13 §4).
- **Config por schema Zod** (falha no boot se faltar env).
- **Health check** e página inicial neutra.
- Conexão com **Postgres** (Prisma) e **storage adapter** stub (FS local).

**Entrega:** app roda local; healthcheck OK; sem features de negócio.

---

## 5. Fase 2 — Autenticação e perfis

**Objetivo:** login do **usuário** e do **admin**, com **RBAC**.

- **Auth do usuário** (Auth.js/Supabase Auth) — conta do app (**não** Gov.br).
- **Auth do admin** em domínio/rotas separados + **RBAC**
  (Admin/Operador/Financeiro/Suporte — doc 11 §2/§3) + **MFA** para internos.
- Guards por perfil; **segregação de funções** (quem opera ≠ quem libera pagamento).
- Tabelas `users`, `user_profiles`, `admin_users` (doc 12 §3.1/§3.2/§3.12).

**Entrega:** usuário e admin logam; permissões por perfil aplicadas.

---

## 6. Fase 3 — Cadastro do processo Guia de Tráfego

**Objetivo:** usuário cria um processo com os dados do fluxo (doc 10 §4/§6).

- Formulário: **destino/evento** (nome, UF, cidade, logradouro, número),
  **arma/PCE indicada**, **justificativa** (padrão "Guia para treino").
- **Checagem de pré-requisitos** (Gov.br ativo, já ter CR/arma) com avisos.
- Tabelas `processes`, `process_types`, `destinations`, `firearms_pce`
  (doc 12 §3.3–§3.8); status inicial `RASCUNHO`.
- Validação Zod; **valores dinâmicos** (validade, GRU) **não** hardcoded.

**Entrega:** usuário monta o processo e revê o resumo antes de pagar.

---

## 7. Fase 4 — Upload de documento de identificação

**Objetivo:** coletar o **Documento de Identificação Pessoal** (único anexo — doc 09 §15.4).

- Upload com validação (formato, tamanho, legibilidade), **bytes no storage**,
  **sha256**, metadados em `process_documents` (doc 12 §3.6).
- Estados do documento: `PENDENTE → ENVIADO → EM_VALIDACAO → APROVADO/REPROVADO`.
- **URLs assinadas** e curtas; **nunca** público.
- Fluxo de **reprovação** com motivo (sem reproduzir PII).

**Entrega:** documento anexado, validável pelo operador, com integridade.

---

## 8. Fase 5 — Pagamento Pix

**Objetivo:** cobrar o **Pix do cliente** (usuário → empresa) **por processo**.

- Integração **PSP Pix** + **webhook idempotente** (doc 13 §9).
- Tabela `payments` (doc 12 §3.9/§8): `CRIADO → AGUARDANDO → CONFIRMADO`.
- **Bloquear cobrança se Gov/SINARM instável** (doc 10 §9).
- Ao confirmar, processo vai de `AGUARDANDO_PAGAMENTO` → `PAGO_EM_FILA`.
- **Não** confundir com a GRU (§11).

**Entrega:** Pix confirmado leva o processo para a fila de operação.

---

## 9. Fase 6 — Painel admin básico

**Objetivo:** **fila** + **detalhe do processo** para a operação (doc 11 §4/§5).

- **Fila** com status, sinalizadores, responsável, filtros e atribuição.
- **Detalhe** reunindo dados, documento, destino, arma/PCE, pagamento e timeline.
- Mudança de **status interno ↔ visível** (doc 11 §10/§11) com registro de evento
  (`process_status_events`).
- Ações conforme perfil (doc 11 §3).

**Entrega:** operação enxerga e conduz processos pagos.

---

## 10. Fase 7 — Revisão humana e checklist pré-protocolo

**Objetivo:** garantir **revisão humana** antes de qualquer protocolo (doc 11 §6/§7).

- **Checklist de revisão** (§6 doc 11) e **checklist "antes de Gerar GRU e Salvar"**
  (§7 doc 11) como itens **obrigatórios e registrados** (quem/quando).
- Estado `EM_REVISAO_HUMANA`; **bloqueio** de avanço enquanto itens abertos.
- Tratamento de **exceções**: doc inválido, **arma divergente**, destino incompleto
  (doc 11 §14–§16) com status próprios.
- **Revisão humana obrigatória** nos primeiros **50–100** processos (doc 00/§11 doc 11).

> **Importante:** o checklist §7 aqui é **preparatório/registro**. **O clique real
> em "Gerar GRU e Salvar" acontece pelo operador direto no SINARM**, não pelo nosso
> sistema (§11 e §21).

**Entrega:** nenhum processo avança para protocolo sem checklist + revisão.

---

## 11. Fase 8 — Registro manual do protocolo/GRU

**Objetivo:** após o operador protocolar **manualmente no SINARM**, o painel
**registra** o resultado. **Sem automação; sem clicar "Gerar GRU e Salvar" pelo app.**

- Operador executa no SINARM (doc 09 §15) e clica **"Gerar GRU e Salvar"**
  **manualmente lá**, após checklist (F7).
- No painel, **registrar**: **número de protocolo**, **dados/PDF da GRU**
  (`gru_records` — doc 12 §3.10), e anexar o PDF (storage + sha256).
- **Financeiro registra o pagamento manual da GRU** pela empresa (comprovante) —
  `GERADA → PAGA_EMPRESA` (doc 11 §9).
- Status do processo: `PROTOCOLADO_GRU_GERADA → GRU_PAGA_EMPRESA`.
- Evento de auditoria destacando o ato (doc 12 §12).

**Entrega:** protocolo, GRU e pagamento da GRU registrados e auditáveis.

---

## 12. Fase 9 — Acompanhamento de status pelo usuário

**Objetivo:** usuário acompanha o andamento com linguagem amigável.

- Exibir **status visível** (doc 11 §11) e **mensagens** por etapa (doc 10 §14).
- Timeline simplificada; acesso ao **PDF da GRU/comprovante** quando disponível
  (URL assinada).
- **Notificações** de mudança de status (e-mail/OTP transacional) via fila.

**Entrega:** usuário vê "Recebido → Pago → Em andamento → Protocolado → Concluído".

---

## 13. Fase 10 — Logs / auditoria / LGPD

**Objetivo:** trilha completa e conforme (doc 12 §12; doc 11 §18; doc 05).

- **`audit_logs`/`admin_actions`/`process_status_events`** append-only, com
  atribuição por perfil.
- **pino** (JSON) sem PII; correlação por `processId`.
- **Consentimentos** (`consents`) registrados antes de abrir o Gov.br.
- **Retenção/expurgo** via `data_retention_jobs` (doc 12 §15).

**Entrega:** todo ato sensível é auditável; retenção configurada.

---

## 14. Fase 11 — Hardening de segurança

**Objetivo:** fechar a casa antes do piloto (doc 13 §13).

- **Cifra de PII em repouso** validada (campos do doc 12 §19) + gestão de chaves
  (KMS/secret manager).
- **HTTPS/TLS**, cookies `httpOnly`+`secure`, **CSRF**, headers de segurança.
- **RBAC/MFA** revisados; **acesso mínimo** à PII.
- **URLs assinadas** curtas; buckets privados.
- **Revisão**: nenhum segredo no repo; `.env.example` sem valores; logs sem PII.
- Teste de **permissões por perfil** (nenhum vazamento entre usuário/admin).

**Entrega:** checklist de segurança aprovado; pronto para dados reais controlados.

---

## 15. Fase 12 — Piloto controlado

**Objetivo:** rodar os **primeiros processos reais** com **revisão humana total**.

- **Poucos usuários reais** (consentidos), **Pix produção**, **GRU real paga
  manual** pela empresa.
- **100% revisão humana**; medir tempo por etapa, exceções, instabilidade Gov/SINARM.
- Coletar **feedback** e **ajustar** antes de escalar.
- **Staging permanece sem protocolar/pagar de verdade** (doc 13 §15).

**Entrega:** primeiros processos concluídos com segurança; aprendizados registrados.

---

## 16. O que NÃO entra no primeiro MVP

- ❌ **Automação SINARM/CAC** (o operador faz manual — §21).
- ❌ **Clique automatizado em "Gerar GRU e Salvar"** pelo sistema.
- ❌ **Cartão de crédito** (só Pix).
- ❌ **Pagamento automático/conciliação da GRU** (empresa paga manual).
- ❌ **Módulo de certidões (M1)** e provedores externos (doc 10 §17).
- ❌ **Outros processos** (CR novo, renovação, transferência, PJ).
- ❌ **Relatórios/BI avançados**, automações de mensagens em massa.
- ❌ **Multi-arma automática / cadastro inicial PF como fluxo** (fallback — doc 10 §3).

---

## 17. Dependências entre fases

```
F0 (decisões) → F1 (esqueleto) → F2 (auth/perfis)
F2 → F3 (cadastro processo) → F4 (documento) → F5 (Pix)
F5 → F6 (painel: fila/detalhe) → F7 (revisão/checklist) → F8 (registro protocolo/GRU)
F8 → F9 (acompanhamento usuário)
F10 (logs/LGPD) atravessa F2–F9 (começa cedo, consolida aqui)
F11 (hardening) depende de F2–F10
F12 (piloto) depende de F5, F8, F9, F11
```

Regras:
- **F5 (Pix) antes de F8 (protocolo):** pagamento confirmado é pré-condição.
- **F7 (revisão) antes de F8 (registro):** nada protocola sem checklist.
- **F11 (hardening) antes de F12 (piloto):** dados reais só após a casa fechada.
- **F10 (LGPD)** não é "no fim": nasce em F2 e é consolidada como fase própria.

---

## 18. Critérios de aceite por fase

- **F0:** stack/provedores confirmados; dúvidas bloqueantes do doc 12 §20 resolvidas.
- **F1:** app sobe local; healthcheck OK; config falha se faltar env.
- **F2:** usuário e admin logam; RBAC e MFA (admin) funcionam; segregação aplicada.
- **F3:** processo criado e revisável; validação Zod; sem valores hardcoded.
- **F4:** documento sobe ao storage com sha256; estados e reprovação funcionam.
- **F5:** Pix confirma via webhook idempotente; instabilidade bloqueia cobrança.
- **F6:** fila e detalhe operáveis; mudança de status registra evento.
- **F7:** avanço bloqueado sem checklist completo; exceções têm status próprio.
- **F8:** protocolo/GRU/pagamento da GRU registrados e auditáveis; PDF anexado.
- **F9:** usuário vê status amigável e recebe notificações.
- **F10:** auditoria append-only, sem PII em log; retenção agendável.
- **F11:** checklist de segurança aprovado; sem segredo no repo; permissões testadas.
- **F12:** primeiros processos reais concluídos com 100% revisão humana; feedback documentado.

---

## 19. Riscos por fase

| Fase | Risco principal | Mitigação |
|------|-----------------|-----------|
| F0 | Decidir tarde e retrabalhar | Fechar provedores/dúvidas antes do código |
| F1 | Config/segredos frágeis | Zod no boot; `.env.example` sem valores |
| F2 | Vazamento entre perfis | RBAC + testes de permissão + MFA interno |
| F3 | Coletar dado errado/insuficiente | Validação Zod; espelhar exatamente o SINARM |
| F4 | PII em storage exposta | Bucket privado; URLs assinadas; sha256 |
| F5 | Webhook Pix duplicado/perdido | Idempotência; reconciliação manual no MVP |
| F6 | Operação confusa | Fila clara; sinalizadores; responsável |
| F7 | Protocolo sem revisão | Bloqueio por checklist; revisão obrigatória |
| F8 | Registro incorreto de protocolo/GRU | Conferência dupla; auditoria destacada |
| F9 | Mensagem confusa/parecer oficial | Tom neutro/honesto (doc 10 §14) |
| F10 | PII em log / retenção falha | pino sem PII; jobs de expurgo auditados |
| F11 | Chave de cifra mal gerida | KMS/secret manager; revisão de segurança |
| F12 | Instabilidade Gov/SINARM no piloto | Fila/retomada; expectativa clara ao usuário |

---

## 20. Definição de MVP entregável

O MVP está **entregável** quando, para a **Guia de Tráfego**:

1. Usuário **cria o processo** (F3) e **anexa o documento** (F4).
2. Usuário **paga via Pix** e o pagamento é **confirmado** (F5) **antes** do protocolo.
3. Operação vê o processo na **fila** e no **detalhe** (F6).
4. **Checklist + revisão humana** são aplicados (F7).
5. Operador **protocola manualmente no SINARM** e **registra** protocolo, GRU e
   **pagamento manual da GRU** no painel (F8).
6. Usuário **acompanha o status** e recebe **notificações** (F9).
7. **Auditoria/LGPD** cobrem os atos sensíveis (F10) e a **segurança** está
   endurecida (F11).
8. **Sem automação SINARM**; **sem clicar "Gerar GRU e Salvar" pelo sistema**;
   **revisão humana** garantida nos primeiros 50–100 processos.

> Em uma frase: **o usuário contrata, paga e acompanha; a equipe opera com
> segurança e registra tudo — sem automação e sem atalhos no ato irreversível.**

---

## 21. Quando considerar automação SINARM/CAC

**Só depois** do piloto (F12) provar o fluxo assistido, e **por módulos**
(doc 11 §22; doc 13 §11), validando o mais difícil primeiro:

- Pré-condições: volume que justifique, fluxo estável, **revisão humana** madura,
  **pós-protocolo mapeado** (doc 09 §15.14).
- Começar por partes **de baixo risco** (preenchimento de campos fixos), deixando
  **seleção de armamento** e o **ato "Gerar GRU e Salvar"** sempre com
  **confirmação humana**.
- **Playwright no worker**, **sem evasão anti-bot**, **login Gov.br humano**.
- **Nunca** automatizar o clique irreversível sem revisão — nem no futuro próximo.

---

## 22. Próximos passos após o roadmap

1. **Fechar Fase 0**: confirmar provedores (Postgres, storage, Redis, **PSP Pix**,
   e-mail) e resolver as **dúvidas em aberto** do doc 12 §20.
2. **Mapear o pós-protocolo** (doc 09 §15.14) para completar o registro da F8.
3. Definir **wireframes** de usuário e painel (ainda sem código).
4. Escrever o **plano de testes/piloto** (F12) e as métricas a coletar.
5. **Só então**, mediante confirmação explícita, iniciar a **Fase 1 (código)**.

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências, criar projeto, migration ou schema. É planejamento.
> A primeira linha de código só começa após **confirmação explícita** do usuário.
