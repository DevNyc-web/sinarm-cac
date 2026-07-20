# 31 — Material para o Gate Jurídico da Automação

> **O que é este documento.** Um material **organizado para levar ao advogado/
> jurídico** e obter **resposta formal por escrito** antes de qualquer automação
> real contra Gov.br/SINARM. Reúne o que o projeto é, o que já foi feito, a
> arquitetura pretendida e as **perguntas objetivas** que precisam de resposta.
>
> **Isto NÃO é parecer jurídico** e **NÃO libera** automação real. É o **pedido de
> análise**. As respostas do jurídico é que destravam (ou não) a Fase 9.
>
> **Data:** 2026-07-20
> **Commit base:** `f1ae61d` — *test: add synthetic exception paths for automation lab*
> **Base:** `docs/23` (piloto), `docs/24` (UX/comunicação), `docs/25` (visão),
> `docs/26` (arquitetura híbrida — gates §19), `docs/29`/`docs/30` (validação do
> laboratório sintético).

---

## 1. Objetivo do material jurídico

Obter **resposta jurídica formal e por escrito** sobre a legalidade, os limites e as
condições da automação assistida/autorizada **antes** de qualquer teste real —
inclusive em conta própria. Enquanto não houver essa resposta, **nenhuma** automação
toca Gov.br/SINARM, nenhum dado real é usado e nenhum piloto real ocorre.

---

## 2. Resumo do projeto (linguagem simples)

- **Plataforma privada** que auxilia pessoas (CACs) em processos junto ao
  SINARM/CAC. **Primeiro caso: Guia de Tráfego** (autorização para transportar a
  arma até clube/evento de tiro).
- **Não é órgão oficial** e **não tem vínculo** com Gov.br, Polícia Federal ou
  Exército.
- **Não promete aprovação** — quem defere é o órgão competente.
- O usuário **contrata uma assistência tecnológica/operacional**: a plataforma
  **organiza, preenche, registra, audita e mostra o status** do processo.
- **Visão futura:** **automação assistida e autorizada** — o sistema conduz o
  máximo do fluxo previsível, com o usuário presente autorizando e confirmando os
  atos sensíveis (`docs/25`, `docs/26`).

---

## 3. Estado atual (o que já existe)

- **Fases 1–7** implementadas em **modo dev/fictício** (rascunho → documento fake →
  Pix sandbox → operação admin → execução manual registrada por humano).
- **Fase 8** validada como **laboratório sintético local** (`docs/29`):
  - **8A** — página fake que imita o fluxo da Guia de Tráfego;
  - **8B** — automação **Playwright apenas contra a página fake em `localhost`**;
  - **8C** — cenários de exceção sintéticos, provando **falha segura** (`docs/30`).
- **Nenhuma automação real foi executada.** **Sem Gov.br/SINARM real. Sem dados
  reais. Sem PII real. Sem pagamento real. Sem protocolo real.**

> Ou seja: existe **prova técnica sintética**, não operação real. Este documento
> trata do que seria necessário para, **no futuro**, sair do sintético.

---

## 4. Arquitetura pretendida da automação real

Fluxo pretendido (ainda **não implementado**; depende deste gate):

1. Usuário **cria o processo** no app (destino, arma/PCE indicada, justificativa).
2. Usuário **aceita termos e consentimento específico** (§6).
3. Sistema **verifica a disponibilidade** do serviço externo (health check leve).
4. Usuário **paga** o serviço (com preço e reembolso exibidos antes).
5. Usuário **faz login/autorização** na janela oficial do Gov.br quando necessário
   (o app nunca vê a senha).
6. **Automação server-side executa as etapas autorizadas** do formulário.
7. Sistema **mostra status/etapas** ao usuário.
8. Usuário **confirma os dados sensíveis** antes do ato irreversível (§7).
9. Sistema **gera/obtém GRU e protocolo** conforme a autorização.
10. **Logs e evidências** são guardados conforme política (§13/§14).
11. A **sessão é descartada** ao fim.

