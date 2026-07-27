# 40 — Revisão dos Gates para Validação Real

> **O que é este documento.** Uma **revisão documental** dos gates que travam
> qualquer automação real: o que cada um exige, onde está hoje, o que falta, quem
> aprova e qual evidência seria necessária. É **diagnóstico**, não aprovação.
>
> **O que este documento NÃO faz — explicitamente:**
>
> - ❌ **NÃO fecha nenhum gate.**
> - ❌ **NÃO preenche nem assina `docs/34 §16`.**
> - ❌ **NÃO assina nada.**
> - ❌ **NÃO afirma que existe autorização real.**
> - ❌ **NÃO autoriza execução real** nem libera Gov.br/SINARM.
> - ❌ **NÃO altera código, Fase 9, Prisma/schema/migrations ou
>   `PHASE9_REAL_EXECUTION_ENABLED`.**
> - ❌ **NÃO libera processos futuros.**
>
> **Fase 9 continua INERTE.** `PHASE9_REAL_EXECUTION_ENABLED` continua
> `false as const`. **`docs/34 §16` continua em branco / não assinado.**
> **Gates 1, 2, 3 e 5 (`docs/26 §19`) continuam abertos.**
>
> **Data:** 2026-07-26
> **Base:** `docs/26 §15`/`§19`, `docs/23 §5`, `docs/32` (retorno jurídico),
> `docs/33`, `docs/34`, `docs/35`, `docs/37`, `docs/38`, `docs/39`.

---

## 1. Lista dos gates existentes

O projeto tem **duas taxonomias** de gate, e elas não são a mesma coisa. Confundi-las
é a principal forma de achar que um gate está fechado quando não está.

**(A) Gates formais — `docs/26 §19`.** Cinco itens numerados. São *a* trava
canônica: "nenhuma automação contra o sistema real começa antes de **todos**".

**(B) Gates funcionais — por domínio de risco.** Os sete revisados aqui, pedidos
para esta revisão. Não substituem (A): são a decomposição prática de (A) em
responsabilidades e evidências.

| ID | Gate funcional | Cobre qual gate formal | Fonte principal |
|----|----------------|------------------------|-----------------|
| **G-LEGAL** | Legal / negócio | Formal **#1** | `docs/25 §9`, `docs/31`, `docs/32` |
| **G-CONSENT** | Consentimento do usuário | Formal **#1** + **#2** (itens 8, 9) | `docs/32 §3`, `docs/23 §5`, `/consentimento` |
| **G-SEC** | Segurança / credenciais | Formal **#3** | `docs/26 §15`, `docs/34 §6`, `docs/35` |
| **G-OPS** | Operacional | Formal **#2** (itens 11, 12) | `docs/23 §5`, `docs/19`, `docs/22` |
| **G-TECH** | Técnico | Formal **#4** | `docs/29`, `docs/34 §5`, `docs/37` |
| **G-LOG** | Logs / auditoria | Formal **#3** (parte) | `docs/05`, `docs/26 §15`, `docs/34 §11`/`§12` |
| **G-ROLLBACK** | Rollback / interrupção manual | Formal **#5** (pré-condição) | `docs/33 §15`, `docs/34 §13` |

> **Nota de cobertura.** O gate formal **#5** (confirmação explícita do dono) não
> tem gate funcional próprio: ele é o **ato final**, que só faz sentido depois dos
> outros. É o mesmo ato que preenche `docs/34 §16` (ver §7).

---

## 2. Estado atual de cada gate

Estado **factual**, não julgamento de mérito. "Parcial" significa: existe
evidência registrada, mas o gate **não está fechado**.

