# 47 — Decisão sobre Estados de Workflow Humano (Fase 5d)

> **O que é este documento.** A **decisão documental** da Fase 5d
> ([`docs/46 §9`](46-inventario-operational-status.md)): se os 6 estados
> operacionais sem equivalente canônico ([`docs/46 §7`](46-inventario-operational-status.md))
> devem virar novos `InternalStatus`, continuar como `operationalStatus` legado,
> ou ganhar estrutura própria. É o gargalo antes de 5e/5f/5g — sem esta decisão,
> migrar qualquer write teria destino incerto.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO cria enum, migration ou schema.**
> - ❌ **NÃO altera código, UI, fila, permissões, readiness ou transições.**
> - ❌ **NÃO cria** `operationalFromInternalStatus` nem mapa nenhum, em qualquer
>   direção.
> - ❌ **NÃO usa os estados da Fase 2** (`AGUARDANDO_CONFIRMACAO_HUMANA`,
>   `AGUARDANDO_CAPTCHA`) em fluxo — continuam proibidos.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-07-30
> **Base da `main`:** `62de389` — *feat: add status divergence diagnostic*
> **Referências:** `docs/44` (máquina de estados), `docs/45` (`userFacingStatus`),
> `docs/46` (inventário e reordenação da Fase 5), `statusDivergence.ts` e seus
> testes (Fase 5c), `prisma/schema.prisma` (enums `InternalStatus` e
> `OperationalStatus`).

---

## 1. Resumo executivo

**Nenhum dos 6 estados vira `InternalStatus` automaticamente.** A decisão é
**híbrida** (Opção D): 2 estados são candidatos legítimos a canônico, 3
permanecem exclusivamente operacionais, e 1 (`BLOQUEADO`) tem direção dada mas
forma final adiada.

| `OperationalStatus` | Decisão |
|---|---|
| `DOCUMENTO_ENVIADO` | ✅ **Candidato a `InternalStatus`** — `DOCUMENTO_RECEBIDO_PARA_ANALISE` |
| `DOCUMENTO_APROVADO` | ✅ **Candidato a `InternalStatus`** — `DOCUMENTO_VALIDADO` |
| `EM_REVISAO_OPERACIONAL` | ❌ **Permanece operacional** — workflow humano, não jornada |
| `PRONTO_PARA_PROTOCOLO_MANUAL` | ❌ **Permanece operacional** — sinal de fila do operador |
| `BLOQUEADO` | ⚠️ **Direção dada, forma adiada** — nova categoria `BLOQUEADO_OPERACIONAL`, decisão própria antes da 5f |
| `CANCELADO_DEV` | ❌ **Permanece operacional** — cancelamento administrativo/dev, não jornada |

**Consequência para a Fase 5h:** `operationalStatus` **não vai virar projeção
100% derivada**. Mesmo depois de 5e-5g, 3 dos 9 valores (`EM_REVISAO_OPERACIONAL`,
`PRONTO_PARA_PROTOCOLO_MANUAL`, `CANCELADO_DEV`) continuam sendo **escritos
diretamente** em `operationalStatus`, sem `internalStatus` equivalente. Isso
revisa — não reverte — `docs/44 §5.2`: a projeção fica **parcial**, com válvula
de escape para os 3 valores só-operacionais.

---

## 2. Problema

`docs/46 §7` inventariou 6 valores de `OperationalStatus` sem correspondência em
`InternalStatus`, e nomeou isso como a "dependência OCULTA" que forçou a
reordenação da Fase 5. Sem decidir o destino desses 6 estados:

- **5e não tem alvo.** Migrar `uploadProcessDocument` para escrever
  `internalStatus` exige saber PARA QUAL valor — `DOCUMENTO_ENVIADO` não tem
  equivalente hoje.
- **5f não tem alvo (dois deles).** `reviewProcessDocument` escreve
  `DOCUMENTO_APROVADO` e `BLOQUEADO` — nenhum tem candidato aprovado.
