# 42 — Plano Técnico do Ensaio Controlado Futuro

> **O que é este documento.** Um **plano técnico**: descreve como *seria* um
> ensaio controlado da Fase 9, caso — no futuro — todos os gates sejam
> aprovados. É desenho, não construção.
>
> **O que este documento NÃO faz — explicitamente:**
>
> - ❌ **NÃO é implementação** e **NÃO muda código.**
> - ❌ **NÃO altera `PHASE9_REAL_EXECUTION_ENABLED`** nem transforma a flag em env.
> - ❌ **NÃO altera a allowlist** nem libera rede oficial.
> - ❌ **NÃO executa nada** e **NÃO altera processo real.**
> - ❌ **NÃO fecha gate** e **NÃO substitui consentimento formal.**
> - ❌ **NÃO preenche `docs/34 §16`.**
>
> **Fase 9 continua INERTE.** `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false as const`. **`docs/34 §16` agora contém autorização operacional
> explícita assinada (2026-07-29), mas isso não equivale à liberação técnica:**
> a execução real continua bloqueada até a conclusão dos gates técnicos
> aplicáveis, PR técnico separado e manutenção das proteções de credenciais,
> sessão e ponto de parada.
> **Gates 1, 2, 3 e 5 (`docs/26 §19`) continuam abertos.** Automação real
> continua **não autorizada**.
>
> **Data:** 2026-07-27
> **Base da `main`:** `3154da1` — hardening da redação mergeado.
> **Referências:** `docs/33` (plano da Fase 9), `docs/34` (checklist + §16),
> `docs/35` (config segura), `docs/36` (infra), `docs/39` (diagnóstico),
> `docs/40` (gates), `docs/41` (auditoria de credenciais).

---

## 1. Objetivo do ensaio controlado futuro

**Provar que os controles já exercitados contra alvo sintético se sustentam
contra um ambiente que o projeto não controla** — e nada além disso.

Concretamente, um ensaio **único**, em **conta própria/autorizada**, que navega e
preenche até a tela **"Dados da GRU"** e **para**, sem gerar GRU, sem gerar
protocolo e sem pagar taxa (`docs/33 §3`, `docs/34 §2`).

O que se busca observar — e que o laboratório sintético **não** consegue provar:

| Controle | Hoje (sintético) | O que o ensaio acrescentaria |
|----------|------------------|------------------------------|
| Sessão efêmera | `sessionDiscarded: true` é literal em caminho bloqueado | Descarte **observado** de sessão que existiu |
| Parada humana | Nenhuma sessão para interromper | Interrupção **exercitada** contra tela real |
| Log redigido | Provado contra dados fictícios | Provado contra texto que o projeto não escreveu |
| Falha segura | Exceções sintéticas (`docs/30`) | Tela que mudou sem aviso |
| Health check | Não implementado | Serviço indisponível de verdade |

> O ensaio **não** busca velocidade, taxa de sucesso, nem viabilidade comercial.
> Busca **evidência de que o freio funciona.**

---

## 2. O que continua fora do escopo

- ❌ Cliente real, dado de terceiro, procuração.
- ❌ Mais de **um** processo; mais de **uma** execução.
- ❌ Processo que não seja **Guia de Tráfego** (`docs/32 §8`).
- ❌ Gerar GRU, gerar protocolo, pagar taxa.
- ❌ Qualquer ato irreversível no órgão.
- ❌ Burlar captcha ou contornar anti-bot (`docs/00 §8` — permanente).
- ❌ Produção, piloto, escala, lançamento.
- ❌ Liberar outros processos (autorização de compra, emissão de CRAF).
- ❌ Tratar sucesso do ensaio como autorização para repetir (`docs/34 §18`).

---

## 3. Pré-condições obrigatórias

Hoje só a autorização operacional do `docs/34 §16` existe; **todas as demais**
continuam pendentes e precisariam estar satisfeitas **antes**:

**Formais**

- [x] `docs/34 §16` **preenchido e assinado** — aprovador, escopo, conta
      autorizada, ponto de parada, data. *(2026-07-29 — autorização
      **operacional**; não fecha gate técnico nem libera execução real.)*
- [ ] `docs/34 §3` com os campos hoje vazios: região/superintendência,
      responsável técnico, responsável operacional, data/hora planejada.
