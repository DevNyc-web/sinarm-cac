# 25 — Visão de Automação e Decisões de Negócio (registro da conversa de 2026-07-20)

> **O que é este documento.** Registro fiel de uma conversa estratégica entre o
> dono do projeto e o assistente em **2026-07-20**, para orientar sessões
> futuras. Contém: a **visão real de longo prazo** do produto (que corrige uma
> premissa dos docs anteriores), a análise crítica de negócio, e as **decisões
> de arquitetura** que o dono tomou — com respaldo jurídico próprio.
>
> **Não é código, não é implementação, não é validação técnica.** É registro de
> direção e de decisões. Nada aqui foi construído.
>
> **IMPORTANTE — não revoga as regras de fase atuais.** As **regras permanentes
> de segurança** (docs/00 §8), os **bloqueios de fase** (docs/15) e as **12
> pendências do piloto** (docs/23 §5) **continuam valendo integralmente** para o
> estado atual (dev/fictício). O que este documento muda é o **destino de longo
> prazo**, não as travas do presente. A automação descrita aqui é uma **fase
> futura**, ainda condicionada aos gates do §9.

---

## 1. Correção de premissa (o ponto central)

Os docs 00–24 tratam o produto como **operação manual assistida** (o app
orienta/registra/audita; um humano executa fora do app). Isso está **correto
para o MVP atual**, mas **não é a visão final**.

**Visão real do produto:**
- A plataforma deve, no futuro, **realizar o processo sozinha ou quase sozinha**.
- O operador humano existe **primeiro** por segurança, validação, jurídico, LGPD
  e aprendizado do fluxo — é uma **ponte**, não o modelo final.
- A longo prazo: o sistema **preenche, confere, gera etapas, registra e
  acompanha**, reduzindo ao máximo a intervenção humana (idealmente só suporte).

**Limites inegociáveis mantidos:** não violar termos de uso; não burlar captcha;
não armazenar senha Gov.br; não acessar Gov.br/SINARM de forma ilegal; não
parecer órgão oficial; não protocolar sem confirmação explícita; não criar risco
jurídico/LGPD.

---

## 2. Dois cenários analisados

**Cenário A — MVP manual assistido:** operador executa fora do app; app registra
e audita; margem presa a trabalho humano. É o estado atual e a ponte.

**Cenário B — visão automatizada (destino):** o sistema executa o máximo
possível; humano entra só em exceção, captcha, revisão e confirmação
irreversível; o clique final/protocolo só ocorre com autorização explícita; o
sistema nunca burla segurança nem guarda senha Gov.br.

**Tensão honesta registrada:** a automação **melhora a economia e a escala**
(mata o custo de mão de obra) e **ao mesmo tempo eleva o risco jurídico/técnico**
(operar sistema público por software é pergunta mais difícil que operá-lo por
humano). O Cenário B eleva **tanto o teto quanto as apostas** — e concentra o
destino do projeto na pergunta "operação automatizada do sistema da PF é
permitida?".

---

## 3. Avaliação de negócio (atualizada nesta conversa)

- **Deixa de ser "serviço com UI" e passa a ter potencial de software escalável**
  — desde que a automação funcione e o jurídico libere. O valor da automação
  **não é margem unitária** (a economia de mão de obra é ~R$17/processo,
  constante); é **throughput** (girar centenas/mês sem contratar proporcional).
- **Alavanca de preço > alavanca de automação, por unidade:** subir R$100→R$150
  vale ~R$42/processo; automatizar vale ~R$17. Automação compensa **no volume**,
  e carrega **custo fixo de construção + manutenção** de automatizar um site que
  não se controla.
- **Guia de Tráfego:** fraca como produto de margem, **forte como campo de provas**
  da automação 100% (fluxo fixo, sem certidões, checkpoint seguro, dano baixo e
  reversível). O dono reporta **demanda real** (pessoas pagando R$200–250 numa
  guia a despachantes, por não saber/não ter tempo/preguiça); um serviço
  automatizado a ~R$100 sem operador **bate o preço** dos concorrentes humanos.
  → Demanda a **validar com número** (ex.: ~5 clientes reais confirmando), não
  por impressão.
