# 48 — Decisão sobre `BLOQUEADO_OPERACIONAL`

> **O que é este documento.** A decisão própria que [`docs/47 §6.5`](47-decisao-estados-workflow-humano.md)
> exigiu antes de `BLOQUEADO` poder ganhar porta canônica: se ele continua apenas
> operacional ou vira `InternalStatus`, e em que forma o motivo do bloqueio é
> registrado.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera código, testes, schema, enum ou migration.**
> - ❌ **NÃO cria** o valor `BLOQUEADO_OPERACIONAL` — decide que ele deve existir.
> - ❌ **NÃO migra** o lado rejeição de `reviewProcessDocument`.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-01
> **Base da `main`:** `3424654` — *docs: trim duplicated phase 5 status notes*
> **Referências:** `docs/44 §7` (invariantes de pausa), `docs/46 §3.4/§6/§7`
> (writes, mapeamento, estados sem equivalente), `docs/47 §6.5` (direção dada),
> `docs/12 §3.5` (nota sem PII).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-01 |
| `main` | `3424654` |
| Tipo | **Decisão arquitetural documental** — pré-requisito da 5f (lado rejeição) |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** `BLOQUEADO` **ganha** `InternalStatus` canônico próprio
(`BLOQUEADO_OPERACIONAL`), e o motivo do bloqueio fica em **`note` livre**, não em
campo estruturado novo.

---

## 2. Estado real no momento da decisão

Dois caminhos escrevem `operationalStatus = BLOQUEADO`, e eles registram coisas
diferentes:

| Caminho | Motivo do bloqueio | Evento na trilha do processo |
|---|---|---|
| `reviewProcessDocument` (rejeição) | `ProcessDocument.rejectionReason` — **obrigatório**, sem PII, já persistido | ❌ **nenhum** — chama o repositório direto |
| `updateProcessOperations` (dropdown) | ❌ nenhum — `note` só é preenchido para `PRONTO_PARA_PROTOCOLO_MANUAL` | ✅ `STATUS_OPERACIONAL`, rótulos em `fromValue`/`toValue` |

**Quem lê `BLOQUEADO` para decidir:** apenas `deriveSignals` → `BLOQUEIO_MANUAL`.
Não filtra a fila (`getAdminQueue` olha `PAGO_EM_FILA || EM_REVISAO_OPERACIONAL`),
não fecha o processo (`isClosed()` só reconhece `CANCELADO_DEV`) e não é guarda de
transição de ninguém. O acoplamento comportamental é **um sinal derivado**.

**Mecanismo de motivo que já existe:** `ProcessStatusEvent.note` (texto curto, sem
PII), aceito por `transitionInternalStatus` e por `recordOperationalEvent`. Nada
consulta nem agrega por motivo de bloqueio hoje.

---

## 3. As três saídas consideradas

| | A — só operacional | **B — canônico** | C — sobreposição |
|---|---|---|---|
| Forma | junta-se aos 3 residuais permanentes | 1 valor novo no `InternalStatus`, mesma forma das 4 exceções existentes | marcador separado; `internalStatus` continua dizendo onde o processo está |
| Custo | zero | migration aditiva (padrão da 5d) | migration + conceito novo no modelo |
| Ponto de retomada | preservado | ⚠️ perdido na coluna, recuperável via `fromStatus` da trilha | preservado por construção |
| 5f (lado rejeição) | ❌ nunca migra | ✅ destrava | ✅ destrava |

**Por que A foi rejeitada.** Os 3 residuais ficaram operacionais por um critério
explícito (`docs/47 §9`): descrevem **a equipe**, não o processo.
`EM_REVISAO_OPERACIONAL` é a equipe conferindo; `PRONTO_PARA_PROTOCOLO_MANUAL` é
fila de trabalho do operador. `BLOQUEADO` descreve o **processo** — ele não
avança. Não é o mesmo grupo. Manter A significaria que o campo canônico não
consegue responder *"por que este processo não anda?"*, que é a meta declarada em
`docs/44`, e deixaria `reviewProcessDocument` permanentemente dividido entre duas
portas dentro da mesma função.

**Por que C foi rejeitada.** É a saída que resolve o ponto de retomada de graça, e
tem apoio no fato de que o único consumidor de `BLOQUEADO` já é um sinal. Mas cria
um **segundo mecanismo** para "processo parado" ao lado das quatro exceções que já
usam estado — exatamente a duplicação de estrutura que `docs/47` rejeitou ao
recusar "sinal derivado" para `DOCUMENTO_ENVIADO`.

---

## 4. Decisão