- [ ] Consentimento específico registrado (`docs/40 §9`).

**Ambiente**

- [ ] Máquina/servidor **isolado e dedicado**, sessão limpa.
- [ ] Playwright + Chromium provisionados **no ambiente do ensaio** — o CI
      deliberadamente **não** instala browsers.
- [ ] Variáveis de ambiente controladas, fora do repo.
- [ ] Artifacts configurados e **gitignored** (`.gitignore:46`, `:51`).
- [ ] Rede do ambiente registrada e observável.

**Operacional**

- [ ] Acompanhante humano presente, com autoridade explícita de abort.
- [ ] Janela de execução acordada, fora de horário crítico do serviço.
- [ ] Canal de registro do ensaio definido (onde o relatório vai parar).

---

## 4. Gates que precisam estar fechados antes

Do `docs/40`, com o estado **atual** — nenhum alterado por este documento:

| Gate | Estado hoje | Bloqueia o ensaio? |
|------|-------------|--------------------|
| **G-LEGAL** | ⚠️ aberto, substância parcial (`docs/32`) | **Sim** |
| **G-CONSENT** | 🔴 aberto — texto publicado descreve execução **manual** | **Sim** |
| **G-SEC** | 🔴 aberto — falta revisão formal registrada | **Sim** |
| **G-OPS** | 🔴 aberto — política operacional e treinamento | **Sim** |
| **G-TECH** | ⚠️ único com evidência (`docs/29`, `docs/37`) | Parcial — falta ambiente |
| **G-LOG** | 🔴 aberto — trilha **em memória**, sem append-only | **Sim** |
| **G-ROLLBACK** | 🔴 aberto — descarte declarado, não observado | **Sim** |
| **Formal #5** (`docs/26 §19`) | 🔴 aberto — confirmação do dono | **Sim** |

> **G-CONSENT merece destaque.** A página `/consentimento` afirma hoje que *"uma
> pessoa da nossa equipe conduzirá as etapas"* e que *"o aplicativo não faz isso
> sozinho"*. Um ensaio automatizado **contradiz o texto vigente**. Fechar este
> gate exige reescrever e **re-consentir**, não só marcar um checkbox.

---

## 5. Alteração técnica mínima imaginada

**A menor mudança possível não é "ligar a flag".** A flag é o último passo de um
conjunto; ligá-la sozinha só faria o runner cair no caminho `abort()` que hoje é
inalcançável (`phase9Runner.ts`, comentário do bloco final).

O conjunto mínimo, em ordem de dependência:

**M1 — Persistência da trilha de auditoria** (fecha parte de G-LOG). O
`auditLogger` declara no próprio módulo que *"ainda NAO grava em banco"*. Sem
trilha append-only não há como auditar o ensaio depois. É pré-requisito, não
acessório.

**M2 — Driver de execução real.** Hoje `runPhase9` é **síncrono e sem I/O**. Um
ensaio exige um driver Playwright que implemente os 12 passos já **nomeados** em
`PLANNED_STEPS` (`HEALTH_CHECK` … `SESSION_DISCARD`) e que hoje retornam todos
`BLOCKED`. O contrato de passos já existe; falta a implementação por trás.

**M3 — Health check leve** (`docs/33 §9`) — o passo `HEALTH_CHECK` existe como
nome e não como código.

**M4 — Entrada de allowlist restrita ao host oficial do serviço.** Atenção: hoje
o `networkGuard` tem **trava dura** — `FORBIDDEN_HOST_PATTERN` bloqueia
`gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` **mesmo que alguém os coloque
na allowlist**. Um ensaio exigiria remover ou condicionar essa trava, e isso é
**a mudança mais perigosa do conjunto**: é a única que, sozinha, transforma um
sistema incapaz de tocar o órgão em um sistema capaz.

**M5 — Mudança da flag**, por último, com `docs/34 §16` já assinado.

**Princípios que a alteração deveria respeitar:**

- **Flag continua literal, não env** — a inércia precisa ser auditável no diff.
  Mover para env transfere a decisão para configuração de ambiente, fora do PR.
- **Nada de "modo real" paralelo** que contorne `safety.ts`. Os bloqueios devem
  continuar sendo o caminho único.
