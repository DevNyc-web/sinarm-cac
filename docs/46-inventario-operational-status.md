# 46 — Inventário de `operationalStatus` e Reordenação da Fase 5

> **O que é este documento.** O inventário de `operationalStatus` e a **decisão de
> reordenar a Fase 5** do [`docs/44 §8`](44-decisao-maquina-de-estados.md), que
> mandava transformá-lo em projeção de `internalStatus`. O mapeamento mostrou que
> isso é prematuro — e por quê, com números.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera código, testes, schema, enum ou migration.**
> - ❌ **NÃO cria** `operationalFromInternalStatus` nem mapa nenhum.
> - ❌ **NÃO projeta** `operationalStatus`.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-07-30
> **Base da `main`:** `553657d` — *docs: deprecate userFacingStatus as visual source*
> **Referências:** `docs/44` (máquina de estados), `docs/45` (`userFacingStatus`),
> `docs/11 §4/§10` (fila e sinalizadores), `docs/12 §6` (status canônicos).

---

## 1. Resumo executivo

**Não projetar `operationalStatus` agora.** A Fase 5 precisa ser **reordenada**:
começa por inventário, guardas e diagnóstico — não por projeção.

- `operationalStatus` é **campo operacional ativo**: dirige fila, sinalizadores,
  filtros, guardas de serviço e o dropdown do admin. **Não** dirige prontidão de
  automação (§4.2).
- `internalStatus` **não tem cobertura suficiente**: 1 caminho de escrita, 1
  chamador, 2 de 17 valores alcançáveis, 2 leituras de decisão.
- **Projetar agora colapsaria a operação.** Todo processo projetaria para
  `RASCUNHO` ou `PAGO_EM_FILA`; `DOCUMENTO_ENVIADO`, `DOCUMENTO_APROVADO`,
  `EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL`, `BLOQUEADO` e
  `CANCELADO_DEV` ficariam **inalcançáveis**, e processos desapareceriam dos
  filtros da fila admin.

---

## 2. O desequilíbrio atual

| | `operationalStatus` | `internalStatus` |
|---|---|---|
| Caminhos de escrita | **5** | **1** (`transitionInternalStatus`) |
| Services que escrevem | **4** | **1** (`confirmPixPayment`) |
| Valores alcançáveis | **9 de 9** | **2 de 17** |
| Leituras que decidem comportamento | **13** (contadas em §4) | **2** (§5) |

> **Nota de precisão.** Duas correções de contagem, registradas porque número
> repetido em documento vira fato falso depois:
>
> - `operationalStatus`: o mapeamento inicial estimou "~14" leituras de decisão. A
>   contagem exata é **13**.
> - `internalStatus`: a primeira versão deste documento disse **1** leitura de
>   decisão. São **2** — faltava a que decide `canCreateCharge` na tela do cliente
>   (§5). Não muda a conclusão: 2 leituras ainda é cobertura quase inerte.

---

## 3. Inventário de writes de `operationalStatus`

Cinco caminhos. Um migrado, quatro não.

### 3.1 `confirmPixPayment` → `PAGO_EM_FILA` — ✅ **já migrado**

- Gatilho: webhook Pix confirmado.
- Escreve `internalStatus`: **sim** (`PAGO_EM_FILA`).
- Usa `transitionInternalStatus`: **sim**, com `alsoSet`.
- Registra evento **tipado** (`fromStatus`/`toStatus`).
- Afeta fila: sim.

É o único write que já passa pela porta canônica. Serve de referência para os
demais.

### 3.2 `uploadProcessDocument` → `DOCUMENTO_ENVIADO` — ⚠️ **precisa de decisão**

- Gatilho: cliente envia documento (guarda: só se `operationalStatus === RASCUNHO`).
- Escreve `internalStatus`: **não**.
- Usa o helper: **não** — vai por `updateProcessOperations`.
- Afeta fila: sim.
- **Bloqueio:** não existe `InternalStatus` equivalente a "documento enviado,
  aguardando conferência".

### 3.3 `reviewProcessDocument` (aprovação) → `DOCUMENTO_APROVADO` — ⚠️ **precisa de decisão**

