# 65 — Decisão: transição das contas com senha própria para o login federado

> **O que é este documento.** A resposta à **pergunta em aberto §13.1** do
> [`docs/64`](64-decisao-login-federado-captcha-rate-limit.md): **o que acontece
> com as contas que já têm senha própria** quando o produto migrar para login
> federado. A resposta curta é que **não existe base real para migrar** — e por
> isso a decisão é *não construir migração para usuário que não existe*, sem
> abrir mão de exigir um plano caso ele passe a existir.
>
> **Este documento decide; não implementa nada.**
>
> - ❌ **NÃO altera** auth, login, banco, Prisma, migration, rotas, UI ou testes.
> - ❌ **NÃO cria** Google OAuth, captcha nem rate limit.
> - ❌ **NÃO remove** senha própria, nem código, nem conta alguma.
> - ❌ **NÃO conclui** o bloco **D** — D.1–D.5 continuam `[ ]`.
> - ❌ **NÃO encerra** a Fase 1 e **NÃO abre** a Fase 2 como execução real.
> - ❌ **NÃO toca** Gov.br/SINARM/PF e **NÃO altera** `PHASE9_REAL_EXECUTION_ENABLED`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `9dd907a` — *feat: add client help structure*
> **Referências:** [`docs/64 §13.1`](64-decisao-login-federado-captcha-rate-limit.md)
> (a pergunta que este documento responde) e [`§2`](64-decisao-login-federado-captcha-rate-limit.md)
> (a decisão de direção que não é alterada aqui),
> [`docs/61 §4.D`](61-checklist-encerramento-fase-1-base-do-saas.md) (o bloco que
> esta decisão destrava sem fechar), [`docs/60 §4`](60-decisao-estrategia-automated-first-e-ux-cliente.md)
> (tipos de usuário), [`docs/23 §5`](23-checklist-piloto-real.md) (auth real e
> MFA como bloqueio de piloto), [`docs/41`](41-gate-seguranca-credenciais.md)
> (gate de credenciais), [`docs/24`](24-revisao-ux-textos-conformidade.md)
> (linguagem).

---

## 1. Status da decisão

| # | Registro |
|---|---|
| 1.1 | **Decisão registrada** — destino das contas com senha própria definido para fins de planejamento. |
| 1.2 | **Implementação NÃO feita aqui.** Este documento é docs-only. |
| 1.3 | **NÃO fecha a Fase 1.** |
| 1.4 | **NÃO abre a Fase 2.** |
| 1.5 | **NÃO altera a Fase 9** — flag e gates intactos (§9). |
| 1.6 | Destrava uma decisão necessária ao futuro bloco **D**; **não conclui D** (§8). |
| 1.7 | O **PR técnico de auth continua separado** e não está aprovado. |

---

## 2. Decisão principal

| # | Decisão |
|---|---|
| 2.1 | **Cliente novo futuro não terá senha própria como fluxo principal.** |
| 2.2 | **Login federado é o caminho preferencial** do cliente — mantendo o Google/OIDC do `docs/64 §2.2`. |
| 2.3 | Contas **seed/dev/teste podem ser descartadas, recriadas ou ajustadas** livremente, sem cerimônia de migração. |
| 2.4 | **Não criar migração complexa para usuário real inexistente** — não se constrói caminho de transição para uma população vazia. |
| 2.5 | **Se surgir usuário real com senha antes da implementação federada**, a migração volta à mesa: precisa ser **reavaliada e decidida antes** do PR técnico, não durante. |
| 2.6 | **Admin/equipe interna tem decisão separada** (§6) — nada aqui migra admin automaticamente. |

> **Por que 2.4 não é preguiça e sim precisão.** Migração de credencial é um dos
> caminhos mais delicados que existem: janela de coexistência, vínculo por
> e-mail (que o `docs/64 §4.12` já rejeita como identidade), conta órfã,
> usuário que perde o acesso no meio. Construir tudo isso **antes** de saber se
> haverá alguém para migrar é escrever código de risco alto para uso zero. O
> compromisso do 2.5 é o que impede que isso vire desculpa: **a ausência de
> usuário real é uma premissa que precisa ser reverificada**, não um fato
> permanente.

---

## 3. Estado atual assumido

Premissas verificadas no código em `9dd907a`, **sem alterar nada**. Se alguma
deixar de valer, o §2.5 é acionado.