- **`assertNoRealGru` permanece bloqueando sempre** — não há ensaio em que gerar
  GRU seja aceitável.
- **Um PR por peça**, sob revisão, com CI verde e sem bypass.

---

## 6. Como manter o usuário no controle do login Gov.br

- A automação **abre a janela oficial** e **para**. Não digita, não preenche, não
  submete credencial.
- O **usuário** digita login, senha e segundo fator, na interface oficial.
- O sistema aguarda um sinal de "sessão pronta" observável **sem ler credencial**
  — por exemplo, a presença do estado autenticado na página.
- Nenhum campo do `Phase9ExecutionRequest` recebe credencial hoje, e **isso deve
  permanecer**: o tipo é a barreira mais barata contra "só um campinho de senha".
- O passo já se chama `HUMAN_LOGIN` em `PLANNED_STEPS` — o nome deve continuar
  descrevendo a realidade.
- Se a autenticação falhar ou divergir, **parar** (`docs/34 §9`).

---

## 7. Como impedir armazenamento de senha/OTP/token/cookie

Baseline favorável, verificado em `docs/41 §3`: **não existe** modelo `User`,
campo de senha, token, cookie ou sessão no `prisma/schema.prisma`. Nada persiste
credencial hoje.

Para manter assim durante um ensaio (`docs/35 §6`):

- **Novo browser context por execução**; sem `storageState` persistente.
- **Sem** salvar cookies, `localStorage` ou `sessionStorage`.
- **Nunca** persistir cookie/token em banco — e **não criar** o campo que
  permitiria.
- **Nunca** logar cookie/token: coberto pelas duas camadas de redação
  (`docs/41 §9.1`).
- **Nenhum** campo de credencial no request, como em §6.

> A proteção mais forte aqui não é a redação — é **não haver onde guardar**.
> Qualquer PR futuro que adicione campo de credencial ao schema deveria ser
> tratado como mudança de gate, não como detalhe de implementação.

---

## 8. Como garantir `sessionDiscarded`

Hoje `sessionDiscarded: true` é um **literal** nos três pontos de saída do
runner, em caminhos que nunca abriram sessão (`docs/41 §6`). Para virar garantia
de verdade:

- Fechar o contexto no **`finally`**, para valer em sucesso, erro e cancelamento.
- O campo deve refletir o **resultado do fechamento**, não uma constante — se o
  descarte falhar, `sessionDiscarded` precisa ser `false` e o ensaio, um
  incidente.
- Registrar o evento `SESSION_DISCARDED` **depois** do descarte efetivo, não
  antes.
- Verificar, após o ensaio, que nenhum artefato de sessão sobreviveu em disco.
- Manter o teste que trava o invariante, **estendido** para o caminho real.

---

## 9. Como registrar logs seguros

O que já existe e deve ser reusado, sem reimplementar:

- **Duas camadas de redação** (`redaction.ts`): por **chave** (`isSecretKey`) e
  por **conteúdo** (`Bearer`/`Basic`/`Digest`/`Negotiate`/`Token`, JWT, par
  `chave=valor` sensível, OTP por contexto).
- **Política de chave**: a chave permanece como evidência; só o valor morre.
- **Métrica numérica preservada** — `durationMs`, `bytes`, `attempt`,
  `tentativas` continuam números (`sanitizeMeta`).
- **Artifacts gitignored**, incluindo screenshots.

O que **falta** e é pré-requisito:

- **Persistência append-only** (M1 / A5) e política de retenção.
- **Screenshots mascaradas ou desativadas** para ensaio real — política ainda
  **não decidida** (A7).
- **Trace sensível** desativado ou expurgado.

**Limites conhecidos, que valem também no ensaio** (`docs/41 §9.3`): segredo em
prosa sem par `chave=valor` não é mascarado; `Set-Cookie` multiatributo pode
manter atributo de nome não listado (A12).

---

## 10. Como interromper manualmente

- **Quem** interrompe: o acompanhante humano de §3, com autoridade declarada.
- **Como**: um comando de abort que não dependa da automação estar saudável —
  fechar o browser precisa bastar.
- **Quando**: a qualquer momento, sem justificar, e **obrigatoriamente** nos
  critérios de §15.
