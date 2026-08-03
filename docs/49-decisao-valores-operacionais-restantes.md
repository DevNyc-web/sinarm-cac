# 49 — Decisão sobre os 5 valores operacionais restantes

> **O que é este documento.** A decisão sobre os 5 valores que ainda passam pela
> linha dinâmica legada de `updateProcessOperations` — quais podem migrar, quais
> nunca vão migrar, e o que isso significa para a projeção da Fase 5h.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO migra** nenhum dos 5 valores.
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO cria** projeção nem mapa em direção nenhuma.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-02
> **Base da `main`:** `bb53970` — *feat: migrate manual blocked status transition*
> **Referências:** `docs/46 §3.5/§7` (porta manual, estados sem equivalente),
> `docs/47 §9` (os 3 que permanecem operacionais), `docs/48` (`BLOQUEADO`).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-02 |
| `main` | `bb53970` |
| Tipo | **Decisão arquitetural documental** — fecha o escopo da Fase 5g |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** dos 5 restantes, **2** podem sair do legado apenas como
**ação explícita própria** (nunca como migração automática desta porta), **2**
permanecem operacionais para sempre e **1** fica operacional com decisão própria
pendente. **A projeção da 5h é parcial por construção.**

---

## 2. Onde a Fase 5 chegou

| Caminho de escrita | Estado |
|---|---|
| `confirmPixPayment` | canônico (Fase 3) |
| `uploadProcessDocument` | canônico (5e) |
| `reviewProcessDocument` — aprovação | canônico (5f) |
| `reviewProcessDocument` — rejeição | canônico (5f completa, `docs/48`) |
| `updateProcessOperations` — `RASCUNHO`, `AGUARDANDO_PAGAMENTO`, `PAGO_EM_FILA`, `BLOQUEADO` | canônico (5g + `docs/48`) |
| `updateProcessOperations` — linha dinâmica | **legado, 5 valores** |

Nenhum fluxo natural escreve `operationalStatus` fora da porta canônica. O que
resta é uma única linha, na porta MANUAL/admin.

---

## 3. Os 5 valores, decididos um a um

### 3.1 `DOCUMENTO_ENVIADO` → legado agora; futuro = **ação explícita**

Tem candidato canônico (`DOCUMENTO_RECEBIDO_PARA_ANALISE`) e o fluxo natural
(`uploadProcessDocument`) já migrou. Mesmo assim **não deve migrar aqui**.

O motivo é concreto, não teórico: a guarda de aprovação de
`reviewProcessDocument` exige `operationalStatus === "DOCUMENTO_ENVIADO"`.
Selecionar esse valor no dropdown é, na prática, **reabrir a conferência
documental** — uma correção de operação. Mover o `internalStatus` junto faria a
jornada canônica **retroceder** para "documento aguardando análise" num processo
que pode já ter passado do pagamento, sem nenhuma das checagens que só o fluxo
de upload faz.

**Decisão: (b) ação explícita separada no futuro.** A forma correta não é migrar
esta linha, e sim uma ação própria — "reabrir conferência documental" — com
guarda, ator e evento próprios. Enquanto ela não existir, o valor continua
legado.

### 3.2 `DOCUMENTO_APROVADO` → legado agora; futuro = **ação explícita**

Mesmo desenho: candidato canônico (`DOCUMENTO_VALIDADO`), fluxo natural já
migrado, e a mesma proibição aqui — com um agravante próprio.

O fluxo natural registra **quem** revisou e **quando** (`reviewedByMockUserId`,
`reviewedByRole`, `reviewedAt` no documento). Marcar `DOCUMENTO_APROVADO` pelo
dropdown não registra revisão nenhuma. Migrar aqui produziria um
`internalStatus = DOCUMENTO_VALIDADO` **sem revisor** — o canônico afirmaria uma
validação que ninguém fez.

**Decisão: (b) ação explícita separada no futuro**, se e quando o produto
precisar de "aprovar documento fora do fluxo de revisão". Enquanto isso, legado.

### 3.3 `EM_REVISAO_OPERACIONAL` → **permanece operacional, permanente**

Descreve **a equipe**, não o processo: é a conferência interna. Tem consumidor
comportamental real — `getAdminQueue` deriva a flag de fila de
`PAGO_EM_FILA || EM_REVISAO_OPERACIONAL`.

