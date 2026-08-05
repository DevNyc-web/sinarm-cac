# 67 — Decisão: pagamentos base e GRU administrada internamente (MVP)

> **O que é este documento.** A decisão do **Bloco G** da Fase 1: quais **meios de
> pagamento** o MVP aceita, como o cliente é cobrado, e como a **GRU** (a taxa do
> órgão) é emitida, paga e controlada — **internamente, pela nossa operação**,
> sem o cliente precisar acessar o Banco do Brasil.
>
> **Este documento decide e confirma; não implementa nada.**
>
> - ❌ **NÃO troca, reabre nem reavalia o gateway** — Mercado Pago segue como
>   decidido no [`docs/17`](17-decisao-pix-mvp.md).
> - ❌ **NÃO integra** cartão, boleto, gateway novo nem webhook.
> - ❌ **NÃO cria** a página `/admin/grus`.
> - ❌ **NÃO cria** automação bancária, reembolso, `registerRefund` nem conciliação.
> - ❌ **NÃO altera** código, banco, Prisma, migration, rotas, UI ou testes.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2 como execução real.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `5c37a94` — *docs: decide password account transition (#134)*
> **Referências:** [`docs/61 §4.G`](61-checklist-encerramento-fase-1-base-do-saas.md)
> (o bloco que esta decisão fecha), [`docs/17`](17-decisao-pix-mvp.md) (gateway
> já decidido), [`docs/10 §9`](10-mvp-guia-de-trafego.md) (Pix antes do
> protocolo, preço embute a GRU), [`docs/11 §8`](11-painel-admin-operacao.md)
> (fluxo interno de pagamento) e [`§9`](11-painel-admin-operacao.md) (**pagamento
> manual da GRU pela empresa**), [`docs/54`](54-decisao-politica-reembolso-cancelamento.md)
> (reembolso — fora deste bloco), [`docs/55`](55-decisao-fila-revisao-financeira.md)
> (fila de revisão financeira), [`docs/59`](59-decisao-relatorio-financeiro-cancelados-pagos.md)
> (relatório financeiro read-only), [`docs/24`](24-revisao-ux-textos-conformidade.md)
> (linguagem).

---

## 1. Status da decisão

| # | Registro |
|---|---|
| 1.1 | **Decisão registrada** — meios de pagamento aceitos e estratégia operacional da GRU. |
| 1.2 | **Implementação NÃO feita aqui.** Este documento é docs-only. |
| 1.3 | **Fecha o Bloco G** do `docs/61` no nível de **confirmação** (§9) — que é o que aquele bloco pede. |
| 1.4 | **NÃO fecha a Fase 1.** |
| 1.5 | **NÃO abre a Fase 2.** |
| 1.6 | **NÃO altera a Fase 9** — flag e gates intactos (§10). |
| 1.7 | **NÃO reabre o gateway** decidido no `docs/17` (§3). |

---

## 2. Contexto verificado no código (`main` `5c37a94`)

Inspeção feita **antes** de decidir. Nada abaixo foi alterado — e boa parte
desta decisão **já existe**, o que reduz o escopo do PR técnico futuro em vez
de ampliá-lo.

| # | Situação hoje | Onde |
|---|---|---|
| 2.1 | **A decomposição serviço/GRU JÁ EXISTE**: total R$100, GRU R$20, serviço R$80 | `src/server/processes/pricing.ts` (`SERVICE_TOTAL_CENTS`, `GRU_ESTIMATED_CENTS`, `SERVICE_FEE_CENTS`) |
| 2.2 | O módulo de preço **já registra** que o que o cliente paga a nós **não é** a GRU — ela é taxa do órgão, recolhida pela empresa e embutida no total | cabeçalho de `pricing.ts` |
| 2.3 | **O fluxo de GRU paga pela empresa JÁ ESTÁ DOCUMENTADO** — Financeiro baixa o PDF, paga manualmente, registra comprovante e data, atualiza status | `docs/11 §9` |
| 2.4 | **Os campos de GRU JÁ EXISTEM no schema**, por processo | `ManualExecution`: `gruReference`, `gruDueDate`, `gruAmountCents`, `gruObservation`, `gruRegisteredBy*`/`At`, `gruPaidAt`, `gruPaymentObservation`, `gruPaymentRegisteredBy*` |
| 2.5 | **Gateway já decidido**: Mercado Pago, com adapter implementado | `docs/17 §4`; `src/server/payments/mercadoPagoProvider.ts` |
| 2.6 | A stack de pagamento é **inteiramente Pix hoje** — não há cartão nem boleto em lugar nenhum | `Payment.pixQrCode`/`pixCopyPaste`; busca por `card`/`boleto` em `src/server/payments/`: zero |
| 2.7 | `PaymentStatus` tem 6 estados | `PENDENTE`, `AGUARDANDO_PAGAMENTO`, `PAGO`, `EXPIRADO`, `CANCELADO`, `FALHOU` |
| 2.8 | **Não existe status próprio da GRU** — o estado é inferido de timestamps (`gruRegisteredAt`, `gruPaidAt`) | `ManualExecution` |
| 2.9 | **Não existe tipo de documento para comprovante de GRU** — o registro do pagamento é texto livre | `documentTypes.ts` (só há `COMPROVANTE_ORIGEM_ENDERECO`, que é outra coisa) |
| 2.10 | **Não existe fila/central de GRUs** — a GRU vive dentro do processo, sem visão agregada | nenhuma rota `/admin/grus` |
| 2.11 | **Reembolso continua ausente**: sem `registerRefund`, sem chamada de PSP para estorno | busca em `src/` e `prisma/`: só um comentário declarando a ausência |

> **Consequência para o PR técnico.** O que falta construir é **menor do que
> parece**: a decomposição de preço, os campos da GRU e o fluxo operacional já
> existem. O trabalho novo é **agregação** (a fila `/admin/grus`), **status
> explícito** da GRU, **comprovante como arquivo** e, mais adiante, **cartão**.

---

## 3. Gateway e meios de pagamento

| # | Decisão |
|---|---|
| 3.1 | **Mercado Pago permanece como gateway base**, já decidido no `docs/17` e refletido na implementação existente. |
| 3.2 | **Pix é o meio atual/base do MVP.** |
| 3.3 | **Cartão fica aprovado como meio aceito** para o MVP comercial / fase próxima — **sem implementação neste PR**. |
| 3.4 | **Boleto fica fora do MVP.** |
| 3.5 | **Este PR não troca gateway, não reabre gateway e não integra novo meio de pagamento.** |

### 3.1 Por que boleto fica fora

Não é preferência estética — é custo operacional que o MVP não tem como
absorver:

| Motivo | Efeito |
|---|---|
| **Compensação lenta** | o processo fica parado entre pagar e confirmar, quebrando a expectativa de fluxo rápido |
| **Vencimento** | cria um estado "emitido e não pago" que precisa de cobrança, lembrete e expiração |
| **Inadimplência** | boleto emitido não é receita; gera fila de limpeza que ninguém tem para operar |
| **Suporte** | segunda via, boleto vencido e boleto pago em duplicidade são os campeões de ticket |

Pix e cartão resolvem o mesmo problema com confirmação rápida e sem esses
estados intermediários.

> **Nota sobre cartão.** Aprovar o meio **não** é integrá-lo. A stack de
> pagamento hoje é toda Pix (2.6): `Payment` guarda `pixQrCode`/`pixCopyPaste`, e
> `PaymentStatus` foi desenhado para o ciclo do Pix. Cartão traz estorno,
> chargeback, parcelamento e antifraude — nenhum deles endereçado aqui. **Exige
> PR técnico próprio, com decisão específica antes.**

---

## 4. Cobrança do cliente

| # | Decisão |
|---|---|
| 4.1 | O cliente **paga à nossa plataforma**, nunca ao órgão. |
| 4.2 | O pagamento **pode incluir serviço + valor provisionado da GRU**, quando aplicável. |
| 4.3 | O cliente pode ver **preço único**; internamente o sistema **separa** as parcelas (4.4). |
| 4.4 | Decomposição interna obrigatória: **valor do serviço**, **valor estimado/provisionado da GRU**, **taxas do gateway**, **margem/receita líquida**. |
| 4.5 | O cliente **não precisa pagar a GRU diretamente no Banco do Brasil** no MVP. |
| 4.6 | A linguagem segue `docs/24`: a tela nunca sugere que a nossa cobrança **é** a GRU, nem que somos o órgão. |

> **Estado de 4.4 hoje.** Serviço e GRU **já estão separados** em `pricing.ts`
> (2.1). O que **não** existe ainda é o registro de **taxas do gateway** e de
> **margem líquida** por transação — isso é trabalho do PR técnico, e é o que
> torna o relatório financeiro capaz de responder "quanto sobrou", não só
> "quanto entrou".

---

## 5. A GRU no MVP

| # | Decisão |
|---|---|
| 5.1 | **O cliente não paga a GRU diretamente.** |
| 5.2 | **O cliente não precisa acessar o Banco do Brasil.** |
| 5.3 | O sistema **emite, registra ou organiza** a GRU quando o processo chega à etapa correta. |
| 5.4 | A GRU vai para uma **fila/central administrativa**. |
| 5.5 | **Admin/equipe interna paga manualmente**, no começo. |
| 5.6 | O admin **marca o estado** da GRU (§7). |
| 5.7 | O **comprovante é anexado/registrado no processo**. |
| 5.8 | Isto é **controle operacional interno**, não automação bancária (§8). |

> **Isto formaliza o que o `docs/11 §9` já descrevia** e que o schema já
> suporta em parte (2.3, 2.4). A diferença que este documento introduz é o
> **agrupamento**: hoje a GRU só existe dentro de cada processo; a decisão é que
> ela passe a ter também uma **visão de fila**, porque pagar 40 GRUs abrindo 40
> processos não é operação, é garimpo.

---

## 6. Página futura `/admin/grus`

**Direção registrada. NÃO implementada neste PR.**

Lista as GRUs por processo, com:

| Campo | Origem provável |
|---|---|
| Número interno do processo | `Process.code` (já existe, formato `CAC-YYYY-NNNNNN`) |
| Cliente | `User` |
| Tipo de processo | `ProcessType` |
| Valor da GRU | `gruAmountCents` (já existe) |
| Vencimento, se existir | `gruDueDate` (já existe) |
| Status | **novo** (§7) |
| Link/arquivo da GRU | **novo** |
| Comprovante | **novo** (2.9) |
| Responsável | `gruPaymentRegisteredBy*` (já existe) |
| Data de pagamento | `gruPaidAt` (já existe) |
| Observação interna | `gruObservation` / `gruPaymentObservation` (já existem) |

> **6 dos 11 campos já estão no schema.** O PR técnico dessa página é menor do
> que a lista sugere: falta status explícito, arquivo da GRU e comprovante — o
> resto é exibição do que já se persiste.
>
> **Acesso:** a página é administrativa e deve entrar sob permissão do RBAC
> existente, na linha do `audit.view.financial` que já protege `/admin/financeiro`.
> A permissão exata é decisão do PR técnico.

---

## 7. Status mínimos da GRU

**Nomes conceituais** — não necessariamente enums, e a modelagem final é do PR
técnico:

| Estado | Significado |
|---|---|
| **Pendente** | o processo chegou à etapa, a GRU ainda não foi gerada |
| **Gerada** | a GRU existe e tem referência/valor; ainda não paga |
| **Paga** | pagamento efetuado pela empresa, com comprovante registrado |
| **Vencida** | passou do vencimento sem pagamento — exige ação |
| **Erro** | falha na geração ou divergência de dados |
| **Cancelada** | quando aplicável (ex.: processo cancelado antes do pagamento) |

> **Hoje esse estado é implícito** (2.8), inferido de `gruRegisteredAt` e
> `gruPaidAt`. Estado implícito não distingue "vencida" de "erro" nem de "ainda
> não gerada" — daí a necessidade de torná-lo explícito. **Este documento não
> cria o campo.**

---

## 8. Automação de pagamento no Banco do Brasil

| # | Decisão |
|---|---|
| 8.1 | **Fora do MVP.** |
| 8.2 | **Não integrar agora.** |
| 8.3 | Só estudar **depois das primeiras vendas reais** e com **volume operacional comprovado**. |
| 8.4 | **Nenhum pagamento real automatizado** é executado nesta fase. |

**Requisitos que precisam existir antes de sequer estudar:**

- conta PJ adequada;
- validação jurídica e contábil;
- auditoria;
- **dupla aprovação** ou controle interno equivalente;
- conciliação;
- comprovantes por processo;
- limites de valor;
- **prevenção de pagamento duplicado**;
- tratamento de guia vencida ou errada.

> **Por que a barra é alta.** Automatizar pagamento é a única parte deste
> produto que **move dinheiro nosso sem humano no meio**. Um erro em automação
> de formulário gera retrabalho; um erro em automação bancária gera prejuízo
> direto e irreversível. Vale aqui o mesmo princípio do `docs/25 §7`: o ato
> irreversível é humano até prova em contrário — e "prova" significa volume,
> conciliação e controle, não confiança.

---

## 9. Relação com a Fase 1 e o Bloco G

| # | Registro |
|---|---|
| 9.1 | **Fecha o Bloco G** — G.1–G.6 passam a `[x]`. |
| 9.2 | O Bloco G pede **confirmação**, não construção: G.1–G.3 confirmam o que existe e G.4–G.6 confirmam **ausências intencionais**. Documento é o instrumento correto. |
| 9.3 | **Não marca D, F nem H** — seguem integralmente abertos. |
| 9.4 | **NÃO encerra a Fase 1.** |
| 9.5 | Nenhuma das 9 condições do `docs/61 §5` muda de estado por este documento — G não tem condição própria no §5. |
| 9.6 | `docs/close-phase-1-foundation` segue como o **único** fechamento futuro da Fase 1. |

**O que foi confirmado, item a item:**

| Item | Confirmação |
|---|---|
| G.1 | `Payment` + `PaymentStatus` (6 estados) + `createPixPayment` + `confirmPixPayment` existem e funcionam |
| G.2 | `/admin/financeiro` existe, read-only, sob `audit.view.financial` |
| G.3 | processo cancelado com pagamento entra em revisão financeira (`operationalSignals`, `processRepository`, `getAdminQueue`) |
| G.4 | reembolso **continua ausente** |
| G.5 | `registerRefund` **continua ausente** |
| G.6 | **nenhuma** chamada de PSP para estorno no adapter de pagamentos |

> **O que o fechamento de G NÃO significa.** O Bloco G fecha a **confirmação da
> base atual e das ausências intencionais**. Ele **não** implementa cartão,
> **não** cria `/admin/grus`, **não** cria automação Banco do Brasil, **não**
> cria reembolso, **não** cria conciliação avançada, **não** altera o gateway e
> **não** altera código. A decisão de cartão (§3.3) **amplia** o escopo futuro
> de pagamentos sem invalidar a confirmação de hoje — mesma leitura que o
> `docs/64` fez para os blocos D e F.

---

## 10. Relação com a Fase 9

| # | Registro |
|---|---|
| 10.1 | **Não libera execução real.** |
| 10.2 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false as const`. |
| 10.3 | **Não toca** Gov.br/SINARM/PF. |
| 10.4 | **Não cria** automação bancária, automação Gov, schedule nem heartbeat. |
| 10.5 | Os gates do `docs/26 §19` seguem íntegros. |
| 10.6 | A GRU tratada aqui é **registro operacional interno**. Gerar a GRU no portal continua sendo ato do fluxo assistido, com confirmação humana (`docs/25 §7`). |

---

## 11. Proibições deste PR

Este PR **não**:

- ❌ altera código;
- ❌ implementa pagamento;
- ❌ integra gateway;
- ❌ troca ou reabre o gateway decidido no `docs/17`;
- ❌ implementa cartão;
- ❌ implementa boleto;
- ❌ cria webhook;
- ❌ cria integração com Banco do Brasil;
- ❌ cria a página `/admin/grus`;
- ❌ cria reembolso, `registerRefund` ou conciliação;
- ❌ altera banco;
- ❌ cria migration;
- ❌ altera Prisma;
- ❌ altera UI;
- ❌ altera rotas;
- ❌ altera testes;
- ❌ altera `package.json`;
- ❌ altera a Fase 9;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ usa `db:push`.

---

> **Fecho.** O MVP cobra por **Pix**, via **Mercado Pago** — gateway já decidido
> no `docs/17` e **não reaberto aqui**. **Cartão está aprovado** como meio aceito
> para a fase próxima, **sem implementação**; **boleto fica fora**. O cliente
> paga à plataforma um preço que **já embute a GRU** e que o sistema **já
> decompõe internamente** (`pricing.ts`), e **nunca precisa acessar o Banco do
> Brasil**: a GRU é emitida, organizada e **paga pela nossa operação**, com
> estado explícito, comprovante registrado e uma **fila administrativa futura**
> (`/admin/grus`) que este PR **não constrói**. **Automação bancária fica fora do
> MVP**, condicionada a volume real e a uma lista própria de controles. O
> **Bloco G fecha** no que ele pede — confirmação da base e das ausências
> intencionais —, os blocos **D, F e H seguem abertos**, a **Fase 1 continua NÃO
> encerrada**, a **Fase 2 não abre**, `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false` e os gates do `docs/26 §19` seguem íntegros.