| # | Premissa | Evidência |
|---|---|---|
| 3.1 | O projeto **ainda não está em produção real** — sem provedor de produção conectado | `docs/00 §4` ("auth mock/dev, storage local/dev, Pix fake/sandbox") |
| 3.2 | **Não há evidência de base real de clientes** usando senha própria | nada no repositório aponta para conta real; os usuários semeados são fictícios |
| 3.3 | **Existe estrutura/código de senha própria** — e ela não é removida aqui | `prisma/schema.prisma` (`passwordHash String?`), `src/server/auth/password.ts` (scrypt), `authenticate.ts` (login, cadastro e rehash oportunista), `userRepository.ts` (`updatePasswordHash`) |
| 3.4 | **Existe seed/dev/teste**, e ele nasce **sem senha** | `prisma/seed.ts` semeia os `MOCK_USERS` com e-mail, nome, papel e `active` — **nenhum `passwordHash`**; o próprio arquivo registra "SEM senha" |
| 3.5 | Os e-mails de dev usam **domínio reservado** `example.com` (RFC 2606) | `src/server/auth/mockUsers.ts` |
| 3.6 | O modo padrão de auth é **mock**, não real | `src/server/auth/config.ts` (`AUTH_MODE ?? "mock"`) |
| 3.7 | **Este documento não remove nada** — nem coluna, nem módulo, nem conta | docs-only (§10) |

> **O achado que simplifica tudo.** `passwordHash` é **anulável** (`String?`) e o
> seed **nunca o preenche**: as contas de desenvolvimento existem *sem senha*.
> Não há, hoje, um único registro conhecido cuja senha precisaria ser migrada.
> A pergunta do `docs/64 §13.1` era grande em teoria e pequena na prática — o
> que **não** significa que a estrutura de senha seja inofensiva: ela continua
> viva e utilizável no cadastro (3.3), e é justamente por isso que o §5 exige
> reverificação em vez de declarar o assunto encerrado para sempre.

---

## 4. Cliente novo

| # | Decisão |
|---|---|
| 4.1 | Fluxo futuro **preferencial com Google/OIDC** — coerente com `docs/64 §5.1`. |
| 4.2 | **Senha própria não deve ser oferecida como opção principal** ao cliente novo. |
| 4.3 | A **UX deve evitar escolha confusa** entre "criar senha" e "entrar com Google": duas portas equivalentes na mesma tela é convite a erro e a suporte. |
| 4.4 | A **conta interna continua existindo no banco** — federar autenticação não terceiriza o usuário (`docs/64 §4`). |
| 4.5 | Linguagem segue `docs/24`: nada de "OIDC", "provider" ou "federado" na tela. |
| 4.6 | Continua valendo a regra permanente: **nunca pedimos senha Gov.br** (`docs/00 §8`). Entrar com Google **não** é entrar no Gov.br. |

> **4.3 não decide a tela.** Decidir que a escolha não pode ser confusa **não é**
> desenhar a entrada — isso é o bloco **D** e depende de PR técnico (§8). Aqui
> se registra apenas a restrição que esse PR terá de respeitar.

---

## 5. Contas existentes

| # | Decisão |
|---|---|
| 5.1 | Se forem **apenas seed/dev/teste**, podem ser ajustadas, recriadas ou descartadas **sem migração formal** — o seed é idempotente e reconstruível. |
| 5.2 | Se **houver usuário real** antes da mudança, exigir **plano de transição escrito** antes do PR técnico. |
| 5.3 | **Não apagar usuário real** sem decisão explícita e registrada. |
| 5.4 | **Não desativar senha de admin automaticamente** — admin é §6. |
| 5.5 | **Não misturar regra de cliente com regra de admin**: a decisão de um não se aplica ao outro por analogia. |

> **Como saber em qual caso estamos.** A verificação é do PR técnico, não deste
> documento: antes de tocar em auth, olhar se existe usuário com `passwordHash`
> não nulo **fora** dos ids semeados (`SEEDED_USER_IDS`). Se a resposta for
> "nenhum", vale 5.1. Se for qualquer outra, vale 5.2 — e o §2.5 se torna
> obrigatório.

---

## 6. Admin / equipe interna

| # | Decisão |
|---|---|
| 6.1 | **Regra separada** da do cliente — reafirma `docs/64 §6.1`. |
| 6.2 | **Não migrar automaticamente** conta interna para o provedor. |
| 6.3 | **RBAC interno obrigatório** — o provedor autentica, o app autoriza. |
| 6.4 | **Allowlist de e-mail/domínio e MFA** continuam como direção futura desejável (`docs/64 §6.3`/`§6.4`, `docs/23 §5`). |
| 6.5 | **Claims do provedor não substituem permissões internas** — papel vem da nossa tabela, sempre. |