---

## 5. Locus de execução (ponto central)

- A automação pretendida **roda no servidor/infraestrutura da empresa**
  (server-side).
- O **usuário autoriza** o acesso e está presente para as autorizações do órgão.
- A **sessão deve ser efêmera** — existir só durante a execução.
- **Cookies/tokens não devem ser persistidos** em banco ou disco.
- **Credenciais Gov.br não devem ser armazenadas** em hipótese alguma.
- **Logs não devem conter** senha, token, cookie ou qualquer segredo.

> Este é o ponto que mais precisa de validação jurídica: **software da empresa
> operando a sessão autenticada do usuário, no servidor da empresa** (§11).

---

## 6. Consentimento do usuário (pontos a cobrir)

- Consentimento para **tratamento de dados** (LGPD).
- Consentimento para **execução automatizada/assistida** (que há automação).
- Consentimento para acessar **somente o sistema/serviço necessário** (SINARM/CAC),
  e apenas enquanto houver autorização ativa.
- Consentimento para **gerar GRU/protocolo após confirmação** do usuário.
- Ciência de que a **plataforma é privada** (não é órgão oficial).
- Ciência de que **não há garantia de aprovação**.
- Ciência de que **os dados precisam estar corretos** (e das consequências de dado
  incorreto confirmado).
- Aceite de **termos, privacidade, reembolso e cláusula de responsabilidade**.

---

## 7. Confirmação antes de ato irreversível

- Antes de gerar GRU/protocolo, o usuário **vê um resumo** dos dados.
- O usuário **confirma**: arma/PCE, destino, finalidade, documentos e taxa.
- **Sem confirmação explícita, o fluxo não avança.**
- A **GRU/taxa só é gerada/paga depois** dessa confirmação (reduz o custo de erro).
- A confirmação é **registrada em log** (quem, quando, o quê).

---

## 8. GRU, pagamento e reembolso

- **Pagamento do serviço** (usuário → empresa) é **distinto** da **taxa/GRU** (taxa
  do órgão), embora o preço embuta a GRU.
- Se o serviço externo estiver **instável antes do pagamento** → **bloquear/não
  cobrar** e avisar.
- Se **cair após o pagamento** → processo em **fila/retomada**, sem nova cobrança.
- **Reembolso:** integral antes do início da execução; parcial conforme estágio.
- **Taxa oficial já paga/gerada pode não ser reembolsável** (houve ato irreversível
  e custo no órgão) — validar redação com o jurídico (`docs/23 §8`, `docs/24 §13`).
- **Responsabilidade por informação errada confirmada pelo usuário** vs.
  **responsabilidade por falha técnica da plataforma** — ver §9.

---

## 9. Responsabilidade por erro (perguntas)

1. Se a **automação preencher dado errado** e o **usuário confirmar**, qual a
   responsabilidade da empresa?
2. Se o **usuário informar dado errado**, qual a responsabilidade dele?
3. Se houver **falha do sistema externo** (órgão), como tratar responsabilidade e
   reembolso?
4. Se a plataforma **gerar GRU/protocolo errado**, como mitigar (refazer, corrigir,
   reembolsar)?
5. **Cláusulas de limitação de responsabilidade** são válidas neste contexto
   (consumidor / CDC)?
6. É necessário **seguro**, **termo específico** ou **aceite reforçado** para os
   atos sensíveis?

---

## 10. Representação perante órgão público (perguntas)

1. A atividade **configura representação** perante órgão público?
2. **Exige procuração/mandato**?
3. Se **não exige**, isso deve **constar expressamente nos termos**?
4. Há **diferença jurídica** entre **um humano operar** e **um software operar** o
   fluxo em nome do usuário?
5. Há diferença entre **assistência técnica** e **despachante** (e implicações
   regulatórias de cada enquadramento)?
6. Pode ser **comercializado nacionalmente**, ou há **diferença por estado/
   superintendência** da PF?