`EM_REVISAO_HUMANA`, o valor de `InternalStatus` mais próximo, é **pausa de
exceção da automação** — coisa outra (`docs/46 §7`). Usá-lo aqui inventaria um
tipo de pausa que não aconteceu.

**Decisão: continua só `operationalStatus`.** Reafirma `docs/47 §9`.

### 3.4 `PRONTO_PARA_PROTOCOLO_MANUAL` → **permanece operacional, permanente**

Descreve a fila de trabalho do operador, não o estado do processo.

**Cuidado registrado:** o mesmo nome já existe como `ReadinessLevel` em
`operationalSignals.ts`, **derivado** de critérios de prontidão. São duas coisas
distintas com o mesmo nome — uma é declaração da equipe, a outra é cálculo. Não
confundir, e não tratar a existência do nível derivado como se fosse projeção do
status operacional.

**Decisão: continua só `operationalStatus`.** Reafirma `docs/47 §9`.

### 3.5 `CANCELADO_DEV` → **operacional por ora, decisão própria pendente**

É o **único** valor que `isClosed()` (`operationalSignals.ts`) reconhece como
fechamento — e é guarda em `reviewProcessDocument` (`!== CANCELADO_DEV`). Dois
consumidores comportamentais reais.

`CANCELADO_REEMBOLSADO`, o único cancelamento no canônico, **afirma reembolso**.
Mapear cancelamento de ambiente de desenvolvimento para ele seria afirmar um
reembolso que não houve — mesma classe de erro que `docs/48` recusou para
`BLOQUEADO`.

**Decisão: continua só `operationalStatus` por ora, e fica FORA da projeção
canônica.** Se um dia existir cancelamento real de cliente (com ou sem
reembolso), aí sim é decisão própria — provavelmente um estado canônico novo,
nunca reuso de `CANCELADO_REEMBOLSADO`.

> **Atualização (2026-08-02):** a decisão sobre o fluxo de cancelamento real
> foi registrada em [`docs/51`](51-decisao-cancelamento-real.md) —
> `CANCELADO_DEV` continua técnico, cancelamento real (quando existir) é
> estado canônico novo por ação explícita própria. Nada foi implementado.

---

## 4. As três categorias

| Categoria | Valores | O que significa |
|---|---|---|
| **A — legado, futuro por ação explícita** | `DOCUMENTO_ENVIADO`, `DOCUMENTO_APROVADO` | Têm candidato canônico, mas migrar a linha manual transformaria correção em retrocesso ou em validação sem revisor. Só saem do legado via ação própria |
| **B — operacional permanente** | `EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL` | Descrevem a EQUIPE. Não há candidato canônico, nem haverá |
| **C — operacional com decisão pendente** | `CANCELADO_DEV` | Fecha o processo e é guarda; fica fora da projeção até existir cancelamento real. Fluxo de cancelamento real decidido em [`docs/51`](51-decisao-cancelamento-real.md) (não implementado) |

---

## 5. Consequência: a 5h é parcial por construção

A Fase 5h (`docs/46 §9`) foi escrita como "avaliar projeção + testes de
equivalência de fila". Com esta decisão, o que ela pode ser fica delimitado:

- **No mínimo 2 valores** (categoria B) nunca serão derivados de
  `internalStatus`. Com `CANCELADO_DEV`, são **3**.
- Os 2 da categoria A, se um dia saírem do legado, saem por **ação explícita** —
  o que também não é projeção.
- Portanto **`operationalStatus` mantém papel residual permanente**, e a 5h não
  pode ser "trocar leitores por uma projeção". No máximo é: derivar o que é
  derivável, e deixar explícito o que é declaração da equipe.

Isto confirma e detalha a consequência que `docs/47 §9` já havia registrado.

---

## 6. O que este documento não resolve

- **Não desenha a ação explícita** dos dois valores da categoria A: guarda,
  permissão e evento ficam para o PR que a propuser.
- **Não decide o cancelamento real** — categoria C continua aberta. (O nível de
  decisão sobre *o que fazer* foi registrado em
  [`docs/51`](51-decisao-cancelamento-real.md); a implementação e as decisões
  de reembolso/protocolo/reversão citadas lá continuam pendentes.)
- **Não reclassifica o diagnóstico.** `statusDivergence` hoje trata os 3 valores
  de B e C como `needs_decision`. Depois desta decisão, "precisa decidir" ficou
  impreciso para eles: a decisão é que **não migram**. Reclassificar (ou criar
  severidade própria para "operacional por natureza") é PR de código, fora deste.
