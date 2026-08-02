# 50 — Decisão sobre as ações explícitas de documento

> **O que é este documento.** A decisão sobre o que deve substituir o uso bruto
> de `DOCUMENTO_ENVIADO` e `DOCUMENTO_APROVADO` no dropdown manual/admin —
> categoria A do [`docs/49`](49-decisao-valores-operacionais-restantes.md).
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO cria** nenhuma das duas ações.
> - ❌ **NÃO altera** código, testes, schema, enum ou migration.
> - ❌ **NÃO remove** os dois valores do dropdown.
> - ❌ **NÃO fecha gate** e **NÃO libera execução real.**
>
> **Data:** 2026-08-02
> **Base da `main`:** `b5003d8` — *feat: classify operational-only status divergence*
> **Referências:** `docs/49 §3.1/§3.2` (categoria A), `docs/47 §6.1/§6.2`
> (candidatos canônicos), `docs/11 §14` (revisão de documento).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-02 |
| `main` | `b5003d8` |
| Tipo | **Decisão arquitetural documental** — desenha o que a categoria A exige |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |

**Decisão em uma linha:** as duas ações **não** são "mover status"; são **desfazer
uma revisão** e **registrar uma revisão feita fora do fluxo**. Ambas exigem
motivo, evento tipado e permissão própria, e cada uma é PR próprio. Nada é
implementado agora.

---

## 2. Contexto pós docs/49

`docs/49` classificou os dois como **categoria A**: têm candidato canônico
(`DOCUMENTO_RECEBIDO_PARA_ANALISE`, `DOCUMENTO_VALIDADO`), o fluxo natural já
migrou, mas a porta manual **não deve** migrar automaticamente — migrar
transformaria correção operacional em retrocesso canônico, ou produziria uma
validação sem revisor.

O que `docs/49` deixou em aberto é o que este documento responde: **qual ação
deveria existir no lugar.**

---

## 3. Problema — e ele é maior do que "imprecisão canônica"

O dropdown move **apenas o processo**. O documento tem status próprio
(`ProcessDocument.status`), que a porta manual nunca toca. E
`reviewProcessDocument` recusa revisar de novo:

```
if (document.status === "APROVADO" || document.status === "REJEITADO") {
  return { ok: false, error: "Documento ja revisado." };
}
```

**Consequência concreta, hoje:** um operador que use o dropdown para "reabrir a
conferência" coloca o processo em `DOCUMENTO_ENVIADO` — que é exatamente a
guarda que a aprovação exige — mas o **documento continua `APROVADO`**. O fluxo
de revisão então recusa a nova conferência com "Documento já revisado". O
processo diz "aguardando conferência" e ninguém consegue conferir.

Ou seja: **o caminho do dropdown já é um beco sem saída**, não apenas uma
imprecisão de canônico. A ação explícita não é purismo arquitetural — é a
correção de um estado que o produto sabe produzir e não sabe desfazer.

O caso simétrico é mais simples e igualmente real: marcar `DOCUMENTO_APROVADO`
pelo dropdown **não registra revisor nenhum** (`reviewedByMockUserId`,
`reviewedByRole`, `reviewedAt` ficam como estavam), e o documento continua no
status anterior. A fila avança sobre uma aprovação que ninguém assinou.

---

## 4. Opções consideradas

| # | Opção | Veredito |
|---|---|---|
| 1 | Migrar a linha do dropdown para a porta canônica | ❌ Rejeitada em `docs/49`: falsifica a jornada e não resolve o documento travado |
| 2 | **Ações explícitas próprias**, dropdown segue legado até existirem | ✅ **Decidida** |
| 3 | Remover os dois valores do dropdown assim que as ações existirem | ⏳ Estado final desejável, mas é decisão de produto/UI própria (§8) |
| 4 | Não fazer nada | ❌ Deixa o beco sem saída do §3 em pé |

---

## 5. `DOCUMENTO_ENVIADO` → ação "reabrir conferência documental"

**Significado decidido:** *desfazer uma revisão já feita*, para que a equipe possa
conferir de novo. **Não** é "corrigir o status exibido sem mexer na jornada" — é
justamente essa leitura que produz o beco sem saída do §3.

A ação futura deve:

| Requisito | Decisão |
|---|---|
| `internalStatus` | → `DOCUMENTO_RECEBIDO_PARA_ANALISE`, pela porta canônica |
| `operationalStatus` | → `DOCUMENTO_ENVIADO`, via `alsoSet` |
| **Status do documento** | → de volta a `ENVIADO`. **Sem isto a ação é inútil**: o fluxo de revisão continuaria recusando |
| Motivo | **Obrigatório** — está desfazendo uma decisão humana |
| Evento | **Tipado**, com o motivo em `note` (mesmo padrão da rejeição, `docs/48`) |
| `reviewedBy*` / `reviewedAt` | **Limpar no documento.** Eles descrevem a revisão ATUAL, que deixou de existir. O histórico de quem revisou fica na trilha append-only, que é o lugar dele |
| Permissão | **Própria**, não reuso de `document.review` |
| Superfície | **Botão explícito** no documento, com confirmação — nunca valor de dropdown |