---

## 11. Gov.br e sessão autenticada (perguntas)

1. É **lícito o usuário autorizar** a plataforma a **operar sua sessão
   autenticada**?
2. O **servidor da empresa** pode **conduzir a sessão autorizada** do usuário?
3. Quais são os **limites do consentimento** para esse acesso?
4. Existe **vedação nos Termos de Uso do Gov.br**?
5. Existe **vedação nos Termos da PF/SINARM** (`servicos.pf.gov.br`)?
6. A empresa pode usar **browser automatizado** desde que **autorizada** e **sem
   burlar** termos/segurança?
7. Quais **práticas são proibidas** (ex.: burlar captcha, contornar anti-bot,
   armazenar senha)?
8. Há **obrigação de informar explicitamente** ao usuário que há **automação**?

---

## 12. Captcha, anti-bot e disponibilidade (perguntas)

1. O que fazer se **aparecer captcha**?
2. É **proibido automatizar** em ambiente com captcha?
3. É **permitido parar e pedir ação humana** (usuário resolve o captcha)?
4. **Health check leve** antes do pagamento é permitido?
5. **Monitorar disponibilidade** pode ser considerado **uso indevido**?
6. Qual **frequência segura** para essa verificação?

> Premissa técnica do projeto: **nunca burlar captcha** e **nunca contornar
> anti-bot** — se surgir desafio real, o **humano/usuário** resolve (`docs/26 §9`).

---

## 13. Dados tratados e LGPD

**Dados possivelmente tratados:**
- identificação do usuário;
- CPF/RG;
- dados do CAC;
- dados de **arma/PCE** (número SIGMA, série, calibre…);
- endereço/destino;
- documentos (identificação);
- número de protocolo;
- GRU;
- logs;
- screenshots mascaradas;
- evidências de consentimento.

**Perguntas:**
1. Qual a **base legal** adequada (execução de contrato a pedido do titular?
   consentimento?)?
2. Dados de **arma/PCE** exigem **tratamento reforçado** (sensibilidade prática /
   risco à segurança do titular)?
3. Qual **prazo de retenção** por tipo de dado?
4. Como fazer o **expurgo**?
5. Como atender aos **direitos do titular** (acesso, correção, exclusão)?
6. Há necessidade de **DPO/encarregado**?
7. Qual **política de incidentes** exigida?
8. **Criptografia/KMS** — o que é obrigatório?
9. **Acesso por operador** — regras de need-to-know/segregação?
10. É necessário **DPIA/RIPD** (relatório de impacto)?

---

## 14. Segurança de sessão e infraestrutura (pontos a validar)

- **Sessão efêmera**; descarte ao fim.
- **Isolamento por processo**.
- **Não persistência** de cookie/token.
- **Logs sem segredo** (sem senha/token/cookie).
- **Screenshots mascaradas** (sem PII visível).
- **Criptografia em repouso** para PII.
- **MFA** para perfis internos (admin/operador/financeiro/suporte).
- **Segregação de permissões** (quem executa ≠ quem libera pagamento).
- **Trilha de auditoria append-only**.
- **Servidores por região/superintendência** como **possibilidade futura** de
  escala e alinhamento à jurisdição (`docs/25 §4.7`).
- **Risco de datacenter/IP** (assinatura de automação a partir de IP de datacenter)
  — a validar tecnicamente e do ponto de vista de ToS.
- **Medidas mínimas obrigatórias antes de produção** (as 12 pendências do
  `docs/23 §5`).

> Consequência já registrada: rodar server-side faz da infra um **alvo de alto
> valor** (sessões de proprietários de arma) — dever de cuidado elevado
> (`docs/25 §8`).

---

## 15. Comunicação e marketing (perguntas)

1. Como **comunicar** o serviço **sem parecer órgão oficial**?
2. O uso dos termos **“CAC”, “SINARM”, “Guia de Tráfego”** é aceitável (e em que
   contexto)?
