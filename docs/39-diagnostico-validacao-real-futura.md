# 39 — Diagnóstico de Validação Real Futura

> **O que é este documento.** Um **diagnóstico**: mapeia o que ainda falta antes
> de qualquer validação real futura da Fase 9. É levantamento de pendências, não
> plano de execução e muito menos permissão.
>
> **O que este documento NÃO faz — explicitamente:**
>
> - ❌ **NÃO autoriza execução real.**
> - ❌ **NÃO fecha gate nenhum.**
> - ❌ **NÃO libera Gov.br/SINARM.**
> - ❌ **NÃO altera `PHASE9_REAL_EXECUTION_ENABLED`.**
> - ❌ **NÃO preenche nem assina `docs/34 §16`.**
> - ❌ **NÃO altera código, CI, `package.json`, Prisma ou allowlist de rede.**
>
> **Fase 9 continua INERTE.** `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false as const`. **`docs/34 §16` continua em branco / não assinado.**
> **Gates 1, 2, 3 e 5 (`docs/26 §19`) continuam abertos.**
>
> **Data:** 2026-07-26
> **Base:** `docs/26 §19` (gates), `docs/23 §5` (12 pendências do piloto),
> `docs/33` (plano da Fase 9), `docs/34` (checklist + §16), `docs/35` (config
> segura), `docs/36` (infra), `docs/37` (Fase 8D), `docs/38` (estado atual).

---

## 1. Estado atual

Retrato factual no momento deste diagnóstico. Detalhe completo em `docs/38`.

| Dimensão | Estado hoje |
|----------|-------------|
| `main` | Limpa, sincronizada com `origin/main`, build e testes unitários passando |
| Proteção da `main` | **Ruleset ativa**: Pull Request obrigatório, `CI / verify` obrigatório, branch precisa estar atualizada, force-push bloqueado, deleção bloqueada, **sem bypass** |
| CI | `.github/workflows/ci.yml` — `npm ci` → `typecheck` → `lint` → `build` → `test:unit:all`. Sem e2e, sem browsers, sem banco, sem secrets, sem rede externa |
| Fase 9 (código) | **Presente e inerte** — `src/server/automation/phase9/` (`safety`, `networkGuard`, `auditLogger`, `phase9Runner`, `types`, `index`) |
| `PHASE9_REAL_EXECUTION_ENABLED` | **`false as const`** (`safety.ts:32`) — literal, **não** lido de env; travado por teste (`tests/unit/phase9/safety.test.ts`) |
| Laboratório sintético | Fase 8A–8D concluída contra páginas **fake locais**, com log redigido e relatório determinístico (`docs/29`, `docs/37`) |
| `docs/34 §16` | **Em branco / não assinado** |
| Gates `docs/26 §19` | **1, 2, 3 e 5 abertos** |
| Gov.br / SINARM | **Não liberados** — fora da allowlist do guard de rede |
| Automação real | **Não autorizada** |

**Observação de controle.** A proteção da `main` tem efeito direto sobre este
diagnóstico: qualquer mudança futura em `PHASE9_REAL_EXECUTION_ENABLED`, na
allowlist do `networkGuard` ou no runner **passa obrigatoriamente por Pull
Request com `CI / verify` verde**, sem bypass. Isso torna a flag auditável por
construção — não é mais possível ligá-la com um push direto e silencioso.

---

## 2. O que seria uma validação real futura

Hoje o projeto só validou automação contra **páginas sintéticas locais**. Uma
validação real futura é algo categoricamente diferente:

**Definição.** Um **único** ensaio, em **conta própria/autorizada**, contra o
ambiente oficial, que navega e preenche **até a tela "Dados da GRU" e para**,
sem gerar GRU, sem gerar protocolo e sem pagar taxa (`docs/33 §3`,
`docs/34 §2`).

O que a diferencia do laboratório atual:

| | Laboratório sintético (feito) | Validação real (não autorizada) |
|---|---|---|
| Alvo | Páginas fake locais | Ambiente oficial |
| Credencial | Nenhuma | Login Gov.br **feito pelo usuário** |
| Dados | Fictícios | Próprios/autorizados |
| Rede externa | Nenhuma | Necessária e restrita |
| Reversibilidade | Total | Só até o ponto de parada |
| Risco jurídico | Nulo | Real |

**O que ela provaria:** que os controles já exercitados no laboratório
(sessão efêmera, log redigido, parada humana, falha segura) se sustentam contra
um ambiente que o projeto não controla.