| Gate | Estado | Base do estado |
|------|--------|----------------|
| **G-LEGAL** | ⚠️ **ABERTO — com substância parcial** | `docs/32` registra **retorno jurídico positivo** sobre o modelo (§3). Mas: o texto legal final não foi redigido/assinado (`docs/32 §3`, nota de fidelidade), e o checkbox *"Retorno jurídico registrado em `docs/32`"* de `docs/34 §4` **nunca foi marcado** |
| **G-CONSENT** | 🔴 **ABERTO — e hoje contraditório com automação** | A página `/consentimento` existe e declara que **"uma pessoa da nossa equipe conduzirá as etapas"** e que **"o aplicativo não faz isso sozinho"**. Declara também: *"nenhum consentimento real é coletado nesta etapa"*. **Não há campo de consentimento no `prisma/schema.prisma`** |
| **G-SEC** | 🔴 **ABERTO** | Postura de `docs/26 §15` existe como **bloqueio** (`safety.ts`) e como **mecanismo de redação** (`redaction.ts`), mas **sem revisão formal registrada**, que é o que o gate formal #3 exige ("implementada **e revisada**") |
| **G-OPS** | 🔴 **ABERTO** | Execução **manual** validada (Fase 7, `docs/22`) e painel admin operante (`docs/19`). Mas **política operacional escrita** e **treinamento do operador** (`docs/23 §5` itens 11 e 12) seguem abertos |
| **G-TECH** | ⚠️ **Único com evidência de conclusão** | Fase 8A–8D concluída contra alvo **sintético** (`docs/29`, `docs/37`). Pré-checks de `docs/34 §5` voltados a ensaio real — ambiente isolado, Chromium, health check — **não provisionados** (`docs/39 §7`) |
| **G-LOG** | 🔴 **ABERTO** | `auditLogger.ts` sanitiza e acumula eventos, reusando `redaction.ts`. Porém é **em memória, sem persistência** (declarado no próprio módulo). A exigência de **auditoria append-only** de `docs/26 §15` **não** está atendida |
| **G-ROLLBACK** | 🔴 **ABERTO** | `sessionDiscarded: true` e `blockedSteps(...)` existem em **todos** os caminhos do `phase9Runner`. Mas nenhum desses caminhos abre sessão real — **não há evidência de descarte ou de parada manual contra ambiente real** |

**Três achados que merecem decisão sua, não só registro:**

1. **`docs/34 §4` está desatualizado em relação a `docs/32`.** O retorno jurídico
   foi registrado em 2026-07-20 e o checkbox correspondente segue vazio. Isso
   não é um gate fechado disfarçado — é um **descompasso de registro** que vale
   corrigir num PR próprio, marcando **apenas** o que `docs/32` de fato sustenta.
2. **O consentimento publicado descreve o modelo manual.** Automação real
   contradiz o texto atual (*"o aplicativo não faz isso sozinho"*). Portanto
   G-CONSENT não é só "falta redigir": exige **reescrever e re-consentir**. Não é
   detalhe de copy — é o escopo do que o usuário autorizou.
3. **Não existe modelo de usuário no schema.** Os modelos são de processo,
   documento, pagamento e execução manual — **não há `User`**. Logo o item 1 de
   `docs/23 §5` (auth real) está aberto na raiz, e consentimento não teria hoje
   onde ser persistido nem a quem ser vinculado.

---

## 3. O que falta para fechar cada gate

