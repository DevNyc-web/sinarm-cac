# 19 — Validação da Fase 6 (Operação/Admin Avançada)

> **O que é este documento.** Registra a **implementação e validação da Fase 6**
> — operação assistida no painel admin — executada em **modo dev/fictício** com
> **Postgres local** e dados 100% falsos.
>
> **Não é especificação nem autorização.** Nada aqui libera produção, Gov.br,
> SINARM, GRU real, Pix real ou protocolo.
>
> **Data:** 2026-07-18
> **Commit:** `4634e5b` — *feat: add advanced admin operations workflow*
> **Base:** `docs/11` (painel/RBAC), `docs/12` (modelo), `docs/14` (roadmap),
> `docs/18` (validação das Fases 1–5).

---

## 1. Objetivo da Fase 6

Aproximar o painel de uma **operação assistida real** — fila trabalhável,
responsáveis, prioridades, trilha de status, comunicação com o usuário e o
checkpoint de conferência — **sem** tocar em Gov.br/SINARM e **sem** protocolar
nada. É a preparação da execução manual (docs/11 §1: "o painel reduz erro humano
e registra tudo — nunca empurra um protocolo no escuro").

---

## 2. Escopo implementado

| # | Item | Onde |
|---|------|------|
| 1 | **Fila admin com filtros** (status operacional, pagamento, documento, busca por código, ordenação, destaque) | `/admin/processos` |
| 2 | **Atribuição operacional** — responsável fictício, com evento no histórico | detalhe admin |
| 3 | **Prioridade** — BAIXA · NORMAL · ALTA · URGENTE, com evento | detalhe admin |
| 4 | **Status operacional** — trilha própria da fila, com evento | detalhe admin |
| 5 | **Notas internas** — visíveis só à equipe | detalhe admin |
| 6 | **Mensagens visíveis ao usuário** — aparecem no processo dele | detalhe admin / revisão do usuário |
| 7 | **Checklist do checkpoint "Dados da GRU"** (8 itens, docs/11 §7) — **fictício** | detalhe admin |
| 8 | **Histórico operacional** — status, prioridade, responsável e notas na mesma trilha append-only | detalhe admin |

**Status operacional (`operationalStatus`):**
`RASCUNHO → DOCUMENTO_ENVIADO → DOCUMENTO_APROVADO → AGUARDANDO_PAGAMENTO →
PAGO_EM_FILA → EM_REVISAO_OPERACIONAL → PRONTO_PARA_PROTOCOLO_MANUAL`, mais
`BLOQUEADO` e `CANCELADO_DEV`.

> `PRONTO_PARA_PROTOCOLO_MANUAL` **apenas sinaliza a fila**: o protocolo no
> SINARM é **humano e externo ao app**. Nenhum estado desta trilha protocola,
> gera GRU ou acessa o Gov.br.

---

## 3. Ambiente de teste

- **Postgres local** (instância portátil descartável), schema via `db push` —
  **sem migration** (docs/16 §7).
- **Dados 100% fictícios**: usuários mock, clube/destino de exemplo, arma de
  catálogo fictício, PDF fictício, Pix `fake`.
- **Sem Gov.br. Sem SINARM/CAC. Sem GRU real. Sem Pix real. Sem protocolo real.
  Sem PII** (nenhum CPF, RG, documento ou cliente real).
- `.env` e `storage-local/` **git-ignored**; nenhuma credencial no repositório.

---

## 4. Checks executados

| Verificação | Resultado |
|-------------|-----------|
| **31 checks no service layer** (banco real) | ✅ todos PASS |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| **Testes manuais em produção local** (`npm start`, build limpo) | ✅ páginas, filtros e RBAC conferidos por perfil |

Cobertura dos 31 checks: status/prioridade iniciais, transições automáticas,
atribuição (incluindo rejeição de responsável inválido), prioridade e status
inválidos rejeitados, RBAC das notas, visibilidade das notas, os 6 filtros da
fila, need-to-know na fila e no detalhe, contagem dos dois checklists e presença
dos eventos operacionais no histórico.

---

## 5–6. Matriz RBAC validada e resultado por perfil

| Ação | ADMIN | OPERADOR | FINANCEIRO | SUPORTE | USER |
|------|:-----:|:--------:|:----------:|:-------:|:----:|
| Acessar fila/detalhe admin | ✅ | ✅ | ✅ | ✅ | ❌ (307 → login) |
| Atribuir responsável | ✅ | ✅ | ❌ | ❌ | ❌ |
| Alterar prioridade | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mover status operacional | ✅ | ✅ | ❌ | ❌ | ❌ |
| Marcar checklists (revisão e GRU) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Nota interna | ✅ | ✅ | ✅ (financeira) | ❌ | ❌ |
| Mensagem ao usuário | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver arma/PCE e metadados de documento | ✅ | ✅ | ✅ | ❌ | própria |
| Ver notas internas/financeiras | ✅ | ✅ | ✅ | ✅ | ❌ |

**Por perfil:**

- **ADMIN** — atribui, altera prioridade/status, cria nota interna e mensagem; vê tudo.
- **OPERADOR** — idem ADMIN no que é operacional; **não** confirma Pix (segregação de funções, docs/11 §3).
- **FINANCEIRO** — **não** executa ações operacionais (atribuir/prioridade/status/checklist); registra **nota financeira** e vê o pagamento com referência do PSP.
- **SUPORTE** — **não** vê arma/PCE nem metadados de documento; **não** escreve nota interna; cria apenas **mensagem visível ao usuário**; acompanha status.
- **USER** — bloqueado no admin; no próprio processo vê **status amigável** e **somente** as mensagens marcadas como visíveis.

---

## 7. Filtros validados

Contagem exata pelas linhas renderizadas da tabela (produção local):

| Filtro | Resultado |
|--------|-----------|
| sem filtro | 5 processos |
| `?status=EM_REVISAO_OPERACIONAL` | 1 |
| `?codigo=GT-DEV-DC71` (busca por código interno) | 1 |
| `?pagamento=PAGO` | 2 |
| `?documento=APROVADO` | 2 |
| `?status=CANCELADO_DEV` (status sem processos) | 0 |
| `?ordem=oldest` / `recent` | ✅ ordenação aplicada |
| **Destaques** | ● processos pagos aguardando operação; prioridade Alta/Urgente realçada |

---

## 8. Transições automáticas confirmadas

| Gatilho | Efeito |
|---------|--------|
| Upload de documento fictício | `RASCUNHO → DOCUMENTO_ENVIADO` |
| Aprovação do documento | `DOCUMENTO_ENVIADO → DOCUMENTO_APROVADO` |
| Pix (sandbox) confirmado | `→ PAGO_EM_FILA` (interno + operacional + visível ao usuário) |
| Rejeição do documento | `→ BLOQUEADO` + usuário vê **"Precisamos de um ajuste"** |

> As transições **não regridem** status: quem já passou do pagamento não volta
> por causa de um evento anterior.

---

## 9. Modelagem / Prisma

Alterações **apenas no `schema.prisma`** (sem migration, `db push` local):

| Alteração | Detalhe |
|-----------|---------|
| `Process` + `operationalStatus` | enum novo, default `RASCUNHO`, indexado |
| `Process` + `priority` | enum `ProcessPriority`, default `NORMAL` |
| `Process` + `assignedToMockUserId` | responsável mock, indexado (vira FK com auth real) |
| **`ProcessNote`** (novo) | `visibility`, `body`, autor mock + perfil, data |
| **`ProcessEventKind`** (novo) | `STATUS_INTERNO`, `STATUS_OPERACIONAL`, `PRIORIDADE`, `RESPONSAVEL`, `NOTA` |
| **`ChecklistGroup`** (novo) | `REVISAO` \| `GRU` |
| `ProcessStatusEvent` alterado | + `kind`, `fromValue`, `toValue`; **`toStatus` agora nullable** (eventos operacionais não mudam status interno). Continua **append-only** |
| `ProcessChecklistItem` alterado | + `group` (default `REVISAO`, preserva linhas existentes) |
| Novos enums de apoio | `OperationalStatus`, `NoteVisibility` |

---

## 10. Decisão técnica importante

**`operationalStatus` é um campo SEPARADO** (decisão explícita do usuário):

- **`internalStatus` segue canônico** (docs/12 §6), incluindo os estados
  SINARM/GRU que só serão usados quando essas fases existirem;
- **`operationalStatus`** é a trilha que a **fila/operação** usa hoje, sem
  estados de protocolo real;
- **toda transição operacional sincroniza o `userFacingStatus`** — o usuário
  nunca vê algo divergente da operação (docs/11 §11).

> **Risco conhecido e mitigado:** três status no mesmo processo poderiam
> divergir. A mitigação é a sincronização automática nas transições. Quando as
> fases SINARM/GRU chegarem, avaliar a **consolidação** das trilhas.

---

## 11. Segurança / LGPD

Padrão obrigatório do projeto **mantido**: **permissão entra na query + DTO
seguro** (docs/18 §6) — a página nunca recebe entidade Prisma crua.

- **Fila não expõe `storageKey` nem metadados restritos** — `select` restrito no
  repositório; a fila carrega apenas status/prioridade/responsável/destino, para
  qualquer perfil.
- **USER não vê notas internas/financeiras** — a leitura do dono filtra por
  `VISIVEL_USUARIO` na própria query.
- **SUPORTE não vê arma/PCE nem metadados de documento** — os campos não são
  lidos do banco para quem não tem `process.pii.viewFull`.
- **FINANCEIRO não executa ações operacionais** — sem `process.assign`,
  `process.priority`, `process.operationalStatus` nem `review.checklist`.
- **Notas**: a UI avisa para **não escrever PII** (docs/11 §19) e o tamanho é
  limitado; a trilha registra **quem/qual perfil/quando** (docs/11 §18).

---

## 12. Resultado final

✅ **Fase 6 validada em modo dev/fictício.** O painel sustenta uma **operação
assistida realista** — triagem por filtros, responsável, prioridade, trilha de
status, comunicação com o usuário e conferência de checkpoint — **sem tocar em
Gov.br/SINARM** e sem nada real.

---

## 13. Pendências antes de produção

Inalteradas em relação ao `docs/18 §9`, todas ainda **bloqueantes**:

1. **Auth real + MFA** (docs/15 §3.8/§3.9).
2. **Storage de produção + KMS/criptografia** (docs/15 §3.2/§3.10).
3. **Retenção final** de documentos (docs/15 §3.11).
4. **Conta Mercado Pago de produção** (PJ validada + credenciais).
5. **Webhook público real** — assinatura oficial do PSP e teste de reentrega.
6. **Termos de uso/pagamento e política de reembolso** (docs/10 §15/§16).
7. **Revisão jurídica** (LGPD, responsabilidade, comunicação ao usuário).
8. **Gov.br/SINARM**: permanece **assistido, manual e futuro** — nunca
   automatizado no MVP (docs/00 §8, docs/10 §17).

---

## 14. Próximo passo recomendado

1. **Completar os blocos restantes do detalhe operacional** (docs/11 §5):
   sinalizadores/exceções (doc inválido, arma divergente, destino incompleto —
   docs/11 §14–§16), SLA/tempo na fila, e a visão consolidada de auditoria
   (docs/11 §18); **ou**
2. **Preparar a F7 — execução assistida/manual**: roteiro passo a passo para o
   operador conduzir o fluxo do docs/09 §15 **fora do app**, com o painel apenas
   **registrando** o que foi feito — **sem automação, sem Playwright, sem
   credenciais Gov.br**.

Em qualquer caminho: aplicar desde o início o padrão **permissão na query + DTO
redigido** (§11).

---

> **Lembrete permanente:** validação **local com dados fictícios**. Não autoriza
> produção, Pix real, upload real de documento pessoal, automação Gov.br/SINARM,
> geração de GRU ou protocolo. Cada avanço depende de **confirmação explícita**
> do usuário.
