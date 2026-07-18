# 18 — Validação Integrada Local (Fases 1–5)

> **O que é este documento.** Registra a **validação integrada** das Fases 1–5 do
> MVP, executada **localmente** com **Postgres real** e **dados 100% fictícios**.
> É o registro de aceite do que já está implementado — e do que continua
> bloqueado antes de produção.
>
> **Não é especificação nem autorização.** Nenhuma conclusão aqui libera
> produção, Pix real, upload real ou automação SINARM/CAC.
>
> **Data da validação:** 2026-07-18
> **Commits validados:** `4870cda` (F5 — Pix sandbox) e `bc13611` (hardening
> need-to-know, aplicado após a validação).
> **Base:** `docs/14` (roadmap), `docs/15` (decisões), `docs/11` (painel/RBAC),
> `docs/12` (modelo de dados), `docs/17` (decisão Pix).

---

## 1. Objetivo da validação

Provar, num ambiente local completo, que o fluxo implementado até a Fase 5
**funciona ponta a ponta** com banco real — e não apenas em testes isolados de
unidade — cobrindo:

- persistência real (Prisma + Postgres, não mocks de repositório);
- **RBAC** aplicado de fato nas rotas e nas ações;
- **idempotência** do webhook de pagamento;
- **need-to-know/LGPD** na exposição de dados por perfil;
- ausência de qualquer dado real, credencial real ou efeito externo.

---

## 2. Ambiente usado

| Item | Configuração |
|------|--------------|
| **Banco** | **PostgreSQL 17.10 portátil** (binários baixados para pasta temporária, sem instalação no sistema), **porta 5433** |
| **Schema** | `npm run db:push` (sem migrations — docs/16 §7) + `npm run seed` (dados fictícios) |
| **`.env`** | **local, git-ignored**, criado só para o teste; sem segredo real |
| **Storage** | **`storage-local/`** — **git-ignored**; arquivos fictícios apagáveis |
| **Pagamento** | `PAYMENT_PROVIDER=fake` — **nenhuma credencial** Mercado Pago |
| **Auth** | **mock/dev** (cookie `cac_mock_session`), perfis fictícios |
| **Build** | `npm run typecheck`, `npm run lint`, `npm run build` — todos ✅; validação final feita em **build de produção** (`npm start`) |

> **Nada externo foi chamado:** sem PSP real, sem Gov.br, sem SINARM, sem bucket
> remoto, sem e-mail.

---

## 3. Fluxo validado (ponta a ponta)

| # | Etapa | Resultado |
|---|-------|-----------|
| 1 | **Login mock** (perfis fictícios) | ✅ sessão aplicada por cookie |
| 2 | **Criação de rascunho** Guia de Tráfego | ✅ `GT-DEV-…`, status `RASCUNHO` |
| 3 | **Revisão do processo** pelo usuário | ✅ destino, arma fictícia, justificativa, status |
| 4 | **Upload de documento fictício** | ✅ metadados corretos: nome, `application/pdf`, tamanho, **sha256**, status `ENVIADO` |
| 5 | **Aprovação admin** do documento | ✅ por OPERADOR → `APROVADO`; revisão dupla bloqueada |
| 6 | **Rejeição admin** (teste separado) | ✅ `REJEITADO` + motivo registrado (sem PII do documento) |
| 7 | **Checklist** | ✅ marcado por OPERADOR, com autoria e data/hora |
| 8 | **Geração de Pix fake/dev** | ✅ R$ 100,00 fictício; copia-e-cola **`PIX-FICTICIO-DEV\|NAO-PAGAVEL\|…`** |
| 9 | **Webhook / simulação de pagamento** | ✅ confirmação via `POST /api/payments/webhook` e via ação dev |
| 10 | **Status `PAGO` / `PAGO_EM_FILA`** | ✅ pagamento `PAGO`; processo `PAGO_EM_FILA`; usuário vê "Pagamento confirmado" |
| 11 | **Histórico auditável** | ✅ 6 entradas na ordem correta (§3.1) |
| 12 | **Painel admin/financeiro** | ✅ fila lista processos; detalhe mostra pagamento, documento, checklist e timeline |