**O que ela NÃO seria:** produção, piloto, atendimento a cliente, escala, nem
autorização implícita para repetir (`docs/34 §18`).

---

## 3. O que ainda precisa ser aprovado

Nada disto está aprovado hoje. Lista de aprovações que **precisariam existir,
por escrito e antes** de qualquer ensaio:

1. **Escopo jurídico por escrito** — modelo de operação server-side sobre sessão
   autenticada do próprio usuário, sem procuração, com limites e
   responsabilidade por erro definidos (`docs/25 §9`, `docs/32`).
2. **Aprovação explícita do dono** para iniciar a Fase 9 — um processo por vez,
   parando antes do irreversível (`docs/26 §19` item 5).
3. **Preenchimento e assinatura de `docs/34 §16`** — inclui responsável técnico,
   responsável operacional, conta autorizada, escopo, data/hora e região, todos
   hoje em branco (`docs/34 §3`).
4. **Consentimento do participante** (ver §5), registrado.
5. **Decisão sobre a mudança de flag** — ligar a execução real exige alteração
   deliberada de código sob revisão, com o `docs/34 §16` já assinado
   (`safety.ts:26-31`). A ordem importa: **assinatura primeiro, código depois.**

> Enquanto qualquer um dos cinco estiver aberto, o ensaio não pode ser marcado.

---

## 4. Gates pendentes

Gates de `docs/26 §19`, com o estado registrado em `docs/38 §5`. **Este
documento não altera nenhum destes estados.**

| # | Gate (`docs/26 §19`) | Estado | O que falta |
|---|----------------------|--------|-------------|
| 1 | Escopo jurídico por escrito | **ABERTO** | Retorno jurídico registrado em `docs/32`; limites e responsabilidade por erro |
| 2 | 12 pendências do piloto (`docs/23 §5`) | **ABERTO** | Auth real + MFA, storage produção + KMS + retenção, Mercado Pago produção + webhook assinado, termos + reembolso, revisão jurídica, política operacional, treinamento |
| 3 | Postura de segurança de sessão (`docs/26 §15`) | **ABERTO** | Implementada e **revisada** — hoje existe como mecanismo no lab e como bloqueio na Fase 9, sem revisão formal registrada |
| 4 | Fase 8 (laboratório sintético) concluída | Único com **evidência registrada** (`docs/29`, `docs/37`) | Nada mapeado aqui — **este documento não o declara fechado**; a confirmação é do dono |
| 5 | Confirmação explícita do dono | **ABERTO** | Autorização escrita para iniciar a Fase 9 |

**Gate 2 é o mais pesado.** As 12 pendências de `docs/23 §5` não são
técnicas apenas: cinco delas dependem de Jurídico, Financeiro, Produto ou
Operação, não de código. Não há caminho curto — `docs/23 §5` é explícito: *"não
há resolve durante o piloto"*.

---

## 5. Requisitos de consentimento do usuário

Aplicáveis ao **participante do ensaio** (que, no escopo previsto, é o próprio
dono da conta autorizada — `docs/34 §3`: *sem cliente real*).

Precisaria estar registrado, antes do ensaio:

- [ ] Consentimento **específico** para este ensaio — não um "aceite geral".
- [ ] Ciência de que a automação **navega e preenche em nome da sessão dele**.
- [ ] Ciência do **ponto de parada** ("Dados da GRU") e de que **nenhum
      protocolo/GRU será gerado**.
- [ ] Ciência de que **o login é feito por ele**, na janela oficial — o sistema
      não recebe nem guarda a senha.
- [ ] Ciência de quais **evidências** serão registradas e de que segredos e PII
      são redigidos (`docs/34 §11`/`§12`).
- [ ] Ciência do **direito de interromper** a qualquer momento, sem justificar.
- [ ] Ciência de que **não há promessa de aprovação** de nada
      (`docs/00 §8`).
- [ ] Registro de **quem consentiu, quando e para qual escopo**.

> Nenhum destes itens está marcado. A lista é o que **precisaria** existir, não
> um formulário a ser preenchido agora.

---

## 6. Requisitos de segurança

Consolidado de `docs/34 §6`, `docs/35 §6`/`§7`/`§10` e `docs/00 §8`.

**Credenciais e sessão — invioláveis:**