- **5g não tem escopo definido.** `updateProcessOperations` aceita os 9 valores;
  sem saber quais têm candidato canônico, não dá para saber o que exatamente
  5g precisa migrar.
- **5h não tem forma.** `docs/44 §5.2` presumia uma projeção total
  (`operationalStatus` inteiramente derivado de `internalStatus`). Se parte dos
  6 estados não tem — e não deveria ter — equivalente canônico, a projeção
  nunca poderia ser total. Continuar sem decidir isso faria 5h ser desenhada
  sobre uma premissa errada.

Decidir tarde não é neutro: cada write novo em `operationalStatus` (ainda que
bloqueado pela trava da 5b para casos NÃO documentados) aumenta o custo de
qualquer migração futura, porque aumenta o número de processos parados nos 6
estados sem destino definido.

---

## 3. O que a 5a/5b/5c provaram

Três achados empíricos, não hipóteses, sustentam esta decisão:

1. **5a (`docs/46`) mediu o desequilíbrio com números.** 5 caminhos de escrita e
   9/9 valores alcançáveis em `operationalStatus`, contra 1 caminho e 2/17 em
   `internalStatus`. Os 6 estados sem equivalente foram nomeados e caracterizados
   (`docs/46 §7`) — mas **sem decidir** o destino, só descrevendo o buraco.
2. **5b (`operationalStatusWrites.test.ts`) provou que os 5 caminhos de escrita
   são exatamente os documentados — nem mais, nem menos.** A trava varre `src/`
   inteiro e falha se aparecer um write novo fora da allowlist. Rodando contra a
   `main` atual (`62de389`), a allowlist continua com exatamente os 5 writes de
   `docs/46 §3` mais o repasse técnico de `transitionInternalStatus` — **nenhum
   caminho novo surgiu** desde o inventário. Isso significa que a superfície
   desta decisão é a mesma que `docs/46` mediu: não cresceu nem encolheu.
3. **5c (`statusDivergence.ts`) provou, caso a caso, que os 6 estados **não** têm
   projeção segura hoje.** O diagnóstico classifica cada um dos 6 como
   `expected_legacy` (só `DOCUMENTO_ENVIADO`) ou `needs_decision` (os outros 5) —
   nunca `none`. Rodei os 6 casos manualmente contra `62de389`:

   | `internalStatus` (RASCUNHO) + `operationalStatus` | `severity` |
   |---|---|
   | `DOCUMENTO_ENVIADO` | `expected_legacy` |
   | `DOCUMENTO_APROVADO` | `needs_decision` |
   | `EM_REVISAO_OPERACIONAL` | `needs_decision` |
   | `PRONTO_PARA_PROTOCOLO_MANUAL` | `needs_decision` |
   | `BLOQUEADO` | `needs_decision` |
   | `CANCELADO_DEV` | `needs_decision` |

   O diagnóstico já **diferenciava** `DOCUMENTO_ENVIADO` dos outros 5 antes desta
   decisão existir — o código previu, de forma independente, a mesma linha de
   corte que a análise qualitativa abaixo confirma. Isso não é coincidência: os
   dois usam o mesmo critério-fonte (`docs/46 §3`/`§7`), mas chegar ao mesmo lugar
   por dois caminhos diferentes (código determinístico e análise humana) é
   evidência a favor da linha de corte, não só repetição dela.

---

## 4. Critérios de decisão

Cada um dos 6 estados foi classificado numa das 5 naturezas abaixo — a
distinção é o que impede "todo estado vira `InternalStatus`" (regra 1 do
enunciado desta fase):

| Natureza | Pergunta que decide | Pertence a `InternalStatus`? |
|---|---|---|
| **Estado da jornada do processo** | O que MUDOU foi um fato sobre o PROCESSO (documento chegou, foi validado)? | Normalmente sim |
| **Estado de trabalho interno da equipe** | O que MUDOU foi só a categorização que UM OPERADOR deu, sem gatilho de domínio? | Não — é metadado de equipe |
| **Bloqueio operacional** | É um "parar" genérico, sem causa estruturada? | Não sem decisão própria (regra 2) |
| **Cancelamento administrativo** | É um "encerrar" de ambiente de dev/operação, não do negócio real? | Não — decisão separada se necessário |
| **Sinal de fila** | Descreve ONDE um humano deveria olhar, não o que o processo é? | Não — `InternalStatus` descreve o processo, não a mesa de trabalho |

