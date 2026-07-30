# 45 — Decisão sobre `userFacingStatus`

> **O que é este documento.** A decisão sobre o destino da coluna
> `processes.user_facing_status`, que a Fase 4 do
> [`docs/44 §8`](44-decisao-maquina-de-estados.md) planejava **promover** e que o
> mapeamento mostrou não ser lida por nenhuma tela do cliente.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera código, schema, enum ou migration.**
> - ❌ **NÃO remove a coluna** nem faz backfill.
> - ❌ **NÃO cria `USER_FACING_BY_INTERNAL`.**
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-07-30
> **Base da `main`:** `8d3d3b8` — *fix: align client dashboard status with detail*
> **Referências:** `docs/44` (máquina de estados), `docs/43 §7` (achado das quatro
> visões), `docs/11 §11`, `docs/21 §11`, `docs/12 §6`.

---

## 1. Resumo da decisão

**`userFacingStatus` é DEPRECADO como fonte visual.** Não será promovido.

A fonte real do status que o cliente vê é a função `clientVisibleStatusLabel`
(`src/server/processes/statusLabels.ts`). A coluna permanece persistida por
compatibilidade, exibida **apenas como diagnóstico** no admin, e sua remoção fica
para a Fase 6.

**Consequência imediata:** a Fase 4c do `docs/44` — "trocar a âncora para
`USER_FACING_BY_INTERNAL`" — está **cancelada** na forma em que foi escrita.

---

## 2. O achado que mudou a Fase 4

O `docs/44 §9` registrou como risco que *"`userFacingStatus` tem **peso
contratual** com o cliente"*, e por isso a Fase 4 foi planejada como delicada.

**A premissa era falsa.** A varredura de `src/app/(user)` não encontrou **nenhuma
leitura** de `userFacingStatus`. O que o cliente vê sempre veio de outro lugar:
`OPERATIONAL_STATUS_USER_LABELS[operationalStatus]`, com sobreposição de
`MANUAL_EXECUTION_USER_LABELS` depois que a execução manual começa.

Pior: as duas visões **divergiam**. O admin exibia `userFacingStatus` sob o
rótulo "Status visível ao usuário", e em **4 dos 9** estados operacionais o texto
não correspondia ao que o cliente lia:

| `operationalStatus` | Admin afirmava | Cliente via |
|---|---|---|
| `DOCUMENTO_ENVIADO` | "Em andamento" | **"Documento em analise"** |
| `DOCUMENTO_APROVADO` | "Em andamento" | **"Documento aprovado"** |
| `AGUARDANDO_PAGAMENTO` | "Recebido" | **"Aguardando pagamento"** |
| `PAGO_EM_FILA` | "Pagamento confirmado" | **"Pagamento confirmado — em fila"** |

Um operador que confiasse na tela admin informava o cliente errado. Isso foi
corrigido nos PRs #67 (admin) e #68 (dashboard).

---

## 3. Fontes reais hoje (`main` em `8d3d3b8`)

| Onde | Fonte |
|------|-------|
| Dashboard do cliente | `clientVisibleStatusLabel(process)` |
| Detalhe do cliente | `clientVisibleStatusLabel(process)` |
| Admin — "status que o cliente vê" | `clientVisibleStatusLabel(detail)` |
| `userFacingStatus` | **persistido apenas como diagnóstico**, rotulado no admin como coluna não exibida ao cliente |

**Quem ainda escreve a coluna** (4 pontos, todos mantidos por ora):

- `updateProcessOperations` — via `USER_FACING_BY_OPERATIONAL`;
- `confirmPixPayment` — literal `PAGAMENTO_CONFIRMADO`, hoje via `alsoSet`;
- `reviewProcessDocument` — literal `PRECISAMOS_DE_UM_AJUSTE`;
- `transitionInternalStatus` — repasse de `alsoSet`, não decisão própria.

**Exceção conhecida:** `src/app/(user)/processos/novo/sucesso/page.tsx` ainda lê
`OPERATIONAL_STATUS_USER_LABELS` direto. Ali o processo acabou de nascer e
`manualExecutionStatus` é sempre `EXECUCAO_MANUAL_NAO_INICIADA`, então a
divergência não pode ocorrer. É o único ponto fora da função compartilhada.

---

## 4. Por que `userFacingStatus` não será promovido

1. **Não é lido pelo cliente.** Promover exigiria mudar as três telas para uma
   fonte que nunca as alimentou.
2. **Já provou divergir.** A coluna é escrita por 4 caminhos, dois deles
   literais, e o resultado não correspondia ao que o cliente via. Um campo com
   histórico de divergência é candidato ruim a fonte de verdade.
3. **Perde informação.** Nove valores de `UserFacingStatus`, e a projeção atual
   produz apenas cinco — `AGUARDANDO_SEU_LOGIN_GOVBR`, `AGUARDANDO_SISTEMA_PF`,
   `PROTOCOLADO` e `CONCLUIDO` **nunca** são escritos. A função derivada usa
   `MANUAL_EXECUTION_USER_LABELS`, que distingue protocolo, GRU e acompanhamento
   — granularidade que a coluna não tem.
