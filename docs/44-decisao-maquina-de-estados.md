# 44 — Decisão da Máquina de Estados do Processo

> **O que é este documento.** A **decisão arquitetural** sobre qual campo de
> status é canônico no `Process`, o que os demais viram, e em que ordem a
> migração acontece. Responde ao achado registrado em
> [`docs/43 §7`](43-checkpoint-extracao-47d.md).
>
> **O que este documento NÃO faz — explicitamente:**
>
> - ❌ **NÃO altera código.**
> - ❌ **NÃO altera schema, enum ou migration.**
> - ❌ **NÃO altera flags** nem `PHASE9_REAL_EXECUTION_ENABLED`.
> - ❌ **NÃO altera testes.**
> - ❌ **NÃO altera `docs/26 §19`** nem fecha gate.
> - ❌ **NÃO libera execução real.**
>
> **Data:** 2026-07-29
> **Base da `main`:** `737a093` — *docs: add extraction checkpoint*
> **Referências:** `docs/12 §6` (status canônicos), `docs/11 §10` (operação),
> `docs/25 §4/§5` (visão de automação, escada de maturidade),
> `docs/43` (checkpoint #47D), `docs/00 §8` (regras permanentes).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| `main` | `737a093` |
| Tipo | **Decisão arquitetural documental** — Fase 0 do plano de migração |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** |
| `PHASE9_REAL_EXECUTION_ENABLED` | `false as const` |
| `docs/26 §19` | Gates 1, 2, 3 e 5 **abertos** — inalterados |

**Decisão em uma linha:** `internalStatus` é o campo **canônico** do processo;
`userFacingStatus` e `operationalStatus` viram **projeções** derivadas dele;
`manualExecutionStatus` deixa de ser fonte de verdade e vira **histórico**.

---

## 2. Problema

O `model Process` carrega **quatro** campos de status simultâneos. Três estão
vivos, um está quase inerte, e **os estados de exceção estão todos no campo
inerte**. A automação assistida precisa de um lugar para dizer "pausei aqui, por
este motivo, e sei de onde retomar" — e hoje a máquina que roda não sabe
expressar isso.

Sem decidir a fonte canônica antes de evoluir automação, cada PR novo é escrito
sobre fontes de verdade concorrentes e multiplica o custo da unificação.

---

## 3. Estado atual dos quatro campos

| Campo | Escrito por | Lido para decidir | Situação |
|-------|-------------|-------------------|----------|
| `internalStatus` | **1 service** — `confirmPixPayment` → `PAGO_EM_FILA` | `createPixPayment` (guarda RASCUNHO/AGUARDANDO_PAGAMENTO); tela do usuário | **Quase inerte** — 15 estados declarados, 2 alcançáveis |
| `operationalStatus` | `confirmPixPayment`, `reviewProcessDocument`, `updateProcessOperations` | Filtro da fila admin, permissões, sinais operacionais, telas | **É a máquina viva** |
| `manualExecutionStatus` | `manualExecution` via repositório | Detalhe admin e do usuário | **Viva** — descreve trabalho humano feito FORA do app |
| `userFacingStatus` | `confirmPixPayment`, `reviewProcessDocument` (literais) **+ derivação** em `updateProcessOperations` | Telas do cliente | **Viva e parcialmente projetada** |

### 3.1 A projeção já existe — ancorada no campo errado

`updateProcessOperations` mantém `USER_FACING_BY_OPERATIONAL`, um mapa completo
de `OperationalStatus → UserFacingStatus`. **O mecanismo de projeção está
construído e funcionando** — falta trocar a âncora, não inventar o padrão.

Mas a derivação **não é consistente**: dois services escrevem
`userFacingStatus` à mão, sem passar pelo mapa. Hoje há **dois caminhos** para o
mesmo campo — um derivado e dois literais — o que já é risco de divergência
antes de qualquer migração.

### 3.2 A trilha de auditoria está tipada para o campo morto

`ProcessStatusEvent.fromStatus` / `toStatus` são do tipo **`InternalStatus`**.
Porém apenas `confirmPixPayment` usa o registrador **tipado**. Todo o resto —
execução manual, submissão à fila de automação, sugestão de destino, notas,
operações — usa o registrador **operacional**, que grava `fromValue`/`toValue`
como **strings de rótulo humano**.

Consequência: **a trilha auditável do fluxo real é texto livre, não enum.** Isso
é dívida hoje e vira problema sério quando a automação precisar responder "em
que estado o sistema estava quando decidiu X".

### 3.3 Os estados de exceção estão todos no campo inerte

`AGUARDANDO_LOGIN_GOVBR`, `SESSAO_GOVBR_EXPIRADA`, `EM_PREENCHIMENTO_SINARM`,
`EM_REVISAO_HUMANA`, `BLOQUEADO_INSTABILIDADE`, `EXCECAO_DOC_INVALIDO`,
`EXCECAO_ARMA_DIVERGENTE`, `EXCECAO_DESTINO_INCOMPLETO` — todos em
`InternalStatus`.

O `OperationalStatus`, que é o que roda, tem apenas `BLOQUEADO` genérico.
**A máquina viva não sabe expressar exceção tipada.**

---

## 4. Decisão: `internalStatus` é o canônico

| Critério | `internalStatus` | `operationalStatus` |
|----------|------------------|---------------------|
| Representa a jornada real | ✅ pagamento → login → preenchimento → protocolo → GRU → conclusão | ⚠️ para em `PRONTO_PARA_PROTOCOLO_MANUAL` |
| Estados Gov.br/SINARM/PF | ✅ três | ❌ nenhum |
| Estados de exceção | ✅ cinco tipados | ❌ só `BLOQUEADO` |
| Suporta pausa/retomada | ✅ cada exceção é ponto de parada nomeado | ❌ |
| Suporta ponto irreversível | ⚠️ tem o *depois* (`PROTOCOLADO_GRU_GERADA`), falta o *antes* — ver §6 | ❌ |
| Não é apenas rótulo de UI | ✅ | ✅ |
| Já documentado como canônico | ✅ `docs/12 §6` | ❌ |

**Decisão.** `internalStatus` é o campo canônico do processo.

**Motivo.** É o único que consegue expressar pausa tipada com ponto de retomada —
que é literalmente a meta do produto (`docs/43 §8`). Além disso, **já era a
decisão escrita** em `docs/12 §6`: o `operationalStatus` nasceu como trilha
operacional da Fase 6 e virou a máquina real **por inércia, não por decisão
arquitetural**.

---

## 5. Papel dos demais campos

### 5.1 `userFacingStatus` → **projeção derivada de `internalStatus`**

> ⚠️ **SUPERADO por [`docs/45`](45-decisao-user-facing-status.md) (2026-07-30).**
> O mapeamento da Fase 4 mostrou que **nenhuma tela do cliente lê**
> `userFacingStatus` — a premissa de "peso contratual" do §9 era falsa. A coluna
> foi **deprecada como fonte visual** em vez de promovida: a fonte real é
> `clientVisibleStatusLabel`, e a remoção fica para a Fase 6. A instrução de
> trocar por `USER_FACING_BY_INTERNAL` está **revogada**.

- Trocar `USER_FACING_BY_OPERATIONAL` por `USER_FACING_BY_INTERNAL`.
- **Eliminar os writes literais diretos** (`confirmPixPayment`,
  `reviewProcessDocument`) — o campo passa a ter origem única.
- **Preservar a semântica visível para o cliente**: a projeção deve reproduzir o
  que o usuário já vê, não "melhorar" os rótulos.

### 5.2 `operationalStatus` → **deprecar em fases**

> ⚠️ **REORDENADO por [`docs/46`](46-inventario-operational-status.md)
> (2026-07-30).** A decisão de deprecar **continua valendo**, mas a projeção
> direta era prematura: `operationalStatus` tem 5 caminhos de escrita e 9/9
> valores alcançáveis, enquanto `internalStatus` tem 1 caminho e 2/17. Projetar
> agora colapsaria a fila. Além disso, **6 estados operacionais não têm
> equivalente canônico** — dependência que esta seção não previa. A Fase 5 passa a
> começar por inventário (5a), guardas (5b) e diagnóstico (5c), com a projeção só
> na 5h.
>
> ⚠️ **Fase 5d decidida por [`docs/47`](47-decisao-estados-workflow-humano.md)
> (2026-07-30).** Dos 6 estados sem equivalente, **2** viram candidatos a
> `InternalStatus` (`DOCUMENTO_ENVIADO` → `DOCUMENTO_RECEBIDO_PARA_ANALISE`;
> `DOCUMENTO_APROVADO` → `DOCUMENTO_VALIDADO`), **3** permanecem só
> operacionais (`EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL`,
> `CANCELADO_DEV`) e **1** (`BLOQUEADO`) tem direção dada mas forma final
> adiada para PR próprio. **Consequência: a projeção da 5h NÃO será 100%
> derivada** — `operationalStatus` mantém papel residual permanente para os 3
> valores só-operacionais. Isto revisa, sem reverter, o parágrafo abaixo.

- Papel temporário: **projeção operacional derivada** de `internalStatus`.
- **Continua existindo** enquanto fila, permissões e telas dependerem dele.
- **Não remover antes de testes de equivalência.**
- Remoção do schema **só por último**, com migration própria.

### 5.3 `manualExecutionStatus` → **histórico, não fonte de verdade**

- Manter como **declaração de trabalho humano externo** (Fase 7).
- Futuramente migrar a semântica para **eventos/tarefas**.
- **Nunca dirigir decisão automática.**
- **Não reinterpretar retroativamente** processos antigos — é trilha auditável de
  ato humano declarado.

---

## 6. Estados faltantes (para migration futura)

| Estado | Prioridade | Por quê |
|--------|-----------|---------|
| **`AGUARDANDO_CONFIRMACAO_HUMANA`** | **crítica** | É o freio do ato irreversível (`docs/25 §4.3`). Sem ele, "pausar antes de gerar GRU" não tem representação, e o invariante do nível 0 ao 5 fica em comentário em vez de em código |
| **`AGUARDANDO_CAPTCHA`** | alta | `BLOQUEADO_INSTABILIDADE` não serve: captcha **não é** instabilidade, e a resolução é outra — humano resolve, não se espera passar |
| `AGUARDANDO_PAGAMENTO_GRU` | avaliar | Existe hoje só em `ManualExecutionStatus`; se `internalStatus` é canônico, precisa do equivalente |
| `EXCECAO_BAIXA_CONFIANCA` | avaliar | Hoje mapeia para `EM_REVISAO_HUMANA` — pode bastar, mas perde o motivo. Decidir: motivo vira **estado** ou **campo separado**? |

> **Nenhum enum é criado ou alterado por este documento.** Isto é registro de
> recomendação para a Fase 2.

---

## 7. Regras de transição futuras (alto nível)

```
sucesso ............................ avança sozinho, sem parar
baixa confiança na extração ........ EM_REVISAO_HUMANA
divergência arma / destino ......... EXCECAO_ARMA_DIVERGENTE / EXCECAO_DESTINO_INCOMPLETO
documento inválido ou ausente ...... EXCECAO_DOC_INVALIDO
captcha ............................ AGUARDANDO_CAPTCHA
sessão Gov.br expirada ............. SESSAO_GOVBR_EXPIRADA
portal instável .................... BLOQUEADO_INSTABILIDADE
etapa irreversível ................. AGUARDANDO_CONFIRMACAO_HUMANA
erro não recuperável ............... falha tipada + motivo sanitizado
```

### Invariantes

1. **Toda pausa carrega o ponto de retomada.** Sair de uma exceção volta ao passo
   exato, não ao início.
2. **`AGUARDANDO_CONFIRMACAO_HUMANA` só sai por ação humana.** Nenhum timeout,
   nenhum reaper e nenhum retry o atravessa — diferente de
   `BLOQUEADO_INSTABILIDADE`, que o sistema pode retomar sozinho.
3. **Captcha nunca é resolvido pelo sistema** (`docs/00 §8`, permanente). Pausa e
   devolve ao humano.
4. **`FALHOU` é só erro não recuperável.** O que um humano consegue resolver
   nunca cai nele — cai numa exceção tipada e retomável.

---

## 8. Plano de migração em fases

**Sem big bang.** As fases 1–3 são **aditivas e reversíveis**; só a 5 exige
coragem, e a 6 é destrutiva.

| Fase | O quê | Quebra? |
|------|-------|---------|
| **0** | **Este documento** — decide canônico, projeções e depreciação | não |
| **1** | **Auditoria tipada** — eventos futuros registram enum `InternalStatus`; rótulos existentes ficam como legado | não (aditivo) |
| **2** | **Novos estados** — `AGUARDANDO_CONFIRMACAO_HUMANA`, `AGUARDANDO_CAPTCHA`; avaliar `AGUARDANDO_PAGAMENTO_GRU` e `EXCECAO_BAIXA_CONFIANCA` | não (migration aditiva) |
| **3** | **Novos fluxos escrevem `internalStatus`** — exceções assistidas e automações nascem já no canônico | não |
| **4** | ~~**`userFacingStatus` deriva de `internalStatus`**~~ — **REESCRITA por [`docs/45`](45-decisao-user-facing-status.md)**: a coluna não é lida pelo cliente, então foi **deprecada** em vez de promovida. Entregue como correção das telas (admin e dashboard passaram a usar `clientVisibleStatusLabel`) | risco baixo — concluída |
| **5** | ~~**`operationalStatus` vira projeção** direto~~ — **REORDENADA por [`docs/46`](46-inventario-operational-status.md)**: passa a começar por inventário (5a), guarda contra novos writes (5b) e diagnóstico de divergência (5c); **decisão sobre os 6 estados sem equivalente na 5d** ([`docs/47`](47-decisao-estados-workflow-humano.md): híbrida — 2 migram, 3 permanecem operacionais, 1 parcial); migração dos writes em 5e–5g; **projeção parcial só na 5h**. Motivo: `internalStatus` tem 2/17 valores alcançáveis e 6 estados operacionais não têm equivalente canônico | **risco alto** — exige testes de equivalência de fila |
| **6** | **Depreciação final** — remover `operationalStatus` do schema só quando não houver leitores; **e também `userFacingStatus`** (`docs/45 §6`) | migration destrutiva, por último |

As fases **1–3 já destravam** os PRs de heartbeat e exceções assistidas **sem
tocar no que roda hoje**.

### 8.1 Sobre a auditoria tipada (Fase 1)

- Fases futuras **adicionam** auditoria tipada baseada em `InternalStatus`.
- Eventos antigos em texto ficam como **legado**.
- **Não** tentar tipagem retroativa destrutiva.
- **Novos fluxos automáticos devem registrar estado tipado** desde o início.

---

## 9. Riscos e compatibilidade

| Risco | Mitigação |
|-------|-----------|
| `operationalStatus` **dirige a fila e as permissões hoje** | Projeção equivalente **antes** de trocar leitores; Fase 5 só com teste de equivalência |
| ~~`userFacingStatus` tem **peso contratual** com o cliente~~ | **RISCO INVÁLIDO** — `docs/45 §2`: nenhuma tela do cliente lê a coluna, e ela já divergia do que o cliente via em 4 dos 9 estados operacionais. O peso contratual está em `clientVisibleStatusLabel`, não nela |
| `manualExecutionStatus` representa **ato humano declarado** | Não apagar, não reinterpretar; migrar semântica para evento sem tocar no histórico |
| **Eventos antigos em texto** não serão retroativamente tipados | Assumido: a trilha anterior à Fase 1 fica como está |
| **Processos em andamento durante a virada** | Regra a definir na Fase 3: migrar, congelar ou terminar no modelo antigo — decisão explícita, não implícita |
| **Decisão errada de estado quebra automação assistida** | Fases aditivas primeiro; nenhum fluxo existente reescrito antes da Fase 4 |
| **Big bang** | **Proibido.** Nenhuma fase pode ser pulada ou fundida com outra |

---

## 10. Escopo proibido

- ❌ Sem código.
- ❌ Sem migration.
- ❌ Sem alteração de enum.
- ❌ Sem execução real.
- ❌ `PHASE9_REAL_EXECUTION_ENABLED` permanece `false as const`.
- ❌ Sem Gov.br/SINARM/PF.
- ❌ Sem schedule.
- ❌ Sem heartbeat.
- ❌ Sem `db:push`.
- ❌ Sem alterar `docs/26 §19`.

---

## 11. Próximos PRs

| Ordem | PR | Fase | Natureza |
|-------|----|------|----------|
| 1 | **Auditoria tipada** — evento com enum `InternalStatus` | 1 | código (aditivo) |
| 2 | **Novos estados de exceção** | 2 | migration aditiva |
| 3 | **Heartbeat com deadline absoluto** | — | código |
| 4 | **Máquina de exceções assistidas** — pausa tipada + tarefa humana + retomada | 3 | código |
| 5 | **Métricas / última execução no painel** | — | código |
| 6 | **`userFacingStatus` derivado de `internalStatus`** | 4 | código |
| 7 | **OCR real controlado** | — | código |
| 8 | **`operationalStatus` como projeção** | 5 | código + testes de equivalência |
| 9 | **Schedule interno controlado** | — | código |
| 10 | **Depreciação de `operationalStatus`** | 6 | migration destrutiva |
| 11 | **Ensaio real controlado** | — | **gated** |

> Ordem de **automação**, não de lançamento. Nenhum destes PRs destrava piloto ou
> divulgação — isso depende das 12 pendências de `docs/23 §5`, que seguem
> abertas.

---

> **Fecho.** Este documento **decide a arquitetura de estado no papel**. Ele não
> implementa, não altera código, não altera schema, não altera enum, não cria
> migration, não fecha gate e não autoriza execução real. Regras permanentes
> (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