Um sinal empírico usado para separar "jornada" de "trabalho da equipe": os
estados com **gatilho codificado** (uma função de domínio decide quando
escrevê-los — `uploadProcessDocument`, `reviewProcessDocument`) tendem a ser
jornada; os estados alcançáveis **só pelo dropdown genérico**
(`updateProcessOperations`, `docs/46 §3.5`) tendem a ser trabalho de equipe,
porque nada no PROCESSO mudou — só a categoria que um humano escolheu.

Regras 2-5 do enunciado desta fase (não mapear `BLOQUEADO` genericamente, não
inverter tempo em `PROTOCOLADO_GRU_GERADA`, não afirmar
reembolso/dev indevidamente, não usar estados da Fase 2) são aplicadas caso a
caso abaixo e reafirmadas na íntegra na §10.

---

## 5. Tabela dos 6 estados

### 5.1 Identidade e situação atual

| `OperationalStatus` | Natureza (§4) | Quem escreve hoje | Quem lê hoje | Impacto em fila/admin |
|---|---|---|---|---|
| `DOCUMENTO_ENVIADO` | Jornada do processo | `uploadProcessDocument` — gatilho: cliente envia documento | Guarda de `reviewProcessDocument` (`=== DOCUMENTO_ENVIADO`); badge/filtro/`<select>` do admin | Aparece na listagem geral; não entra na flag especial da fila (`docs/46 §4.1`) |
| `DOCUMENTO_APROVADO` | Jornada do processo | `reviewProcessDocument` (aprovação) — gatilho: ADMIN/OPERADOR aprova | Badge/filtro/`<select>` do admin | Aparece na listagem geral; não entra na flag especial |
| `EM_REVISAO_OPERACIONAL` | Trabalho da equipe | Só `updateProcessOperations` (dropdown, sem gatilho de domínio) | `getAdminQueue` — **entra** na flag especial junto com `PAGO_EM_FILA` (`docs/46 §4.1`); badge/filtro | **Alto** — processo aparece destacado/priorizado na fila quando neste estado |
| `PRONTO_PARA_PROTOCOLO_MANUAL` | Sinal de fila | Só `updateProcessOperations` | Badge/filtro/`<select>`; nota de UI própria: *"apenas sinaliza a fila: o protocolo no SINARM é feito por humano, fora do app. Nada aqui protocola."* | Médio — sinaliza fila de trabalho do operador, sem ação automática |
| `BLOQUEADO` | Bloqueio operacional | `reviewProcessDocument` (rejeição, gatilho: documento rejeitado) **e** `updateProcessOperations` (dropdown) | `operationalSignals` — dispara sinal `BLOQUEIO_MANUAL`; guardas de `uploadProcessDocument`/`reviewProcessDocument` (`!== CANCELADO_DEV`, indireto) | **Alto** — muda sinalizadores operacionais (`BLOQUEIO_MANUAL`) |
| `CANCELADO_DEV` | Cancelamento administrativo | Só `updateProcessOperations` | `isClosed()` (`operationalSignals`) — é o **único** valor que fecha o processo; guarda de `reviewProcessDocument` (`!== CANCELADO_DEV`) | **Alto** — encerra sinalizadores/SLA (`isClosed()` retorna cedo) |

### 5.2 Decisão por estado