**`BLOQUEADO_OPERACIONAL` deve existir como `InternalStatus`** — categoria nova,
nunca reutilização de `BLOQUEADO_INSTABILIDADE` ou `EXCECAO_*`. A proibição da
regra 2 (`docs/46 §3.4`, `docs/47 §6.5`) continua valendo integralmente: bloqueio
decidido por humano não pode vestir causa apurada pela automação.

Ganho que decidiu o empate: hoje a rejeição de documento grava `BLOQUEADO` **sem
nenhum evento na trilha do processo** (§2). Passar esse caminho pela porta canônica
fecha um buraco de auditoria real — não é arrumação de enum.

---

## 5. O motivo vai em `note`, não em campo estruturado

- O mecanismo **já existe** e já é usado (`note` em `recordOperationalEvent`).
- O caminho de rejeição **já persiste** `rejectionReason` de forma estruturada onde
  ela pertence: no documento, não no processo.
- **Nenhum consumidor** consulta ou agrega por motivo de bloqueio. Uma taxonomia
  de causas seria inventada aqui, não validada com a operação — o mesmo erro que
  `docs/46` registra para mapeamentos que afirmam causa não verificada.
- É reversível na direção barata: promover notas a campo estruturado depois é
  fácil; abandonar uma taxonomia da qual o código já depende, não.

O dropdown do admin passa a poder registrar motivo — hoje não registra nenhum.
Se isso deve ser **obrigatório** ali (como já é na rejeição de documento) é
decisão do PR de implementação, não deste documento.

---

## 6. O que este documento não resolve

**O ponto de retomada.** Sobrescrever `internalStatus` com o bloqueio perde, na
coluna, onde o processo estava. Isso **não é específico de `BLOQUEADO`**:
`BLOQUEADO_INSTABILIDADE` e as três `EXCECAO_*` já sobrescrevem do mesmo jeito, e
o invariante 1 do `docs/44 §7` ("toda pausa carrega o ponto de retomada") **não é
código para nenhuma delas** — não existe coluna de retomada no schema.

Resolver isso dentro do PR de `BLOQUEADO` seria inventar mecanismo para um caso
quando o problema é de cinco. **Pertence à máquina de exceções assistidas
(Fase 3)**, e a informação continua recuperável pela trilha (`fromStatus` do evento
tipado) enquanto isso.

---

## 7. Consequências para as subfases

| Subfase | Efeito |
|---|---|
| **5f** (lado rejeição de `reviewProcessDocument`) | **Desbloqueada** — depende só da migration aditiva de `BLOQUEADO_OPERACIONAL` |
| **5g** (`BLOQUEADO` em `updateProcessOperations`) | Deixa de ser um dos 6 legados; passa a caber na porta canônica pela mesma migration. Os outros 5 seguem legados |
| **5h** (projeção) | Inalterada: continua **não** sendo 100% derivada, pelos 3 residuais de `docs/47 §9` |

Nota para o PR de migration: `ALTER TYPE ... ADD VALUE` sem `BEFORE`/`AFTER` anexa
ao fim do tipo no Postgres — o valor novo vai **no fim do enum**, mesmo cuidado já
registrado no `schema.prisma` para os valores da Fase 2 e da 5d.

---

## 8. Achado colateral

`reviewProcessDocument` (rejeição) altera `operationalStatus` e `userFacingStatus`
**sem registrar evento nenhum** no processo. A trilha append-only não tem registro
de que o processo foi bloqueado, nem por quem. A migração da 5f corrige isso como
efeito, mas o buraco existe **hoje** e é independente desta decisão.

---

## 9. Proibições

- ❌ Mapear `BLOQUEADO` para `BLOQUEADO_INSTABILIDADE` ou qualquer `EXCECAO_*`.
- ❌ Criar campo estruturado de motivo de bloqueio agora.
- ❌ Reordenar o enum ao adicionar o valor novo.
- ❌ Migrar `EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL` ou
  `CANCELADO_DEV` — seguem operacionais permanentes (`docs/47 §9`).
- ❌ Fechar gate de `docs/26 §19`.

---

## 10. Próximos PRs

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Migration aditiva de `BLOQUEADO_OPERACIONAL` | migration | este documento |
| 2 | **5f (completa)** — migrar o lado rejeição de `reviewProcessDocument` | código | PR 1 |
| 3 | Migrar `BLOQUEADO` em `updateProcessOperations` | código | PR 1 |

---

> **Fecho.** Este documento **decide no papel**. Não implementa, não cria o valor
> do enum, não migra fluxo, não fecha gate e não autoriza execução real. Regras
> permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
