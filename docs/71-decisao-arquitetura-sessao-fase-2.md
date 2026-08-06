# 71 — Decisão: arquitetura da sessão autenticada na Fase 2

> **O que é este documento.** A primeira decisão da **Fase 2 (Motor de
> automação)**, respondendo ao item deixado explícito no
> [`docs/70 §7.6`](70-encerramento-fase-1-base-do-saas.md): **como a sessão
> autenticada do cliente no Gov.br/SINARM/PF poderia chegar ao ambiente de
> automação de forma segura**. Estuda e compara opções; **não implementa
> nenhuma**.
>
> **A Fase 2 começa apenas como decisão, preparação, laboratório e desenho
> técnico.**
>
> - ❌ **NÃO abre** execução real e **NÃO** é autorização para tocar
>   Gov.br/SINARM/PF.
> - ❌ **NÃO usa** credencial real, CPF real, senha, OTP ou cookie real.
> - ❌ **NÃO altera** a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED` — segue
>   `false as const`.
> - ❌ **NÃO altera** código, `src`, `prisma`, migration, testes,
>   `package.json` ou `package-lock.json`.
> - ❌ **NÃO implementa** Playwright real nem contra alvo real.
> - ❌ **NÃO altera** a política de captcha, que continua **nunca burlar**.
> - ❌ **NÃO toca** o `docs/66`.
>
> **Data:** 2026-08-05
> **Base da `main`:** `1b95c95` — *docs: close phase 1 foundation (#139)*
> **Referências:** [`docs/70 §7`](70-encerramento-fase-1-base-do-saas.md) (o que
> a Fase 2 pode e não pode ser), [`docs/25 §7`](25-visao-automacao-e-decisoes-negocio.md)
> (regras permanentes de automação segura), [`docs/26 §15/§18/§19`](26-arquitetura-automacao-hibrida.md)
> (segurança de sessão, regras permanentes e gates), [`docs/39 §5/§6`](39-diagnostico-validacao-real-futura.md)
> (consentimento e segurança para validação real), [`docs/41 §3/§9`](41-gate-seguranca-credenciais.md)
> (não há onde guardar credencial hoje), [`docs/42 §6/§7/§8`](42-plano-tecnico-ensaio-controlado-futuro.md)
> (login humano, não-armazenamento, descarte de sessão),
> [`docs/09 §15`](09-reconhecimento-sinarm-cac.md) (fluxo observado do órgão),
> [`docs/23 §5`](23-checklist-piloto-real.md) (12 pendências de produção).

---

## 1. Status da decisão

| # | Registro |
|---|---|
| 1.1 | **Decisão de arquitetura registrada** — de direção, não de construção. |
| 1.2 | **A Fase 2 está aberta como preparação/laboratório/desenho**, conforme `docs/70 §7.1`. |
| 1.3 | **A Fase 2 NÃO está aberta como execução real** (`docs/70 §7.2`). |
| 1.4 | **Nenhuma linha de código é escrita aqui.** Docs-only. |
| 1.5 | **A Fase 9 continua bloqueada** (§8). |
| 1.6 | Este documento **resolve o `docs/70 §7.6`** no nível de *decisão de caminho*; **não** o resolve no nível de contrato implementado — isso é PR futuro (§7). |
| 1.7 | **Nenhum gate do `docs/26 §19` é fechado aqui.** |

---

## 2. O problema central

### 2.1 Como o cliente autentica hoje no Gov.br/SINARM/PF

Observado em reconhecimento manual (`docs/09 §15`), sem automação:

| # | Etapa |
|---|---|
| 2.1.1 | O portal do órgão (`servicos.pf.gov.br/...`) **não tem conta própria** — redireciona para o **Gov.br** (`sso.acesso.gov.br`). |
| 2.1.2 | Sequência de telas: **CPF → senha → autorização de compartilhamento**. |
| 2.1.3 | A conta Gov.br é **do cidadão**, pessoal e intransferível, com **segundo fator** possível. |
| 2.1.4 | Concluído o login, o navegador do cliente passa a ter uma **sessão autenticada** com o órgão. |
| 2.1.5 | Toda a jornada útil (Guia de Tráfego, dados, GRU) acontece **dentro dessa sessão**. |

### 2.2 Como a automação poderia continuar a jornada

O motor determinístico do `docs/26` só serve para alguma coisa **depois** que
essa sessão existe. Ele não cria a sessão — ele a **continua**. Daí o problema:

> A sessão nasce **no navegador do cliente**. O motor roda **em outro lugar**.
> Toda a Fase 2 depende de responder: **o que atravessa essa distância — e o que
> nunca pode atravessar.**

### 2.3 Por que isso é pré-condição do motor de automação

| # | Razão |
|---|---|
| 2.3.1 | Sem sessão autenticada, o motor não vê nenhuma tela útil — o laboratório sintético (`docs/27`–`docs/30`) existe justamente porque nada real está acessível. |
| 2.3.2 | A escolha aqui define **onde o motor roda** (navegador do cliente, servidor, ou nenhum dos dois) — e isso muda infra, custo, risco e escopo jurídico. |
| 2.3.3 | Define **o que o produto pode prometer**: automação total, automação parcial guiada, ou apenas orientação. |
| 2.3.4 | Define o **modelo de responsabilidade**: quem clicou o ato irreversível, o cliente ou o sistema. |
| 2.3.5 | O `docs/26 §19.1` exige **escopo jurídico por escrito** sobre "server-side operando a sessão autenticada do usuário" — a peça jurídica não pode ser escrita antes de a arquitetura estar decidida. |
| 2.3.6 | Um contrato de sessão errado **contamina tudo o que for construído em cima** — refazer depois é caro; decidir agora é barato. |

### 2.4 Por que isso não pode depender de senha armazenada

| # | Razão |
|---|---|
| 2.4.1 | **Regra permanente do projeto**: nunca armazenar senha Gov.br (`docs/00 §8`, `docs/25 §7`, `docs/26 §18`). Não é preferência — é linha vermelha já registrada. |
| 2.4.2 | A conta Gov.br é **pessoal do cidadão** e dá acesso a muito mais que o SINARM — guardar a senha é assumir a identidade civil digital do cliente inteira. |
| 2.4.3 | O segundo fator **existe para impedir exatamente isso**; contorná-lo é derrotar o controle, não usá-lo. |
| 2.4.4 | Guardar senha de dono de arma faz da infra um **alvo de altíssimo valor** (`docs/26 §15`, `docs/25 §8`) — a base vira lista de quem tem arma **mais** a chave para agir como essa pessoa. |
| 2.4.5 | Hoje **não existe onde guardar**: sem modelo `User`, sem campo de senha, token, cookie ou sessão no schema (`docs/41 §3`). A ausência é a proteção mais forte que temos — e é deliberada (`docs/42 §7`). |
| 2.4.6 | Sob LGPD, tratar credencial de acesso a serviço público é risco desproporcional à finalidade: o produto quer **protocolar um processo**, não **ser o cliente**. |

---

## 3. Restrições obrigatórias

Valem sobre **qualquer** opção deste documento. Nenhuma é negociada aqui.

| # | Restrição | Origem |
|---|---|---|
| 3.1 | **Não armazenar senha Gov.br** — em banco, disco, log, memória persistente ou campo de request. | `docs/00 §8`, `docs/25 §7`, `docs/26 §18` |
| 3.2 | **Não armazenar cookie/token de sessão real** sem decisão própria e posterior. Hoje: **não persistir**. | `docs/26 §15`, `docs/42 §7` |
| 3.3 | **Nunca burlar captcha nem contornar anti-bot** — sem 2captcha, anti-captcha, resolvedor externo ou fingerprint evasion. Captcha **degrada para humano**. | `docs/00 §8`, `docs/25 §7`, `docs/70 §6.1.11` |
| 3.4 | **Não executar contra portal real** — Gov.br, SINARM, PF ou qualquer certidão externa. | `docs/70 §6.1`, `networkGuard.ts:22` |
| 3.5 | **Playwright apenas em `localhost`/laboratório sintético.** | `docs/70 §7.4` |
| 3.6 | **`PHASE9_REAL_EXECUTION_ENABLED` continua `false as const`**, hard-coded. | `phase9/safety.ts:32` |
| 3.7 | **LGPD, need-to-know, redação e auditoria** aplicam-se a qualquer desenho — inclusive aos sintéticos. | `docs/05`, `docs/41 §9` |
| 3.8 | **Sessão real só depois dos gates futuros** (§6) e de autorização explícita do dono. | `docs/26 §19`, `docs/70 §7.5` |
| 3.9 | **Nunca esconder do cliente que há automação** — qualquer opção precisa ser explicável em uma frase verdadeira. | `docs/25 §7` |
| 3.10 | **Ato irreversível só com confirmação humana** — "Gerar GRU e Salvar", seleção de arma, pagamento. | `docs/25 §7`, `docs/26 §18` |

---

## 4. Opções de arquitetura

Quatro caminhos possíveis. Comparados, não escolhidos por eliminação
automática — a recomendação está na §5.

### 4.1 Opção A — cliente executa a etapa autenticada no próprio navegador

**Como seria.** O servidor **orienta**: monta o roteiro, valida dados antes,
prepara o que for preciso e diz ao cliente exatamente o que fazer. O **cliente**
abre o portal, autentica no Gov.br e executa a etapa autenticada **no próprio
navegador**. O sistema recebe de volta **apenas o resultado** — número de
protocolo, PDF da GRU, comprovante — quando e como o cliente permitir.

| Aspecto | Avaliação |
|---|---|
| **Credencial** | Nunca sai do navegador do cliente. Risco **mínimo**. |
| **Sessão** | Nunca atravessa fronteira nenhuma. Nada a persistir, nada a descartar. |
| **Captcha** | Resolvido pelo cliente, humano, sem qualquer tensão de política. |
| **Jurídico** | O mais simples: o cliente age em nome próprio; o sistema orienta e registra. Sem procuração, sem "operar sessão alheia". |
| **LGPD** | O que entra é resultado, não credencial — superfície pequena. |
| **Automação** | **Baixa** — o valor é orientação, validação prévia, checagem e organização, não execução. |
| **Continuidade** | É o modelo de hoje (`docs/22`, execução assistida manual), com o cliente no lugar do operador interno. |
| **Custo de infra** | Baixo. Sem browser server-side, sem isolamento por sessão. |

> **Leitura honesta.** A Opção A **não é o motor de automação** que o `docs/26`
> desenha. É o degrau imediatamente antes dele — e é o único que pode existir
> hoje sem nenhum gate novo.

### 4.2 Opção B — sessão assistida com handoff controlado

**Como seria.** O cliente autentica **ele mesmo** na interface oficial — o
sistema **abre a janela e para**, nunca digita credencial (`docs/42 §6`).
Estabelecida a sessão, a automação **continua a jornada** num ambiente
controlado, com o cliente presente, até parar antes de qualquer ato
irreversível para confirmação humana.

| Aspecto | Avaliação |
|---|---|
| **Credencial** | Nunca é digitada, lida ou transmitida pelo sistema. Mas a **sessão resultante** é operada por ele. |
| **Sessão** | É exatamente aqui que mora o problema: efêmera, isolada por processo, não persistida, descartada com garantia verificável (`docs/26 §15`, `docs/42 §8`). |
| **Captcha** | Degrada para humano — sempre, sem exceção. |
| **Jurídico** | Exige o **escopo jurídico por escrito** do `docs/26 §19.1`: o servidor opera a sessão autenticada do usuário, sem procuração, com limites e responsabilidade por erro definidos. **Não existe hoje.** |
| **LGPD** | Exige consentimento explícito, específico e revogável (`docs/39 §5`), com finalidade e prazo. |
| **Automação** | **Alta** — é o caminho que entrega a promessa do `docs/26`. |
| **Risco** | **Alto**: infra vira alvo de alto valor; falha de isolamento vaza sessão de dono de arma; quebra do portal vira incidente. |
| **Custo de infra** | Alto — isolamento por processo/cliente, expurgo, observabilidade, incidente. |
| **Autorização** | **Não autorizada ainda.** Nenhum gate do `docs/26 §19` está fechado. |

> **Nota de continuidade.** A Opção B **já está parcialmente desenhada** — o
> `docs/42 §6/§7/§8` descreve o login humano, o não-armazenamento e o descarte
> de sessão. O que falta não é ideia: é **contrato, gate e prova**.

### 4.3 Opção C — execução remota com credencial

**Como seria.** O cliente entregaria senha, OTP ou cookie ao sistema, que
autenticaria sozinho e executaria sem presença dele.

| # | Registro |
|---|---|
| 4.3.1 | **REJEITADA para o produto.** Não é "adiada", não é "depende de gate" — é rejeitada. |
| 4.3.2 | Viola diretamente `docs/00 §8`, `docs/25 §7` e `docs/26 §18` — regras permanentes, não preferências de fase. |
| 4.3.3 | Viola o princípio de **não armazenar credencial**, mesmo que o armazenamento fosse "temporário" ou "criptografado": OTP repassado é senha repassada. |
| 4.3.4 | Transformaria a base em alvo catastrófico: identidade civil digital de donos de arma. |
| 4.3.5 | A Opção C fica **rejeitada para o produto sob as regras atuais**, e **não pode reaparecer como "detalhe técnico"** em PR futuro. Qualquer tentativa de reabertura exigiria **decisão formal própria**, com **revisão jurídica**, **revisão de segurança**, **análise LGPD**, **consentimento explícito**, **retenção**, **auditoria**, **KMS/segredos** e **revogação explícita** das regras que hoje proíbem armazenar ou repassar senha, OTP, cookie ou credencial Gov.br. |
| 4.3.6 | **Consequência prática:** nenhum campo de credencial pode ser adicionado ao `Phase9ExecutionRequest` nem ao schema. O tipo é a barreira mais barata (`docs/42 §6/§7`). |

> **Por que ela é listada, se está rejeitada.** Porque é a opção que aparece
> sozinha quando alguém pede "automatize tudo" sem ler as regras. Registrá-la
> como rejeitada é mais barato do que rediscuti-la a cada PR.

### 4.4 Opção D — API oficial ou integração permitida

**Como seria.** Integração por interface oficial — API pública, convênio,
credenciamento, ou qualquer via que o órgão ofereça deliberadamente.

| Aspecto | Avaliação |
|---|---|
| **Credencial** | Credencial **de integração**, do prestador, não do cidadão. Muda a natureza do problema por inteiro. |
| **Sessão** | O problema da §2 **deixa de existir** na forma em que está posto. |
| **Captcha** | Não se aplica. |
| **Jurídico** | O mais sólido: uso previsto e autorizado, não uso tolerado. |
| **Automação** | Potencialmente **total e estável** — sem quebra por mudança de layout. |
| **Disponibilidade** | **Desconhecida.** Nenhum documento do projeto registra existência, ausência ou termos de uma API oficial para o fluxo do SINARM/CAC. |
| **Status** | **Melhor caminho quando existir.** Exige **descoberta e documentação oficial** antes de qualquer estimativa. Fora de implementação agora. |

> **O que falta.** Uma descoberta formal: existe API/convênio/credenciamento
> para este fluxo? Sob que termos? Para quem? É a mesma família de trabalho da
> descoberta dos portais de certidões externas (`docs/70 §6.1.10`) — e deve ser
> feita **antes** de investir em B, porque um resultado positivo tornaria boa
> parte de B desnecessária.

### 4.5 Comparação lado a lado

| Critério | A — cliente executa | B — handoff assistido | C — credencial remota | D — API oficial |
|---|---|---|---|---|
| Risco de credencial | Mínimo | Baixo (nunca lida) | **Inaceitável** | N/A |
| Risco de sessão | Nenhum | **Alto** | Altíssimo | Nenhum |
| Grau de automação | Baixo | Alto | Alto | Alto |
| Gate jurídico necessário | Leve | **Pesado** (`§19.1`) | Impossível | Convênio/termos |
| Custo de infra | Baixo | Alto | Alto | Médio |
| Explicável ao cliente em 1 frase | Sim | Sim, com cuidado | Não honestamente | Sim |
| Existe hoje? | Parcial (`docs/22`) | Desenho parcial (`docs/42`) | — | Desconhecido |
| **Status** | **Viável agora** | **Alvo futuro, sob gates** | **REJEITADA** | **Melhor, se existir** |

---

## 5. Recomendação para a Fase 2

**Recomendado: preparar B em laboratório sintético, mantendo A como o que o
produto realmente entrega no curto prazo, e abrir a descoberta de D em
paralelo.**

| # | Recomendação |
|---|---|
| 5.1 | **Laboratório sintético primeiro.** Evoluir `docs/27`–`docs/30` e `docs/37` — página fake, dados fictícios, `localhost`. Nenhum alvo real. |
| 5.2 | **Modelar o handoff sem dados reais.** O laboratório ganha uma etapa de "login sintético" que **imita a forma** do handoff (a automação abre, para, espera sinal de sessão pronta, continua) sem nenhuma credencial verdadeira. |
| 5.3 | **Criar um contrato de sessão abstrato** — um tipo/protocolo que descreve *o que a automação recebe* (um handle opaco de sessão, com escopo e expiração) e, principalmente, **o que ela nunca recebe** (senha, OTP, cookie, CPF). O contrato é a peça que impede o campo de credencial de nascer "por engano". |
| 5.4 | **Testar apenas contra `localhost`.** Playwright, se e quando entrar, só no sintético. |
| 5.5 | **Não liberar nada real.** Nem sessão, nem portal, nem cliente, nem CPF. |
| 5.6 | **Manter a Opção A como o produto de hoje.** Enquanto B não passa pelos gates, o valor entregue continua sendo orientação, validação prévia e registro auditável — que é o modelo já decidido (`docs/25 §2`, `docs/70 §4.1`). |
| 5.7 | **Abrir a descoberta da Opção D** como trabalho paralelo, fora do código, junto com o gate jurídico. Resultado positivo muda a prioridade de tudo. |
| 5.8 | **Tratar a Opção C como encerrada**, não como pendência. |

> **Por que preparar B sem autorizá-lo.** Porque o custo de B não está no
> código — está no **contrato, no consentimento, no isolamento e na prova de
> descarte**. Essas peças podem ser desenhadas e exercitadas inteiramente contra
> uma página sintética, e é exatamente isso que torna o gate futuro decidível: o
> dono e o jurídico vão avaliar algo demonstrável, não uma promessa.

> **Por que não recomendar A como destino final.** A entrega valor real, mas não
> é o motor de automação — e o `docs/60 §11` define a Fase 2 como motor. Fixar A
> como destino seria decidir, por omissão, encerrar a ambição do produto. A é o
> **piso**, não o teto.

---

## 6. Gates mínimos antes de qualquer sessão real

Nenhum item abaixo está fechado. São **conjuntivos** — um aberto impede a
sessão real, mesmo que todos os outros passem.

| # | Gate | Estado |
|---|---|---|
| 6.1 | **Decisão jurídica por escrito** — server-side operando sessão autenticada do usuário, sem procuração, com limites e responsabilidade por erro (`docs/26 §19.1`, `docs/25 §9`) | ❌ aberto |
| 6.2 | **Consentimento explícito, específico, informado e revogável**, com finalidade e prazo (`docs/39 §5`) | ❌ aberto |
| 6.3 | **Política de sessão escrita** — efêmera, isolada, não persistida, expiração, revogação (`docs/26 §15`) | ❌ aberto |
| 6.4 | **Logs e auditoria append-only** do ato automatizado, sem credencial | ❌ aberto |
| 6.5 | **Redação verificada** nas duas camadas (`docs/41 §9.1`), estendida ao caminho real | ❌ aberto |
| 6.6 | **KMS/criptografia em repouso**, se e somente se algum segredo passar a existir — o padrão continua **não haver segredo** | ❌ aberto |
| 6.7 | **Política de retenção e expurgo** de artefatos, screenshots e resultados (`docs/15 §3.11`) | ❌ aberto |
| 6.8 | **Isolamento por processo e por cliente** — contexto novo por execução, sem `storageState` compartilhado (`docs/42 §7`) | ❌ aberto |
| 6.9 | **Revisão de captcha e anti-bot** — confirmar que a degradação para humano cobre todos os pontos e que nada no desenho tenta contornar | ❌ aberto |
| 6.10 | **Aprovação técnica** — laboratório sintético concluído com sucesso medido (`docs/26 §19.4`) | ❌ aberto |
| 6.11 | **As 12 pendências do `docs/23 §5`** (`docs/26 §19.2`) | ❌ abertas |
| 6.12 | **Confirmação explícita do dono** (`docs/26 §19.5`) | ❌ aberto |
| 6.13 | **`PHASE9_REAL_EXECUTION_ENABLED` continua `false`** até decisão própria, em PR próprio, sob revisão — fechar os gates acima **não** liga a flag automaticamente | 🔒 travado |

> **6.13 é diferente dos demais.** Os outros são pré-condições; este é uma
> **trava independente**. Mesmo com 6.1–6.12 fechados, ligar a execução real
> continua exigindo o bloco `docs/34 §16` assinado **mais** alteração deliberada
> de código sob revisão (`docs/70 §8.7`).

---

## 7. O que fica proibido durante a Fase 2 de preparação

Lista **normativa**, não informativa:

| # | Proibido |
|---|---|
| 7.1 | **Gov.br real** — login, navegação, requisição, qualquer toque |
| 7.2 | **SINARM/PF real** |
| 7.3 | **CPF real** e qualquer PII real |
| 7.4 | **Senha real** — de cliente, de teste, de qualquer pessoa |
| 7.5 | **Cookie/token de sessão real** |
| 7.6 | **Bypass de captcha** — inclusive 2captcha, anti-captcha ou qualquer resolvedor externo |
| 7.7 | **Produção** — nenhum ambiente de produção envolvido |
| 7.8 | **Cliente real** — nenhum piloto, nenhum voluntário, nenhuma "só uma vez" |
| 7.9 | **Fase 9** — nenhuma alteração, nenhuma habilitação |
| 7.10 | **Automação de pagamento no Banco do Brasil** (`docs/67 §8`, `docs/70 §6.3`) |
| 7.11 | **Certidões externas reais** (`docs/70 §6.9`, `§6.1.10`) |
| 7.12 | **Campo de credencial** em request, tipo, schema ou formulário |

---

## 8. Relação com a Fase 9

| # | Registro |
|---|---|
| 8.1 | **`PHASE9_REAL_EXECUTION_ENABLED = false as const`** — `src/server/automation/phase9/safety.ts:32`, hard-coded, não ligável por env. **Não alterado por este documento.** |
| 8.2 | O passo `HUMAN_LOGIN` já existe em `PLANNED_STEPS` (`phase9Runner.ts:35`) e **descreve a realidade**: o humano autentica. Nada aqui o altera nem o promove a execução real. |
| 8.3 | O **guard de rede** continua bloqueando `gov.br`, `servicos.pf`, `sinarm` e `acesso.gov` mesmo se adicionados à allowlist (`networkGuard.ts:22`). |
| 8.4 | Os gates do `docs/26 §19` seguem **íntegros** — nenhum é fechado aqui. |
| 8.5 | **Abrir a Fase 2 como preparação não afrouxa, não revisa e não fecha a trava da Fase 9** (`docs/70 §7.3`). |
| 8.6 | Nenhuma das 12 pendências do `docs/23 §5` é fechada por este documento. |

---

## 9. Próximo passo após este documento

| # | Passo |
|---|---|
| 9.1 | **Próximo PR, docs-only:** `docs: design synthetic automation lab` — desenho do laboratório sintético da Fase 2, incluindo a etapa de handoff sintético (§5.2) e o **contrato de sessão abstrato** (§5.3). |
| 9.2 | Esse PR **também não implementa** — desenha. Playwright real, se vier, é PR próprio e posterior, contra `localhost`. |
| 9.3 | **Em paralelo, fora do código:** abrir a descoberta da Opção D (§4.4) e o gate jurídico (§6.1). São os dois itens de maior alavancagem e não dependem de nenhuma linha de código. |
| 9.4 | **Não** iniciar nada da Opção B contra alvo real, em nenhuma circunstância, antes da §6 inteira. |

---

## 10. Proibições deste PR

Este PR **não**:

- ❌ altera código, `src`, `prisma`, testes, `package.json` ou `package-lock.json`;
- ❌ cria migration nem usa `db:push`;
- ❌ implementa Playwright, motor de automação ou contrato de sessão;
- ❌ acessa Gov.br, SINARM ou PF;
- ❌ usa credencial, senha, OTP, cookie, CPF ou PII real;
- ❌ altera a política de captcha;
- ❌ altera a Fase 9 nem `PHASE9_REAL_EXECUTION_ENABLED`;
- ❌ abre a Fase 2 como execução real;
- ❌ fecha nenhum gate do `docs/26 §19`;
- ❌ fecha nenhuma das 12 pendências do `docs/23 §5`;
- ❌ toca o `docs/66`;
- ❌ altera `docs/25`, `docs/26` ou `docs/70`.

---

> **Fecho.** A pergunta que o `docs/70 §7.6` deixou aberta — **como a sessão
> autenticada do cliente chegaria ao ambiente de automação** — tem agora uma
> direção decidida, não uma implementação. Das quatro opções, a **C (credencial
> remota) está REJEITADA em definitivo**, por violar regra permanente e não por
> falta de gate; a **D (API oficial)** é o melhor caminho **se existir**, e a
> descoberta que responde isso está aberta; a **A (cliente executa)** é o que o
> produto entrega hoje e continua sendo o piso; e a **B (handoff assistido)** é
> o alvo — preparada em **laboratório sintético**, com **contrato de sessão
> abstrato**, **sem nenhum dado real** e **apenas contra `localhost`**. Os **13
> gates da §6 seguem todos abertos**, `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false as const`, os gates do `docs/26 §19` seguem íntegros, as 12 pendências
> do `docs/23 §5` seguem abertas e a **Fase 2 continua sendo apenas decisão,
> preparação, laboratório e desenho técnico**. Nada aqui autoriza tocar
> Gov.br/SINARM/PF.
