# 68 — Revisão de segurança, PII, logs e permissões (Bloco F da Fase 1)

> **O que é este documento.** A **revisão** do Bloco F do `docs/61`: need-to-know,
> PII, DTOs, logs, `storageKey`, permissões financeiras, permissões de
> cancelamento e auditoria — sobre o código **como ele está hoje**.
>
> **É revisão, não reescrita.** No espírito do [`docs/41`](41-gate-seguranca-credenciais.md):
> achados são **reportados**, não corrigidos no mesmo PR.
>
> - ❌ **NÃO corrige** código, auth, login, banco, Prisma, migration, rotas, UI ou testes.
> - ❌ **NÃO implementa** captcha, login federado nem rate limit distribuído.
> - ❌ **NÃO fecha** os blocos D e H.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `96b93c1` — *docs: decide payment and GRU admin workflow (#135)*
> **Referências:** [`docs/61 §4.F`](61-checklist-encerramento-fase-1-base-do-saas.md)
> (o bloco revisado), [`docs/41`](41-gate-seguranca-credenciais.md) (gate de
> credenciais e o método "reportar, não corrigir"), [`docs/18 §6`](18-validacao-integrada-fases-1-5.md)
> (DTOs seguros), [`docs/05`](05-logs-auditoria-lgpd.md) (logs, auditoria e
> LGPD), [`docs/11 §3`](11-painel-admin-operacao.md) (matriz de permissões),
> [`docs/64`](64-decisao-login-federado-captcha-rate-limit.md) e
> [`docs/65`](65-decisao-transicao-contas-senha-login-federado.md) (auth futura),
> [`docs/67`](67-decisao-pagamentos-gru-admin-mvp.md) (pagamentos e GRU),
> [`docs/57`](57-decisao-bloqueio-acoes-cliente-cancelado.md) (bloqueio em
> processo cancelado).

---

## 1. Status da revisão

| # | Registro |
|---|---|
| 1.1 | **Revisão registrada.** |
| 1.2 | **Implementação/correção NÃO feita aqui.** Este documento é docs-only. |
| 1.3 | **NÃO fecha a Fase 1 automaticamente** — D e H seguem abertos. |
| 1.4 | **NÃO abre a Fase 2.** |
| 1.5 | **NÃO altera a Fase 9** — flag e gates intactos (§8). |
| 1.6 | **NENHUM achado bloqueante** foi encontrado (§4). |

---

## 2. Escopo revisado

**Documentação:** `docs/00`, `docs/05`, `docs/11 §3`, `docs/18 §6`, `docs/41`,
`docs/57`, `docs/61`, `docs/64`, `docs/65`, `docs/67`.

**Código (lido, não alterado):**

| Área | Arquivos principais |
|---|---|
| Auth / RBAC | `permissions.ts`, `guards.ts`, `roles.ts`, `session.ts`, `sessionToken.ts`, `rateLimit.ts`, `password.ts`, `authenticate.ts`, `config.ts` |
| Repositórios | `userRepository.ts`, `processRepository.ts`, `processDocumentRepository.ts` |
| Services | `uploadProcessDocument.ts`, `confirmPixPayment.ts`, `applyDestinationSuggestion.ts`, `cancelProcess.ts`, `getAdminProcessDetail.ts` |
| Documentos | `documentAccess.ts`, `documentTypes.ts`, `documentExtractionMock.ts` |
| Pagamentos | `adapter.ts`, `fakeProvider.ts`, `mercadoPagoProvider.ts` |
| Rotas | `src/app/api/documents/[documentId]/file/route.ts`, `src/app/(admin)/**`, `src/app/(user)/**` |
| Automação | `automation/redaction.ts`, `automation/phase9/{safety,networkGuard,auditLogger,phase9Runner}.ts` |
| Schema | `prisma/schema.prisma` (`User`, `Process`, `Payment`, `ManualExecution`, `ProcessStatusEvent`) |

---

## 3. Achados confirmados seguros

### 3.1 Permissões e RBAC

| # | Confirmação | Evidência |
|---|---|---|
| 3.1.1 | **Cliente tem zero permissão interna** — `USER: []` por construção | `permissions.ts` |
| 3.1.2 | A matriz é **fonte única**; páginas e services usam `hasPermission`, **nunca comparam `role` na mão** | `guards.ts` |
| 3.1.3 | **Segregação de funções real**: `OPERADOR` não confirma Pix; `FINANCEIRO` não executa SINARM | `ROLE_PERMISSIONS` |
| 3.1.4 | Atos sensíveis têm **permissão própria**, não reusada: `process.cancel`, `document.review.reopen`, `document.review.approveOutOfFlow`, `extraction.run` | `permissions.ts`, com o critério documentado em comentário |
| 3.1.5 | `process.cancel` (irreversível) fica **só com ADMIN** — `OPERADOR` não recebe | `ROLE_PERMISSIONS.OPERADOR` |

### 3.2 PII e need-to-know

| # | Confirmação | Evidência |
|---|---|---|
| 3.2.1 | **Não existe campo de CPF no schema.** `Process` é declaradamente "SEM PII" | `prisma/schema.prisma` |
| 3.2.2 | CPF existe apenas como **conceito de extração**, com valores mock fixos marcados "(exemplo)" | `documentExtractionMock.ts` |
| 3.2.3 | `SUPORTE` recebe `process.pii.viewMinimal`, não `viewFull` | `ROLE_PERMISSIONS.SUPORTE` |
| 3.2.4 | Eventos da trilha carregam **rótulos curtos, sem PII**, por contrato declarado no schema | `ProcessStatusEvent.note` / `fromValue` / `toValue` |

### 3.3 DTOs e fronteira de dados

| # | Confirmação | Evidência |
|---|---|---|
| 3.3.1 | `USER_SELECT` é **explícito** — nunca `select: *` | `userRepository.ts` |
| 3.3.2 | `passwordHash` **só sai** por funções marcadas `...WithSecrets`, consumidas apenas pelo serviço de auth. **A barreira é o tipo**: `AuthUser` não tem o campo | `userRepository.ts`, `types.ts` |
| 3.3.3 | **Permissão na query, não no filtro**: `findProcessByIdForUser`, `findProcessByCodeForUser`, `listProcessesByUser` recebem `userId` e escopam no `where` | `processRepository.ts` |
| 3.3.4 | Todas as telas do cliente usam as funções escopadas por dono | `(user)/dashboard`, `(user)/processos/[id]`, `(user)/processos/novo/sucesso` |
| 3.3.5 | Usuário inativo devolve `null` — desativar em `users.active` derruba o acesso **sem apagar a trilha** (FK `Restrict`) | `findUserById` |

### 3.4 Logs

| # | Confirmação | Evidência |
|---|---|---|
| 3.4.1 | **Zero `console.*` em todo o `src/`** (fora de testes) — não há log ad-hoc capaz de vazar nada | busca em `src/**/*.ts(x)`: nenhuma ocorrência |
| 3.4.2 | `redaction.ts` opera em **duas camadas**: por **chave** (o valor nunca é visitado) e por **conteúdo** (`Bearer`, JWT, `senha=`, `set-cookie`, OTP) | `redaction.ts` |
| 3.4.3 | Senha/OTP/cookie/token **não são mascarados — a chave inteira vira `[REDACTED]`**, o valor não sobrevive | `redaction.ts` |
| 3.4.4 | O módulo **documenta honestamente o que não promete**: segredo em prosa livre, sem par `chave=valor`, continua passando | `redaction.ts` |

### 3.5 Uploads e documentos

| # | Confirmação | Evidência |
|---|---|---|
| 3.5.1 | **`storageKey` não aparece em nenhum arquivo `.tsx`** — zero exposição na UI | busca em `src/**/*.tsx`: nenhuma ocorrência |
| 3.5.2 | Upload é escopado ao dono: `findProcessByIdForUser(processId, actor.id)` | `uploadProcessDocument.ts` |
| 3.5.3 | **Processo encerrado é barrado ANTES de gravar byte** — nenhum arquivo no storage, nenhuma linha criada, nenhum status movido | `uploadProcessDocument.ts`, reusando `isClosed` |
| 3.5.4 | O guard de cancelado vive no **service**, não na UI, e é **o mesmo** usado no pagamento — não há checagem duplicada divergente | `isClosed` em `operationalSignals.ts` |
| 3.5.5 | Limite de 2 MB, `sha256` do conteúdo e nome de arquivo sanitizado | `uploadProcessDocument.ts` |
| 3.5.6 | A rota de arquivo responde **404 igual para inexistente e para não autorizado** — não vira oráculo de existência | `api/documents/[documentId]/file/route.ts` |
| 3.5.7 | O **storage só é tocado depois da autorização**, e `storageKey` não aparece em resposta alguma | mesma rota |
| 3.5.8 | Acesso ao arquivo é decidido por módulo **puro e testável**: revisor autorizado **ou** dono | `documentAccess.ts` |

### 3.6 Pagamentos e financeiro

| # | Confirmação | Evidência |
|---|---|---|
| 3.6.1 | **Payload cru do provedor não chega ao domínio.** O contrato devolve 4 campos: `providerPaymentId`, `pixQrCode`, `pixCopyPaste`, `expiresAt` | `payments/adapter.ts` |
| 3.6.2 | A `description` enviada ao PSP é **documentada como sem PII** (código do processo) | `adapter.ts` |
| 3.6.3 | O provider do Mercado Pago **recusa token que não comece com `TEST-`** — credencial de produção não roda nesta fase | `mercadoPagoProvider.ts` |
| 3.6.4 | Nenhuma credencial no código: token vem de env, com falha clara em runtime se ausente | `mercadoPagoProvider.ts` |
| 3.6.5 | `/admin/financeiro` exige `audit.view.financial` via `requirePermission`, **não** `queue.view` | `(admin)/admin/financeiro/page.tsx` |
| 3.6.6 | O link para o financeiro no painel admin **só renderiza** com a permissão | `(admin)/admin/page.tsx` |
| 3.6.7 | **Reembolso continua ausente** — sem `registerRefund`, sem chamada de PSP para estorno (confirma `docs/61 §4.G`) | busca em `src/` e `prisma/` |

### 3.7 Sessão

| # | Confirmação | Evidência |
|---|---|---|
| 3.7.1 | Token opaco de **256 bits** (CSPRNG), base64url | `sessionToken.ts` |
| 3.7.2 | **O banco guarda apenas o SHA-256** do token — vazamento da tabela `sessions` **não concede sessão** | `sessionToken.ts` |
| 3.7.3 | Cookie assinado com HMAC: adulteração é rejeitada **antes** de consultar o banco | `sessionToken.ts` |
| 3.7.4 | Comparação com `timingSafeEqual` | `sessionToken.ts`, `password.ts` |
| 3.7.5 | Senha com **scrypt** (memory-hard, aceito pela OWASP), formato que guarda o algoritmo — migrar depois não exige reset de senha | `password.ts` |

### 3.8 Phase 9 e automação

| # | Confirmação | Evidência |
|---|---|---|
| 3.8.1 | `PHASE9_REAL_EXECUTION_ENABLED = false as const` — **hard-coded, não ligável por env** | `phase9/safety.ts:32` |
| 3.8.2 | O runner **não abre navegador**, não acessa rede externa e devolve resultado bloqueado | `phase9Runner.ts` |
| 3.8.3 | **Trava dura de rede:** domínios `gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` são bloqueados **mesmo que alguém os coloque na allowlist** | `networkGuard.ts` |
| 3.8.4 | Allowlist default é apenas loopback (`localhost`, `127.0.0.1`) | `networkGuard.ts` |
| 3.8.5 | Playwright da Fase 9 roda **sem `baseURL` real** — cada teste fornece o próprio alvo localhost | `playwright.phase9.config.ts` |
| 3.8.6 | **Não há schedule nem heartbeat** reais no código | busca no repositório |

> **Leitura de 3.8.3.** Essa é a única trava do repositório que protege contra o
> **próprio time**: ela assume que alguém, no futuro, vai tentar adicionar o
> domínio oficial à allowlist sem passar pelo gate — e falha mesmo assim. É o
> padrão certo e vale preservá-lo em qualquer refatoração.

---

## 4. Achados que exigem ação

### 4.1 Bloqueantes

**NENHUM.** Não foi encontrado, nesta revisão, nenhum achado que impeça seguir
para o Bloco D ou que exija correção antes de outro trabalho.

Especificamente, **não** foram encontrados: exposição de `storageKey` na UI,
vazamento de `passwordHash` fora do serviço de auth, consulta sem escopo de dono
na área do cliente, permissão financeira concedida a perfil indevido, log de
credencial, PII persistida sem necessidade, nem qualquer caminho de execução
real de Gov.br/SINARM/PF.

### 4.2 Importantes

| # | Achado | Por quê importa |
|---|---|---|
| **4.2.1** | **`audit.view.all` e `audit.view.own` não têm ponto de aplicação.** Estão na matriz e têm rótulo na UI, mas **nenhuma rota, página ou action as consulta** — só `audit.view.financial` é efetivamente aplicada. Além disso, **não existe modelo de auditoria dedicado**: a trilha é `ProcessStatusEvent`, por processo. | Não é vulnerabilidade — permissão não aplicada não concede nada. É **incoerência da matriz**: ela promete "ver todos os logs" que o produto não entrega, e o `docs/05` trata auditoria como requisito. Precisa de decisão: construir a visão de auditoria, ou remover as permissões até existir. **É por isso que F.8 fica aberto (§5).** |
| **4.2.2** | **Rate limit é por instância**: memória local, zera no restart, e limitar por e-mail permite **DoS de conta**. | Já documentado no próprio módulo e no `docs/64 §8`. É **pré-condição de tráfego real** — não bloqueia o Bloco D, mas bloqueia produção. |

### 4.3 Melhorias futuras

| # | Achado | Observação |
|---|---|---|
| 4.3.1 | **`FINANCEIRO` tem `process.pii.viewFull`.** | Vale reavaliar se conferir Pix e GRU exige PII completa ou se `viewMinimal` basta. É need-to-know (F.1), não falha — a permissão é deliberada e está na matriz do `docs/11 §3`. Trocar exige decisão de produto, não refatoração. |
| 4.3.2 | **Captcha não implementado.** | Decidido no `docs/64 §7`, não construído. Esperado nesta fase. |
| 4.3.3 | **Login federado não implementado**; `AUTH_MODE` é `mock` por padrão. | Decidido no `docs/64`/`docs/65`, não construído. Ligar auth real é item das 12 pendências do `docs/23 §5`. |
| 4.3.4 | **`assignedToMockUserId` e `actorMockUserId` ainda são ids "mock"**, não FK para `users`. | Herança da Fase 2, já prevista no schema. A trilha funciona, mas não tem integridade referencial de ator. Item do PR de auth real. |

---

## 5. Relação com o Bloco F

| Item | Estado | Justificativa |
|---|---|---|
| **F.1** need-to-know | `[x]` | Revisado (§3.1, §3.2). Achado 4.3.1 registrado como **melhoria futura**, não pendência: a permissão é deliberada e mudá-la é decisão de produto. |
| **F.2** PII | `[x]` | Revisado (§3.2). Não há CPF no schema; `Process` é sem PII por contrato. |
| **F.3** DTOs seguros | `[x]` | Revisado (§3.3). Permissão na query + DTO explícito + barreira de tipo. |
| **F.4** logs sem credenciais/cookies/tokens | `[x]` | Revisado (§3.4). Zero `console.*`; redação em duas camadas. |
| **F.5** `storageKey` fora da UI | `[x]` | Revisado (§3.5). Zero ocorrência em `.tsx`. |
| **F.6** permissões financeiras | `[x]` | Revisado (§3.6). `audit.view.financial` aplicado na rota e no link. |
| **F.7** permissões de cancelamento | `[x]` | Revisado (§3.1.4/§3.1.5). `process.cancel` é permissão própria, só ADMIN. |
| **F.8** auditoria | **`[ ]`** | **Mantido aberto.** A revisão encontrou o achado **4.2.1**: duas permissões de auditoria sem ponto de aplicação e nenhum modelo de auditoria dedicado. Declarar "auditoria revisada" com essa lacuna aberta seria marcar um item que a própria revisão contradiz. Fecha quando houver **decisão** sobre construir a visão de auditoria ou remover as permissões. |

> **Por que 7 fecham e 1 não.** O Bloco F pede **revisão**, e revisão que
> encontra o código correto **fecha o item** — é o que `docs/61 §4.F` já previa
> ("espera-se confirmar o que já está correto e registrar achados"). F.8 é
> diferente: o achado não é sobre código a corrigir depois, é sobre uma
> **lacuna dentro do próprio objeto revisado**. Marcar seria afirmar o que a §4.2.1
> nega.

---

## 6. Relação com o Bloco D

Impactos registrados para a futura separação cliente/admin. **D não é fechado
nem iniciado aqui.**

| # | Impacto |
|---|---|
| 6.1 | **D.4 e D.5 já estão garantidos por permissão** — `USER: []` e a matriz como fonte única (§3.1). O que falta em D é **experiência de entrada** (D.1–D.3), não controle de acesso. |
| 6.2 | **Não foi encontrado vazamento entre a área do cliente e a admin**: as telas do cliente usam exclusivamente consultas escopadas por dono (§3.3.4), e as rotas admin passam por `requireAdminRole`/`requirePermission`. |
| 6.3 | A entrada única (`/login`) continua sendo a pendência real de D, como o `docs/61 §4.D` já registra. Isto é **UX**, não brecha. |
| 6.4 | O achado 4.2.1 (auditoria) toca D indiretamente: uma futura tela de auditoria precisará decidir **o que o admin vê e o que o cliente nunca vê**. |
| 6.5 | O achado 4.3.4 (ids mock) precisará ser resolvido no PR de auth real, que é vizinho de D. |

---

## 7. Relação com o Bloco G

| # | Confirmação |
|---|---|
| 7.1 | Pagamentos e financeiro **continuam protegidos** — §3.6 confirma gate, DTO e ausência de payload cru na UI. |
| 7.2 | **Reembolso continua ausente**, o que reconfirma G.4–G.6 (§3.6.7). |
| 7.3 | A GRU segue como **registro operacional interno** (`ManualExecution`), sem exposição ao cliente. |
| 7.4 | **O Bloco G não é alterado por este documento** — segue fechado como o `docs/67` o deixou. |

---

## 8. Relação com a Fase 9

| # | Registro |
|---|---|
| 8.1 | **Não libera execução real.** |
| 8.2 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` — confirmado `false as const` (§3.8.1). |
| 8.3 | **Não toca** Gov.br/SINARM/PF — e a trava dura de rede foi **verificada** (§3.8.3). |
| 8.4 | **Não cria** schedule nem heartbeat — confirmada a ausência (§3.8.6). |
| 8.5 | Playwright existente é **local/sintético**, sem alvo real (§3.8.5). |
| 8.6 | Os gates do `docs/26 §19` seguem íntegros. |

---

## 9. Recomendações — próximos PRs

Em ordem de prioridade. **Nenhum é aprovado por este documento.**

| # | PR sugerido | Natureza | Resolve |
|---|---|---|---|
| 1 | **Decisão sobre a visão de auditoria** — construir a tela/consulta, ou remover `audit.view.all`/`audit.view.own` da matriz até existir | docs | achado 4.2.1 → fecha **F.8** |
| 2 | **Seguir para o Bloco D** — separação de entrada cliente/admin | código | D.1–D.3 |
| 3 | Rate limit distribuído (Redis ou equivalente) | código | achado 4.2.2 — **pré-condição de produção**, não de D |
| 4 | Reavaliar `process.pii.viewFull` do `FINANCEIRO` | docs | achado 4.3.1 |

> **Recomendação principal: seguir para D.** Não há achado bloqueante, o
> controle de acesso entre cliente e admin já está correto (§6.2), e o único
> item de F que ficou aberto (F.8) é resolvível por **um documento de decisão
> curto**, sem depender de código. D é o caminho crítico da Fase 1; F.8 pode
> correr em paralelo.

---

## 10. Proibições deste PR

Este PR **não**:

- ❌ altera código;
- ❌ corrige nenhum achado;
- ❌ altera auth, login ou sessão;
- ❌ cria captcha, login federado ou rate limit distribuído;
- ❌ altera banco;
- ❌ cria migration;
- ❌ altera Prisma;
- ❌ altera UI;
- ❌ altera rotas;
- ❌ altera testes;
- ❌ altera `package.json`;
- ❌ altera a Fase 9;
- ❌ fecha os blocos D ou H;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ usa `db:push`.

---

> **Fecho.** A revisão do Bloco F **não encontrou achado bloqueante**. O controle
> de acesso está correto no que importa: cliente sem permissão interna por
> construção, consultas escopadas por dono no `where`, `passwordHash` barrado
> por tipo, `storageKey` fora da UI, rota de arquivo sem oráculo de existência,
> payload cru do PSP fora do domínio, sessão com token opaco e hash no banco,
> zero `console.*` no servidor e trava dura de rede que bloqueia o domínio
> oficial mesmo contra a própria allowlist. **F.1–F.7 fecham**; **F.8 fica
> aberto** por um achado interno à própria auditoria: duas permissões sem ponto
> de aplicação e nenhum modelo de auditoria dedicado. Os blocos **D e H seguem
> abertos**, o **Bloco G não é alterado**, a **Fase 1 continua NÃO encerrada**, a
> **Fase 2 não abre**, `PHASE9_REAL_EXECUTION_ENABLED` continua `false` e os
> gates do `docs/26 §19` seguem íntegros.