- **Nunca** armazenar senha Gov.br.
- **Nunca** armazenar OTP.
- **Nunca** persistir cookie, token ou sessão em banco, arquivo ou log.
- Sessão **efêmera**, com descarte comprovado (`sessionDiscarded`).
- Browser context **descartável**, sem perfil reaproveitado.
- **Usuário no controle do login** — a automação não digita credencial.

**Logs e evidências:**

- Log **sem segredo**: redação ativa, não promessa em comentário — o mecanismo
  já existe em `src/server/automation/redaction.ts` e é compartilhado pela
  Fase 8D e pelo `auditLogger` da Fase 9 (`docs/38 §3`).
- Screenshots mascaradas ou desativadas; trace sensível desativado ou expurgado.
- **Nenhuma evidência versionada no git** (`docs/34 §12`).

**Rede:**

- Guard de rede com allowlist explícita; URL fora dela é bloqueio, não aviso.
- Gov.br/SINARM **continuam fora da allowlist** — adicioná-los é decisão
  separada, sob PR e revisão, e **não** é objeto deste documento.

**Regras permanentes (`docs/00 §8`), que nenhum ensaio suspende:**

- ❌ Não burlar captcha. ❌ Não contornar anti-bot. ❌ Não protocolar processo
  real em teste. ❌ Não prometer aprovação. ❌ Não parecer órgão oficial.
- ✅ Ambíguo/inconclusivo → **revisão humana**.

---

## 7. Requisitos técnicos

Derivado de `docs/34 §5` e `docs/35`. Estado apenas informativo — **nada aqui é
uma tarefa liberada.**

| Requisito | Situação hoje |
|-----------|---------------|
| Repo clean, branch correta | ✅ Atendido pelo fluxo atual (`main` protegida, PR obrigatório) |
| Guard de rede com allowlist | ✅ Existe (`networkGuard.ts`) — **sem** Gov.br/SINARM |
| Camada de segurança / bloqueios | ✅ Existe (`safety.ts`), retorna decisão segura, nunca exception crua |
| Audit logger com redação | ✅ Existe, consome `redaction.ts` compartilhado |
| Ponto de parada codificado | ✅ `REQUIRED_STOP_POINT = "DADOS_DA_GRU"` |
| Bloqueio de GRU/protocolo real | ✅ `assertNoRealGru` — bloqueia **sempre** nesta fase |
| Sessão efêmera + descarte | ⚠️ Marcado nos caminhos bloqueados (`sessionDiscarded: true`); **não** exercitado contra ambiente real |
| Variáveis de ambiente controladas, fora do repo | ⚠️ **Não definidas** — e a Fase 9 hoje **não** lê env; qualquer mudança nisso é decisão separada |
| Execução isolada (máquina dedicada) | ❌ **Não provisionada** |
| Playwright + Chromium disponível no ambiente do ensaio | ❌ **Não provisionado** para ensaio real (o CI não instala browsers, por desenho) |
| Artifacts configurados e gitignored | ✅ Para o lab sintético; ⚠️ política para ensaio real **não** definida |
| Health check leve antes de iniciar | ❌ **Não implementado** (`docs/33 §9`, `docs/34 §8`) |
| Interrupção manual comprovada em ambiente real | ❌ **Não exercitada** |

**Leitura do quadro:** o que existe é a **forma** do controle, provada contra
alvo sintético. O que falta é justamente o que não se pode simular: provisionar
ambiente isolado, health check real e parada manual verificada contra um sistema
que o projeto não controla.

---

## 8. Riscos

| Risco | Por que importa | Mitigação prevista (não implementada) |
|-------|-----------------|---------------------------------------|
| **Ato irreversível acidental** (GRU/protocolo gerado) | Não tem rollback do lado oficial | Parada codificada em "Dados da GRU" + `assertNoRealGru` sempre bloqueando |
| **Vazamento de credencial em log/artifact/screenshot** | Dano direto ao dono da conta | Redação ativa + screenshots mascaradas + nada versionado |
| **Persistência involuntária de sessão** | Cookie/token sobrevivendo ao ensaio | Contexto descartável + descarte comprovado |
| **Captcha / anti-bot** | Tentar contornar é proibido por regra permanente | **Parada imediata** — nunca bypass (`docs/34 §9`) |
| **Mudança de tela do sistema oficial** | Automação pode preencher campo errado | Falha segura: na dúvida, para (`docs/34 §15`) |
| **Exposição jurídica** sem gate 1 fechado | Operar sobre conta de terceiro sem escopo escrito | Gate 1 é pré-condição, não item paralelo |
| **Instabilidade do serviço oficial** | Ensaio inválido ou estado ambíguo | Health check leve; se instável, abortar e registrar |
| **Falso sinal de sucesso** | Ensaio "verde" ser lido como liberação para escalar | `docs/34 §18`: sucesso **não** libera cliente real, pagamento nem escala |
| **Deriva de escopo do próprio diagnóstico** | Documento ser citado depois como se autorizasse | Este cabeçalho e §10 existem para impedir isso |