- **Economia unitária do modelo maduro (sem operador):** ≈ R$100 − GRU R$20 −
  taxas/imposto ~R$7 − suporte ~R$8 ≈ **~R$65/processo líquido**. É um negócio,
  **se** a automação atingir alta taxa de sucesso sem humano.

**Refinamento da conta de lucro** (líquido ≈ `0,85·P − 28 − mão de obra`;
0,15·P = Pix ~1% + Simples ~6% + reserva erro ~8%; R$28 = GRU R$20 + suporte R$8;
mão de obra a ~R$40/h):

| Preço | Manual (30min) | Semi (12min) | Automação (5min) |
|---|---|---|---|
| R$100 | R$37 | R$49 | R$54 |
| R$120 | R$54 | R$66 | R$71 |
| R$150 | R$79 | R$91 | R$96 |
| R$200 | R$122 | R$134 | R$139 |

Volume p/ ~R$5.000/mês líquido: manual R$100 ≈ 135/mês (inviável à mão);
semi R$120 ≈ 76/mês; automação R$150 ≈ 52/mês; automação R$200 ≈ 36/mês.
(Não inclui custo fixo de build/infra — automação **só amortiza em volume**.)

---

## 4. Decisões de arquitetura tomadas pelo dono (2026-07-20)

> Registradas como **decisão do dono, com respaldo do jurídico próprio dele**.
> O assistente levantou objeções (§8); o dono respondeu e decidiu. Onde o
> assistente concordou após os contra-argumentos, está marcado.

1. **Execução server-side.** A automação **roda no servidor da empresa**. O
   jurídico do dono avaliou a arquitetura concreta e **sugeriu/aprovou** o
   modelo server-side. → Higiene recomendada: **deixar o escopo aprovado por
   escrito**, incluindo especificamente "o servidor opera a sessão gov
   autenticada do cliente".