**Ressalva honesta sobre o histórico:** a trilha só tem evento tipado de
aprovação desde a Fase 5f. Documentos aprovados **antes** disso não têm evento
correspondente — reabrir um deles apaga do documento a única marca de quem
revisou. O PR da ação precisa decidir se isso é aceitável ou se exige um evento
de compensação registrando os valores anteriores.

---

## 6. `DOCUMENTO_APROVADO` → ação "registrar aprovação feita fora do fluxo"

**Significado decidido:** *registrar que a conferência aconteceu por outro canal*
— não "forçar aprovação administrativa" como atalho de rotina. A diferença
importa: a ação assume um revisor real, apenas não o formulário de revisão.

A ação futura deve:

| Requisito | Decisão |
|---|---|
| `internalStatus` | → `DOCUMENTO_VALIDADO`, pela porta canônica |
| `operationalStatus` | → `DOCUMENTO_APROVADO`, via `alsoSet` |
| **Status do documento** | → `APROVADO`. O processo não pode dizer "aprovado" com o documento em outro estado |
| Motivo | **Obrigatório** — precisa dizer onde a conferência aconteceu |
| Evento | **Tipado**, com o motivo em `note` |
| Revisor | **Obrigatório**: `reviewedByMockUserId`/`reviewedByRole` recebem o ator, `reviewedAt` recebe o agora. **É a ausência disso que torna o dropdown inaceitável hoje** |
| Documento já revisado | **Recusar**, como `reviewProcessDocument` já faz. Sobrescrever aprovação existente é outra ação, não esta |
| Permissão | **Própria**, não reuso de `document.review` |
| Superfície | **Botão explícito**, nunca valor de dropdown |

---

## 7. Por que permissão própria nos dois casos

O repositório já fixou esse critério ao criar `extraction.run`
(`permissions.ts`): *"Permissao PROPRIA de proposito: reusar `document.review`
… daria execucao de extracao a quem so pediu para conferir documento — e a
matriz deixaria de responder 'quem pode acionar extracao?'"*.

Vale igual aqui: hoje **ADMIN e OPERADOR têm as duas permissões**
(`document.review` e `process.operationalStatus`), então a ação explícita não
fica *mais restrita* por acidente — ela fica **auditável**. Sem permissão
própria, a matriz não responde "quem pode desfazer uma aprovação?".

Quais papéis recebem cada permissão é decisão do PR de implementação.

---

## 8. Impacto em `updateProcessOperations`

**Nenhum agora.** Os dois valores continuam na linha dinâmica legada, junto com
os outros três (`docs/49` categoria B/C).

Quando as ações existirem, abre-se a pergunta da opção 3: **remover os dois
valores do dropdown**, deixando só as ações. Isso é mudança de comportamento e
de UI — decisão própria, não consequência automática deste documento. Enquanto
os valores existirem no dropdown, o beco sem saída do §3 continua alcançável.

---

## 9. Impacto em `statusDivergence`

**Nenhum agora — `expected_legacy` continua correto** para os dois, e as razões
atuais já nomeiam as duas origens (dado antigo **ou** dropdown vivo).

Quando as ações existirem, elas passam pela porta canônica e produzem os pares
seguros já registrados (`severity: none`). Aí as razões de `expected_legacy`
devem ser reescritas para citar **só dado antigo** — a cláusula "OU escrita do
dropdown" deixa de valer se a opção 3 for adotada. É a mesma manutenção de
precisão que `BLOQUEADO` exigiu no `docs/48`/#82.

---

## 10. O que este documento não faz

- **Não implementa** nenhuma das duas ações.
- **Não decide os papéis** de cada permissão nova.
- **Não decide o caso do histórico pré-5f** (§5, ressalva).
- **Não decide sobrescrever aprovação existente** — ficou explicitamente fora
  da ação do §6.
- **Não remove** valor nenhum do dropdown.
- **Não toca** `reviewProcessDocument`, `processDocumentRepository`,
  `updateProcessOperations` nem `statusDivergence`.

---

## 11. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|-------|----|----------|------------|
| 1 | Ação "reabrir conferência documental" — inclui reset do status do documento | código + permissão | este documento |
| 2 | Ação "registrar aprovação fora do fluxo" | código + permissão | este documento |
| 3 | Remover `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO` do dropdown | código + UI | 1 e 2 |
| 4 | Reescrever as razões de `expected_legacy` (só dado antigo) | código | 3 |

Nenhum destes é pré-requisito de piloto ou divulgação — isso segue dependendo
das pendências de `docs/23 §5`.

---

## 12. Proibições

- ❌ Implementar as ações como mapeamento de valor de dropdown.
- ❌ Reusar `document.review` como permissão das ações novas.
- ❌ Mover o processo sem mover o documento (ou vice-versa).
- ❌ Registrar aprovação sem revisor.
- ❌ Desfazer revisão sem motivo.
- ❌ Migrar a linha dinâmica de `updateProcessOperations` para esses valores.
- ❌ Fechar gate de `docs/26 §19`.

---

> **Fecho.** Este documento **decide no papel**. Não implementa ação nenhuma, não
> altera código, não remove valor do dropdown, não fecha gate e não autoriza
> execução real. Regras permanentes (`docs/00 §8`) e bloqueios de fase
> (`docs/15`) seguem íntegros.