| `OperationalStatus` | `InternalStatus` equivalente hoje? | Deveria virar `InternalStatus`? | Nome canônico sugerido | Risco de perda de informação | Impacto em 5e/5f/5g |
|---|---|---|---|---|---|
| `DOCUMENTO_ENVIADO` | Não | **Sim** | `DOCUMENTO_RECEBIDO_PARA_ANALISE` | Baixo — mapeamento 1:1, sem ambiguidade | **Desbloqueia 5e** — falta só a migration aditiva do enum |
| `DOCUMENTO_APROVADO` | Não | **Sim** (ver §6.2) | `DOCUMENTO_VALIDADO` | Baixo — mapeamento 1:1, mesmo raciocínio de `DOCUMENTO_ENVIADO` | **Desbloqueia metade da 5f** (lado aprovação) |
| `EM_REVISAO_OPERACIONAL` | Não, e não deveria ter | **Não** | — | Médio — sem representação em `internalStatus` durante este estado, mas `operationalStatus` continua sendo a fonte, então não há perda real, só ausência de espelho | **Reduz o escopo da 5g** — este valor não precisa migrar |
| `PRONTO_PARA_PROTOCOLO_MANUAL` | Não, e não deveria ter | **Não** | — | Médio — mesma lógica; risco adicional de conflito conceitual com `manualExecutionStatus` se forçado a existir em dois lugares | **Reduz o escopo da 5g** |
| `BLOQUEADO` | Não (genérico demais) | **Parcial** — nova categoria, forma final adiada | `BLOQUEADO_OPERACIONAL` (proposto; formato exato pendente) | **Alto** — é o risco nomeado em `docs/46 §6`: perde causa, dispara `BLOQUEIO_MANUAL` falso se mapeado errado | **Bloqueia a 5f até PR de decisão próprio** (ver §6.5) |
| `CANCELADO_DEV` | Não, e não deveria ter | **Não** agora | — | Alto se confundido com `CANCELADO_REEMBOLSADO` (regra 4) — por isso NÃO reutilizar aquele valor | **Reduz o escopo da 5g** |

---

## 6. Análise por estado

### 6.1 `DOCUMENTO_ENVIADO` → candidato limpo

Tem gatilho de domínio único e sem ambiguidade: o cliente enviou um documento.
Não exige julgamento humano para decidir a causa (diferente de `BLOQUEADO`), não
inverte tempo, não conflita com nenhum estado existente. É também o único dos 6
que o diagnóstico da 5c classifica como `expected_legacy` — o próprio código já
tratava este caso como qualitativamente mais simples que os outros 5, antes
desta decisão existir (§3).

Migrar `docs/46 §3.2` (`uploadProcessDocument`) pela porta canônica exige que
`DOCUMENTO_RECEBIDO_PARA_ANALISE` (ou nome equivalente) exista no enum — uma
migration **aditiva**, do mesmo tipo que criou `AGUARDANDO_CONFIRMACAO_HUMANA`/
`AGUARDANDO_CAPTCHA` (`docs/44 §6`, PR "feat: add assisted exception states").
Este documento **recomenda** o valor; não o cria.

### 6.2 `DOCUMENTO_APROVADO` → candidato, com alternativa considerada e rejeitada

Duas formas possíveis foram avaliadas:

