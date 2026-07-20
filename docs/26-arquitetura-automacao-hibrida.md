# 26 — Arquitetura de Automação Híbrida (Caminho 3)

> **O que é este documento.** Planejamento de **arquitetura** para a automação
> futura do projeto, no modelo **híbrido (Caminho 3)**: um **motor determinístico**
> (Playwright/Puppeteer) executa o fluxo previsível, o **backend do app orquestra**,
> a **IA apoia** apenas exceções/validação/diagnóstico/recuperação, e o **humano**
> confirma atos sensíveis e trata ambiguidade.
>
> **NÃO é código. NÃO libera automação real. NÃO autoriza tocar Gov.br/SINARM.**
> É arquitetura e planejamento. A implementação depende dos **gates** do §19 e de
> **confirmação explícita** do dono.
>
> **Estado atual (2026-07-20):** Fases 1–7 implementadas e validadas em
> **dev/fictício**; o MVP é **seguro/manual/assistido**. A **visão futura** de
> automação server-side autorizada está registrada em **docs/25**. Este documento
> detalha **como** essa automação seria arquitetada — não **quando** nem autoriza
> começar.
>
> **Base:** `docs/00` (regras permanentes), `docs/09 §15` (fluxo do órgão),
> `docs/10`/`docs/11` (MVP e operação), `docs/15` (decisões/gates),
> `docs/23 §5` (12 pendências do piloto), `docs/25` (visão de automação).

---

## 1. Objetivo da arquitetura híbrida

Definir uma arquitetura que **automatize o máximo do fluxo previsível** da Guia
de Tráfego com **execução determinística e auditável**, mantendo **humano no
controle dos atos irreversíveis** e usando **IA só onde ela agrega** (exceções,
interpretação, recuperação), sem que a IA seja crítica no caminho feliz.

Metas de projeto:
- **Previsibilidade:** o caminho feliz roda por passos fixos, testáveis, repetíveis.
- **Segurança:** nada irreversível sem confirmação humana; sessão efêmera; auditoria total.
- **Custo controlado:** IA opcional, fora do caminho crítico (§17).
- **Degradação graciosa:** qualquer imprevisto **cai para humano**, nunca "empurra".

---

## 2. Três abordagens comparadas

| Abordagem | Como funciona | Prós | Contras |
|---|---|---|---|
| **IA controla tudo** (agente clica) | um modelo lê a tela e decide cada clique/campo | flexível a mudanças de layout; pouco código de fluxo | **não determinístico**, caro por processo, difícil de auditar/reproduzir, alto risco em ato irreversível, alucinação vira clique errado |
| **Playwright/Puppeteer determinístico** | script fixo com seletores/etapas conhecidas | previsível, barato, testável, rápido, auditável passo a passo | frágil a mudanças de layout; ruim para o inesperado; não "entende" mensagem nova |
| **Híbrido (Caminho 3) — recomendado** | motor determinístico executa; IA só interpreta exceção/valida; humano confirma sensível | previsível no feliz + resiliente no imprevisto; IA barata (só na exceção); humano protege o irreversível | mais peças para orquestrar; exige disciplina de "quando chamar IA vs. humano" |

**Decisão:** adotar o **híbrido**. O determinístico é o motor; a IA é o
copiloto de exceção; o humano é a trava dos atos sensíveis.

---

## 3. Decisão principal

- **Playwright/Puppeteer é o motor de execução previsível.** O caminho feliz
  (login disparado, preenchimento, navegação, anexos, leitura, download) roda por
  **passos determinísticos**.
- **A IA NÃO clica em tudo em produção.** Ela **não** é responsável por conduzir o
  fluxo nem por atos sensíveis.
- **A IA é apoio** para exceções, classificação de erro, comparação de texto
  esperado × encontrado, sugestão de recuperação, resumo operacional e detecção de
  "precisa de humano".
- **O humano** confirma atos irreversíveis, resolve ambiguidade e faz suporte.
- **Consequência de projeto:** a automação deve funcionar **mesmo se a IA estiver
  indisponível** — nesse caso, a exceção simplesmente vai para humano.

---

## 4. Papel de cada camada

