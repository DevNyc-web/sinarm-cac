# 60 — Decisão estratégica: SaaS automatizado-first e UX principal do cliente

> **O que é este documento.** O registro da **decisão estratégica oficial do
> produto**: o SINARM-CAC será lançado como **SaaS automatizado-first**, não
> como MVP assistido/manual permanente; suporte humano é **exceção**, não motor;
> cliente comum e admin/equipe interna são **perfis distintos**; cliente novo é
> guiado por uma **tela simples de escolha de processo**, não por uma lista
> vazia de "Meus processos"; e cada processo tem um **número interno próprio do
> site** para suporte, consulta e auditoria.
>
> **O que este documento NÃO faz:**
>
> - ❌ **NÃO altera** código, UI, rotas, auth, testes, schema, enum ou migration.
> - ❌ **NÃO implementa** número interno, tela de escolha de processo nem login separado.
> - ❌ **NÃO cria** automação real, fila, worker, OCR ou schedule.
> - ❌ **NÃO toca** Gov.br/SINARM/PF.
> - ❌ **NÃO fecha** a Fase 1 e **NÃO abre** a Fase 2 como execução real.
> - ❌ **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED` e **NÃO fecha gate.**
>
> **Data:** 2026-08-04
> **Base da `main`:** `b29901f` — *docs: fill documentation index gap*
> **Referências:** [`docs/25`](25-visao-automacao-e-decisoes-negocio.md) (visão
> de automação e decisões de negócio), [`docs/26`](26-arquitetura-automacao-hibrida.md)
> (arquitetura híbrida e gates do §19), [`docs/32`](32-decisao-gate-juridico-automacao.md)
> (gate jurídico validado), [`docs/24`](24-revisao-ux-textos-conformidade.md)
> (linguagem, avisos obrigatórios, jargão proibido),
> [`docs/37`](37-fase-8d-log-seguro-e-relatorio.md) (log seguro/redação),
> [`docs/15`](15-decisoes-fase-0.md) (bloqueios de fase),
> `prisma/schema.prisma` (`Process.code`), `src/server/auth/permissions.ts`
> (RBAC), `src/server/automation/phase9/safety.ts` (flag).

---

## 1. Status da decisão

| Campo | Valor |
|-------|-------|
| Data | 2026-08-04 |
| `main` | `b29901f` |
| Tipo | **Decisão estratégica de produto + UX** — orienta todos os PRs seguintes |
| Escopo | Documentação apenas |
| Execução real | **BLOQUEADA** — `PHASE9_REAL_EXECUTION_ENABLED` segue `false as const` |
| Fase 1 | **Final, mas NÃO encerrada** |
| Fase 2 | **NÃO aberta como execução real** |

**Decisão em uma linha:** o produto é um **SaaS automatizado-first** — o cliente
comum conclui o fluxo principal sozinho, guiado por uma tela de **escolha de
processo** em linguagem simples, com cada processo identificado por um **número
interno do site**; admin/equipe interna é um perfil **separado**, com entrada
própria e permissões RBAC; **suporte humano só entra por exceção**, nunca como
etapa obrigatória do caminho feliz.

---

## 2. Contexto verificado no código (`main` `b29901f`)

Registrado para separar **o que já existe** do **o que esta decisão ainda pede**
— evitando que um PR futuro reimplemente algo pronto.

| Fato verificado | Onde | Consequência para esta decisão |
|---|---|---|
| `Process.code` **já existe** como coluna real, `String @unique` | `prisma/schema.prisma:104` | O número interno **não precisa de campo novo nem migration** — a coluna já é única |
| O código é gerado como `GT-DEV-${uuid.slice(0,8).toUpperCase()}` | `src/server/services/createGuiaTrafegoDraft.ts:23-25` | Formato atual é **de desenvolvimento**, aleatório e com prefixo por tipo. A pendência real é **formato estável**, não existência do campo |
| O cliente **já vê** o código no dashboard e no detalhe do processo | `src/app/(user)/dashboard/page.tsx:112`; `src/app/(user)/processos/[id]/page.tsx:120` | "Exibir ao cliente" **já está atendido** |
| O admin **já consulta/filtra** processo por código | `src/app/(admin)/admin/processos/page.tsx:68,83`; `processRepository.ts` (`listAdminQueue`, filtro `code contains`) | "Admin consulta por número interno" **já está atendido** |
| Existe `ClientStartPanel` com duas densidades e o ramo `semPedidos` | `src/components/client/ClientStartPanel.tsx`; `src/app/(user)/dashboard/page.tsx:28` | O produto **já distingue** cliente novo de cliente com processos — mas entrega **boas-vindas + primeiros passos**, **não** uma tela de escolha de processo |
| A entrada é **única** hoje: só `/login` público, sem área de acesso separada | `src/app/(public)/login`; `src/app/(admin)/*` e `src/app/(user)/*` são grupos de rota, não entradas distintas | A separação de entrada cliente/admin é **decisão nova**, ainda não implementada |
| RBAC já existe, com `USER: []` (nenhuma permissão interna) e ADMIN com todas | `src/server/auth/permissions.ts` (`PERMISSIONS`, `ROLE_PERMISSIONS`) | "Cliente não vê tela administrativa" **já é garantido por permissão**, não precisa de mecanismo novo |
| Central de ajuda pública já existe (`/ajuda`), linkada do painel do cliente | `src/app/(public)/ajuda`; `ClientStartPanel.tsx` (`HelpCard`) | A "aba de ajuda visível" **já existe** — a pendência é o **conteúdo** (vídeo, linguagem simples) |
| `PHASE9_REAL_EXECUTION_ENABLED = false as const` | `src/server/automation/phase9/safety.ts:32` | Execução real segue inerte, sem exceção |

### 2.1 O que isso muda no pedido original

O pedido tratava o número interno como algo a criar. **A coluna já existe, é
única, já é exibida ao cliente e já é consultável pelo admin.** O que falta é
**apenas o formato** (`GT-DEV-…` aleatório → algo estável e comunicável). Isso
reduz o PR técnico futuro de "criar identificador" para "trocar o gerador" —
sem migration, sem campo novo.

---

## 3. Estratégia do produto — automatizado-first

| # | Decisão |
|---|---|
| 3.1 | O produto **não será lançado como MVP assistido/manual**. O modo assistido atual (Fase 7, `docs/22`) é **etapa de construção**, não o produto final. |
| 3.2 | O lançamento ocorre como **SaaS automatizado-first**. |
| 3.3 | O **cliente comum deve conseguir usar o fluxo principal sozinho**, do início ao fim, sem depender de contato humano. |
| 3.4 | **Suporte humano é exceção**, não motor principal. Nenhuma etapa do caminho feliz pode exigir intervenção humana para concluir. |
| 3.5 | **Não é sistema oficial** Gov.br/SINARM/PF — mantém-se a regra permanente do `docs/00 §8` (não parecer órgão oficial, não usar identidade visual oficial). |
| 3.6 | **Não promete aprovação/deferimento** — regra permanente, sem exceção de copy. |
| 3.7 | **Não é despachante manual por trás.** O modelo não é "humano fazendo escondido enquanto a tela finge automação". |

> **Nota de coerência.** 3.7 **não invalida** a Fase 7 (execução assistida
> manual, `docs/21`/`docs/22`), que é honesta sobre o que faz: o app **registra**
> trabalho humano feito fora dele, com trilha auditável. A decisão é sobre o
> **destino**: esse modo é andaime, não o produto lançado.

---

## 4. Tipos de usuário

Existem **pelo menos dois perfis principais**:

| Perfil | Usa o sistema para |
|---|---|
| **Cliente comum** | Iniciar processo, acompanhar, pagar, anexar documentos e confirmar informações |
| **Admin / equipe interna** | Consulta, auditoria, exceções, diagnóstico, financeiro e suporte |

Decisões:

| # | Decisão |
|---|---|
| 4.1 | Permissões internas continuam baseadas em **RBAC/permissions** (`src/server/auth/permissions.ts`) — nenhum mecanismo paralelo de autorização. |
| 4.2 | **O cliente não deve ver telas administrativas** — em nenhuma superfície, nem parcialmente, nem "só leitura". |
| 4.3 | **Admin não deve ser confundido com fluxo de cliente**: a jornada interna e a jornada do cliente são produtos distintos dentro do mesmo sistema. |
| 4.4 | O perfil interno pode ter subdivisões (OPERADOR, FINANCEIRO, SUPORTE, ADMIN — já existentes); esta decisão **não altera** a matriz nem cria papel novo. |

---

## 5. Login e entrada

| # | Decisão |
|---|---|
| 5.1 | A experiência deve **separar claramente** acesso de cliente e acesso administrativo. |
| 5.2 | A separação pode ser **visual/UX** ou **por rota/área** — **a decisão técnica fica para depois**, em PR próprio. |
| 5.3 | A decisão de **agora** é apenas esta: **cliente e admin não devem ter a mesma experiência de entrada.** |
| 5.4 | Esta decisão **não cria** login separado, não altera `/login`, não altera auth e não altera rotas. |

> **Estado atual (verificado):** hoje existe **uma única** entrada pública
> (`/login`), sem distinção de experiência. A separação é, portanto, **mudança
> futura**, não descrição do que já existe.

---

## 6. Cliente novo — sem processos

| # | Decisão |
|---|---|
| 6.1 | Se o cliente **nunca criou processo no site**, ele **não deve cair primeiro** em uma tela centrada em "Meus processos". |
| 6.2 | A tela principal deve **perguntar**, em linguagem direta: **"Qual processo você deseja realizar?"** |
| 6.3 | Deve exibir **opções simples de escolha de processo** — poucas, nomeadas em linguagem do cliente (§8). |
| 6.4 | Deve ter **acesso visível a uma aba/área de ajuda**. |
| 6.5 | A ajuda deve priorizar **vídeos tutoriais e linguagem simples**. |
| 6.6 | **Evitar excesso de texto** — o cliente escolhe, não estuda. |

> **Relação com o que já existe.** O `ClientStartPanel` (variante `full`) já
> ocupa esse espaço com boas-vindas + "Primeiros passos" + card de ajuda, e o
> dashboard já ramifica por `semPedidos`. A **estrutura de ramificação já
> existe**; o que muda é o **conteúdo do ramo do cliente novo**: de "boas-vindas
> e passos" para **"escolha do processo"**. O PR técnico futuro deve **evoluir
> esse componente**, não criar um segundo caminho paralelo.

---

## 7. Cliente com processos

| # | Decisão |
|---|---|
| 7.1 | Depois que o cliente criou **pelo menos um processo**, a área **"Meus processos" passa a fazer sentido** como destaque. |
| 7.2 | "Meus processos" deve **listar os processos do cliente**. |
| 7.3 | Cada item deve mostrar: **número interno do site**, **data de entrada**, **status simples** e **botão de consulta**. |
| 7.4 | **Protocolo externo só aparece quando existir** — nunca campo vazio, nunca placeholder que sugira protocolo inexistente. |

> Coerência com decisões já vigentes: o status exibido continua sendo o
> **status voltado ao cliente** em linguagem simples (`docs/45`, `docs/24`),
> nunca `internalStatus` cru; e avisos de cancelamento seguem `docs/56`/`docs/58`.

---

## 8. Número interno do processo

| # | Decisão |
|---|---|
| 8.1 | Cada processo criado no site **recebe um número interno próprio**. |
| 8.2 | Esse número é **diferente** de protocolo Gov/SINARM/PF — nunca apresentado como protocolo oficial. |
| 8.3 | Objetivo: **consulta, suporte, auditoria e comunicação com o cliente**. |
| 8.4 | **Exemplo de formato futuro aceitável:** `CAC-2026-000001`. |
| 8.5 | O **formato exato fica para PR técnico separado** — este documento não o define. |
| 8.6 | O número interno **deve ser único**. |
| 8.7 | Deve ser **exibido para cliente e admin**. |
| 8.8 | O admin deve **conseguir consultar processo por esse número**. |

### 8.1 O que já está atendido (verificado)

| Item | Situação |
|---|---|
| 8.1 (existe) | ✅ `Process.code` |
| 8.6 (único) | ✅ `@unique` no schema |
| 8.7 (exibido) | ✅ cliente (dashboard + detalhe) e admin (fila + detalhe) |
| 8.8 (consulta admin) | ✅ filtro por código na fila admin |
| 8.4/8.5 (formato) | ⏳ **única pendência real** — hoje `GT-DEV-XXXXXXXX`, aleatório e marcado como dev |

**Consequência:** o PR técnico futuro é uma **troca de gerador de formato**, não
criação de identificador. Sem migration, sem coluna nova, sem alteração de
schema. O PR deve tratar **explicitamente** o que fazer com processos já
existentes com código `GT-DEV-…` (manter como estão vs. renumerar) — decisão que
**não** é tomada aqui.

---

## 9. Linguagem simples dos processos

Nomes técnicos **não são o foco para o cliente**. Nomes amigáveis registrados:

| Nome amigável (cliente) |
|---|
| "Tirar ou renovar meu CR" |
| "Comprar uma arma ou produto controlado" |
| "Emitir documento da arma" |
| "Emitir Guia de Tráfego" |
| "Acompanhar meus processos" |

| # | Decisão |
|---|---|
| 9.1 | Por baixo, o sistema **pode manter códigos técnicos** (ex.: `GUIA_TRAFEGO_PF_CAC`) — a camada interna não muda. |
| 9.2 | A **interface do cliente usa linguagem simples**, sempre. |
| 9.3 | Esta lista é **vocabulário de produto**, não catálogo implementado: registrar um nome amigável **não** significa que o processo existe ou está disponível hoje (o único processo do MVP continua sendo a Guia de Tráfego, `docs/10`). |
| 9.4 | Continua valendo `docs/24`: sem jargão de dev, sem status cru, sem erro técnico exposto ao cliente. |

---

## 10. Exceções — quando o humano entra

O caminho feliz é automático. As exceções abaixo são as **únicas** portas de
entrada do humano, e cada uma tem regra própria.

### 10.1 Documento ilegível

| # | Decisão |
|---|---|
| 10.1.1 | Documento ilegível **não vai para suporte inicialmente**. |
| 10.1.2 | O sistema **avisa o cliente**. |
| 10.1.3 | O cliente **anexa imagem/documento melhor**. |
| 10.1.4 | Suporte **só entra em exceção ou falha persistente**. |

### 10.2 Falha da automação

| # | Decisão |
|---|---|
| 10.2.1 | Se a automação **não conseguir concluir**, o sistema **registra log técnico**. |
| 10.2.2 | O log indica **onde falhou** e **por que não conseguiu concluir**. |
| 10.2.3 | O log é **seguro**: sem credenciais, cookies, tokens ou PII desnecessária. |
| 10.2.4 | Suporte pode entrar **depois da falha diagnosticada** — não antes, não no lugar do diagnóstico. |

> **Reuso obrigatório:** a redação/máscara de log já existe e já foi decidida —
> `labRedaction` da Fase 8D (`docs/37`), adotada também pela infra da Fase 9
> (`docs/00 §7`, rebase de 2026-07-25). Nenhum PR futuro deve escrever
> sanitização própria.

### 10.3 Pedido de suporte

| # | Decisão |
|---|---|
| 10.3.1 | Se **o cliente pedir suporte**, suporte **pode entrar**. |
| 10.3.2 | Suporte continua **exceção**, não fluxo principal — o pedido do cliente abre a porta, não redefine o produto. |

### 10.4 Mudança de fluxo Gov/SINARM/PF

| # | Decisão |
|---|---|
| 10.4.1 | Mudança de fluxo Gov/SINARM/PF **não deve virar operação manual permanente**. |
| 10.4.2 | O sistema deve ser **ajustado em até 7 dias**. |
| 10.4.3 | Enquanto não ajustado, o fluxo afetado pode ser **pausado, sinalizado ou bloqueado com segurança**. |
| 10.4.4 | "Pausar com segurança" significa: **não** prometer prazo ao cliente, **não** cobrar por algo que não pode ser entregue, **não** deixar o processo em estado ambíguo. |

### 10.5 Ações irreversíveis

Exemplo canônico: **Gerar GRU** (`docs/00 §5.1` — "Gerar GRU e Salvar" é
irreversível: protocola, gera PDF e cria protocolo).

| # | Decisão |
|---|---|
| 10.5.1 | O sistema **executa sozinho após confirmação do cliente**. |
| 10.5.2 | **Antes** da ação, o sistema mostra um **resumo claro** das informações. |
| 10.5.3 | O **cliente confirma**. |
| 10.5.4 | **Depois** da confirmação, o sistema executa. |
| 10.5.5 | **Suporte humano não deve ser confirmação obrigatória.** |
| 10.5.6 | Toda ação irreversível gera **log/auditoria** (§13). |

> **Isto não libera nada hoje.** A execução real de qualquer ato irreversível
> em Gov.br/SINARM/PF continua bloqueada pelos gates do `docs/26 §19` e pela
> flag `PHASE9_REAL_EXECUTION_ENABLED = false`. §10.5 descreve **como deverá
> ser quando for liberado**, não uma autorização.

---

## 11. Fases oficiais do produto

| Fase | Nome | Escopo |
|---|---|---|
| **Fase 1** | **Base do SaaS** | Cadastro, auth, permissões, processos, documentos, pagamento, status, auditoria, segurança, dashboard, admin, cancelamento, financeiro, documentação e decisões de UX base |
| **Fase 2** | **Motor de automação** | Fila, worker, Playwright/lab, checkpoints, logs de erro, retomada, validação automática, resumo para cliente confirmar e execução segura |
| **Fase 3** | **Gates de execução real** | Gov.br/SINARM/PF real **só depois** de gates técnicos, jurídicos, segurança, logs, operação e revisão aprovados |
| **Fase 4** | **Lançamento SaaS automatizado** | Cliente usa o fluxo principal sozinho; suporte humano apenas por exceção |
| **Fase 5** | **Escala** | Métricas, SLA, planos, cobrança recorrente, expansão de processos, monitoramento e manutenção de mudanças Gov/SINARM/PF em até 7 dias |

### 11.1 Mapeamento com a numeração técnica já usada no repositório

**Atenção — dois esquemas de numeração coexistem.** A documentação existente
(`docs/00`, `docs/14`–`docs/36`) usa **fases técnicas de implementação 1–9**. As
**Fases oficiais 1–5** acima são de **produto**, e **não** substituem nem
renumeram aquelas. Para evitar leitura errada:

| Fase oficial (produto) | Corresponde a (fases técnicas já documentadas) |
|---|---|
| Fase 1 — Base do SaaS | Fases técnicas **1 a 7** (`docs/16`–`docs/22`) + os blocos de cancelamento/financeiro/UX (`docs/44`–`docs/59`) |
| Fase 2 — Motor de automação | Fase técnica **8** (laboratório sintético, `docs/27`–`docs/30`, `docs/37`) + o motor ainda não construído |
| Fase 3 — Gates de execução real | Fase técnica **9** e os **gates do `docs/26 §19`** (`docs/33`–`docs/36`, `docs/40`, `docs/41`) |
| Fase 4 — Lançamento | Sem correspondente técnico ainda |
| Fase 5 — Escala | Sem correspondente técnico ainda |

**Regra de leitura:** ao escrever "Fase N", indicar sempre se é **fase oficial
de produto** ou **fase técnica**. "Fase 2 não está aberta" (produto) **não** é a
mesma afirmação que "Fase 9 está bloqueada" (técnica) — mas ambas são
verdadeiras hoje.

---

## 12. Estado atual

| # | Registro |
|---|---|
| 12.1 | O projeto está no **final da Fase 1 (oficial)** — mas a **Fase 1 ainda NÃO está encerrada**. |
| 12.2 | Falta transformar estas decisões em **checklist** e, depois, em **implementação UX/técnica**. |
| 12.3 | A **Fase 2 ainda NÃO deve abrir execução real**. |
| 12.4 | **`PHASE9_REAL_EXECUTION_ENABLED` continua `false`** (`src/server/automation/phase9/safety.ts:32`, `false as const`). |
| 12.5 | Os **gates do `docs/26 §19`** e os **bloqueios de fase do `docs/15`** seguem íntegros. |
| 12.6 | As **12 pendências de produção/piloto do `docs/23 §5`** continuam abertas — este documento não fecha nenhuma. |

---

## 13. Consequência prática

O que muda no dia a dia dos próximos PRs:

| # | Consequência |
|---|---|
| 13.1 | **Novas features devem favorecer automação.** Uma proposta que só funciona com humano no meio precisa justificar por que não pode ser automática. |
| 13.2 | **Fluxos manuais devem ser rejeitados ou marcados explicitamente como exceção** — nunca aceitos como caminho padrão sem rótulo. |
| 13.3 | **Suporte humano não deve compensar fluxo incompleto.** "O suporte resolve" não é resposta de design. |
| 13.4 | **Toda ação irreversível** exige **resumo + confirmação do cliente + log/auditoria**. |
| 13.5 | **Toda falha de automação** exige **log seguro e rastreável** (sem credencial/cookie/token/PII desnecessária), reusando `labRedaction` (`docs/37`). |
| 13.6 | **Cliente novo é guiado por escolha de processo**, não por lista vazia. |
| 13.7 | **Admin tem consulta eficiente por número interno** do processo (já existente — manter em qualquer refatoração da fila). |

---

## 14. O que este documento não resolve

- **Não define** o formato final do número interno (§8.5) nem o que fazer com os
  códigos `GT-DEV-…` já gravados.
- **Não define** se a separação de entrada cliente/admin é visual, por rota ou
  por subdomínio (§5.2).
- **Não define** o catálogo real de processos disponíveis — os nomes do §9 são
  vocabulário, não roadmap de escopo.
- **Não define** layout, componentes, textos finais ou wireframe da tela de
  escolha de processo.
- **Não define** arquitetura de fila/worker da Fase 2 (isso é `docs/26`).
- **Não fecha** a Fase 1 nem transforma estas decisões em checklist executável —
  esse é o próximo passo (§15).
- **Não altera** a régua de reembolso (`docs/00 §2`), a política de cancelamento
  (`docs/51`–`docs/58`) nem o relatório financeiro (`docs/59`).

---

## 15. Próximos PRs possíveis

| Ordem | PR | Natureza | Depende de |
|---|---|---|---|
| 1 | **Checklist de encerramento da Fase 1** — traduzir §3–§13 em itens verificáveis, com critério de "feito" | docs | este documento |
| 2 | Formato estável do número interno (`CAC-2026-NNNNNN` ou equivalente) + tratamento dos códigos `GT-DEV-…` legados | decisão + código | este documento (§8) |
| 3 | Tela de escolha de processo para cliente novo — evoluir `ClientStartPanel`/dashboard, sem caminho paralelo | decisão de UX + código | este documento (§6, §9) |
| 4 | Separação de entrada cliente/admin — decidir visual vs. rota, depois implementar | decisão + código | este documento (§5) |
| 5 | Conteúdo da ajuda em linguagem simples/vídeo | conteúdo | este documento (§6.5) |

**Nenhum PR desta tabela está aprovado por este documento** — mesma lógica de
`docs/54 §6`/`docs/55 §6`/`docs/59 §6`. Nenhum deles é pré-requisito de piloto
ou divulgação, e nenhum toca Gov.br/SINARM/PF.

---

## 16. Proibições

- ❌ Implementar tela, rota, componente ou action nesta etapa.
- ❌ Implementar o número interno ou trocar o gerador de código agora.
- ❌ Criar login separado, alterar `/login`, alterar auth ou alterar rotas.
- ❌ Criar migration, alterar Prisma, alterar enum ou usar `db:push`.
- ❌ Alterar testes.
- ❌ Criar automação real, fila, worker, schedule, heartbeat ou OCR real.
- ❌ Usar Playwright fora de `localhost`/laboratório sintético.
- ❌ Tocar Gov.br/SINARM/PF em qualquer forma.
- ❌ Criar reembolso, `registerRefund` ou chamar PSP.
- ❌ Alterar `PHASE9_REAL_EXECUTION_ENABLED` ou qualquer gate.
- ❌ Fechar a Fase 1.
- ❌ Abrir a Fase 2 como execução real.
- ❌ Prometer aprovação, deferimento, prazo ou resultado ao cliente.
- ❌ Expor telas ou dados administrativos ao cliente.
- ❌ Apresentar o número interno como protocolo oficial Gov/SINARM/PF.
- ❌ Renumerar as fases técnicas já documentadas (`docs/14`–`docs/36`) por causa
  das fases oficiais do §11.

---

> **Fecho.** Este documento **decide no papel** a direção do produto: SaaS
> **automatizado-first**, cliente comum concluindo o fluxo principal sozinho,
> suporte humano como **exceção**, perfis de cliente e admin **separados**,
> cliente novo guiado por **escolha de processo**, "Meus processos" como
> destaque **só depois do primeiro processo**, e **número interno próprio** por
> processo — este último já existente no schema, faltando apenas formato. Não
> implementa nada, não altera código/UI/rotas/auth/banco/testes, não toca
> Gov.br/SINARM/PF, não fecha gate e não autoriza execução real. A **Fase 1 está
> no final, mas NÃO encerrada**; a **Fase 2 NÃO abre execução real**;
> `PHASE9_REAL_EXECUTION_ENABLED` continua `false`. Regras permanentes
> (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