4. **A derivação já existe e é testada.** `clientVisibleStatusLabel` tem
   cobertura exaustiva dos dois enums de entrada e testes que travam a
   divergência histórica.
5. **Promover exigiria backfill.** Processos existentes têm valores gravados por
   caminhos inconsistentes; confiar neles exigiria corrigi-los primeiro.

---

## 5. Decisão

**`userFacingStatus` é deprecado como fonte visual.**

- A **fonte real** do status visível é `clientVisibleStatusLabel`.
- A coluna **permanece no schema** por compatibilidade — nenhuma migration agora.
- Os **writes existentes permanecem** até as Fases 5/6, para não mexer em fluxos
  que ainda dependem de `operationalStatus`.
- No admin, a coluna é exibida **como diagnóstico/legado**, nunca como "o que o
  cliente vê".

**Por que deprecar em vez de remover já:** remover exigiria migration
destrutiva, tocar 4 fluxos de escrita e mexer em `updateProcessOperations`, que
ainda dirige a fila. O `docs/44 §8` já reserva a Fase 6 para depreciação final,
quando não houver leitores — e o mesmo critério vale aqui.

---

## 6. Política de transição

| Fase | O que acontece com `userFacingStatus` |
|------|--------------------------------------|
| **Agora** | Coluna mantida · writes mantidos · exibida como diagnóstico · **nunca** como fonte do cliente |
| **Fase 5** | Ao `operationalStatus` virar projeção, os writes derivados dele (`USER_FACING_BY_OPERATIONAL`) mudam junto — sem promover a coluna |
| **Fase 6** | Remoção definitiva, junto com a depreciação de `operationalStatus`, via migration destrutiva e **somente** quando não houver nenhum leitor |

Regra de ouro da transição: **nenhum código novo pode ler `userFacingStatus`.**
Escrever é tolerado como legado; ler é o que cria dependência.

---

## 7. Permitido

- ✅ Manter a coluna `userFacingStatus` por compatibilidade.
- ✅ Manter os writes existentes até as Fases 5/6.
- ✅ Exibir `userFacingStatus` no admin **apenas** como diagnóstico/legado.
- ✅ Usar `clientVisibleStatusLabel` como fonte real do status visual.

## 8. Proibido

- ❌ Usar `userFacingStatus` como fonte do cliente.
- ❌ Rotular `userFacingStatus` como "status que o cliente vê" (ou equivalente).
- ❌ Criar `USER_FACING_BY_INTERNAL` agora.
- ❌ Trocar a âncora para `internalStatus` nesta fase.
- ❌ Remover a coluna agora.
- ❌ Fazer migration ou backfill agora.
- ❌ Criar mapa `operationalStatus → internalStatus`.
- ❌ Usar os estados da Fase 2 (`AGUARDANDO_CONFIRMACAO_HUMANA`,
  `AGUARDANDO_CAPTCHA`) em fluxo.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Tocar Gov.br/SINARM/PF.

---

## 9. Impacto nas fases futuras

- **Fase 4c — CANCELADA na forma escrita.** Não haverá troca de âncora para
  `USER_FACING_BY_INTERNAL`. A Fase 4 se encerra com o que já foi entregue: o
  admin corrigido (#67) e o dashboard alinhado (#68).
- **Fase 5 — inalterada no risco, com uma simplificação.** Ao transformar
  `operationalStatus` em projeção, o write de `userFacingStatus` derivado dele
  acompanha. Como a coluna não alimenta tela alguma, **um erro nessa derivação
  não é visível ao cliente** — o que reduz o risco daquela fase, sem eliminar o
  risco principal (fila e permissões leem `operationalStatus`).
- **Fase 6 — ganha um item.** Além de `operationalStatus`, remove
  `userFacingStatus` e o enum `UserFacingStatus`, se nenhum leitor restar.
- **`docs/44 §5.1` está superado.** Aquela seção manda "trocar
  `USER_FACING_BY_OPERATIONAL` por `USER_FACING_BY_INTERNAL`" e "eliminar os
  writes literais". A primeira instrução é revogada por este documento; a segunda
  passa para a Fase 6.

---

## 10. Checklist de segurança

- `PHASE9_REAL_EXECUTION_ENABLED` permanece **`false as const`**.
- `docs/26 §19` **inalterado** — gates 1, 2, 3 e 5 seguem **abertos**.
- **Execução real segue bloqueada.**
- Sem código de produção, sem testes, sem migration, sem schema, sem enum.
- Sem UI, sem fila, sem readiness, sem automação.
- Sem schedule, sem heartbeat, sem OCR real.
- Sem Gov.br/SINARM/PF, sem credenciais, cookies ou tokens.
- Sem `db:push`.

---

> **Fecho.** Este documento **decide** que `userFacingStatus` não será promovido e
> será removido na Fase 6. Ele não implementa, não altera código, não altera
> schema, não cria migration, não fecha gate e não autoriza execução real. Regras
> permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