| Camada | Responsabilidade | Não faz |
|---|---|---|
| **Frontend** | criar processo, aceitar termos/consentimento, exibir progresso por etapa, apresentar a tela de **confirmação sensível**, disparar login na janela oficial | não executa automação; não vê senha |
| **Backend / orquestrador** | máquina de estados do processo, enfileirar/agendar, iniciar/parar o motor, aplicar gates, decidir "IA vs. humano", persistir status e auditoria | não guarda credencial; não decide ato sensível sozinho |
| **Fila de processos** | serializar execução, retries controlados, isolamento por processo, retomada após instabilidade | não paraleliza a ponto de martelar o órgão |
| **Navegador automatizado** (Playwright/Puppeteer) | executar passos determinísticos na **sessão do usuário**, ler página, anexar, baixar PDF, screenshot mascarado, logs por etapa | não burla captcha; não clica ato irreversível sem gate |
| **Storage** | guardar documento/comprovante/PDF cifrado, URLs assinadas curtas, sha256 | não guarda cookie/token de sessão |
| **Logs / auditoria** | trilha **append-only**: etapa, tempo, quem autorizou, quando pausou, erro, retry, screenshot mascarado | não registra PII/credencial |
| **IA** | interpretar exceção, classificar erro, comparar textos, sugerir recuperação, apoiar suporte, resumir, sinalizar "humano necessário" | **nunca decide ato sensível**; não está no caminho crítico |
| **Humano (operador)** | confirmar irreversível, resolver ambiguidade, tratar erro imprevisto | não faz o trabalho repetitivo que o motor cobre |
| **Suporte** | acompanhar exceções, comunicar o usuário, escalonar | não executa o órgão nem paga GRU sem perfil |

---

## 5. Fluxo futuro ideal (visão)