- **O que acontece depois**: descarte de sessão (§8), registro do motivo, etapa e
  horário, e verificação de que nada foi protocolado (§11).
- **Precondição honesta**: interrupção manual **nunca foi exercitada** contra
  ambiente real (`docs/40 §2`, G-ROLLBACK). Convém ensaiar o abort **contra o
  laboratório sintético** antes, para que o primeiro teste do freio não seja em
  ambiente oficial.

---

## 11. Como evitar protocolo/GRU indevido

Defesa em profundidade, do código ao humano:

1. **`REQUIRED_STOP_POINT = "DADOS_DA_GRU"`** — `evaluateSafety` bloqueia
   qualquer request com outro ponto de parada.
2. **`assertNoRealGru()`** — bloqueia **sempre**, independentemente de flag. Não
   deve ganhar exceção.
3. **Passo `STOP_AT_GRU`** explícito no fluxo, antes de `SESSION_DISCARD`.
4. **Nenhum clique em "Gerar GRU e Salvar"** — proibição literal de `docs/34 §2`.
5. **Confirmação humana** antes de qualquer ato sensível — e, neste ensaio, a
   resposta correta é sempre *não prosseguir*.
6. **Verificação pós-ensaio** de que nenhum protocolo/GRU foi gerado e nenhuma
   taxa paga (`docs/34 §13`).

> Se em algum momento o ensaio "precisar" avançar além da tela de GRU para
> provar algo, a resposta é **parar e replanejar** — não avançar.

---

## 12. Como fazer rollback

- **Antes do irreversível**: interromper em qualquer etapa anterior a "Dados da
  GRU" **não tem efeito no órgão**. Esse é o motivo de o ponto de parada existir.
- **Sessão**: fechar browser, descartar cookies/tokens/cache, registrar o
  descarte.
- **Artifacts**: revisar e remover o que for sensível; confirmar que nada entrou
  no git.
- **Registro**: motivo, etapa, horário, decisão tomada.
- **Código**: como cada peça de §5 seria um PR próprio, o rollback técnico é
  reverter os PRs — com a flag voltando a `false as const` como estado final.
- **Limite honesto**: se um ato irreversível ocorrer por engano, **não há
  rollback do lado oficial**. Toda a arquitetura existe para que esse caso não
  aconteça, não para remediá-lo.

---

## 13. Como revisar o ensaio depois

- Produzir `docs/37`-equivalente de registro: o que aconteceu, etapa a etapa.
- Anexar a **trilha redigida** (M1) e o relatório interno.
- Confirmar: sessão descartada, nenhum protocolo, nenhuma taxa, nenhum dado
  sensível versionado.
- Comparar o observado com os critérios de §14 e §15.
- Revisar se algum **limite conhecido** (§9) se manifestou na prática.
- **Decidir explicitamente**: repetir, ajustar ou parar (`docs/34 §17`).
- **Não** avançar para cliente real automaticamente (`docs/34 §18`).

---

## 14. Critérios de sucesso

O ensaio só é sucesso se **todos** ocorrerem:

- [ ] Chegou à tela **"Dados da GRU"**.
- [ ] **Parou** antes do ato irreversível.
- [ ] **Nenhum** protocolo gerado; **nenhuma** taxa paga.
- [ ] **Sessão descartada**, com descarte **observado** (não declarado).
- [ ] **Trilha completa** e **redigida**, sem segredo.
- [ ] Usuário manteve o controle do login em todos os momentos.
- [ ] **Nenhum** dado sensível versionado.
- [ ] Relatório interno produzido.

> **Falhar parando é sucesso parcial aceitável. Avançar sem certeza é falha**,
> ainda que a tela final tenha sido alcançada (`docs/34 §15`).

---

## 15. Critérios de parada

**Parada imediata**, sem discussão, em qualquer um (`docs/33 §14`, `docs/34 §9`):

- 🔴 Captcha inesperado — **nunca** contornar.
- 🔴 Login/autorização divergente do esperado.
- 🔴 Tela diferente do mapeado.
- 🔴 Campo obrigatório ausente.
- 🔴 Arma/PCE ambígua — `docs/32 §9` marca como risco crítico.
- 🔴 Dado que não bate.
- 🔴 Documento não aceito.
- 🔴 Serviço instável.
- 🔴 Erro inesperado.
- 🔴 Falha ao descartar sessão.
- 🔴 Suspeita de que algo foi registrado no órgão.
- 🔴 **Qualquer dúvida** operacional ou jurídica.

