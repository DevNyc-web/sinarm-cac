# 64 — Decisão: login federado, captcha e rate limit

> **O que é este documento.** A **decisão de produto/segurança** sobre como o
> cliente vai autenticar no futuro — **login federado (Google/OIDC)** em vez de
> senha própria — e sobre as duas defesas contra abuso que acompanham essa
> mudança: **captcha** e **rate limit**. Entra na fila dos blocos **D**
> (separação cliente/admin) e **F** (segurança e permissões) do
> [`docs/61`](61-checklist-encerramento-fase-1-base-do-saas.md).
>
> **Este documento decide a direção; não implementa nada.**
>
> - ❌ **NÃO altera** auth, login, banco, Prisma, migration, rotas, UI ou testes.
> - ❌ **NÃO cria** Google OAuth, captcha nem rate limit novo.
> - ❌ **NÃO conclui** os blocos D e F — ambos seguem integralmente abertos.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2 como execução real.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `5dde913` — *feat: add client start process selection*
> **Referências:** [`docs/61 §4.D`](61-checklist-encerramento-fase-1-base-do-saas.md)
> e [`§4.F`](61-checklist-encerramento-fase-1-base-do-saas.md) (os blocos que
> esta decisão alimenta), [`docs/60 §4`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (tipos de usuário) e [`§5`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (login e entrada), [`docs/23 §5`](23-checklist-piloto-real.md) (auth real +
> MFA como bloqueio de piloto), [`docs/41`](41-gate-seguranca-credenciais.md)
> (gate de credenciais), [`docs/05`](05-logs-auditoria-lgpd.md) (logs, auditoria
> e LGPD), [`docs/18 §6`](18-validacao-integrada-fases-1-5.md) (DTOs seguros),
> [`docs/24`](24-revisao-ux-textos-conformidade.md) (linguagem).

---

## 1. Status da decisão

| # | Registro |
|---|---|
| 1.1 | **Decisão de direção registrada** — o produto caminha para **login federado**, com captcha e rate limit como defesas contra abuso. |
| 1.2 | **Implementação NÃO feita aqui.** Este documento é docs-only. |
| 1.3 | **NÃO fecha a Fase 1.** |
| 1.4 | **NÃO abre a Fase 2.** |
| 1.5 | **NÃO altera a Fase 9** — flag e gates intactos (§11). |
| 1.6 | Alimenta os blocos **D** e **F** do `docs/61`; **não conclui nenhum dos dois** (§9). |
| 1.7 | O **PR técnico é separado** e ainda não está aprovado. |

### 1.1 Contexto verificado no código (`main` `5dde913`)

Inspeção feita **antes** de decidir. Nada abaixo foi alterado — e dois pontos
corrigem a premissa de que tudo aqui é campo aberto.

| # | Situação hoje | Onde |
|---|---|---|
| 1.1.1 | Auth é **senha própria**: hash, rehash oportunista, sessão e RBAC | `src/server/auth/` (`authService.ts`, `authenticate.ts`, `password.ts`, `session.ts`) |
| 1.1.2 | **Nenhum** OAuth/OIDC/provider externo existe — sem `provider`, sem `providerAccountId`, sem callback | busca por `oauth\|oidc\|google` em `src/server/auth/` e `prisma/schema.prisma`: zero ocorrências |
| 1.1.3 | **RATE LIMIT JÁ EXISTE** para login e cadastro (5/15min e 3/1h), com janela deslizante | `src/server/auth/rateLimit.ts`, ligado em `authService.ts` |
| 1.1.4 | As **limitações** desse rate limit já estão escritas no próprio módulo: memória **por instância** (N réplicas = N× o limite), **zera no restart**, e limitar por e-mail **permite DoS de conta** | cabeçalho de `rateLimit.ts` |
| 1.1.5 | **Captcha NÃO existe** no produto | busca por `captcha\|turnstile\|recaptcha` em `src/`: nada de produto |
| 1.1.6 | RBAC do cliente é **vazio por construção** (`USER: []`) | `src/server/auth/permissions.ts` |
| 1.1.7 | Existe **uma única** entrada pública (`/login`), sem distinção de experiência | `src/app/(public)/login`; `docs/60 §5` |

> **⚠️ `AGUARDANDO_CAPTCHA` no schema NÃO é captcha de produto.** É um estado de
> **processo** (`InternalStatus`), sobre o captcha exibido pelo **portal
> Gov.br/PF** durante automação da Fase 9 — e existe justamente para o sistema
> **parar e devolver para a pessoa**, sem caminho automático (`docs/00 §8`,
> permanente). Quem for implementar o captcha **deste** documento não deve
> confundir os dois: são camadas diferentes, com propósitos opostos.

> **Consequência para o PR técnico.** Login federado é **construção nova**;
> captcha é **construção nova**; rate limit é **evolução do que já existe**
> (§8) — não recomeço. Reimplementar `rateLimit.ts` do zero seria trabalho
> refeito.

---

## 2. Decisão principal

| # | Decisão |
|---|---|
| 2.1 | O produto adota **login federado** como estratégia de autenticação do cliente. |
| 2.2 | **Começar por Google/OIDC** para o cliente comum. |
| 2.3 | Manter **aberta** a possibilidade futura de **Microsoft** e **Apple** — sem compromisso de prazo. |
| 2.4 | **Evitar senha própria** no escopo inicial do login federado: o cliente novo entra pelo provedor e não cria senha conosco. |
| 2.5 | O **banco continua existindo** para os dados internos — federar autenticação não é terceirizar o produto (§4). |
| 2.6 | A escolha do provedor é de **autenticação**, nunca de **autorização**: quem pode o quê continua sendo decidido por nós (§6). |

> **Sobre o que existe hoje.** A senha própria (1.1.1) **não é removida por este
> documento**. O que fazer com as contas já criadas com senha — migrar,
> coexistir por um período, ou exigir vínculo com o provedor no próximo login —
> era **decisão em aberto** (§13.1) e precisava ser resolvida **antes** do PR
> técnico, não durante.
>
> **Resolvido em 2026-08-05 pelo [`docs/65`](65-decisao-transicao-contas-senha-login-federado.md)**
> — ver §13.1 abaixo. A senha própria **continua não sendo removida aqui**.

---

## 3. O que o login federado resolve

| # | Ganho |
|---|---|
| 3.1 | **Reduz o risco de armazenar senha** — o que não se guarda não vaza. |
| 3.2 | **Elimina o fluxo de recuperação de senha**, que é superfície de ataque clássica (enumeração de conta, token de reset, e-mail interceptado). |
| 3.3 | **Melhora a experiência**: menos fricção no cadastro, um clique em vez de formulário e confirmação. |
| 3.4 | **Transfere a autenticação primária** para um provedor com escala, detecção de fraude e MFA que não vamos igualar sozinhos. |

### 3.1 O que ele NÃO resolve

Federar **não** transfere responsabilidade. Continuam integralmente nossos:

| Responsabilidade | Por quê |
|---|---|
| **Sessão** | O cookie de sessão, sua expiração, rotação e invalidação são nossos, não do provedor. |
| **Autorização / RBAC** | O provedor diz *quem é*; **nunca** diz *o que pode*. `ROLE_PERMISSIONS` continua sendo nosso. |
| **Auditoria** | A trilha de eventos do processo é nossa (`docs/05`). |
| **Proteção contra abuso** | Rate limit e captcha protegem **as nossas rotas**, inclusive as que nem passam por login (§8). |
| **PII** | Os dados do cliente ficam conosco; LGPD não é federada. |
| **Disponibilidade** | Provedor fora do ar = ninguém entra. É um ponto único de falha novo, a ser considerado no PR técnico. |

---

## 4. O que o banco ainda precisa guardar

Login federado **não esvazia o banco**. Continuam persistidos:

| # | Dado |
|---|---|
| 4.1 | **Usuário interno** — a nossa entidade, com id próprio. |
| 4.2 | **Vínculo com o provider** (`google`, `microsoft`, …). |
| 4.3 | **`providerAccountId`** — o `sub` do OIDC ou equivalente. |
| 4.4 | **E-mail verificado** — e o registro de que veio verificado do provedor. |
| 4.5 | **Perfil cliente/admin**. |
| 4.6 | **Permissões / RBAC**. |
| 4.7 | **Processos**. |
| 4.8 | **Documentos**. |
| 4.9 | **Pagamentos**. |
| 4.10 | **Auditoria**. |
| 4.11 | **Logs de segurança**. |

| # | Regra |
|---|---|
| 4.12 | A identidade do usuário é **`(provider, providerAccountId)`**, não o e-mail: e-mail muda e pode ser reatribuído; o `sub` do provedor, não. |
| 4.13 | **Nunca** guardar senha do provedor, token de acesso de longa duração ou refresh token sem necessidade demonstrada — vale o espírito do `docs/41`. |
| 4.14 | Nada disso exige migration **neste** PR: o modelo de dados é problema do PR técnico (§13.2). |

---

## 5. Cliente comum

| # | Decisão |
|---|---|
| 5.1 | Entrada **preferencial com Google**. |
| 5.2 | **Sem senha própria** inicialmente. |
| 5.3 | Experiência **simples** — coerente com o SaaS automatizado-first (`docs/60 §3`) e com a tela de entrada já implementada (`docs/63`). |
| 5.4 | **Não misturar cliente com admin**: a entrada do cliente é a do cliente. |
| 5.5 | A linguagem segue `docs/24` — nada de jargão técnico ("OIDC", "OAuth", "provider") na tela. |
| 5.6 | Continua valendo a regra permanente: **nunca pedimos senha Gov.br** (`docs/00 §8`). Entrar com Google **não** é entrar no Gov.br, e a tela não pode sugerir isso. |

---

## 6. Admin / equipe interna

| # | Decisão |
|---|---|
| 6.1 | **Entrada separada** da do cliente. |
| 6.2 | **RBAC interno obrigatório** — o provedor autentica, o app autoriza. |
| 6.3 | **Allowlist** de e-mail ou domínio como opção futura. |
| 6.4 | **MFA pelo provedor** como requisito futuro desejável — conversa com "MFA admin" do `docs/23 §5`, que já é bloqueio de piloto. |
| 6.5 | As permissões internas **continuam no app**, nunca em claim do provedor. |
| 6.6 | Um e-mail estar em domínio nosso **não** concede papel interno: o papel vem da nossa tabela, sempre. |

---

## 7. Captcha

| # | Decisão |
|---|---|
| 7.1 | Decisão futura: usar **captcha/anti-bot em pontos sensíveis**. |
| 7.2 | Preferência inicial: **Cloudflare Turnstile**. |
| 7.3 | **Não usar captcha como única defesa.** |
| 7.4 | **Captcha não substitui rate limit** — e o contrário também é verdade. |
| 7.5 | Captcha é para **abuso automatizado**; rate limit é para **volume**, inclusive de humano autenticado. Resolvem problemas diferentes. |
| 7.6 | Não confundir com `AGUARDANDO_CAPTCHA`, que é estado de processo sobre o portal Gov.br (§1.1). |
| 7.7 | Escolher Turnstile é **preferência**, não contrato: o PR técnico pode divergir com justificativa registrada. |

---

## 8. Rate limit

**Correção de premissa:** rate limit **não é construção do zero** — existe hoje
para login e cadastro (§1.1.3). O que é futuro é **torná-lo confiável** e
**estendê-lo**.

| # | Situação | Estado |
|---|---|---|
| 8.1 | Rate limit em login e cadastro | ✅ **já existe** (`rateLimit.ts`) |
| 8.2 | Armazenamento **distribuído** (Redis ou equivalente) | ⏳ futuro — hoje é memória por instância, e com N réplicas o limite efetivo é N× o pretendido |
| 8.3 | Sobreviver a restart/deploy | ⏳ futuro — hoje zera |
| 8.4 | Cobertura das demais rotas | ⏳ futuro (8.6) |

| # | Decisão |
|---|---|
| 8.5 | Aplicar por **IP**, por **usuário/e-mail** e por **rota** — as três dimensões, não uma. |
| 8.6 | Rotas candidatas: **login**, **callback/auth**, **cadastro**, **criação de processo**, **upload de documento**, **pagamento**, **suporte/contato**. |
| 8.7 | **Bloqueio temporário progressivo**, não permanente. |
| 8.8 | **Logs sem vazar PII** — registrar que houve bloqueio, não o conteúdo da tentativa (`docs/05`, `docs/41`). |
| 8.9 | O **DoS de conta** já documentado em `rateLimit.ts` (limitar por e-mail permite manter a conta da vítima bloqueada) **continua sem solução** e precisa ser tratado explicitamente no PR técnico — combinar dimensões, não escolher uma. |
| 8.10 | Rate limit é **pré-condição de tráfego real**, como o próprio módulo já registra. |

---

## 9. Relação com a Fase 1

| # | Registro |
|---|---|
| 9.1 | A decisão impacta principalmente os blocos **D** e **F** do `docs/61 §4`. |
| 9.2 | **NÃO conclui o bloco D** — D.1–D.5 continuam `[ ]`. |
| 9.3 | **NÃO conclui o bloco F** — F.1–F.8 continuam `[ ]`. |
| 9.4 | Apenas **registra direção**: nenhum item de checklist é satisfeito por uma decisão de arquitetura futura. |
| 9.5 | **A Fase 1 continua aberta.** |
| 9.6 | Nenhuma das 9 condições do `docs/61 §5` muda de estado por este documento. |
| 9.7 | `docs/close-phase-1-foundation` segue como o **único** fechamento futuro da Fase 1. |

> **Por que D e F não fecham aqui.** D.1–D.3 pedem uma **experiência de entrada**
> distinta implementada; F é uma **revisão** de need-to-know, PII, DTOs e logs
> sobre o código como ele está. Decidir que um dia haverá Google login não
> entrega nem uma coisa nem outra. Mais que isso: **este documento aumenta** o
> escopo futuro de D e F em vez de reduzi-lo.

---

## 10. Relação com o bloco B

| # | Registro |
|---|---|
| 10.1 | O **bloco B já foi concluído** (`docs/61 §4.B`, PR `5dde913`). |
| 10.2 | Esta decisão **não reabre B**. |
| 10.3 | A tela inicial do cliente novo (`docs/63`) **continua válida** — ela começa **depois** do login e não depende de como o cliente autenticou. |
| 10.4 | Auth será tratado em **PR próprio**, sem tocar `ClientStartPanel`, dashboard ou `clientProcessChoices`. |

---

## 11. Relação com a Fase 9

| # | Registro |
|---|---|
| 11.1 | **Não libera execução real.** |
| 11.2 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false as const`. |
| 11.3 | **Não toca** Gov.br/SINARM/PF. |
| 11.4 | **Não cria** automação real, schedule nem heartbeat. |
| 11.5 | Login federado é do **nosso** produto. Não tem relação com o acesso do cliente ao Gov.br, que continua sendo feito **por ele**, no ambiente oficial, fora deste site (`docs/00 §8`). |
| 11.6 | Os gates do `docs/26 §19` seguem íntegros. |

---

## 12. Proibições deste PR

Este PR **não**:

- ❌ altera código;
- ❌ altera auth;
- ❌ altera login;
- ❌ cria Google OAuth;
- ❌ cria captcha;
- ❌ cria rate limit;
- ❌ altera banco;
- ❌ cria migration;
- ❌ altera Prisma;
- ❌ altera rotas;
- ❌ altera UI;
- ❌ altera testes;
- ❌ altera a Fase 9;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ usa `db:push`.

---

## 13. Perguntas em aberto

Não decididas aqui, e que o **PR técnico não pode improvisar**:

| # | Questão |
|---|---|
| 13.1 | ~~**Contas com senha já existentes** — migrar, coexistir por um período, ou exigir vínculo no próximo login?~~ → **DECIDIDA** pelo [`docs/65`](65-decisao-transicao-contas-senha-login-federado.md) (2026-08-05). |
| 13.2 | **Modelo de dados** do vínculo com o provider — tabela própria ou colunas no usuário? Provavelmente exige migration. |
| 13.3 | **Provedor fora do ar** — existe caminho de contingência para a equipe interna, ou o produto simplesmente para? |
| 13.4 | **Backend do rate limit distribuído** — Redis é uma dependência de infraestrutura nova, com custo e operação próprios. |
| 13.5 | **Mesmo e-mail em dois provedores** (Google e Microsoft) — uma conta ou duas? |
| 13.6 | **LGPD**: o que o provedor compartilha, o que guardamos e o que consta no consentimento (`docs/05`, `/consentimento`). |

> **13.1 — decisão registrada pelo [`docs/65`](65-decisao-transicao-contas-senha-login-federado.md):**
>
> | Caso | Destino |
> |---|---|
> | **Cliente novo** | **Login federado preferencial** — senha própria não é o fluxo principal. |
> | **Contas seed/dev/teste** | Podem ser ajustadas, recriadas ou descartadas **sem migração formal**. |
> | **Usuário real que surja antes da mudança** | **Exige decisão e plano de transição** antes do PR técnico — não se improvisa migração de credencial. |
> | **Admin / equipe interna** | **Regra separada**, sem migração automática, RBAC interno obrigatório. |
>
> A base da decisão é factual: **não há usuário real** — `passwordHash` é
> anulável e o `prisma/seed.ts` **não o preenche**. Por isso **não se constrói
> migração** para uma população vazia; se a premissa mudar, o `docs/65 §2.5`
> reabre o assunto. **13.2–13.6 continuam abertas.**
>
> **A decisão principal deste documento (§2) não muda:** login federado,
> Google/OIDC primeiro, captcha e rate limit seguem como decididos.

---

> **Fecho.** O produto vai deixar de guardar senha de cliente: a autenticação
> passa para um provedor grande, começando por **Google/OIDC**, com **captcha**
> em pontos sensíveis e **rate limit** — que **já existe em forma mínima** e
> precisa virar distribuído e cobrir mais rotas. Federar a autenticação **não**
> federa a responsabilidade: sessão, RBAC, auditoria, PII e proteção de rota
> continuam nossos, e o banco continua guardando tudo o que importa. Este
> documento **alimenta** os blocos D e F sem concluir nenhum dos dois, **não
> reabre o bloco B**, **não encerra a Fase 1**, **não abre a Fase 2**,
> `PHASE9_REAL_EXECUTION_ENABLED` continua `false` e os gates do `docs/26 §19`
> seguem íntegros.
