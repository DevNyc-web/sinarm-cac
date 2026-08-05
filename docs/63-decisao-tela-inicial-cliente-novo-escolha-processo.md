# 63 — Decisão: tela inicial do cliente novo — escolha de processo

> **O que é este documento.** A **decisão e o plano** para a tela inicial do
> cliente **novo, sem processos**: em vez de cair numa lista vazia de "Meus
> processos", ele encontra uma pergunta direta — **"Qual processo você deseja
> realizar?"** — com opções simples, nomes amigáveis e ajuda visível. Resolve o
> bloco **B** do [`docs/61 §4.B`](61-checklist-encerramento-fase-1-base-do-saas.md)
> no nível de **decisão**, e detalha o PR técnico futuro.
>
> **Este documento decide; não implementa.**
>
> - ❌ **NÃO altera** código, UI, rotas, auth, banco, Prisma, migration ou testes.
> - ❌ **NÃO fecha** o bloco B — B só é marcado concluído depois do PR técnico.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2 como execução real.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-04
> **Base da `main`:** `a93d958` — *feat: add friendly process code format*
> **Referências:** [`docs/60 §6`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (cliente novo sem processos), [`docs/60 §7`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (cliente com processos), [`docs/60 §9`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (nomes amigáveis), [`docs/60 §10`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (exceções — quando o humano entra), [`docs/61 §4.B`](61-checklist-encerramento-fase-1-base-do-saas.md)
> (o bloco pendente), [`docs/62`](62-decisao-formato-numero-interno-processo.md)
> (número interno `CAC-YYYY-NNNNNN`), [`docs/24`](24-revisao-ux-textos-conformidade.md)
> (linguagem e conformidade), [`docs/25`](25-visao-automacao-e-decisoes-negocio.md)
> (catálogo dos 4 processos de lançamento), [`docs/45`](45-decisao-user-facing-status.md)
> (status voltado ao cliente), [`docs/10`](10-mvp-guia-de-trafego.md) (Guia de
> Tráfego como único fluxo real).

---

## 1. Status da decisão

| # | Registro |
|---|---|
| 1.1 | **Decisão tomada** — a tela inicial do cliente novo passa a ser uma **escolha de processo**, não uma lista vazia. |
| 1.2 | **Implementação NÃO feita aqui.** Este documento é docs-only. |
| 1.3 | Resolve **B.1–B.5** do `docs/61 §4.B` **no nível de decisão/plano**. |
| 1.4 | **O bloco B continua aberto** até o PR técnico ser mergeado (§9). |
| 1.5 | A **condição `docs/61 §5.4`** ("cliente novo tiver entrada clara") **ainda não** está satisfeita — decidir não é implementar. |
| 1.6 | Toca também o bloco **C** (nomes amigáveis) por dependência: a tela de escolha **precisa** de labels de cliente (§5). O bloco C segue com PR próprio. |

---

## 2. Contexto verificado no código (`main` `a93d958`)

Inspeção feita antes de decidir. Nada abaixo foi alterado.

| # | O que existe hoje | Onde |
|---|---|---|
| 2.1 | Dashboard do cliente com H1 fixo **"Meus processos"** e CTA "Nova solicitação" na primeira dobra, **igual para todos** | `src/app/(user)/dashboard/page.tsx` |
| 2.2 | Ramificação por ausência de processos: `semPedidos = !dbUnavailable && processes.length === 0` | `dashboard/page.tsx` |
| 2.3 | Banco fora do ar **não** conta como "sem pedidos" — degrada com aviso em vez de mostrar a jornada de quem começa | `dashboard/page.tsx` |
| 2.4 | `ClientStartPanel` com duas densidades: `full` (sem pedidos) e `compact` (com pedidos) | `src/components/client/ClientStartPanel.tsx` |
| 2.5 | Conteúdo do painel em módulo **puro**: `ONBOARDING_STEPS` (4 passos), `TRUST_NOTES`, `OFFICIAL_STEPS_NOTICE`, `greetingFor` | `src/server/support/clientOnboarding.ts` |
| 2.6 | Catálogo dos 4 processos de lançamento, com dependência lógica, GRU e requisitos | `src/server/processes/processCatalog.ts` |
| 2.7 | Regra de disponibilidade **já pura e centralizada**: `AVAILABLE_PROCESS_CODES = ["GUIA_TRAFEGO"]`; os demais caem em `EM_PREPARACAO` | `src/server/processes/processAvailability.ts` |
| 2.8 | Escolha de processo já renderizada — porém dentro de `/processos/novo`, **depois** do CTA, com foco operacional (GRU, ordem lógica, contagem de requisitos) | `src/components/processes/ProcessTypeSelection.tsx` |
| 2.9 | Separação nome de produto × código persistido já existe (`GUIA_TRAFEGO` ↔ `GUIA_TRAFEGO_PF_CAC`) | `src/server/processes/processTypeMapping.ts` |
| 2.10 | Ajuda pública `/ajuda` com seção de **vídeos tutoriais** (`#videos`) e catálogo de 5 vídeos, todos `url: null` → botão "Em breve" | `src/app/(public)/ajuda/page.tsx`, `src/server/support/tutorialVideos.ts` |
| 2.11 | `HelpCard` do painel do cliente já linka `/ajuda` e `/ajuda#suporte` | `ClientStartPanel.tsx` |
| 2.12 | Número interno amigável `CAC-YYYY-NNNNNN` já implementado e exibido na lista | `src/server/processes/processCode.ts`; `docs/62` |

### 2.1 Diagnóstico — o que falta de fato

O cliente novo hoje encontra, nesta ordem: **H1 "Meus processos"** → card da
conta → boas-vindas e "Primeiros passos" → card de documentos → `EmptyState`
**"Nenhum processo ainda"**.

| Elemento | Situação |
|---|---|
| Ramificação por cliente sem processos | ✅ **já existe** (`semPedidos` + variantes do painel) |
| Regra de disponível vs. em preparação | ✅ **já existe** e é pura |
| Ajuda com vídeos | ✅ **já existe** como estrutura (links pendentes de gravação) |
| Pergunta "Qual processo você deseja realizar?" | ❌ **não existe** |
| Escolha de processo na **entrada** | ❌ existe só **dentro** de `/processos/novo` |
| Nomes amigáveis ao cliente | ❌ o catálogo usa nomes regulatórios ("Emissão de CRAF") |
| "Meus processos" **não** ser o foco do cliente novo | ❌ é o H1 da página, para todos |

**Consequência:** o PR técnico futuro é **troca de conteúdo do ramo já
existente** e **elevação da escolha de processo** para a entrada — não é criar
ramificação nova, nem regra de disponibilidade nova, nem página de ajuda nova.

---

## 3. Decisão principal

| # | Decisão |
|---|---|
| 3.1 | Cliente novo **sem nenhum processo** é direcionado para uma **tela/área inicial simples de escolha de processo**. |
| 3.2 | Ele **não** cai primeiro numa lista vazia de "Meus processos". |
| 3.3 | A pergunta de abertura é **"Qual processo você deseja realizar?"**. |
| 3.4 | Isso **evolui** o `ClientStartPanel`/dashboard existentes — **sem criar um segundo caminho paralelo** (`docs/60 §6`). |
| 3.5 | A ramificação continua sendo a **já existente** (`semPedidos`), inclusive a regra de que **banco indisponível não é "sem processos"** (§2.3). |

---

## 4. Experiência desejada

A tela do cliente novo deve ter:

| # | Elemento |
|---|---|
| 4.1 | **Título claro:** "Qual processo você deseja realizar?" |
| 4.2 | **Cards/opções simples** — poucas, escaneáveis, sem tabela de atributos. |
| 4.3 | **Nomes amigáveis** (§5), não nomes regulatórios. |
| 4.4 | **Explicação curta** por opção — uma frase, não parágrafo. |
| 4.5 | **Indicação do que está disponível agora.** |
| 4.6 | **Indicação do que está em preparação.** |
| 4.7 | **Ajuda visível** na própria tela, não escondida em rodapé. |
| 4.8 | **Prioridade para vídeos tutoriais** (§7). |
| 4.9 | **Pouco texto** — o cliente escolhe, não estuda (`docs/60 §6.6`). |

> **O que NÃO vai nesta tela.** Taxa de GRU, contagem de requisitos
> documentais, "ordem lógica passo N de 4" e "cadastro inicial exigido" são
> informação **operacional**: úteis dentro do fluxo (`/processos/novo`),
> ruído na pergunta de entrada. A tela de escolha responde "qual", não "como".

---

## 5. Processos e nomes amigáveis

Nome **amigável** (o que o cliente lê) é coisa distinta de **código técnico**
(o que o sistema guarda). A separação já existe no código (§2.9) e **não muda**.

| Nome amigável (cliente) | Código de catálogo | Código persistido |
|---|---|---|
| "Tirar ou renovar meu CR" | `CONCESSAO_CR` | — (não semeado) |
| "Comprar arma ou produto controlado" | `AUTORIZACAO_COMPRA` | — (não semeado) |
| "Emitir documento da arma" | `EMISSAO_CRAF` | — (não semeado) |
| "Emitir Guia de Tráfego" | `GUIA_TRAFEGO` | `GUIA_TRAFEGO_PF_CAC` |
| "Acompanhar meus processos" | — (não é processo) | — |

| # | Decisão |
|---|---|
| 5.1 | A interface do cliente usa **sempre** o nome amigável. |
| 5.2 | O sistema **mantém** os códigos técnicos internamente — camada interna não muda (`docs/60 §9.1`). |
| 5.3 | "Acompanhar meus processos" **não é um processo**: é a entrada para "Meus processos". Aparece como opção de navegação, nunca como algo criável. |
| 5.4 | Esta lista é **vocabulário de produto**, não catálogo implementado (`docs/60 §9.3`) — nomear não cria fluxo. |
| 5.5 | Continua valendo `docs/24`: sem jargão de dev, sem status cru, sem erro técnico exposto ao cliente. |

> **Relação com o bloco C.** O bloco C (`docs/61 §4.C`) cobre as labels em
> **todo** o produto. Este documento registra o vocabulário **da tela de
> escolha**; a revisão completa segue no PR próprio de C.

---

## 6. Disponibilidade

| # | Decisão |
|---|---|
| 6.1 | **Apenas processos realmente criáveis** aparecem como disponíveis. Hoje: **só a Guia de Tráfego** (`docs/10`, `processAvailability.ts`). |
| 6.2 | Processos em preparação **podem aparecer**, marcados como "em preparação", **sem CTA de criação**. |
| 6.3 | **Não prometer prazo** — nada de "em breve", "no próximo mês", data. |
| 6.4 | **Não prometer aprovação** — a decisão é do órgão competente (`docs/24`). |
| 6.5 | **Não confundir preparação documental com execução real:** reunir e conferir documentos no nosso sistema **não** é protocolo, não é envio ao órgão e não é execução. |
| 6.6 | A regra de disponibilidade continua **uma só**, na camada pura já existente — a tela **lê** a regra, não a duplica. |

> **Por que mostrar o que não está disponível.** Esconder os outros três
> processos faria o cliente concluir que não os atendemos. Mostrá-los sem CTA
> informa o escopo sem prometer nada. Se, no PR técnico, a versão sem CTA
> ainda parecer promessa, a alternativa aceitável é **omitir** — nunca criar
> CTA falso.

---

## 7. Ajuda

| # | Decisão |
|---|---|
| 7.1 | A área de ajuda é **visível na tela de escolha**, não só no rodapé ou no menu. |
| 7.2 | **Vídeos tutoriais têm prioridade** sobre texto. |
| 7.3 | Texto de apoio é **curto**. |
| 7.4 | A ajuda **não é atendimento manual obrigatório** — não é fila, não é formulário de chamado, não é etapa do fluxo. |
| 7.5 | **Suporte humano continua exceção**, conforme `docs/60 §10`. |
| 7.6 | A rota `/ajuda` e a seção `#videos` **já existem** — a mudança é de **destaque e conexão**, não criação de página. |
| 7.7 | Vídeo sem link publicado continua marcado como indisponível. **Nunca** link falso ou placeholder navegável (regra já vigente em `tutorialVideos.ts`). |
| 7.8 | Continua proibido apontar para canal, vídeo ou marca de órgão público, ou produzir algo que passe por canal oficial (`docs/24 §5/§7/§14`). |

> **Relação com o bloco E.** O bloco E (`docs/61 §4.E`) define a **estrutura
> mínima da ajuda** como um todo, em documento próprio. Aqui decide-se apenas
> **como a ajuda aparece na entrada do cliente novo**.

---

## 8. Cliente com processos

| # | Decisão |
|---|---|
| 8.1 | A partir do **primeiro processo**, "Meus processos" passa a ser o **destaque** da entrada. |
| 8.2 | Cada item mostra: **número interno** (`CAC-YYYY-NNNNNN`, `docs/62`), **data**, **status simples** e **botão para consultar**. |
| 8.3 | O botão para **iniciar novo processo continua disponível** — nunca some. |
| 8.4 | O status exibido continua sendo o **status voltado ao cliente** em linguagem simples (`docs/45`, `docs/24`), nunca `internalStatus` cru. |
| 8.5 | **Protocolo externo só aparece quando existir** — nunca campo vazio nem placeholder que sugira protocolo inexistente (`docs/60 §7.4`). |
| 8.6 | Avisos de cancelamento seguem `docs/56`/`docs/58` — este documento **não** os altera. |
| 8.7 | A densidade `compact` do painel (cliente que já usa o produto) **continua existindo** e não é substituída pela tela de escolha. |

> **8.1–8.5 já estão majoritariamente atendidos hoje** (a lista mostra código,
> data, status voltado ao cliente e link "Continuar"). Ficam registrados como
> **não regressão**: o PR técnico não pode degradar o ramo de quem já tem
> processos ao melhorar o ramo de quem não tem.

### 8.1 Lista vazia — onde ela fica

| # | Decisão |
|---|---|
| 8.1.1 | "Meus processos" **não é o foco inicial** do cliente novo. |
| 8.1.2 | Sem processos, a tela **prioriza começar um processo**. |
| 8.1.3 | A lista vazia **pode existir como informação secundária** — abaixo da escolha, discreta — mas **não** como experiência principal. |
| 8.1.4 | O estado de **falha ao carregar** (`dbUnavailable`) continua distinto de "sem processos" e continua visível — esconder falha de carregamento seria mentir sobre o estado da conta. |

---

## 9. Relação com a Fase 1

| # | Registro |
|---|---|
| 9.1 | Este documento cria a **decisão/plano** do bloco **B** (`docs/61 §4.B`). |
| 9.2 | **NÃO conclui o bloco B.** |
| 9.3 | B só pode ser marcado concluído **depois do PR técnico de UI** (§10). |
| 9.4 | A **Fase 1 NÃO é encerrada** aqui. |
| 9.5 | A condição `docs/61 §5.4` **continua não satisfeita** — ela exige entrada clara **implementada**, não decidida. |
| 9.6 | [`docs/close-phase-1-foundation`](61-checklist-encerramento-fase-1-base-do-saas.md) continua sendo o **único** fechamento futuro da Fase 1. |
| 9.7 | Os blocos **C–H** do `docs/61 §4` seguem integralmente abertos. |

> **Diferença em relação ao bloco A.** O bloco A pôde ser fechado porque sua
> condição (`§5.6`) exige **decisão**. A condição de B (`§5.4`) exige **entrada
> clara para o cliente novo** — isso é comportamento observável, e só um PR de
> UI o entrega. Por isso B **não** fecha com um documento.

---

## 10. PR técnico futuro sugerido

**Sugestão, não execução.** Nada aqui é aprovado por este documento.

Branch sugerida: **`feat/client-start-process-selection`** (o PR 3 do
`docs/61 §7`).

Escopo provável:

| # | Item |
|---|---|
| 10.1 | Ajustar o `ClientStartPanel` (variante `full`) ou componente equivalente — **evoluir**, não duplicar. |
| 10.2 | Melhorar o dashboard para o ramo **sem processos**, incluindo o H1 hoje fixo em "Meus processos". |
| 10.3 | Mostrar **cards de escolha de processo** na entrada, lendo a disponibilidade da camada pura já existente. |
| 10.4 | Usar **nomes amigáveis** (§5), com o mapeamento nome ↔ código em módulo puro. |
| 10.5 | Mostrar **ajuda visível**, com vídeos em destaque, apontando para `/ajuda#videos`. |
| 10.6 | Manter "Meus processos" como foco **apenas quando houver processos**. |
| 10.7 | **Adicionar/ajustar testes** — `tests/unit/components/clientStartPanel.test.ts` e o que mais o PR tocar. |

Arquivos provavelmente tocados (levantamento, não compromisso):

- `src/app/(user)/dashboard/page.tsx`
- `src/components/client/ClientStartPanel.tsx`
- `src/server/support/clientOnboarding.ts`
- módulo puro novo ou ampliado para os nomes amigáveis do cliente
- `src/server/processes/processAvailability.ts` (leitura; alteração só se necessária)
- `tests/unit/components/clientStartPanel.test.ts`

Restrições do PR técnico futuro:

- sem migration, sem alteração de Prisma, sem `db:push`;
- sem rota nova (a entrada continua sendo `/dashboard`), salvo decisão posterior;
- sem tocar auth ou RBAC;
- sem tocar Gov.br/SINARM/PF;
- sem alterar `PHASE9_REAL_EXECUTION_ENABLED`.

---

## 11. Relação com a automação-first

| # | Registro |
|---|---|
| 11.1 | A tela deve **guiar o cliente a usar sozinho** — o caminho feliz é ele escolher e seguir. |
| 11.2 | A tela **não empurra** o cliente para o suporte. |
| 11.3 | Suporte aparece **apenas como exceção ou pedido do cliente** (`docs/60 §10.3`). |
| 11.4 | Ajuda ≠ atendimento: vídeo e texto curto resolvem antes de existir contato humano. |
| 11.5 | Isso **não** enfraquece as exceções obrigatórias do `docs/60 §10` (documento ilegível, falha de automação, mudança de fluxo Gov/SINARM/PF, ações irreversíveis) — elas continuam acionando humano por regra. |

---

## 12. Relação com a Fase 9

| # | Registro |
|---|---|
| 12.1 | Este documento **não libera execução real**. |
| 12.2 | **Não toca** Gov.br/SINARM/PF. |
| 12.3 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false` em `src/server/automation/phase9/safety.ts`. |
| 12.4 | A **Fase 9 continua bloqueada**, com os gates do `docs/26 §19` íntegros. |
| 12.5 | Escolher um processo na tela inicial **não executa nada** — cria, no máximo, um rascunho no nosso sistema. |

---

## 13. Proibições

Este PR **não**:

- ❌ altera código;
- ❌ altera UI;
- ❌ altera rotas;
- ❌ altera auth;
- ❌ altera banco;
- ❌ cria migration;
- ❌ altera Prisma;
- ❌ altera testes;
- ❌ fecha o bloco B;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ abre execução real;
- ❌ toca Gov.br/SINARM/PF;
- ❌ altera `PHASE9_REAL_EXECUTION_ENABLED`;
- ❌ usa `db:push`.

---

> **Fecho.** O cliente novo passa a ser recebido por uma **pergunta**, não por
> uma lista vazia: "Qual processo você deseja realizar?", com opções em
> linguagem dele, o que está disponível agora separado do que está em
> preparação, e ajuda em vídeo à vista. A ramificação, a regra de
> disponibilidade e a página de ajuda **já existem** — o PR técnico futuro
> troca o **conteúdo** do ramo do cliente novo e eleva a escolha para a
> entrada, sem criar caminho paralelo. **O bloco B NÃO é fechado aqui**, a
> **Fase 1 NÃO é encerrada**, a Fase 2 **NÃO** abre como execução real,
> `PHASE9_REAL_EXECUTION_ENABLED` continua `false` e os gates do `docs/26 §19`
> seguem íntegros.