**Risco de processo, específico deste momento:** hoje a barreira principal é
*documental* (`docs/34 §16` em branco) e *estrutural* (flag `false as const`).
Se num futuro a flag for movida para env antes dos gates fecharem, a barreira
deixa de ser auditável no diff e passa a depender de configuração de ambiente.
**Manter a flag como literal, sob PR, é parte da mitigação** — não um detalhe de
implementação.

---

## 9. Sequência futura recomendada

Ordem sugerida. **Nenhum passo está autorizado por este documento**; cada um
depende do anterior e da decisão do dono.

1. **Revisão documental dos gates** — mapear, gate a gate, o que falta e quem
   aprova (futuro `docs/40`).
2. **Diagnóstico de segurança/credenciais** — auditar o repo por menções
   sensíveis, persistência indevida e cobertura da redação (futuro `docs/41`).
3. **Fechar gate 1 (jurídico)** — retorno registrado em `docs/32`, com limites e
   responsabilidade.
4. **Endereçar gate 2** — as 12 pendências de `docs/23 §5`, com responsáveis
   nomeados; é a etapa mais longa e a menos técnica.
5. **Revisar formalmente a postura de sessão** (gate 3), incluindo a política de
   sessão/credenciais/documentos reais ainda não escrita (`docs/38 §6`).
6. **Plano técnico do menor ensaio possível** (futuro `docs/42`) — planejamento,
   ainda sem implementação.
7. **Roteiro operacional do ensaio** (futuro `docs/43`) — checklists antes,
   durante e depois.
8. **Confirmação explícita do dono** (gate 5) + **preenchimento e assinatura de
   `docs/34 §16`**.
9. **Só então**: PR técnico mínimo, revisado, para habilitar o ensaio — com CI
   verde e sem bypass.
10. **Ensaio único**, acompanhado, parando em "Dados da GRU".
11. **Registro do resultado** e decisão explícita: repetir, ajustar ou parar
    (`docs/34 §17`).

> Passos 1, 2, 6 e 7 são **documentais** e podem avançar sem tocar código.
> Passos 3 a 5 **não são técnicos** — não há PR que os resolva. Passo 9 é o
> primeiro que altera comportamento, e só existe depois do passo 8.

---

## 10. O que continua proibido

Válido **agora** e até que os gates sejam formalmente fechados:

- ❌ Executar automação real contra Gov.br/SINARM/PF.
- ❌ Acessar qualquer ambiente oficial.
- ❌ Adicionar Gov.br/SINARM/`servicos.pf`/`acesso.gov` à allowlist de rede.
- ❌ Alterar `PHASE9_REAL_EXECUTION_ENABLED`.
- ❌ Transformar a flag em variável de ambiente.
- ❌ Criar "modo real", bandeira alternativa ou caminho paralelo que contorne a
  camada de segurança.
- ❌ Gerar protocolo real.
- ❌ Gerar ou pagar GRU real.
- ❌ Usar dados de cliente real ou de terceiro.
- ❌ Armazenar senha, OTP, token, cookie ou sessão real.
- ❌ Versionar evidência sensível (screenshot, trace, documento).
- ❌ Burlar captcha ou contornar anti-bot.
- ❌ Preencher ou assinar `docs/34 §16` sem aprovação externa clara.
- ❌ Declarar gate fechado sem evidência registrada.
- ❌ Liberar outros processos (autorização de compra, emissão de CRAF etc.) para
  automação real.
- ❌ Tratar merge de infraestrutura como autorização de execução.

---

> **Fecho.** Este documento **mapeia pendências**. Ele **não** autoriza execução
> real, **não** fecha gate, **não** libera Gov.br/SINARM, **não** altera código
> e **não** toca `PHASE9_REAL_EXECUTION_ENABLED`. A Fase 9 continua **inerte**,
> `docs/34 §16` continua **em branco / não assinado**, e os **gates 1, 2, 3 e 5
> continuam abertos**. Regras permanentes (`docs/00 §8`) e bloqueios de fase
> (`docs/15`) seguem íntegros.
