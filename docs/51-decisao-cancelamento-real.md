# 51 — Decisão sobre o fluxo de cancelamento real

> **O que é este documento.** A decisão pendente que [`docs/49 §3.5/§6`](49-decisao-valores-operacionais-restantes.md)
> deixou em aberto (categoria C): o que fazer quando um dia existir
> **cancelamento real de cliente**, e por que isso **não** é `CANCELADO_DEV`.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** o `InternalStatus`/permissão/action propostos — só recomenda
>   a forma.
> - ❌ **NÃO reclassifica** `CANCELADO_DEV` nem o remove de
>   `operationalStatusProjection.ts`.
> - ❌ **NÃO decide** política de reembolso, tratamento de processo já
>   protocolado nem reversão — registra que essas decisões continuam
>   pendentes, fora do escopo deste documento.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-02
> **Base da `main`:** `a797940` — *docs: update phase 5 status projection notes*
> **Referências:** `docs/49 §3.5/§4/§6` (categoria C, decisão pendente),
> `docs/48` (mesmo padrão de decisão — categoria nova de `InternalStatus`,
> sem migrar código no mesmo PR), `docs/50` (mesmo padrão — ação explícita
> própria, não dropdown), `docs/46 §11` (proibição de mapear `CANCELADO_DEV`
> para `CANCELADO_REEMBOLSADO`).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-02 |
| `main` | `a797940` |
| Tipo | **Decisão arquitetural documental** — fecha o que `docs/49` categoria C deixou aberto |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** `CANCELADO_DEV` **continua** sendo estado técnico/de
desenvolvimento, nunca cancelamento real de cliente; cancelamento real, quando
existir, é **estado canônico novo** produzido por **ação explícita própria**
— nunca dropdown genérico, nunca reuso de `CANCELADO_DEV` ou
`CANCELADO_REEMBOLSADO`. Nada disso é implementado agora.

---

## 2. Contexto — o que `CANCELADO_DEV` é hoje

`docs/49 §3.5` já apurou o estado real: `CANCELADO_DEV` é o **único** valor que
`isClosed()` (`operationalSignals.ts`) reconhece como fechamento, e é a guarda
que impede `reviewProcessDocument` de reabrir revisão em processo cancelado
(`document.process.operationalStatus !== "CANCELADO_DEV"`). Dois consumidores
comportamentais reais, os dois **técnicos**: marcar um processo como "morto"
em ambiente de desenvolvimento, sem afirmar nada sobre reembolso, decisão de
cliente ou estágio da jornada.

`operationalStatusProjection.ts` (Fase 5h, `docs/46`/`docs/49`) classifica
`CANCELADO_DEV` como **operational-only** (`OPERATIONAL_ONLY_STATUSES`) — fora
de `CANONICAL_OPERATIONAL_PROJECTION` **de propósito**, exatamente porque não é
projeção do estado do processo: é rótulo operacional de ambiente.

O `InternalStatus` mais próximo no canônico, `CANCELADO_REEMBOLSADO`, **afirma
reembolso** — e está classificado como `invalid_projection` em
`statusDivergence.ts` justamente por isso (`docs/46 §6`, `docs/49 §3.5`).
Mapear `CANCELADO_DEV` para ele seria afirmar um reembolso que não houve.

---

## 3. Por que isso precisa de decisão própria, não de atalho