> **Por que admin não segue o cliente.** O cliente pode perder o acesso e
> recadastrar; a equipe interna perdendo acesso ao painel é incidente
> operacional. Além disso, o `docs/64 §13.3` (provedor fora do ar) segue **em
> aberto** justamente para o caminho interno — decidir a transição do admin
> antes disso seria decidir na frente da própria contingência.

---

## 7. Relação com o `docs/64`

| # | Registro |
|---|---|
| 7.1 | **Resolve a §13.1** para fins de planejamento: o destino das contas com senha está decidido (§2). |
| 7.2 | A resolução é **condicional por desenho** — vale enquanto a premissa "sem usuário real" valer (§2.5, §3). |
| 7.3 | **As demais perguntas abertas continuam abertas**: §13.2 (modelo de dados do vínculo), §13.3 (provedor fora do ar), §13.4 (backend do rate limit distribuído), §13.5 (mesmo e-mail em dois provedores), §13.6 (LGPD). |
| 7.4 | **Não altera a decisão principal do `docs/64`** — login federado, Google/OIDC primeiro, captcha e rate limit seguem exatamente como decididos lá. |
| 7.5 | **Não implementa auth.** |
| 7.6 | **Não implementa login federado.** |
| 7.7 | **Não implementa captcha.** |
| 7.8 | **Não implementa rate limit** — o que existe hoje (`rateLimit.ts`) segue intocado. |

---

## 8. Relação com o bloco D

| # | Registro |
|---|---|
| 8.1 | **Destrava** uma decisão que o futuro bloco **D** precisava ter respondida antes de virar código. |
| 8.2 | **NÃO conclui D** — D.1–D.5 continuam `[ ]`. |
| 8.3 | D só fecha com **comportamento observável implementado** — entrada de cliente e entrada de admin distintas, na tela. |
| 8.4 | A **separação cliente/admin ainda exige PR técnico**, não aprovado por este documento. |
| 8.5 | A condição `docs/61 §5.5` ("admin estiver separado do fluxo de cliente") **continua NÃO satisfeita**. |

> **Decidir não é entregar.** Vale aqui a mesma leitura que o `docs/61 §4.B` já
> fez para o bloco B: condição que exige comportamento não é satisfeita por
> documento. Este PR remove um **impedimento de decisão**, não um item de
> checklist.

---

## 9. Relação com a Fase 9

| # | Registro |
|---|---|
| 9.1 | **Não libera execução real.** |
| 9.2 | **Não altera** `PHASE9_REAL_EXECUTION_ENABLED` — segue `false as const`. |
| 9.3 | **Não toca** Gov.br/SINARM/PF. |
| 9.4 | **Não cria** schedule nem heartbeat. |
| 9.5 | Os gates do `docs/26 §19` seguem íntegros. |
| 9.6 | Senha **do nosso app** e credencial de **órgão oficial** são coisas distintas e continuam distintas: nada neste documento aproxima as duas (`docs/00 §8`, `docs/41`). |

---

## 10. Proibições deste PR

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
- ❌ altera UI;
- ❌ altera rotas;
- ❌ altera testes;
- ❌ altera a Fase 9;
- ❌ fecha a Fase 1;
- ❌ abre a Fase 2;
- ❌ usa `db:push`.

---

> **Fecho.** A pergunta §13.1 do `docs/64` — o que fazer com as contas que já têm
> senha — se responde pelo estado real do projeto: **não há usuário real para
> migrar**, `passwordHash` é anulável e o seed sequer o preenche. Então o
> cliente novo futuro entra por **login federado**, sem senha própria como fluxo
> principal; **seed/dev/teste é ajustável sem migração formal**; **usuário real
> que apareça antes da mudança exige plano de transição decidido antes do PR
> técnico**; e **admin/equipe interna fica sob regra separada**, sem migração
> automática e com RBAC interno obrigatório. Nada é removido, nada é
> implementado: o bloco **D segue aberto** (D.1–D.5 `[ ]`), a **Fase 1 continua
> NÃO encerrada**, a **Fase 2 não abre**, `PHASE9_REAL_EXECUTION_ENABLED`
> continua `false` e os gates do `docs/26 §19` seguem íntegros.