- Gatilho: ADMIN/OPERADOR aprova o documento (guarda: `operationalStatus === DOCUMENTO_ENVIADO`).
- Escreve `internalStatus`: **não**.
- Usa o helper: **não**.
- Afeta fila: sim.
- **Bloqueio:** mesmo caso do 3.2 — sem equivalente canônico.

### 3.4 `reviewProcessDocument` (rejeição) → `BLOQUEADO` — ❌ **proibido mapear**

- Gatilho: documento rejeitado (guarda: `operationalStatus !== CANCELADO_DEV`).
- Escreve `internalStatus`: **não**.
- Usa o helper: **não**.
- Afeta fila: sim.
- **Proibição:** mapear para `BLOQUEADO_INSTABILIDADE` ou qualquer `EXCECAO_*`
  **sem decisão própria** inventaria a causa do bloqueio. `docs/44` já fixou isso
  para o sentido inverso, e a regra vale nos dois.

### 3.5 `updateProcessOperations` → **qualquer um dos 9** — ❌ **depende de decisão própria**

- Gatilho: admin move o status na tela (permissão `process.operationalStatus`).
- Escreve `internalStatus`: **não**.
- Registra evento **operacional** (rótulo em `fromValue`/`toValue`, não enum).
- Afeta fila: sim.
- **Risco: alto.** É a porta única do campo operacional e aceita os nove valores.
  Migrar aqui é a última etapa, não a primeira.

---

## 4. Inventário de leituras

### 4.1 Fila (2)

- `getAdminQueue` — flag derivada de `PAGO_EM_FILA || EM_REVISAO_OPERACIONAL`.
- `processRepository` (filtro) + `admin/processos/page.tsx` — filtro da listagem.

### 4.2 Operacional (11)

- **`operationalSignals` — 7 leituras**: `isClosed()`, `BLOQUEIO_MANUAL` a partir
  de `BLOQUEADO`, SLA interno, `PRONTO_PARA_CHECKPOINT_GRU`, `deriveReadiness`
  (prontidão de **conferência humana**, `docs/11 §7`), próximas ações. **É o maior
  acoplamento do campo.**
- `updateProcessOperations` — guarda de idempotência (no-op se igual).
- `uploadProcessDocument` — guarda `if RASCUNHO`.
- `reviewProcessDocument` — 2 guardas (`DOCUMENTO_ENVIADO`, `≠ CANCELADO_DEV`).

> **`automationReadiness` NÃO entra nesta conta — e não é acoplamento.** Ele **não
> lê `operationalStatus`** e **não consome `operationalSignals`**: é módulo **puro**,
> derivado de destino, arma/PCE, documentos, sugestões e pagamento. A única menção
> a `operationalSignals` no arquivo é um comentário comparando **estilo de
> modelagem** (ambos derivam em vez de persistir), não um import. Registrado
> explicitamente porque uma versão anterior desta seção afirmava o contrário:
> `operationalStatus` **não influencia prontidão para automação**, e a projeção da
> Fase 5 não tem risco por esse caminho.
>
> **Não confundir as duas "prontidões":** `deriveReadiness`, dentro de
> `operationalSignals`, **lê** `operationalStatus` (é uma das 7 acima) e trata de
> **conferência humana** (`docs/11 §7`); `automationReadiness`, em
> `src/server/automation/`, é o checklist pré-execução e **não lê** o campo.

### 4.3 Visual (5)

- Badge da lista admin · badge do detalhe admin · `<select defaultValue>` do
  detalhe admin · `clientVisibleStatusLabel` · `processos/novo/sucesso`.

### 4.4 Diagnóstica (4)

- DTOs de `getAdminProcessDetail` e `getAdminQueue` — repasse para exibição.

### 4.5 Permissões — o risco é menor do que parece

`permissions.ts` menciona `"process.operationalStatus"` três vezes, mas isso é o
**nome de uma permissão RBAC**, não leitura da coluna.

- **Nenhuma permissão é decidida pelo valor de `operationalStatus`.**
- O risco de permissão é **menor** que o de fila e sinalizadores.
- Ressalva: a tela do admin combina `hasPermission` **com** o valor atual para
  montar o `<select>` — o valor afeta o que aparece selecionado, não quem pode
  mudar.