Um cancelamento real de cliente ("o cliente desistiu", "o processo foi
cancelado por decisão administrativa") **não é a mesma coisa** que um
processo de desenvolvimento marcado como morto para não poluir a fila de
teste. Tratá-los como o mesmo valor produziria o mesmo tipo de erro que
`docs/48` recusou para `BLOQUEADO`: **afirmar uma causa/decisão que não
aconteceu** (aqui, um cancelamento de cliente que na verdade é só um processo
de teste descartado, ou vice-versa — um cancelamento real escondido atrás de
um rótulo que hoje só significa "lixo de dev").

Cancelamento real também tem consequências que `CANCELADO_DEV` nunca teve que
resolver: pode exigir reembolso, pode acontecer **depois** do protocolo (onde
reverter não é trivial), e pode precisar ser **desfeito** (reaberto) em algum
cenário. Nenhuma dessas perguntas tem resposta hoje — e não é este documento
que responde.

---

## 4. Decisões

| # | Decisão |
|---|---|
| 1 | `CANCELADO_DEV` **continua** sendo estado técnico/de desenvolvimento. **Não vira** cancelamento real, nem por reuso, nem por reinterpretação de rótulo. |
| 2 | Cancelamento real, quando existir, precisa de **ação explícita própria** — nunca valor de dropdown genérico (`updateProcessOperations`/`changeOperationalStatus`), mesmo padrão de `docs/50 §5/§6`. |
| 3 | Cancelamento real **exige motivo obrigatório** — mesmo contrato de `reopenDocumentReview`/`approveDocumentOutOfFlow`: curto, sem PII do documento. |
| 4 | Cancelamento real **exige permissão própria** — não reuso de `process.operationalStatus` nem de qualquer permissão de documento. Mesmo critério já fixado em `extraction.run`/`document.review.reopen`/`document.review.approveOutOfFlow`: permissão própria é o que permite a matriz responder "quem pode cancelar de verdade?". |
| 5 | Cancelamento real **registra evento tipado** — pela porta canônica `transitionInternalStatus`, com o motivo em `note`, mesmo padrão das ações do `docs/50`. |
| 6 | Cancelamento real **preserva a trilha append-only** — nada de sobrescrever ou apagar `ProcessStatusEvent` existente; o histórico de por que o processo chegou até ali continua intacto. |
| 7 | Cancelamento real **não toca Gov.br/SINARM/PF** — é só registro no app; nenhum ato no órgão é executado ou desfeito por esta ação. |
| 8 | Cancelamento real **não ativa a Fase 9** nem depende dela — `PHASE9_REAL_EXECUTION_ENABLED` continua `false as const`, sem relação nenhuma com esta decisão. |
| 9 | Cancelamento real **não apaga documentos** — `ProcessDocument` e seus metadados continuam intactos; cancelar o processo não é expurgo. |
| 10 | Cancelamento real **não apaga pagamentos** — registros de Pix/GRU continuam na trilha; se houver reembolso, é registro adicional, nunca remoção do que já aconteceu. |
| 11 | **Decisão futura, fora deste documento:** política de reembolso/financeiro associada ao cancelamento real (docs/00 §2 já registra a régua geral de reembolso por estágio — este documento não a substitui nem a antecipa). |
| 12 | **Decisão futura, fora deste documento:** o que fazer com processo **já protocolado** que precisa ser cancelado — reverter protocolo real está fora do que o app pode fazer sozinho (o protocolo é humano, manual, fora do app). |
| 13 | **Decisão futura, fora deste documento:** se cancelamento real admite **reversão/reabertura**, e em que condições — mesmo cuidado que `docs/50 §5` teve com o histórico pré-Fase-5f ao desenhar `reopenDocumentReview`. |

Os itens 11–13 ficam **explicitamente abertos**: registrá-los aqui como
pendência é o que evita que uma implementação futura precise "inventar"
resposta no meio do PR de código.

---

## 5. Proposta recomendada para uma implementação futura

**Nenhum destes itens está decidido a ponto de virar código — são a direção
recomendada**, no mesmo espírito do `docs/48 §3/§4` (decidir a forma antes de
qualquer migration):

| Item | Recomendação |
|---|---|
| Novo `InternalStatus` | Nome candidato: `CANCELADO_OPERACIONAL` ou `PROCESSO_CANCELADO` — categoria **nova**, nunca reuso de `CANCELADO_REEMBOLSADO` (que afirma reembolso) nem de `CANCELADO_DEV` (que é técnico). Forma final (nome, se afirma ou não reembolso) é decisão de um PR de decisão próprio, mesmo padrão que `docs/48` exigiu para `BLOQUEADO_OPERACIONAL`. |
| Action explícita | Nome candidato: `cancelProcess`. Segue o mesmo desenho de `approveDocumentOutOfFlow`/`reopenDocumentReview`: motivo obrigatório, permissão própria, `transitionInternalStatus` + evento tipado, nunca a porta manual genérica. |
| Permissão nova | Nome candidato: `process.cancel`. Papéis que a recebem ficam para o PR de implementação (mesmo critério de `docs/50 §7`: hoje várias permissões já se sobrepõem em ADMIN/OPERADOR; a permissão própria existe para a matriz continuar respondendo "quem pode cancelar?"). |
| Estados irreversíveis | Bloquear cancelamento real para processo já em estado que o torna sem sentido — no mínimo já `CANCELADO_DEV`/já cancelado, e a definir se `PROTOCOLADO`/pós-GRU-gerada entra na lista (depende do item 12 acima). Mesmo padrão de guarda que `approveDocumentOutOfFlow` usa para recusar documento já revisado. |
| Porta a NÃO reaproveitar | `updateProcessOperations` (porta manual genérica) e escrever `operationalStatus` solto continuam **proibidos** para este caso — mesmo motivo do `docs/50 §3/§6`: a porta manual não tem guarda de máquina de transições nem coleta motivo hoje. |

---

## 6. O que este documento não resolve

- **Não decide** a forma final do novo `InternalStatus` (nome exato, se
  entra em `CANONICAL_OPERATIONAL_PROJECTION`, migration aditiva) — fica
  para o PR de decisão próprio, mesmo padrão que `docs/48` usou para
  `BLOQUEADO_OPERACIONAL`.
- **Não decide** reembolso/financeiro, tratamento de processo já protocolado,
  nem reversão (itens 11–13) — continuam abertos.
- **Não implementa** `cancelProcess`, a permissão `process.cancel` nem
  nenhuma migration.
- **Não reclassifica** `CANCELADO_DEV` em `statusDivergence.ts` nem em
  `operationalStatusProjection.ts` — ele continua `operational_only`/fora da
  projeção canônica exatamente como `docs/49 §3.5` decidiu.
- **Não toca** `updateProcessOperations`, `reviewProcessDocument`,
  `approveDocumentOutOfFlow`, `reopenDocumentReview`, `transitionInternalStatus`,
  UI do admin/cliente nem a Fase 9.

---

## 7. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Decisão própria: forma final do novo `InternalStatus` de cancelamento real (nome, migration aditiva, se afirma reembolso) | docs | este documento |
| 2 | Migration aditiva do `InternalStatus` decidido no PR 1 | migration aditiva | PR 1 |
| 3 | Decisão de produto/financeiro: reembolso associado ao cancelamento real (item 11) | docs | produto |
| 4 | Decisão de produto: tratamento de processo já protocolado (item 12) | docs | produto |
| 5 | Decisão de produto: reversão/reabertura de cancelamento (item 13) | docs | produto |
| 6 | Action explícita `cancelProcess` + permissão `process.cancel` | código + permissão | PRs 1, 2 e, no mínimo, uma resposta aos itens 12/13 |

Nenhum destes é pré-requisito de piloto ou divulgação — isso segue dependendo
das pendências de `docs/23 §5`. **Nenhum PR desta tabela está aprovado por
este documento** — mesma lógica de `docs/50 §11`/`docs/49 §7`: registro de
ordem, não autorização de execução.

---

## 8. Proibições

- ❌ Mapear `CANCELADO_DEV` para cancelamento real de cliente, por reuso ou
  reinterpretação.
- ❌ Mapear cancelamento real para `CANCELADO_REEMBOLSADO` sem que reembolso
  real tenha acontecido.
- ❌ Implementar cancelamento real como valor de dropdown genérico.
- ❌ Registrar cancelamento real sem motivo.
- ❌ Reusar `process.operationalStatus` como permissão do cancelamento real.
- ❌ Apagar documento, pagamento ou evento da trilha ao cancelar.
- ❌ Tocar Gov.br/SINARM/PF nesta ação, hoje ou no futuro.
- ❌ Ativar ou depender da Fase 9.
- ❌ Afirmar, neste ou em qualquer documento futuro que cite este, que
  cancelamento real **já está implementado**.
- ❌ Fechar gate de `docs/26 §19`.

---

> **Atualização (2026-08-02).** O `InternalStatus` `CANCELADO_OPERACIONAL` foi
> preparado no enum (migration aditiva
> `20260802000000_add_real_cancellation_status`), usando o nome já recomendado
> no §5 acima — combinando os PRs 1 e 2 da tabela do §7, já que o nome não
> exigiu uma decisão própria separada. **Continua SEM FLUXO**: nenhuma action,
> permissao ou porta o escreve; `cancelProcess` (PR 6 do §7) continua não
> implementado. `statusDivergence.ts` classifica qualquer combinação com
> `CANCELADO_OPERACIONAL` como `needs_decision` (mesma categoria dos demais
> `InternalStatus` avançados sem candidato); `operationalStatusProjection.ts`
> não o projeta. `CANCELADO_DEV` não mudou. Os itens 11–13 (reembolso,
> processo protocolado, reversão) continuam em aberto. **Execução real
> continua bloqueada.**

---

> **Fecho.** Este documento **decide no papel**. Não implementa `cancelProcess`,
> não cria `InternalStatus` novo, não migra `CANCELADO_DEV`, não fecha gate e
> não autoriza execução real. Regras permanentes (`docs/00 §8`) e bloqueios de
> fase (`docs/15`) seguem íntegros.