3. Quais **disclaimers obrigatórios** (ex.: “serviço privado”, “não garantimos
   aprovação”, “não somos órgão oficial”)?
4. Quais **frases são proibidas** (ex.: “aprovação garantida”, “sistema oficial”)?
5. Como **evitar promessa de aprovação** em todos os canais (inclusive boca a boca
   do operador)?
6. Como **explicar a automação** de forma verdadeira — **sem assustar e sem
   omitir**?

> Base já levantada internamente: frases proibidas/recomendadas e 7 avisos
> obrigatórios em `docs/24 §3/§4/§14`.

---

## 16. Escopo do primeiro piloto (proposta ao jurídico)

- **Poucos processos** (3 a 10), **um de cada vez** no início.
- **Apenas Guia de Tráfego** (nenhum outro tipo).
- **Dados de cliente real somente após produção segura** (auth real + MFA + storage
  + KMS + retenção — `docs/23 §5`).
- **Clientes conhecidos/indicados**, cientes de que é piloto.
- **Revisão humana** nos primeiros processos (`docs/10 §12`).
- **Logs reforçados** e trilha completa.
- **Sem outros tipos de processo**, **sem urgência**, **sem caso ambíguo**
  (`docs/23 §13/§14`).

---

## 17. Perguntas objetivas para resposta formal

1. Podemos **operar o fluxo SINARM/CAC em nome do usuário mediante consentimento**?
2. É **necessária procuração/mandato**?
3. **Software operando** a sessão autorizada tem **tratamento diferente** de um
   **humano operando**?
4. O **servidor da empresa** pode **conduzir a sessão autorizada** do usuário?
5. Podemos usar **Playwright/browser automatizado** se **não burlarmos captcha nem
   os termos de uso**?
6. Quais **termos precisam ser aceitos** pelo usuário?
7. Que **responsabilidade** temos por **erro confirmado pelo usuário**?
8. Quais **dados** podemos **armazenar** e **por quanto tempo**?
9. Quais **medidas mínimas de segurança** são **obrigatórias antes do piloto**?
10. Como **comunicar** o serviço **sem parecer órgão oficial** nem **prometer
    aprovação**?

---

## 18. Respostas necessárias antes da Fase 9

**Sem resposta formal por escrito, NÃO avançar para:**
- teste **em conta própria** (real);
- teste **com cliente real**;
- **automação contra Gov.br/SINARM**;
- **coleta de PII real**;
- **pagamento real** de taxa;
- **piloto real**.

---

## 19. Anexos / referências internas

- `docs/23-checklist-piloto-real.md` — 12 pendências do piloto e critérios de
  aceite/recusa.
- `docs/24-revisao-ux-textos-conformidade.md` — frases proibidas/recomendadas e
  avisos obrigatórios.
- `docs/25-visao-automacao-e-decisoes-negocio.md` — visão, decisões e go-to-market.
- `docs/26-arquitetura-automacao-hibrida.md` — arquitetura híbrida e **gates (§19)**.
- `docs/29-validacao-fase-8-laboratorio-automacao.md` — validação do laboratório.
- `docs/30-fase-8c-excecoes-sinteticas.md` — cenários de exceção e falha segura.

---

## 20. Conclusão

- O projeto tem **prova técnica sintética** madura (laboratório fake, caminho feliz
  + exceções, tudo em `localhost`).
- A **próxima trava é jurídica/segurança**, não técnica.
- Este documento **organiza o pedido de análise** para o jurídico.
- **Nenhuma automação real deve ocorrer antes das respostas formais** (§18) e do
  fechamento dos **gates do `docs/26 §19`**.

---

> **Lembrete permanente:** este material é **insumo para o jurídico**, não parecer.
> Não autoriza automação real, não toca Gov.br/SINARM, não usa dados reais. Cada
> avanço depende de **resposta jurídica formal**, do fechamento dos gates do
> `docs/26 §19` e de **confirmação explícita** do dono.