1. **Usuário cria o processo** (destino, arma/PCE indicada, justificativa).
2. **Usuário aceita termos/consentimento** (tratamento de dados; escopo "só
   sinarm-cac"; ciência do reembolso; ciência de que há automação e confirmação).
3. **Sistema verifica disponibilidade do Gov/SINARM** (health check, §13). Se
   instável → **bloqueia pagamento** e avisa.
4. **Usuário paga** (Pix), com composição de preço e reembolso exibidos antes.
5. **Automação inicia** (entra na fila; motor prepara a execução).
6. **Usuário realiza login/autorização** na **janela oficial do Gov.br** quando
   necessário — o app nunca vê a senha; autorizações da PF são apresentadas para
   ele **autorizar de fato**.
7. **Sistema preenche as etapas** previsíveis (motor determinístico).
8. **Sistema pausa em confirmação sensível** (seleção de arma/PCE; pré-protocolo).
9. **Usuário confirma os dados** ("resumo do que foi feito → concordo").
10. **Sistema gera GRU/protocolo conforme autorização** (ato irreversível **só**
    após o confirma — docs/25 §4.3).
11. **Sistema salva comprovantes/PDFs** (protocolo, PDF da GRU) cifrados.
12. **Sistema atualiza o status** (interno e visível ao usuário).
13. **Suporte acompanha exceções** e comunica o usuário quando preciso.

> Presença do usuário é requisito nas etapas de login/autorização e na
> confirmação sensível — coerente com docs/25.

---

## 6. Onde Playwright/Puppeteer entra

Motor determinístico do caminho previsível:
- **Abrir navegador real/headed** (não headless "escondido"; velocidade próxima da humana).
- **Preencher campos** do formulário (destino, finalidade, serviço, justificativa).
- **Clicar botões previsíveis** (avançar etapas, abrir seções).
- **Anexar documentos** (Documento de Identificação Pessoal).
- **Ler textos da página** (dados da GRU, validade, mensagens do sistema).
- **Baixar PDF** (GRU, comprovantes) para o storage.
- **Tirar screenshots mascarados** por etapa (PII borrada).
- **Registrar logs por etapa** (início/fim, sucesso/erro).
- **Detectar erro simples** (campo obrigatório vazio, botão ausente, timeout) e
  sinalizar ao orquestrador.

**Nunca:** burlar captcha, clicar o irreversível sem gate, agir fora da sessão do usuário.

---

## 7. Onde a IA entra

Apoio, fora do caminho crítico:
- **Interpretar mensagem inesperada** da página (texto que o script não previu).
- **Sugerir recuperação** (ex.: "sessão expirou → pedir novo login").
- **Classificar erro** (transitório vs. bloqueante; do órgão vs. do dado).
- **Comparar texto esperado × encontrado** (a tela mudou? o valor bate?).
- **Ajudar o suporte** (rascunhar resposta, explicar o estado do processo).
- **Gerar resumo operacional** do que aconteceu (para auditoria/humano).
- **Detectar se precisa de humano** e escalonar.
- **Nunca decidir sozinha um ato sensível** — só recomenda; a decisão é humana.

> A IA recebe **texto/estado já dessensibilizado** quando possível, e sua saída é
> **sugestão**, nunca comando direto de clique em produção.

---

## 8. Onde o humano entra

- **Confirmação final** de dados e do ato irreversível.
- **Caso ambíguo** (dado que não bate, situação atípica).
- **Erro não previsto** que o motor/IA não resolvem.
- **Divergência de arma/PCE** (ponto crítico — docs/11 §15).
- **Falha de login/autorização** do usuário no Gov.br.
- **Instabilidade do órgão** (decidir pausar/retomar).
- **Suporte ao usuário** (dúvidas, reenvio de documento, reembolso).

---

## 9. O que nunca deve ser automatizado sem gate

- **Burlar captcha** — proibido sempre (se surgir desafio real, humano/usuário resolve).
- **Armazenar senha Gov.br** — nunca.
- **Ignorar a autorização do usuário** — nunca agir sem autorização ativa.
- **Pular consentimento** — nunca cobrar/tratar dado sem termos aceitos.
- **Esconder a automação do usuário** — comunicar que o app conduz e ele confirma.
- **Protocolar processo sensível sem confirmação humana** — nunca.
- **Usar dados reais no laboratório** — nunca (§10).

---

## 10. Laboratório seguro (como começar)

A automação **começa contra uma página fake/sintética**, nunca contra o órgão:
1. Criar uma **página sintética** (HTML/local) que **imita o fluxo** da Guia de
   Tráfego (mesmas etapas, campos e botões equivalentes), **sem** qualquer vínculo
   com Gov/SINARM.
2. Usar **somente dados fictícios**.
3. **Automatizar essa página fake** com o motor (Playwright/Puppeteer).
4. **Medir** tempo por etapa, logs, falhas, retries e screenshots (mascarados).
5. **Não tocar Gov/SINARM real** nesta etapa — nem para "testar".

> Objetivo: provar a **mecânica** (preencher, avançar, validar, pausar, confirmar,
> gerar PDF fake, auditar) em ambiente 100% controlado, antes de qualquer gate.

---

## 11. Fase 8 proposta — Laboratório de Automação Sintética

- **Nome:** Laboratório de Automação Sintética.
- **Objetivo:** provar que o sistema consegue **preencher, avançar, validar,
  pausar, confirmar, gerar PDF fake e registrar auditoria** em ambiente controlado.
- **Escopo:** página sintética + motor + orquestrador + fila + storage + auditoria,
  com dados fictícios. IA opcional (só para exercitar o caminho de exceção).
- **Fora do escopo:** Gov.br, SINARM, site público real, dados reais, credenciais.
- **Critério de conclusão:** caminho feliz e alguns caminhos de exceção rodam
  ponta a ponta na página fake, com logs, screenshots mascarados e trilha
  auditável; tempo e falhas medidos.

---

## 12. Fase 9 proposta — Prova técnica controlada

- **Nome:** Prova técnica controlada.
- **Objetivo:** testar a arquitetura em **fluxo real próprio/autorizado**
  (ex.: conta CAC do próprio dono), **somente depois** dos gates jurídicos,
  segurança e produção mínima (§19).
- **Regra:** parar **antes do irreversível** nas primeiras execuções; humano
  confirma e gera; um processo por vez; medir tudo.
- **Não iniciar** sem os gates do §19 fechados e **confirmação explícita**.

---

## 13. Health check Gov/SINARM

- **Verificar disponibilidade antes de permitir pagamento** — se instável,
  **bloquear novos pagamentos** e a entrada de novos processos.
- **Fila/retomada** se o serviço cair **depois** do pagamento (processo aguarda
  janela boa; usuário vê "aguardando o sistema da PF" — docs/11 §12).
- **Evitar teste agressivo** contra sistema público — verificação **leve**, com
  baixa frequência; nunca "martelar" o órgão para sondar status.

---

## 14. Servidores por região/superintendência (ideia futura)

- Registrar a ideia de **distribuir a execução por região/superintendência**
  (SP, Norte, Sul… cada uma analisa a sua jurisdição).
- **Objetivos:** reduzir concentração de carga, organizar a operação e **alinhar a
  execução à jurisdição** que analisa (origem do acesso coerente com a região).
- **É fase futura, não agora.** Não implica nada para o laboratório sintético nem
  para o MVP atual.

---

## 15. Segurança da sessão

- **Sessão efêmera** — existe só durante a execução, com o usuário presente.
- **Não persistir cookie/token** de sessão em banco ou disco.
- **Isolamento por processo** — cada execução isolada das demais.
- **Logs sem credenciais** — nunca registrar senha/token/cookie.
- **Mascaramento de screenshots** — PII borrada antes de salvar.
- **Expurgo após conclusão** — descartar sessão e artefatos temporários; documento
  segue política de retenção (docs/15 §3.11).
- **Auditoria append-only** — trilha imutável de cada ato.

> Consequência (docs/25 §8): rodar server-side faz da infra um **alvo de alto
> valor** (sessões de donos de arma) — tratar a própria infra como ativo crítico.

---

## 16. Observabilidade

Cada processo deve expor/registrar:
- **Etapa atual** (nome legível).
- **Tempo por etapa** (e total).
- **Screenshot mascarado** por etapa.
- **Erro** (tipo, mensagem dessensibilizada).
- **Retry** (quantos, com que resultado).
- **Quem autorizou** (usuário/operador, quando).
- **Quando pausou** (e por quê).
- **Quando precisou de humano** (motivo do escalonamento).

> Base para o replay auditável (docs/25 §7) e para medir a **taxa de exceção**
> antes de reduzir o humano no loop.

---

## 17. Custos e escolha da IA

- A **IA não precisa controlar todo o processo** — ela atua só na exceção, então o
  custo por processo no caminho feliz é **baixo ou zero**.
- A IA pode ser **Claude, GPT ou outro modelo via API** — a arquitetura não se
  amarra a um fornecedor (usar um **adapter**, como no storage/payment).
- **Escolha final depende de:** custo, estabilidade, privacidade (o que se envia ao
  modelo), latência e facilidade de integração.
- **Para o MVP de automação, a IA deve ser opcional e não crítica no caminho
  feliz** — se a IA cair, a exceção vai para humano, e o motor determinístico segue
  funcionando.

---

## 18. Regras permanentes da automação híbrida

- O **motor determinístico** conduz o caminho feliz; a **IA nunca** clica ato sensível.
- **Ato irreversível só após confirmação humana** — em qualquer nível.
- **Nunca** burlar captcha nem contornar anti-bot.
- **Nunca** armazenar senha/token/cookie Gov.br; sessão **efêmera**.
- **Nunca** agir sem autorização ativa do usuário nem sem consentimento aceito.
- **Nunca** esconder do usuário que há automação.
- **Nunca** usar dados reais no laboratório sintético.
- **Nunca** tocar Gov/SINARM real antes dos gates (§19).
- **Sempre** degradar para humano em captcha, ambiguidade, instabilidade ou divergência.
- **Sempre** manter logs + replay auditável (append-only), sem PII/credencial.
- **Sempre** tratar quebra por mudança do órgão como incidente (flag para desligar
  e cair no manual).
- A automação deve **funcionar sem IA** (IA fora do caminho crítico).

---

## 19. Gates antes de tocar Gov/SINARM real

Nenhuma automação contra o sistema real começa antes de **todos**:
1. **Escopo jurídico por escrito** (docs/25 §9): server-side operando a sessão
   autenticada do usuário; sem procuração; limites e responsabilidade por erro.
2. **12 pendências do piloto** (docs/23 §5) — auth real + MFA, storage
   produção + KMS + retenção, Mercado Pago produção + webhook público, termos +
   reembolso, revisão jurídica, política operacional, treinamento.
3. **Postura de segurança de sessão** (§15) implementada e revisada.
4. **Fase 8 (laboratório sintético) concluída** com sucesso medido.
5. **Confirmação explícita do dono** para iniciar a Fase 9 (prova controlada),
   um processo por vez, parando antes do irreversível.

> Enquanto qualquer item estiver aberto: **nada de Gov.br/SINARM real, nada de
> dado real, nada de protocolo real.**

---

## 20. Próximo passo recomendado

1. **Aprovar esta arquitetura** (ou ajustar) — decisão do dono.
2. Quando liberar código (confirmação explícita), **começar pela Fase 8**:
   montar a **página sintética** e automatizá-la com o motor determinístico, com
   dados fictícios, medindo tempo/logs/falhas/screenshots.
3. **Não** instalar Playwright/Puppeteer nem escrever automação **antes** dessa
   confirmação — este documento é planejamento.
4. Em paralelo (fora do código), avançar os **gates do §19** — especialmente o
   **escopo jurídico por escrito**, que destrava a Fase 9.

---

> **Lembrete permanente:** este documento é **arquitetura e planejamento**. Não
> autoriza implementar automação, instalar dependências, tocar Gov.br/SINARM,
> acessar site público real ou usar dados reais. O laboratório começa em **página
> fake/sintética**. Cada avanço depende de **confirmação explícita** do dono e dos
> **gates do §19**.