2. **Usuário presente, autorizando de verdade.** O processo só roda com o
   usuário dentro do fluxo. O login é feito na **janela oficial do Gov.br** pelo
   próprio usuário; as **autorizações que a PF pede** são apresentadas para ele
   **autorizar de fato** (não um robô clicando "sim" em tudo) — para não quebrar
   nenhuma lei. UX durante a execução: um **indicador de progresso** descrevendo
   a etapa ("realizando cadastro inicial", "anexando documentos", "gerando
   GRU"), em vez de o usuário assistir a tela operar sozinha.
3. **GRU paga só após confirmação do usuário.** Ao final, um **resumo do que foi
   feito** + etapa "concordo com tudo que foi feito, podem gerar a GRU". Só então
   o ato irreversível/pagamento da taxa. **É o principal mecanismo de controle de
   erro e custo** — como o custo é quase inteiramente a taxa, o pior caso vira
   "refazer o processo" (perda ~R$20–100, reversível). O assistente endossou como
   a melhor salvaguarda da conversa.
4. **Seleção de arma/PCE automatizável.** É uma tabela de seleção. Multi-arma se
   resolve com formulário simples ("detectamos as armas X, Y e Z; confirme que
   sua guia é para a arma X"). Confirmação humana antes do irreversível.
5. **Health check do Gov antes de cobrar.** O sistema verifica se o Gov está
   normal **antes** do pagamento e do início; se instável, **bloqueia pagamentos
   e a entrada de novos processos**. Se cair **depois** do pagamento → processo
   vai para **fila** e retoma em janela boa (docs/11 §12). → Fazer a verificação
   **leve**, sem martelar o sistema do órgão.
6. **Tempo-alvo por processo: 5–10 min** (um humano com documentos protocola um
   processo grande em 15–25 min; a sessão de ~60 min sobra).
7. **Escala futura por superintendência (regionalização).** Cada região tem sua
   **superintendência** que analisa (SP uma, Norte outra, Sul outra…). Ideia:
   futuramente **um servidor por superintendência/região**, em vez de tudo num
   servidor único fazendo ~10.000/hora. Benefício duplo: **dilui a carga** e
   **alinha a origem do acesso à jurisdição que analisa** — o que também
   neutraliza o resíduo de "tudo de um IP só" (§8).

---

## 5. Escada de maturidade da automação (referência)

| Nível | O que faz | Onde o humano entra | Gate para subir |
|---|---|---|---|
| 0 — Manual assistido | app registra/audita; humano faz tudo | Tudo | estado atual |
| 1 — Preenchimento assistido (in-app) | app monta/valida payload; **não toca o gov** | executa no gov | risco ~zero de ToS |
| 2 — Automação até o checkpoint | automação preenche e para em "Dados da GRU" | login, autorização, arma, **clique final** | escopo jurídico por escrito |
| 3 — Automação + revisão humana | igual N2 + conferência estruturada | revisão + clique final | zero erro de arma/destino medido |
| 4 — Automação com exceções | caminho feliz quase sozinho (usuário presente); humano só em exceção/captcha/ambiguidade | exceções + confirma irreversível | taxa de exceção baixa medida |
| 5 — Quase total | máxima automação **se juridicamente permitido** | **sempre** o irreversível + o que a lei exigir | parecer explícito |

O **clique irreversível é humano do N0 ao N5** — nunca sobe de nível.

---

## 6. Automatizável com baixo risco vs. nunca automatizar

**Baixo risco (é só o seu software, fora da sessão gov):** coletar/validar
destino; montar serviço/finalidade/PCE como dado; anexar/validar documento;
rascunhar justificativa; gerar checklist; registrar protocolo/GRU após obtidos;
acompanhar status.

**Dentro da sessão gov (risco médio — só com usuário presente/autorizando):**
preencher campos do formulário; navegar até "Dados da GRU"; ler dados da GRU.

**Nunca automatizar / cuidado extremo:** login Gov.br; autorização de
compartilhamento; captcha (nunca burlar; se surgir, humano resolve); **seleção
de arma/PCE** (sempre confirmação humana); **clique "Gerar GRU e Salvar"**
(irreversível — humano sempre); persistência de sessão/credencial.

---

## 7. Regras permanentes para automação segura

- Nunca **armazenar senha/token Gov.br**.
- Nunca **burlar captcha** nem contornar anti-bot.
- Nunca **automatizar contra o Termo de Uso** — ler o ToS antes e reler quando o
  gov mudar.
- Nunca **executar ato irreversível** (seleção de arma, "Gerar GRU e Salvar") ou
  **pagar a taxa** sem **confirmação humana explícita** — em nível nenhum.
- Nunca **usar dado real / PII real no laboratório de automação**.
- Nunca **apontar automação ao sistema real da PF antes do escopo jurídico por
  escrito**.
- Nunca **esconder do usuário que houve automação** — dizer que o app conduziu,
  e ele confirma. Comunicação **precisa e verdadeira** ("você autoriza o acesso;
  conduzimos com sua autorização e não guardamos sua senha").
- Nunca **decidir automaticamente algo com consequência jurídica** sem revisão
  humana (LGPD art. 20).
- Sempre **manter logs + replay auditável** (quem/o quê/quando; screenshots
  mascarados).
- Sempre **degradar para humano** em captcha, ambiguidade, instabilidade ou
  divergência — nunca "empurrar".
- Sempre tratar **quebra por mudança do gov** como incidente controlado (flag
  para desligar e cair no manual).

---

## 8. Objeções levantadas e como foram resolvidas (honestidade do registro)

- **"IP de datacenter fazendo volume será bloqueado."** → **Refutado pelo dono
  com dados de campo:** 500+ processos no mesmo computador (dele) e amigos
  despachantes com 700/2000/5000 pelo mesmo computador, sem bloqueio. Volume por
  IP **não é o gatilho**. Resíduo estreito (assinatura de automação headless a
  partir de IP de datacenter, ≠ humano manual) é **barato de testar** nas
  primeiras execuções e mitigável (browser headed, velocidade próxima do humano,
  regionalização §4.7). Assistente **retirou** o argumento de volume.
- **"O jurídico não avaliou server-side especificamente."** → **Resolvido:** o
  jurídico do dono **deu a ideia** do server-side, conhecendo a arquitetura.
  Higiene: registrar o escopo por escrito.
- **"Precisa de procuração/mandato."** → **Não precisa** (confirmado pelo
  jurídico e pelos próprios analisadores do processo, que não se importam com
  quem executa — só querem o processo correto). Basta o **acesso autorizado ao
  Gov**.
- **"Consentimento pode não cobrir."** → **Cobre**, desde que o usuário consinta
  que se acessa **apenas o sinarm-cac**, com plena autorização, e só se entra na
  conta com autorização ativa.
- **"Formulário de confirmação não elimina erro."** → **Mitigado pelo gate de
  GRU-no-confirma** (§4.3): custo do erro é baixo e reversível para a Guia. Nota
  durável: essa rede de segurança **encolhe em processos de maior valor** — o
  gate de confirmação deve ser reavaliado a cada novo tipo de processo.

**Consequência durável que permanece (não é objeção, é design):** rodar
server-side faz da empresa um **alvo de alto valor** — passa a deter/retransmitir
**sessões gov.br autenticadas de proprietários de arma**. O raio de dano de um
incidente na infra sobe muito. Design obrigatório: sessão do usuário **efêmera,
nunca persistida em disco/banco**, descartada ao fim; isolamento forte; segredos
em cofre; acesso mínimo; trilha de tudo. **Tratar a própria infra como o ativo
crítico.**

---

## 9. Gates antes de construir a automação real

1. **Escopo jurídico por escrito** — incluindo "servidor opera a sessão gov
   autenticada do cliente" e "sem procuração".
2. **Um processo de Guia real, ponta a ponta, na conta CAC do próprio dono**, na
   arquitetura escolhida, **parando no confirma antes do irreversível** — para
   medir tempo real, taxa de erro de preenchimento e resolver empiricamente o
   resíduo de datacenter/automação (§8).
3. **Validar demanda** com ~5 clientes reais dispostos a pagar e a logar agora.
4. **Postura de segurança** para deter sessões gov ao vivo (§8) definida.
5. As **12 pendências do piloto (docs/23 §5)** seguem valendo para qualquer
   cobrança/PII/protocolo real.

---

## 10. Go-to-market (registrado)

- **Distribuição por clube:** o dono **é proprietário de um clube** — canal de
  confiança embutido, primeiros clientes e transferência de confiança (sócio →
  sócio). Complementos: vídeos, patrocínios, e **suporte consistente** para não
  gerar desconfiança.
- **Cautela durável:** em comunidade fechada o boca a boca **corta nos dois
  sentidos** — os **primeiros 10–20 processos precisam sair impecáveis**, com
  humano no loop, antes de confiar no automático.

---

## 11. Veredito honesto registrado

Ao longo da conversa o assistente ficou **progressivamente mais otimista** (com
base em respostas concretas do dono, não por cortesia): o modelo saiu de
"serviço manual de margem fina" para **"provável bom negócio de software"** —
automação server-side com respaldo jurídico, demanda sinalizada a R$200–250,
distribuição própria por clube, e o gate de GRU-no-confirma como controle de
risco. A Guia de Tráfego é o campo de provas certo.

**O que ainda decide o jogo, em ordem:** (1) escopo jurídico por escrito;
(2) primeiros 10–20 processos impecáveis (o clube pune erro rápido); (3) medir a
taxa de exceção antes de prometer 100% automático; (4) segurança à altura de
deter sessões federais ao vivo; (5) risco regulatório do setor de armas (externo,
independente de tudo acima).

**Próximo passo mais inteligente:** **um** processo real de Guia na conta do
próprio dono, medindo tudo, na arquitetura escolhida, parando no confirma. Depois
disso, escalar com dado — não com fé.

---

> **Lembrete permanente:** este documento registra **visão e decisões
> estratégicas** de 2026-07-20. Não autoriza implementar automação, não revoga as
> regras de fase (docs/00 §8, docs/15) nem as 12 pendências do piloto (docs/23
> §5). A automação é fase futura, condicionada aos gates do §9, e cada avanço
> depende de **confirmação explícita** do dono.