### 3.1 Histórico observado (linha do tempo do processo)

1. **Rascunho criado** — *Usuario Exemplo (Usuario)*
2. **Documento enviado** — *Usuario Exemplo (Usuario)*
3. **Documento aprovado** — *Operador Exemplo (Operador)*
4. **Checklist: documento anexado e legível** — *marcado por Operador Exemplo*
5. **Cobrança Pix criada (sandbox/dev) — R$ 100,00** — provider `fake`
6. **Status: Rascunho → Pago / em fila** — *webhook (SYSTEM)*, com o id do evento

> Cada ato sensível tem **quem / qual perfil / quando** (docs/11 §18).

---

## 4. RBAC validado

| Perfil | Resultado observado |
|--------|---------------------|
| **USER (sem sessão)** | ❌ bloqueado → redirecionado a `/login?motivo=sessao` |
| **USER** | ✅ cria rascunho, envia documento e gera Pix **apenas no próprio processo**; ❌ rota admin → `/login?motivo=perfil`; ❌ upload em processo alheio → "Processo não encontrado" |
| **ADMIN** | ✅ vê tudo; revisa documento; marca checklist |
| **OPERADOR** | ✅ fila, detalhe, metadados, arma/PCE, revisão de documento, checklist; ❌ **não** confirma Pix (segregação de funções — docs/11 §3) |
| **FINANCEIRO** | ✅ fila, detalhe, pagamento com referência do PSP; ❌ **não** revisa documento; ❌ **não** marca checklist |
| **SUPORTE** | ✅ fila, status do processo, status do pagamento; ❌ **não** vê arma/PCE; ❌ **não** vê metadados do documento; ❌ **não** revisa; ❌ **não** marca checklist |

---

## 5. Idempotência validada

| Cenário | Resultado |
|---------|-----------|
| **Cobrança ativa não duplica** | ✅ segunda tentativa reaproveita a cobrança existente (1 cobrança) |
| **Webhook repetido (mesmo `eventId`)** | ✅ `alreadyProcessed: true`, sem reprocessar |
| **Pagamento já pago (`eventId` diferente)** | ✅ `alreadyProcessed: true`, sem duplicar |
| **Duplo/triplo clique na simulação dev** | ✅ **1** evento `PAGO_EM_FILA` no histórico, **1** cobrança |