---

## 5. Uso real de `internalStatus`

- **Escreve:** apenas `transitionInternalStatus`.
- **Chamador real:** apenas `confirmPixPayment`.
- **Alcançáveis:** `RASCUNHO` (default do schema) e `PAGO_EM_FILA`.
- **Os outros 15** são futuros/documentais — incluindo os dois da Fase 2
  (`AGUARDANDO_CONFIRMACAO_HUMANA`, `AGUARDANDO_CAPTCHA`).
- **Lido para decidir:** **2 lugares**, ambos com a mesma dupla
  `RASCUNHO`/`AGUARDANDO_PAGAMENTO`:
  - `createPixPayment:32` — guarda de serviço, recusa criar cobrança fora dessa
    dupla.
  - `src/app/(user)/processos/[id]/page.tsx:85` — compõe `canCreateCharge`, que
    decide se o cliente vê a ação de pagar (junto com "não há cobrança ativa nem
    paga").

**`internalStatus` ainda não pode substituir `operationalStatus`.** A Fase 3
entregou a porta canônica; ninguém além do Pix entra por ela.

---

## 6. Mapeamento `internalStatus → operationalStatus`

**Somente 3 projeções são seguras:**

| `internalStatus` | → `operationalStatus` | Por quê é seguro |
|---|---|---|
| `RASCUNHO` | `RASCUNHO` | 1:1, mesmo significado |
| `AGUARDANDO_PAGAMENTO` | `AGUARDANDO_PAGAMENTO` | 1:1 |
| `PAGO_EM_FILA` | `PAGO_EM_FILA` | 1:1 |

Os outros 14 são **arriscados, sem equivalente ou com perda de informação**.
Casos que merecem nome:

- `BLOQUEADO_INSTABILIDADE` e as três `EXCECAO_*` → `BLOQUEADO`: perde a causa e
  dispara `BLOQUEIO_MANUAL` em `operationalSignals` sem que humano tenha
  bloqueado.
- `PROTOCOLADO_GRU_GERADA` → `PRONTO_PARA_PROTOCOLO_MANUAL`: **inverte o tempo**
  — protocolado não é "pronto para protocolar".
- `CONCLUIDO` → sem equivalente. `isClosed()` reconhece apenas `CANCELADO_DEV`.
- `CANCELADO_REEMBOLSADO` → `CANCELADO_DEV`: afirmaria cancelamento de
  desenvolvimento onde houve reembolso.

> **Nenhum mapa em código.** Esta tabela é análise, não especificação de
> implementação.

---

## 7. Os 6 estados operacionais sem equivalente canônico

| `OperationalStatus` | Natureza | Por que não é derivável |
|---|---|---|
| `DOCUMENTO_ENVIADO` | etapa de conferência documental interna | não há `InternalStatus` para "aguardando conferência" |
| `DOCUMENTO_APROVADO` | idem | idem |
| `EM_REVISAO_OPERACIONAL` | conferência interna da equipe | `EM_REVISAO_HUMANA` é **pausa de exceção da automação**, coisa outra |
| `PRONTO_PARA_PROTOCOLO_MANUAL` | fila de trabalho do operador | descreve a **equipe**, não o processo |
| `BLOQUEADO` | bloqueio genérico decidido por humano | as `EXCECAO_*` afirmam causa específica |
| `CANCELADO_DEV` | cancelamento de desenvolvimento | `CANCELADO_REEMBOLSADO` afirma reembolso |

**A razão é conceitual:** estes são **estados de workflow humano**, não estados da
jornada do processo. Derivá-los exigiria **novos valores em `InternalStatus`** —
território da Fase 2 — ou aceitar perda de informação na fila.

> **Esta é uma dependência OCULTA da Fase 5**, não registrada no `docs/44 §5.2`.
> É a principal razão da reordenação.
>
> **Decidido em [`docs/47`](47-decisao-estados-workflow-humano.md) (2026-07-30):**
> 2 destes 6 viram candidatos a `InternalStatus`, 3 permanecem só operacionais,
> 1 (`BLOQUEADO`) tem forma adiada. Este inventário não muda — a decisão está
> em `docs/47`.

---

## 8. Decisão de reordenação

- **A Fase 5 NÃO deve começar por projeção.**
- **A Fase 5 começa por inventário, guardas e diagnóstico.**
- `operationalStatus` **continua persistido e operacional** — nenhum write é
  removido nesta fase.
- `internalStatus` **deve ganhar cobertura real** antes de virar fonte de
  projeção.

O critério para reavaliar a projeção: quando os writes de `operationalStatus`
estiverem migrados para a porta canônica e `internalStatus` tiver valores
alcançáveis suficientes para cobrir a fila **sem perda**.

---

## 9. Subfases propostas

| Subfase | O quê | Natureza | Risco |
|---|---|---|---|
| **5a** | **Inventário documental** — este documento | docs | nenhum |
| **5b** | **Teste de guarda** contra novos writes soltos de `operationalStatus` | teste | baixo |
| **5c** | **Diagnóstico de divergência** `internalStatus` × `operationalStatus`, sem mudar comportamento | código | baixo |
| **5d** | ~~**Decisão sobre novos `InternalStatus`**~~ — **DECIDIDA por [`docs/47`](47-decisao-estados-workflow-humano.md)**: 2 dos 6 estados migram, 3 permanecem operacionais, 1 parcial | docs | nenhum |
| **5e** | **Migrar `uploadProcessDocument`** — um gatilho, um valor, guarda clara | código | médio |
| **5f** | **Migrar `reviewProcessDocument`** — dois caminhos, um deles `BLOQUEADO` | código | médio-alto |
| **5g** | **Migrar `updateProcessOperations`** — porta do admin, 9 valores | código | **alto** |
| **5h** | **Só então** avaliar projeção + testes de equivalência de fila | código | **alto** |

Ordem de 5e a 5g: do menor para o maior acoplamento, cada uma reversível sozinha.

---

## 10. Riscos

| Risco | Gravidade |
|---|---|
| **Processo sumir da fila** — `getAdminQueue` e o filtro leem `operationalStatus` | **alto** |
| **`operationalSignals` errar** — 7 leituras; `BLOQUEIO_MANUAL` falso, SLA errado | **alto** |
| **Guardas de serviço travarem ou vazarem** — 4 leituras (`uploadProcessDocument`, 2 em `reviewProcessDocument`, idempotência de `updateProcessOperations`) | **alto** |
| **`isClosed()` não reconhece `CONCLUIDO`** — só `CANCELADO_DEV` fecha | médio |
| Botão/dropdown admin aparecer errado — `<select defaultValue>` lê o valor atual | médio |
| **`internalStatus` quase inerte** — é a causa raiz, não risco lateral | **alto** |
| **6 estados sem equivalente** — dependência oculta de novos enums | **alto** |
| Testes atuais não cobrem equivalência de fila | médio |

> **Risco retirado:** *"`automationReadiness` errar"* constava aqui como **alto** por
> supor que o módulo consome `operationalSignals`. Ele não consome, e não lê
> `operationalStatus` (§4.2) — não havia risco por esse caminho. Removido em vez de
> rebaixado: risco inventado desperdiça blindagem na 5b/5c.

---

## 11. Proibições

- ❌ Criar `operationalFromInternalStatus` agora.
- ❌ Criar mapa `operationalStatus → internalStatus`.
- ❌ Projetar `operationalStatus` agora.
- ❌ Usar os estados da Fase 2 em fluxo.
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Tocar Gov.br/SINARM/PF.
- ❌ Usar `db:push`.

---

## 12. Checklist de segurança

- `PHASE9_REAL_EXECUTION_ENABLED` permanece **`false as const`**.
- `docs/26 §19` **inalterado** — gates 1, 2, 3 e 5 seguem **abertos**.
- **Execução real segue bloqueada.**
- Sem código, sem testes, sem migration, sem schema, sem enum.
- Sem UI, sem fila, sem readiness, sem automação.
- Sem schedule, sem heartbeat, sem OCR real.
- Sem Gov.br/SINARM/PF, sem credenciais, cookies ou tokens.

---

> **Fecho.** Este documento **inventaria e reordena**. Ele não implementa, não
> altera código, não cria projeção, não fecha gate e não autoriza execução real.
> Regras permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem
> íntegros.
