# 62 — Decisão: formato do número interno do processo (`Process.code`)

> **O que é este documento.** A decisão do **formato futuro** do número interno
> do processo e do **tratamento dos códigos antigos** `GT-DEV-…`. Resolve a
> parte **decisória** da pendência **A** do
> [`docs/61`](61-checklist-encerramento-fase-1-base-do-saas.md) (itens A.1–A.3),
> derivada do requisito registrado em
> [`docs/60 §8`](60-decisao-estrategia-automated-first-e-ux-cliente.md).
>
> **Formato adotado: `CAC-YYYY-NNNNNN`** (ex.: `CAC-2026-000001`), com
> **sequência global monotônica** e **preservação** dos códigos antigos.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, Prisma, UI, rotas, auth ou testes.
> - ❌ **NÃO cria** migration e **NÃO faz** backfill.
> - ❌ **NÃO renomeia** nenhum código `GT-DEV-…` existente.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-04
> **Base da `main`:** `09a1b0d` — *docs: add phase 1 closure checklist*
> **Referências:** [`docs/60 §8`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (requisito do número interno), [`docs/61 §4.A`](61-checklist-encerramento-fase-1-base-do-saas.md)
> (pendência A), `prisma/schema.prisma` (`Process.code String @unique`),
> `src/server/services/createGuiaTrafegoDraft.ts` (gerador atual),
> `src/server/repositories/processRepository.ts` (busca por código).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-04 |
| `main` | `09a1b0d` |
| Tipo | **Decisão técnica/produto** — resolve `docs/61` A.1–A.3 |
| Escopo | Documentação apenas |
| Fase 1 | **NÃO encerrada** — A.4–A.6 continuam pendentes |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** novos processos passarão a receber `CAC-YYYY-NNNNNN`
com **sequência global que nunca reinicia** (o ano é apenas rótulo do momento
de criação); os códigos `GT-DEV-…` já gravados **ficam como estão**, sem
backfill e sem migration de reescrita; busca e suporte aceitam **os dois
formatos** durante e depois da transição.

---

## 2. Contexto verificado no código (`main` `09a1b0d`)

| Fato | Onde |
|---|---|
| `Process.code` já existe, `String @unique` | `prisma/schema.prisma` |
| Gerador atual: `GT-DEV-${randomUUID().slice(0, 8).toUpperCase()}` | `src/server/services/createGuiaTrafegoDraft.ts:23-25` |
| Cliente já vê o código (dashboard, detalhe, tela de sucesso) | `src/app/(user)/dashboard/page.tsx`; `src/app/(user)/processos/[id]/page.tsx`; `processos/novo/sucesso/page.tsx` |
| Admin já filtra a fila por código, com `contains` + `mode: "insensitive"` | `src/server/repositories/processRepository.ts` (`listAdminQueue`); `src/app/(admin)/admin/processos/page.tsx` |
| Busca por código para o cliente existe | `processRepository.ts` (`findProcessByCodeForUser`) |
| **Não existe** nenhum `autoincrement` nem sequence no schema — todos os ids são `uuid` | `prisma/schema.prisma` (varredura completa: zero ocorrências) |

### 2.1 Refinamento do `docs/60 §8.1`

O `docs/60 §8.1` concluiu que o PR técnico futuro seria *"uma troca de gerador
de formato… sem migration, sem coluna nova, sem alteração de schema"*. Isso
continua verdadeiro para a **coluna** — `Process.code` já existe e já é única.

**Mas não é verdadeiro para a sequência.** O gerador atual é aleatório
(`randomUUID`), e o schema **não tem nenhuma fonte de número sequencial**. Um
número monotônico exige uma fonte real de sequência, e isso **provavelmente
exigirá migration** no PR técnico futuro (§10).

Este documento **corrige essa expectativa**: a decisão é docs-only e sem
migration; a **implementação** dela não é.

---

## 3. Formato futuro

**Formato adotado:**

```
CAC-YYYY-NNNNNN
```

**Exemplo:** `CAC-2026-000001`

| Parte | Significado |
|---|---|
| `CAC` | Prefixo interno do produto |
| `YYYY` | **Ano de criação** do processo |
| `NNNNNN` | Número **sequencial**, 6 dígitos, com zeros à esquerda |

---

## 4. Sequência

| # | Decisão |
|---|---|
| 4.1 | A sequência é **global e monotônica**. |
| 4.2 | O ano é **rótulo visual**, derivado do ano de criação do processo. |
| 4.3 | A sequência **não reinicia por ano**. |

**Exemplo da regra 4.3 em ação:**

```
CAC-2026-000001
CAC-2026-000002
CAC-2027-000003   ← ano virou, sequência continuou
```

**Justificativa:** menor risco técnico · evita colisão · facilita suporte ·
evita lógica complexa por ano (reset, contadores paralelos, corrida na virada
do ano) · preserva rastreabilidade — a ordem dos números é a ordem real de
criação, sempre.

### 4.1 Implicação técnica para o PR futuro (não implementada aqui)

A sequência precisa de **fonte confiável e concorrente-segura**. Registrado
como restrição do PR técnico (§10), não como decisão de implementação:

- ✅ **Recomendado:** uma **sequence do Postgres** (`CREATE SEQUENCE`), lida
  atomicamente. É a fonte natural de monotonicidade no banco que já usamos.
- ❌ **Não usar `count() + 1`.** É *racy*: dois processos criados ao mesmo
  tempo leem o mesmo total e derivam o mesmo número. A `@unique` de
  `Process.code` faria a segunda gravação **falhar** (`P2002`) em vez de
  duplicar — falha segura, mas ainda assim falha visível ao cliente.
- ⚠️ Se a sequência exigir objeto novo no banco, o PR técnico **terá**
  migration (§2.1) — o que **não** contradiz este documento, que é docs-only.
- ⚠️ Um `NNNNNN` de 6 dígitos satura em **999 999** processos. O PR técnico
  deve definir o comportamento no estouro (crescer para 7 dígitos vs. erro
  explícito) — **não decidido aqui**.

---

## 5. Códigos antigos `GT-DEV-…`

| # | Decisão |
|---|---|
| 5.1 | **Preservar** os códigos antigos exatamente como estão. |
| 5.2 | **Não renomear** registros existentes neste momento. |
| 5.3 | **Não fazer backfill** obrigatório. |
| 5.4 | **Não criar migration** para reescrever histórico. |
| 5.5 | Admin e suporte devem **aceitar os dois formatos** — `GT-DEV-…` e `CAC-YYYY-NNNNNN` — durante e após a transição. |
| 5.6 | Se no futuro houver necessidade de migração dos antigos, será **decisão própria**, em documento próprio. |

**Justificativa:** evita quebrar histórico · reduz risco · evita alterar dados
já existentes · permite transição segura.

> **Verificado:** 5.5 **já é atendido hoje sem trabalho novo** — a busca admin
> usa `contains` com `mode: "insensitive"` sobre `Process.code`, sem qualquer
> validação de formato. Códigos antigos e novos coexistem na mesma coluna e na
> mesma consulta. O PR técnico só precisa **não introduzir** validação de
> formato que rejeite `GT-DEV-…`.

---

## 6. Novos processos

| # | Decisão |
|---|---|
| 6.1 | Novos processos, **após o PR técnico futuro**, usam `CAC-YYYY-NNNNNN`. |
| 6.2 | **Este documento não implementa** essa mudança. |
| 6.3 | A implementação acontece em **PR técnico separado** (§10). |
| 6.4 | Até lá, o gerador atual (`GT-DEV-…`) continua em vigor — nenhum comportamento muda hoje. |

---

## 7. Exibição

| # | Decisão |
|---|---|
| 7.1 | O número interno **deve aparecer para o cliente**. |
| 7.2 | O número interno **deve aparecer para o admin**. |
| 7.3 | Deve aparecer em **listas, detalhes e telas de suporte/consulta**, quando aplicável. |
| 7.4 | O **protocolo externo** Gov/SINARM/PF continua **separado** e só aparece **quando existir** (`docs/60 §7.4`). |

> **Verificado:** 7.1 e 7.2 **já estão atendidos** — o cliente vê o código no
> dashboard, no detalhe e na tela de sucesso; o admin vê na fila e no detalhe.
> Ficam registrados como **não regressão** (`docs/61` A.5).

---

## 8. Consulta

| # | Decisão |
|---|---|
| 8.1 | Admin/equipe interna deve conseguir **consultar por `Process.code`**. |
| 8.2 | A consulta deve **aceitar código antigo e novo**. |
| 8.3 | O cliente pode **informar esse número ao suporte**. |
| 8.4 | O suporte deve usar esse número como **principal referência interna** do processo. |

> **Verificado:** 8.1 e 8.2 **já funcionam hoje** (filtro `contains`
> case-insensitive, sem validação de formato). Registrados como **não
> regressão** (`docs/61` A.6).

---

## 9. Relação com o protocolo externo

| # | Decisão |
|---|---|
| 9.1 | `Process.code` **não é** protocolo Gov/SINARM/PF. |
| 9.2 | `Process.code` é **número interno privado do site**. |
| 9.3 | O protocolo externo **só existe após a etapa real correspondente**. |
| 9.4 | Os dois **não devem ser confundidos na UI** — rótulos distintos, nunca o mesmo campo, nunca um servindo de placeholder do outro. |

> O prefixo `CAC-` é deliberadamente **do produto**, não do órgão: não imita
> numeração oficial, coerente com a regra permanente de não parecer órgão
> oficial (`docs/00 §8`).

---

## 10. Próximo PR técnico sugerido

**Sugestão, não execução.** Não aprovado por este documento.

`feat/process-code-friendly-format` (ou similar):

- [ ] Alterar **apenas o gerador** de `Process.code`, para **novos** processos.
- [ ] **Não** renomear códigos antigos; **não** fazer backfill.
- [ ] Prover fonte de sequência **concorrente-segura** (sequence do Postgres recomendada — §4.1); **não** usar `count() + 1`.
- [ ] Definir o comportamento no **estouro** de 6 dígitos.
- [ ] **Testes** do novo formato: shape `CAC-YYYY-NNNNNN`, zeros à esquerda, monotonicidade, ano correto.
- [ ] Garantir **compatibilidade da busca/admin** com os dois formatos (não introduzir validação que rejeite `GT-DEV-…`).
- [ ] Aceitar que, se a sequência exigir objeto novo no banco, **haverá migration** — o que é legítimo naquele PR, com aprovação própria.

---

## 11. Relação com a Fase 1

| # | Registro |
|---|---|
| 11.1 | Esta decisão atende a **parte decisória** da pendência **A** do `docs/61` — itens **A.1, A.2 e A.3**. |
| 11.2 | **Ainda falta o PR técnico** para implementar a geração no novo formato (`docs/61` A.4). |
| 11.3 | **A Fase 1 NÃO é encerrada** por este documento. |
| 11.4 | `docs/close-phase-1-foundation` continua sendo o **único** PR capaz de encerrar a Fase 1 no futuro (`docs/61 §7`). |
| 11.5 | A condição **`docs/61 §5.6`** ("número interno amigável estiver decidido") passa a estar **satisfeita** — ela pede *decidido*, não *implementado*. |

---

## 12. Relação com a Fase 9

| # | Registro |
|---|---|
| 12.1 | Esta decisão **não libera execução real**. |
| 12.2 | **Não toca** Gov.br/SINARM/PF. |
| 12.3 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` (segue `false as const`). |
| 12.4 | **Fase 9 continua bloqueada**; os gates do `docs/26 §19` seguem íntegros. |

---

## 13. Proibições

Este PR **não**:

- ❌ altera código;
- ❌ altera Prisma;
- ❌ cria migration;
- ❌ faz backfill;
- ❌ renomeia códigos `GT-DEV-…` antigos;
- ❌ altera UI;
- ❌ altera auth;
- ❌ altera rotas;
- ❌ altera testes;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ abre execução real;
- ❌ toca Gov.br/SINARM/PF;
- ❌ altera `PHASE9_REAL_EXECUTION_ENABLED`;
- ❌ usa `db:push`.

---

> **Fecho.** Este documento **decide no papel** o formato do número interno:
> `CAC-YYYY-NNNNNN`, sequência **global monotônica** que não reinicia por ano,
> com os códigos `GT-DEV-…` **preservados** — sem backfill, sem renomeação, sem
> migration de histórico — e busca aceitando os dois formatos. Registra também
> que a **implementação** exigirá fonte de sequência concorrente-segura e
> provavelmente migration, refinando o `docs/60 §8.1`. Não altera código,
> Prisma, UI, rotas, auth ou testes; não toca Gov.br/SINARM/PF; **não encerra a
> Fase 1** (A.4–A.6 seguem pendentes) e **não abre a Fase 2**.
> `PHASE9_REAL_EXECUTION_ENABLED` continua `false`, os gates do `docs/26 §19`,
> as regras permanentes (`docs/00 §8`) e os bloqueios de fase (`docs/15`)
> seguem íntegros.