> Garantia estrutural: **`payments.webhook_event_id` é UNIQUE** (docs/15 §7 #10) —
> a idempotência não depende só da checagem em código.

---

## 6. LGPD / need-to-know

Validado e, onde faltava, **corrigido** (commit `bc13611`):

- **SUPORTE não recebe arma/PCE** — os dados **não são lidos do banco** para
  perfis sem `process.pii.viewFull`.
- **SUPORTE não recebe metadados restritos** do documento (nome do arquivo,
  mime, tamanho, sha256, motivo de rejeição) — vê apenas **tipo + status**.
- **`storageKey` não sai para tela/listagem** em nenhum perfil — permanece
  restrito ao caminho de gravação/storage (download/expurgo futuros).
- **`sha256`** vai para a UI apenas como **prefixo curto**.

**Padrão adotado (replicar nas próximas fases):**

> **Permissão entra na _query_ + página recebe _DTO_ redigido.**
> Não basta esconder na renderização: o dado buscado ainda trafega (payload,
> logs, futura API). Implementação de referência:
> `src/server/services/getAdminProcessDetail.ts` — o repositório recebe flags de
> visibilidade (`includeMetadata`, `includeFirearm`) e usa `select` explícito;
> a página nunca recebe entidade Prisma crua.

---

## 7. Bugs encontrados

**Nenhum bug de produção no fluxo principal.** Registro honesto do que apareceu:

1. **Falso positivo de teste (meu):** o `grep` por "Aprovar" na página do
   FINANCEIRO casava com o **rótulo da permissão negada** ("Aprovar/rejeitar
   documento", exibido com ✕), não com um botão. Não havia ação indevida.
2. **Observação sobre RSC/dev payload:** em `npm run dev`, o payload continha
   `originalFileName`, `sha256` e `storageKey` mesmo para SUPORTE — efeito do
   **canal de debug do React** (owner stacks) serializando valores de promises
   awaited. **Verificado no build de produção: ausente.** Não era bug de
   produção, mas revelou que a redação estava só na renderização.
   → **Correção aplicada em commit separado (`bc13611`)**: need-to-know movido
   para a query/DTO (§6). Após a correção, o payload de SUPORTE ficou limpo
   **também em dev**.
3. **Armadilha de metodologia (registrada para não repetir):** uma rodada de
   medições "em produção" acusou ausência de dados para **todos** os perfis —
   era `.next` corrompido devolvendo **HTTP 500**, não redação funcionando.
   Medições de ausência **só valem** com HTTP 200 + presença do conteúdo
   esperado confirmada.

---

## 8. Resultado final

✅ **Fases 1–5 validadas em modo dev/fictício**, com Postgres real, build de
produção e RBAC/idempotência/need-to-know comprovados.

O produto hoje executa, de ponta a ponta e **sem tocar em nada real**:

> login mock → rascunho da Guia de Tráfego → revisão → documento fictício →
> fila admin → aprovação/rejeição → checklist → Pix sandbox → confirmação →
> **processo em fila de operação**, com histórico auditável.

---

## 9. Pendências antes de produção

Nenhuma delas está resolvida; todas **bloqueiam** ir a produção com dados reais:

| # | Pendência | Referência |
|---|-----------|------------|
| 1 | **Auth real + MFA** para usuários e perfis internos | docs/15 §3.8/§3.9 |
| 2 | **Storage de produção** (Supabase Storage vs. S3 compatível) | docs/15 §3.2 |
| 3 | **KMS / criptografia final** de PII | docs/15 §3.10 |
| 4 | **Retenção final** de documentos (política jurídica/LGPD) | docs/15 §3.11 |
| 5 | **Conta Mercado Pago de produção** (PJ validada + credenciais) | docs/15 §3.4, docs/17 §5 |
| 6 | **Webhook externo real** — validação de assinatura oficial do PSP e teste de reentrega | docs/17 §5 |
| 7 | **Termos de uso/pagamento + política de reembolso** revisados | docs/10 §15/§16 |
| 8 | **Gov.br/SINARM**: permanece **assistido/manual e futuro** — nunca automatizado no MVP | docs/00 §8, docs/10 §17 |

> Enquanto isso: **sem dados reais, sem PII real, sem CPF real, sem documento
> real, sem cobrança real, sem protocolo real.**

---

## 10. Próximo passo recomendado

**Fase 6 — operação/admin avançada** (ainda em modo dev/fictício), ou a
**preparação da execução assistida manual**:

- fila com **filtros, ordenação e atribuição de responsável** (docs/11 §4);
- **detalhe do processo** completo com blocos restantes (docs/11 §5);
- **mensagens ao usuário** e sincronização status interno ↔ visível
  (docs/11 §10/§11, docs/10 §14);
- **checklist do checkpoint "Dados da GRU"** (docs/11 §7) como preparação da
  execução assistida — **sem** automatizar o SINARM;
- **auditoria** consolidada (docs/11 §18) sobre os eventos já existentes.

Ao construir qualquer tela nova, aplicar o **padrão do §6** (permissão na query
+ DTO redigido) desde o início.

---

> **Lembrete permanente:** este documento registra uma validação **local com
> dados fictícios**. Não autoriza produção, Pix real, upload real de documento
> pessoal, automação Gov.br/SINARM ou protocolo. Cada avanço depende de
> **confirmação explícita** do usuário.