- **Não toca a linha dinâmica.** Ela continua existindo, agora cobrindo 5
  valores, e é o último write solto de `operationalStatus` do projeto.

---

## 7. Próximos passos possíveis

| Ordem | Passo | Natureza | Depende de |
|-------|-------|----------|------------|
| 1 | Reclassificar B e C no `statusDivergence` (severidade própria ou `expected_legacy`) | código | este documento |
| 2 | Ação explícita "reabrir conferência documental" (`DOCUMENTO_ENVIADO`) | código | decisão de produto |
| 3 | Ação explícita de aprovação fora do fluxo de revisão (`DOCUMENTO_APROVADO`) | código | decisão de produto |
| 4 | Decisão sobre cancelamento real (`CANCELADO_DEV`) | docs | produto |
| 5 | **5h** — projeção PARCIAL + testes de equivalência de fila | código | 1 |

Nenhum destes é pré-requisito de piloto ou divulgação — isso segue dependendo
das pendências de `docs/23 §5`.

> **Atualização (2026-08-02).** Itens **1** (`b5003d8` — classificação
> `operational_only`/`expected_legacy` em `statusDivergence`), **2** (`docs/50 §5`
> — ação "reabrir conferência documental"), **3** (`docs/50 §6` — ação "aprovar
> fora do fluxo") e **5** (`operationalStatusProjection.ts` + testes de
> equivalência) **foram implementados**. A 5h é parcial **por construção**, como
> esta seção previa: cobre os 6 pares canônicos e classifica os 3 valores
> só-operacionais, sem tentar derivar `operationalStatus` por inteiro.
> **Item 4 (decisão sobre cancelamento real de `CANCELADO_DEV`, categoria C):**
> a decisão sobre **o que fazer** foi registrada em
> [`docs/51`](51-decisao-cancelamento-real.md) — `CANCELADO_DEV` continua
> técnico, cancelamento real (quando existir) é estado canônico novo por ação
> explícita própria, nunca reuso de `CANCELADO_DEV`/`CANCELADO_REEMBOLSADO`.
> **Nada disso foi implementado**, e `CANCELADO_DEV` continua fora da projeção
> canônica. Reembolso/financeiro, processo já protocolado e reversão continuam
> decisões futuras, fora de `docs/51`. Uso da projeção parcial em
> relatórios/admin (além do diagnóstico interno) também continua **em
> aberto**, se algum dia for desejado. **Execução real continua bloqueada.**
>
> **Atualização (2026-08-03).** A frase "nada disso foi implementado" acima
> **não reflete mais o estado atual** — registrado aqui para não deixar a
> desatualização implícita. O cancelamento real de `CANCELADO_OPERACIONAL`
> (o `InternalStatus` novo mencionado acima) foi implementado em ciclo
> completo: service `cancelProcess`, sinais operacionais/fila/SLA
> reconhecendo o encerramento, visualização admin read-only e a ação
> "Cancelar processo" no detalhe admin — detalhes em
> [`docs/51`](51-decisao-cancelamento-real.md),
> [`docs/52`](52-decisao-visibilidade-cancelamento-real.md) e
> [`docs/53`](53-decisao-ux-acao-cancelamento-admin.md). O que esta seção
> disse sobre `CANCELADO_DEV` **continua exatamente igual**: técnico/dev,
> fora da projeção canônica, nunca reclassificado. Reembolso/financeiro,
> processo já protocolado e reversão **continuam decisões futuras**, sem
> resposta em nenhum dos PRs implementados. **Execução real continua
> bloqueada.**

---

## 8. Proibições

- ❌ Migrar `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO` pela linha da porta manual.
- ❌ Mapear `EM_REVISAO_OPERACIONAL` para `EM_REVISAO_HUMANA`.
- ❌ Mapear `CANCELADO_DEV` para `CANCELADO_REEMBOLSADO`.
- ❌ Tratar o `ReadinessLevel` homônimo como projeção do `OperationalStatus`.
- ❌ Prometer projeção 100% derivada na 5h.
- ❌ Fechar gate de `docs/26 §19`.

---

> **Fecho.** Este documento **decide no papel**. Não implementa, não migra valor
> nenhum, não cria projeção, não fecha gate e não autoriza execução real. Regras
> permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