---

## 16. Motivos para NÃO seguir

Razões legítimas para o ensaio **nunca acontecer** — e não são fracasso:

- **Os gates não fecham.** G-CONSENT exige reescrever o consentimento e
  re-consentir; G-LEGAL depende de texto jurídico assinado; o gate 2
  (`docs/23 §5`) tem 12 pendências, cinco delas fora de engenharia.
- **O custo do erro é assimétrico.** O ganho é evidência técnica; a perda
  possível envolve conta do dono, dados de titulares e exposição jurídica.
- **A execução manual assistida já funciona** (Fase 7, `docs/22`) e é o que o
  consentimento publicado descreve. Automação real é otimização, não requisito.
- **Risco à segurança física dos titulares** em caso de vazamento
  (`docs/32 §9`) — não é risco de reputação apenas.
- **Mudança regulatória** no setor pode alterar as premissas a qualquer momento.
- **Se M4 (allowlist) parecer arriscado demais, essa é a resposta**, não um
  obstáculo a contornar.

> Decidir **não** executar é um desfecho válido deste plano.

---

## 17. Pendências abertas antes de qualquer ensaio

Herdadas de `docs/41 §9` — **nenhuma iniciada**, nenhuma liberada aqui:

| # | Pendência | Por que importa no ensaio |
|---|-----------|---------------------------|
| **A4** | **`redact`/serializer no `logger` pino** de aplicação | A redação vive no caminho lab/Fase 9; o logger geral **não** tem redact. Um `logger.info({ token })` fora daquele caminho registra em claro. Num ensaio real há mais código no caminho, e mais chance de alguém logar pelo canal errado |
| **A11** | **Teto de tamanho** pelo custo quadrático (4 k → 14 ms; 16 k → 230 ms; ~100 k → segundos) | Mensagem de erro de página oficial pode ser grande. Hoje é inofensivo porque meta e mensagens do lab são curtas — num ensaio, não necessariamente |
| **A12** | **Decisão sobre `Set-Cookie` inteiro** | Atributo posterior com nome fora da lista sobrevive (`set-cookie: a=1; refresh=X`). Decidir se o header deve ser redigido até o fim da linha, aceitando perder prosa de diagnóstico |
| **—** | **Convenção de nomes** para evitar sobre-redação | `certificado*` e `assinatura*` entraram nos termos sensíveis, então `certificadoRegistro` (o CR, documento central do domínio CAC) e `assinaturaPlano` viram `[REDACTED]`. Nenhum existe no código hoje. Convém convencionar **inglês para dado de domínio não sensível** — `certificateNumber`, `subscriptionPlan` — como já se faz com `processTypeCode` |

Além dessas, seguem abertas de `docs/41 §9`: **A5** (append-only, que é o M1 de
§5), **A6** (descarte observado, §8), **A7** (política de screenshot, §9), **A8**
(webhook *timing-safe*), **A9** (env secreta como `enum`) e **A10** (auth real +
MFA).

> **Ordem sugerida:** A5/M1 e A6 são pré-condição de auditabilidade do ensaio.
> A4, A11 e A12 reduzem risco de vazamento e deveriam vir antes. A convenção de
> nomes é barata e evita perder evidência. A8–A10 não bloqueiam o ensaio, mas
> bloqueiam piloto/produção.

---

> **Fecho.** Este documento **planeja**. Ele **não** implementa, **não** altera
> código, **não** altera `PHASE9_REAL_EXECUTION_ENABLED`, **não** toca a
> allowlist, **não** libera rede oficial, **não** executa nada, **não** altera
> processo real, **não fecha gate** e **não substitui consentimento formal**. A
> Fase 9 continua **inerte**; o `docs/34 §16` passou a conter **autorização
> operacional assinada (2026-07-29), que não é liberação técnica**, e os
> **gates 1, 2, 3 e 5 continuam abertos**. Regras permanentes
> (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem íntegros.