**Opção considerada: readiness derivado, não estado.** `DocumentStatus.APROVADO`
já existe **por documento** (`prisma/schema.prisma`). `OperationalStatus.DOCUMENTO_APROVADO`
é um rollup **por processo**. Dado que o produto já tem o padrão de sinal
derivado (`operationalSignals.ts`, `automationReadiness.ts` — nenhum dos dois
persiste, ambos computam a partir do que já existe), fazer `DOCUMENTO_APROVADO`
ser um sinal computado (ex.: "todos os documentos obrigatórios têm
`DocumentStatus.APROVADO`") em vez de um valor de estado era uma alternativa
real.

**Por que foi rejeitada aqui:** o sistema atual já trata isso como ESTADO, não
como sinal — a fila filtra por ele, o `<select>` do admin o lista, e
`reviewProcessDocument` já usa `operationalStatus === DOCUMENTO_ENVIADO` como
guarda de transição (comportamento de máquina de estados, não de flag).
Inventar um segundo mecanismo (sinal derivado) para fazer o que um valor de
enum já faz seria duplicar estrutura sem necessidade — o próprio `docs/46 §10`
lista "testes atuais não cobrem equivalência de fila" como risco médio; abrir
uma segunda forma de representar a mesma informação aumentaria esse risco, não
reduziria. **Decisão: estado, não sinal** — mesmo raciocínio 1:1 de
`DOCUMENTO_ENVIADO`, nome sugerido `DOCUMENTO_VALIDADO` (evita reusar o nome
literal do `OperationalStatus`, para não confundir os dois enums na leitura de
código).

### 6.3 `EM_REVISAO_OPERACIONAL` → trabalho da equipe, não jornada

Único gatilho: o dropdown genérico (`docs/46 §3.5`). Nenhuma função de domínio
decide quando este valor é atingido — é inteiramente a critério de quem está
operando. **Entra na flag especial da fila** (`docs/46 §4.1`), o que reforça a
leitura: é um estado sobre **prioridade de atenção da equipe**, não sobre o que
o processo é. `docs/46 §7` já registrava que colide com `EM_REVISAO_HUMANA`
(pausa de exceção da **automação**, coisa distinta) — canonizar este valor
correria o risco de a leitura de `internalStatus` confundir "equipe está de
olho nisso" com "a automação parou aqui por um motivo tipado". São conceitos
diferentes; forçá-los na mesma coluna perde a distinção. **Decisão: permanece
só operacional.**

### 6.4 `PRONTO_PARA_PROTOCOLO_MANUAL` → sinal de fila, sobreposto a `manualExecutionStatus`

`docs/46 §7` já nomeava a razão: "descreve a equipe, não o processo". A própria
UI confirma isso em texto visível ao operador — *"apenas sinaliza a fila... Nada
aqui protocola"* (`page.tsx`, card "Operação"). Além disso, este valor só existe
porque a automação real ainda não roda: é o sinal de "vá fazer isso manualmente
fora do app", e `manualExecutionStatus` **já é o campo dedicado** a rastrear
exatamente esse trabalho manual, com granularidade maior
(`GOVBR_ABERTO_PELO_OPERADOR`, `PROTOCOLO_MANUAL_REGISTRADO`, etc. —
`prisma/schema.prisma`). Criar um `InternalStatus` para "pronto para
protocolar" arriscaria duplicar, com granularidade pior, o que
`manualExecutionStatus` já expressa melhor. `docs/44 §5.3` já planeja migrar a
semântica de `manualExecutionStatus` para "eventos/tarefas" no futuro — se um
conceito de jornada equivalente a "pronto para o ato final" for necessário
depois, ele deveria nascer **daquela** evolução, não de um valor avulso aqui.
**Decisão: permanece só operacional.**

### 6.5 `BLOQUEADO` → direção dada, forma final adiada (regra 2)

A regra 2 desta fase proíbe mapear `BLOQUEADO` automaticamente para
`BLOQUEADO_INSTABILIDADE` ou qualquer `EXCECAO_*` — e a proibição continua
valendo integralmente aqui. Mas "não decidir o mapeamento" não é o mesmo que
"não decidir a forma": os dois grupos de causa são estruturalmente diferentes.

- `BLOQUEADO_INSTABILIDADE`/`EXCECAO_*` (`InternalStatus`, já existentes):
  pausas **decididas pela automação**, com causa já tipada pelo próprio sistema.
- `BLOQUEADO` (`OperationalStatus`, hoje): bloqueio **decidido por um humano**
  — via rejeição de documento (`docs/46 §3.4`) ou via dropdown (`§3.5`) — sem
  causa estruturada nenhuma.

Reutilizar um dos quatro valores automáticos para representar um bloqueio
humano **afirmaria uma causa que ninguém verificou** — exatamente o risco que
`docs/46 §6` nomeia ("dispara `BLOQUEIO_MANUAL` sem que humano tenha
bloqueado", só que invertido: aqui seria o oposto, fingir causa automática onde
houve decisão humana). A saída estruturalmente correta é uma **categoria nova**,
não uma reutilização: `BLOQUEADO_OPERACIONAL` — bloqueio decidido por humano,
distinto de exceção automática.

**O que fica decidido agora:** a existência da categoria e sua distinção das
exceções automáticas.
**O que fica pendente:** se o motivo do bloqueio vira campo estruturado (novo)
ou continua em nota livre (`note`, já suportado por `recordStatusEvent` —
mecanismo existente, não novo). Essa escolha é **decisão própria**, exigida
antes da 5f poder migrar o lado `BLOQUEADO` de `reviewProcessDocument`. O lado
`DOCUMENTO_APROVADO` da 5f (§6.2) não depende dessa decisão e pode avançar
independente.

### 6.6 `CANCELADO_DEV` → cancelamento administrativo, não jornada do negócio

O próprio schema já documenta a natureza: *"Cancelamento em ambiente de
desenvolvimento (não é reembolso real)"*. Regra 4 desta fase proíbe usar
`CANCELADO_REEMBOLSADO` (`InternalStatus` real, para reembolso de verdade) para
representar isso — fazer isso afirmaria reembolso onde não houve, exatamente o
risco que `docs/46 §6` já nomeia. Como o próprio valor é rotulado como
ferramenta de ambiente de desenvolvimento, não como conceito de negócio
permanente, não há um "candidato correto" óbvio a propor — e propor um agora
seria decidir algo que ninguém pediu ainda. Se um conceito real de
"cancelamento administrativo" (distinto de reembolso) for necessário no
produto, é decisão **separada e futura**, não consequência automática deste
documento. **Decisão: permanece só operacional; sem candidato proposto.**

---

## 7. Opções consideradas

| Opção | Descrição | Por que não foi a escolha integral |
|---|---|---|
| **A — Tudo vira `InternalStatus`** | Os 6 estados ganham valor canônico | Misturaria jornada do processo com metadado de equipe (`EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL`) e cancelamento de dev (`CANCELADO_DEV`) na mesma coluna que hoje representa GovBR/SINARM/PF — transformaria o canônico em "fila admin com outro nome" |
| **B — Nada vira `InternalStatus`** | Workflow humano continua só em `operationalStatus` | Deixaria `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO` sem representação canônica indefinidamente, apesar de serem estados de jornada legítimos e de baixo risco — adiar sem necessidade |
| **C — Estrutura separada (`humanWorkflowStatus`)** | Um campo novo, dedicado, para os estados de trabalho de equipe | Prematuro agora: só 3 valores (`EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL`, `CANCELADO_DEV`) ficariam órfãos, e criar campo+schema+migration para 3 valores é desproporcional. **Fica registrada como direção futura plausível** (§8) se o papel duplo de `operationalStatus` — parte projeção, parte trabalho de equipe — se tornar confuso o bastante para justificar |
| **D — Híbrido** | Cada estado avaliado pela sua natureza (§4); alguns migram, outros não, um fica parcialmente decidido | **Escolhida.** É a única opção que trata `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO` (jornada) diferente de `EM_REVISAO_OPERACIONAL`/`PRONTO_PARA_PROTOCOLO_MANUAL`/`CANCELADO_DEV` (equipe/sinal/administrativo) — a distinção que a Opção A apaga e a Opção B ignora |

**Decisão: Opção D**, com a Opção C registrada como evolução futura possível
para o papel residual de `operationalStatus` (§8).

---

## 8. Decisão recomendada

1. **`DOCUMENTO_ENVIADO` e `DOCUMENTO_APROVADO` são candidatos aprovados** a
   novos valores de `InternalStatus` — nomes sugeridos
   `DOCUMENTO_RECEBIDO_PARA_ANALISE` e `DOCUMENTO_VALIDADO`. A criação real do
   enum é migration aditiva, **fora deste documento**, mesma natureza da Fase 2
   (`docs/44 §6`).
2. **`EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL` e `CANCELADO_DEV`
   permanecem exclusivamente em `operationalStatus`.** Não há candidato a
   `InternalStatus` para nenhum dos três, e não é esperado que exista — são
   metadado de equipe, sinal de fila e cancelamento administrativo,
   respectivamente, não estados da jornada do processo.
3. **`BLOQUEADO` tem direção estrutural aprovada** (nova categoria
   `BLOQUEADO_OPERACIONAL`, nunca reutilizar exceções automáticas), **mas forma
   final fica para PR de decisão próprio** antes da 5f poder migrar o lado
   `BLOQUEADO` de `reviewProcessDocument`.
4. **`operationalStatus` não vai virar projeção 100% derivada.** Isto revisa
   `docs/44 §5.2`: a projeção da 5h será **parcial**, cobrindo os valores com
   `InternalStatus` equivalente (os 3 seguros de sempre + os 2 novos + `BLOQUEADO`
   quando decidido) e mantendo escrita direta para os 3 valores só-operacionais.
   `operationalStatus` continua existindo além da 5h — não por falta de
   decisão, mas porque parte do que ele representa **nunca deveria** estar no
   canônico.
5. **A Opção C (`humanWorkflowStatus` separado) fica registrada, não
   descartada**, como evolução futura se o papel duplo de `operationalStatus`
   (parte projeção, parte trabalho de equipe) se tornar confuso o suficiente
   para justificar uma estrutura própria.

---

## 9. Impacto nas fases 5e/5f/5g/5h

| Fase | Antes desta decisão | Depois desta decisão |
|---|---|---|
| **5e** (`uploadProcessDocument`) | Sem alvo — `DOCUMENTO_ENVIADO` não tinha candidato | **Desbloqueada em direção**, pendente só da migration aditiva que cria `DOCUMENTO_RECEBIDO_PARA_ANALISE` |
| **5f** (`reviewProcessDocument`) | Sem alvo nos dois lados (`DOCUMENTO_APROVADO`, `BLOQUEADO`) | **Lado aprovação desbloqueado** (pendente da mesma migration); **lado `BLOQUEADO` continua bloqueado** até PR de decisão próprio (§6.5) |
| **5g** (`updateProcessOperations`) | Escopo presumido: migrar os 9 valores | **Escopo reduzido a 6** (os 3 seguros + os 2 novos + `BLOQUEADO` quando decidido) — `EM_REVISAO_OPERACIONAL`, `PRONTO_PARA_PROTOCOLO_MANUAL` e `CANCELADO_DEV` **não migram**, continuam escritos direto |
| **5h** (projeção) | Presumida total (`docs/44 §5.2`) | **Revisada para parcial** — projeção cobre o que tem `InternalStatus` equivalente; os 3 valores só-operacionais continuam com escrita direta e testes de equivalência próprios para esse subconjunto |

---

## 10. Estados que não devem ser usados

- **`AGUARDANDO_CONFIRMACAO_HUMANA` e `AGUARDANDO_CAPTCHA`** (Fase 2,
  `docs/44 §6`) — continuam **sem consumidor real** e **proibidos em fluxo**.
  Esta decisão não os afeta e não os libera.
- **`BLOQUEADO_INSTABILIDADE`, `EXCECAO_DOC_INVALIDO`, `EXCECAO_ARMA_DIVERGENTE`,
  `EXCECAO_DESTINO_INCOMPLETO`** não devem ser usados para representar
  `BLOQUEADO` — regra 2, reafirmada (§6.5).
- **`PRONTO_PARA_PROTOCOLO_MANUAL`** não pode virar `PROTOCOLADO_GRU_GERADA` nem
  o inverso — regra 3, reafirmada (`docs/46 §6`: "inverte o tempo").
- **`CANCELADO_REEMBOLSADO`** não deve ser usado para `CANCELADO_DEV`, e
  `CANCELADO_DEV` não deve afirmar reembolso — regra 4, reafirmada (§6.6).
- **`DOCUMENTO_RECEBIDO_PARA_ANALISE`, `DOCUMENTO_VALIDADO` e
  `BLOQUEADO_OPERACIONAL`** são **nomes recomendados, não valores existentes** —
  não aparecem no schema até uma migration aditiva própria os criar.

---

## 11. O que fica proibido

- ❌ Criar enum neste PR.
- ❌ Criar migration neste PR.
- ❌ Alterar `schema.prisma`.
- ❌ Alterar código de produto.
- ❌ Alterar testes.
- ❌ Alterar fila, filtros ou `getAdminQueue`.
- ❌ Alterar permissões.
- ❌ Alterar UI do admin ou do cliente.
- ❌ Criar `operationalFromInternalStatus` ou qualquer mapa
  `operationalStatus → internalStatus`.
- ❌ Criar mapa reverso `internalStatus → operationalStatus` para uso
  operacional (a tabela do `statusDivergence.ts`, Fase 5c, continua sendo
  diagnóstico, não fonte).
- ❌ Fechar gate de `docs/26 §19`.
- ❌ Tocar Gov.br/SINARM/PF.
- ❌ Usar `db:push`.
- ❌ Usar os estados da Fase 2 em fluxo.

---

## 12. Próximos PRs

| Ordem | PR | Natureza | Depende de |
|---|---|---|---|
| 1 | Migration aditiva: `DOCUMENTO_RECEBIDO_PARA_ANALISE` e `DOCUMENTO_VALIDADO` em `InternalStatus` | migration aditiva | Este documento |
| 2 | **5e** — migrar `uploadProcessDocument` pela porta canônica | código | PR 1 |
| 3 | **5f (parcial)** — migrar o lado aprovação de `reviewProcessDocument` | código | PR 1 |
| 4 | Decisão própria: forma final de `BLOQUEADO_OPERACIONAL` (motivo estruturado vs. nota livre) | docs | Este documento (§6.5) |
| 5 | **5f (completa)** — migrar o lado `BLOQUEADO` de `reviewProcessDocument` | código | PR 4 + migration aditiva de `BLOQUEADO_OPERACIONAL` |
| 6 | **5g** — migrar `updateProcessOperations` para o escopo reduzido (§9) | código | PRs 2, 3, 5 |
| 7 | **5h** — projeção parcial de `operationalStatus` + testes de equivalência de fila | código + testes | PRs 2, 3, 5, 6 |

> Nenhum destes PRs está aprovado por este documento — são o **próximo passo
> proposto**, na mesma lógica de `docs/44 §11`: registro de ordem, não
> autorização de execução.

> **Atualização (2026-08-02).** PRs 2, 3, 5, 6 e **7 (5h)** desta tabela foram
> implementados. A 5h entregou a projeção **PARCIAL** prevista no §9 acima —
> `operationalStatusProjection.ts` (6 pares canônicos) + testes de equivalência
> (`operationalProjectionEquivalence.test.ts`) — sem tornar `operationalStatus`
> derivado universal: os 3 valores só-operacionais (`docs/49` categorias B/C)
> continuam com escrita direta, como esta decisão já previa. `DOCUMENTO_ENVIADO`
> e `DOCUMENTO_APROVADO` ganharam ações explícitas próprias (`docs/50 §5/§6`) e
> saíram do dropdown manual. **Execução real continua bloqueada**
> (`PHASE9_REAL_EXECUTION_ENABLED = false as const`).

---

## 13. Checklist de segurança

- `PHASE9_REAL_EXECUTION_ENABLED` permanece **`false as const`**.
- `docs/26 §19` **inalterado** — gates 1, 2, 3 e 5 seguem **abertos**.
- **Execução real segue bloqueada.**
- Sem código, sem testes, sem migration, sem schema, sem enum.
- Sem UI, sem fila, sem permissões, sem readiness.
- Sem schedule, sem heartbeat, sem OCR real.
- Sem Gov.br/SINARM/PF, sem credenciais, cookies ou tokens.
- Sem `db:push`.
- Sem mapa `internalStatus → operationalStatus` para uso operacional.
- Sem mapa `operationalStatus → internalStatus`.
- Sem projeção criada.
- Estados da Fase 2 não usados em fluxo.

---

> **Fecho.** Este documento **decide** o destino dos 6 estados operacionais sem
> equivalente canônico: 2 migram, 3 permanecem operacionais, 1 tem direção
> parcial. Ele não implementa, não altera código, não altera schema, não cria
> migration, não fecha gate e não autoriza execução real. Regras permanentes
> (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