| Gate | Falta para fechar |
|------|-------------------|
| **G-LEGAL** | (a) Texto legal final — termos, privacidade, consentimento, cláusulas de responsabilidade — redigido e assinado pelo advogado; (b) **limites e responsabilidade por erro** registrados por escrito (exigência literal do formal #1, não coberta por `docs/32 §3`); (c) `docs/34 §4` atualizado conforme o que `docs/32` sustenta |
| **G-CONSENT** | (a) Reescrever o consentimento para descrever **automação assistida**, se e quando ela existir; (b) definir **onde e como** o consentimento é persistido (hoje: nenhum lugar); (c) fluxo de **aceite explícito** antes do primeiro atendimento real; (d) mecanismo de **revogação** com efeito prático; (e) termos e política de reembolso publicados (`docs/23 §5` itens 8, 9) |
| **G-SEC** | (a) **Revisão formal registrada** da postura de sessão contra `docs/26 §15`, item a item; (b) política escrita de sessão/credenciais/documentos reais (pendência aberta em `docs/38 §6`); (c) auth real + MFA admin (`docs/23 §5` itens 1, 2); (d) storage de produção + KMS + retenção (itens 3, 4, 5) |
| **G-OPS** | (a) Política operacional escrita (item 11); (b) treinamento do operador registrado (item 12); (c) definição de **quem acompanha** um ensaio em tempo real e com qual autoridade para interromper; (d) monitoramento e suporte definidos (`docs/32 §7`) |
| **G-TECH** | (a) Ambiente isolado provisionado; (b) Playwright + Chromium no ambiente do ensaio (o CI **não** instala browsers, por desenho); (c) **health check leve** implementado (`docs/33 §9`); (d) política de artifacts para ensaio real; (e) variáveis de ambiente controladas, fora do repo |
| **G-LOG** | (a) **Persistência append-only** da trilha de auditoria — hoje inexistente; (b) definição de retenção e expurgo da trilha (`docs/05`, `docs/15 §3.11`); (c) confirmação de que a redação cobre os campos que um ensaio real produziria (objeto do futuro `docs/41`); (d) política de screenshot/trace decidida para ensaio real (`docs/35 §5`) |
| **G-ROLLBACK** | (a) Procedimento de interrupção manual **exercitado**, ainda que contra o laboratório sintético, com evidência; (b) prova de descarte de sessão que não seja um literal `true` num caminho bloqueado; (c) critério registrado de **quem** aborta e como o abort é comunicado; (d) verificação pós-abort de que nenhum protocolo/GRU foi gerado (`docs/34 §13`) |

---

## 4. Quem deve aprovar cada gate

Aprovação **não é** trabalho de código, e nenhum PR fecha os gates abaixo.

| Gate | Aprovador | Papel do assistente |
|------|-----------|---------------------|
| **G-LEGAL** | **Advogado** (redação/assinatura) + **dono** (decisão de negócio) | Organizar material e registrar a decisão. **Não** emite parecer jurídico (`docs/32`, cabeçalho) |
| **G-CONSENT** | **Advogado** (texto) + **dono** (publicação) | Apontar contradições entre texto publicado e comportamento real |
| **G-SEC** | **Responsável técnico** (implementação) + **revisor independente** (revisão) | Implementar sob revisão; **não** se auto-aprovar |
| **G-OPS** | **Produto + Operação** (`docs/23 §5` itens 11, 12) | Documentar procedimento; não substitui treinamento |
| **G-TECH** | **Responsável técnico** | Provisionar e evidenciar |
| **G-LOG** | **Responsável técnico** + **Jurídico** (retenção/LGPD) | Implementar mecanismo; retenção é decisão jurídica |
| **G-ROLLBACK** | **Responsável técnico** + **responsável operacional** | Exercitar e evidenciar |
| **Formal #5** | **Dono do projeto — exclusivamente** | Nenhum. É ato pessoal e registrado |

> `docs/34 §3` deixa **responsável técnico** e **responsável operacional** como
> *"preencher antes"*. Enquanto forem campos vazios, não há a quem atribuir a
> aprovação de G-SEC, G-TECH, G-OPS e G-ROLLBACK. **Nomear essas pessoas é
> pré-requisito de qualquer fechamento de gate.**

---

## 5. Evidência necessária para aprovação

Regra geral: **evidência é registro verificável, não afirmação em documento.**
Um gate fechado sem artefato citável é um gate aberto com aparência de fechado.

| Gate | Evidência mínima aceitável |
|------|----------------------------|
| **G-LEGAL** | Documento jurídico assinado (termos, privacidade, consentimento, responsabilidade); registro datado do retorno em `docs/32`; `docs/34 §4` marcado com referência ao artefato |
| **G-CONSENT** | Texto publicado que descreva o comportamento **real**; registro de aceite (quem, quando, qual versão do texto, qual escopo); prova de que a revogação tem efeito |
| **G-SEC** | Relatório de revisão da postura de `docs/26 §15`, item a item, com revisor identificado e data; teste automatizado cobrindo cada invariante; auditoria do futuro `docs/41` endereçada |
| **G-OPS** | Política operacional versionada; registro de treinamento (quem, quando, conteúdo); nome do acompanhante do ensaio e sua autoridade de abort |
| **G-TECH** | Descrição do ambiente isolado; versão de Playwright/Chromium; execução de health check com saída registrada; comprovação de que artifacts estão gitignored |
| **G-LOG** | Trilha append-only persistida e consultável; amostra de trilha **redigida** de um run do laboratório; política de retenção escrita |
| **G-ROLLBACK** | Log de um abort real (motivo, etapa, horário, decisão); confirmação de descarte de sessão; verificação de que nada foi protocolado |
| **Formal #5** | `docs/34 §16` preenchido e assinado, com escopo, conta autorizada e ponto de parada explícitos |

---

## 6. Riscos se o gate for fechado sem validação

O que se perde ao marcar um checkbox sem o artefato por trás.

| Gate fechado sem validação | Consequência concreta |
|----------------------------|-----------------------|
| **G-LEGAL** | Operar sobre sessão autenticada de terceiro sem limites nem responsabilidade definidos. Exposição jurídica cai sobre o dono, não sobre o código |
| **G-CONSENT** | Automação executando sob um consentimento que descreve **operação manual** — divergência entre o autorizado e o executado. É o risco mais grave desta revisão: contamina LGPD, contrato e confiança |
| **G-SEC** | Senha/OTP/cookie/token vazando em log, artifact ou screenshot. Impacto não é só de dados: `docs/32 §9` registra risco à **segurança física dos titulares** |
| **G-OPS** | Ensaio sem ninguém habilitado a interromper. O ponto de parada existe no código, mas quem decide abortar é pessoa |
| **G-TECH** | Ensaio inválido (ambiente sujo) ou dano por preenchimento errado — `docs/32 §9` marca **erro de arma/PCE** como risco crítico |
| **G-LOG** | Ensaio sem trilha: nada de provar o que aconteceu, nem de demonstrar que segredo não foi registrado. Falha de auditoria é irrecuperável **depois** |
| **G-ROLLBACK** | Descobrir na hora que não há caminho de abort — justamente quando o abort é necessário |
| **Formal #5** | Execução real sem autorização registrada do dono. É exatamente o cenário que `PHASE9_REAL_EXECUTION_ENABLED = false` existe para impedir |

**Risco transversal:** fechar gate por acúmulo de documentação. Nenhum dos
documentos 39–43 fecha gate; se em algum momento a existência deles for tratada
como progresso de gate, a trava vira burocracia sem efeito. Documento é insumo
de decisão, não a decisão.

---

## 7. Relação com `docs/34 §16`

- `docs/34 §16` é o **bloco de aprovação explícita**: a materialização do gate
  formal **#5**. Sem ele preenchido e assinado, o checklist **não autoriza nada**
  (`docs/34 §16`, `§20`).
- **Continua em branco / não assinado.** Este documento **não** o preenche,
  **não** o assina e **não** reduz o que ele exige.
- **Ordem obrigatória:** §16 é o **último** ato, não o primeiro. Assiná-lo antes
  de G-LEGAL, G-CONSENT, G-SEC, G-OPS, G-TECH, G-LOG e G-ROLLBACK inverte a
  função do bloco — ele deixaria de ser aprovação informada.
- **Campos hoje vazios** que dependem dos gates acima: região/superintendência,
  responsável técnico, responsável operacional, data/hora planejada
  (`docs/34 §3`), além de aprovador, escopo, conta autorizada e assinatura
  (`docs/34 §16`).
- **Relação com o código:** `phase9Runner.ts` registra
  `HUMAN_CONFIRMATION_REQUIRED` e aborta com a mensagem canônica
  *"Execução real da Fase 9 ainda não autorizada. docs/34 §16 pendente."* O §16
  não é só documental — é o motivo declarado do bloqueio em runtime.
- **Ordem entre §16 e a flag:** primeiro §16 assinado, **depois** alteração de
  código sob revisão (`safety.ts:26-31`). Nunca o inverso.

---

## 8. Relação com `docs/39`

| | `docs/39` | `docs/40` (este) |
|---|-----------|------------------|
| Pergunta | *O que falta antes de uma validação real?* | *Onde está cada gate, e quem fecha?* |
| Recorte | Amplo — estado, requisitos, riscos, sequência | Profundo nos **gates** |
| Saída | Mapa de pendências | Matriz gate × estado × falta × aprovador × evidência |

- `docs/39 §4` lista os gates **formais** (`docs/26 §19`) e seu estado. Este
  documento **detalha** aquela seção pela taxonomia funcional (§1) — não a
  contradiz e **não** altera nenhum estado ali registrado.
- `docs/39 §9` propõe a sequência futura; este documento é o **passo 1** dessa
  sequência. O passo 2 (auditoria de segurança/credenciais) é o futuro
  `docs/41`, referenciado em §3 (G-SEC, G-LOG) como quem endereça as pendências
  de redação e persistência.
- Ambos compartilham a mesma restrição: **diagnóstico, sem autorização.** Nem
  isolados nem somados fecham gate.

---

## 9. Checklist de consentimento do usuário

Nenhum item marcado. É o que **precisaria** existir — não um formulário a ser
preenchido agora. Complementa `docs/39 §5`, focando no que é **mecanismo** e não
só ciência.

**Texto e escopo:**

- [ ] Consentimento descreve o comportamento **real** (se houver automação, dizer
      que há automação).
- [ ] Consentimento **específico** para o ensaio, distinto do aceite geral.
- [ ] Escopo explícito: qual processo, qual conta, quantas execuções.
- [ ] Ponto de parada declarado ("Dados da GRU", sem gerar GRU/protocolo).
- [ ] Ausência de promessa de aprovação, explícita (`docs/00 §8`).

**Credenciais:**

- [ ] Declarado que **o usuário faz o login** na janela oficial.
- [ ] Declarado que senha/OTP **não são vistos, pedidos nem guardados**.
- [ ] Declarado que cookie/token **não são persistidos**.

**Mecanismo (hoje inexistente):**

- [ ] Onde o consentimento é **persistido** — decisão pendente.
- [ ] **Versionamento** do texto aceito (qual redação o usuário viu).
- [ ] Registro de **quem, quando, qual escopo**.
- [ ] **Revogação** com efeito prático e registrado.
- [ ] Vínculo a uma identidade — **depende de auth real** (`docs/23 §5` item 1).

**Durante e depois:**

- [ ] Direito de **interromper a qualquer momento**, sem justificar.
- [ ] Ciência de quais **evidências** são registradas e de que há redação.
- [ ] Ciência da **retenção** aplicada à trilha.

---

## 10. Conclusão

- **Nenhum gate foi fechado neste PR.** Este documento é revisão documental.
- **`docs/34 §16` continua em branco / não assinado.** Nada aqui o preenche.
- **Gates 1, 2, 3 e 5 (`docs/26 §19`) continuam abertos.** G-TECH (formal #4) é o
  único com evidência de conclusão registrada, e **este documento não o declara
  fechado** — a confirmação é do dono.
- **Não existe autorização real.** Automação real contra Gov.br/SINARM continua
  proibida.
- `PHASE9_REAL_EXECUTION_ENABLED` continua **`false as const`**; a Fase 9 continua
  **inerte**.
- **Bloqueador não técnico mais pesado:** G-CONSENT. O consentimento publicado
  descreve execução **manual por pessoa da equipe** — automação real exigiria
  reescrever o texto e re-consentir, além de criar o mecanismo de persistência
  que hoje não existe em nenhum lugar do schema.
- **Próximo passo diagnóstico:** auditoria de segurança/credenciais (futuro
  `docs/41`), que endereça as pendências de G-SEC e G-LOG apontadas em §3.

---

> **Fecho.** Este documento **revisa** gates. Ele **não fecha** gate, **não
> assina** nada, **não preenche `docs/34 §16`**, **não afirma que há autorização
> real**, **não altera código nem Prisma** e **não libera processos futuros**.
> Regras permanentes (`docs/00 §8`) e bloqueios de fase (`docs/15`) seguem
> íntegros.
