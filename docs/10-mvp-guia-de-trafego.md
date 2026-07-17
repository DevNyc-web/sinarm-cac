# 10 — MVP: Guia de Tráfego (especificação funcional)

> **O que é este documento.** Transforma o **reconhecimento manual** da Guia de
> Tráfego (ver `docs/09-reconhecimento-sinarm-cac.md §15`) em uma **especificação
> de MVP funcional**. É a base para, depois, decidir telas e implementação.
>
> **Ainda NÃO é código.** Nada aqui é implementado, automatizado ou prototipado.
> Só especificação.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/00-contexto-atual.md`, `docs/09-reconhecimento-sinarm-cac.md`.

---

## 1. Objetivo do MVP

Oferecer um **serviço privado assistido** que ajuda um **CAC** a **emitir a Guia
de Tráfego Pessoa Física (CAC)** no SINARM/CAC da Polícia Federal, do início até
a **geração da GRU e do protocolo**, com **revisão humana** e **pagamento por
processo**.

**Escopo do MVP:** um único processo — **Guia de Tráfego** — para o **CAC final**.

**Meta funcional:** conduzir o usuário e a operação até o **checkpoint final**
(tela "Dados da GRU"), executar a ação **"Gerar GRU e Salvar"** com revisão
humana, **capturar protocolo + PDF da GRU** e **acompanhar o status**.

**Fora do objetivo:** automação ponta a ponta sem humano; outros processos
(CR novo, renovação, transferência); módulo de certidões.

---

## 2. Público-alvo

- **CAC** (Colecionador, Atirador, Caçador) **já ativo**, que **já possui CR e/ou
  arma registrada** no SINARM/CAC.
- Perfil típico: **Atirador Desportivo** que precisa de **Guia de Tráfego para
  treino** (transporte da arma até o clube/evento).
- Pessoa com **conta Gov.br** e disposição a fazer login na **janela oficial**.

> **Não** é público do MVP: quem ainda **não tem CR/arma** (não teria "Endereço
> SIGMA" nem acervo para selecionar) — esses caem em **fallback/atendimento**.

---

## 3. Pré-requisitos do usuário

Para usar o MVP, o usuário precisa (o app deve **checar/avisar** antes de cobrar):

1. **Conta Gov.br ativa** e capaz de fazer login.
2. Possivelmente **foto válida no Gov.br** (requisito observado no cadastro; §8 do doc 09).
3. **Já possuir CR e/ou arma registrada** no SINARM/CAC (tem **Endereço SIGMA** e
   **acervo** para selecionar a arma/PCE).
4. Saber os **dados do destino** (clube/evento): nome, UF, cidade, logradouro, número.
5. Ter em mãos o **Documento de Identificação Pessoal** (para anexar).
6. Aceitar os **termos e consentimentos** (LGPD, §16).

> Se algum pré-requisito falhar → **não seguir para pagamento**; encaminhar para
> **suporte humano** ou orientar o usuário a resolver no Gov.br antes.

---

## 4. Dados que o app precisa coletar

**Do processo (entrada do usuário):**
- Confirmação de que é **Guia de Tráfego para treino** (finalidade).
- **Destino/evento:** Nome do Evento/Clube · UF · Cidade · Logradouro · Número.
- **Qual arma/PCE** será usada (o usuário indica; o sistema seleciona do acervo).
- **Justificativa** (padrão sugerido "Guia para treino", editável).

**Derivados/confirmados no SINARM/CAC (não digitados do zero):**
- **Endereço SIGMA** de origem (vem do acervo).
- Dados do **acervo/armamento** (Nº SIGMA, Código PCE, espécie, marca, modelo,
  calibre, nº de série, nº de lote, quantidade).
- **Dados da GRU** (contribuinte, CPF, UG/Gestão, código de recolhimento, valor,
  vencimento) — **lidos do sistema**, não fixados.

**Metadados operacionais:**
- Registro de **consentimento** do usuário.
- Registro de **pagamento Pix** confirmado.
- Registro de que o usuário **fez login/autorizou** no Gov.br (nunca a senha).

> **Regra:** valores como **validade da Guia** e **vencimento/valor da GRU** são
> **dinâmicos** — sempre lidos do sistema, **nunca hardcoded**.

---

## 5. Documentos que o usuário precisa enviar

Com base no fluxo mapeado (etapa 3 "Condições de Exigências", item 42):

| Documento | Situação no MVP |
|-----------|-----------------|
| **Documento de Identificação Pessoal** | **Único anexo observado** na Guia de Tráfego. Coletar do usuário. |
| Certidões / antecedentes | **NÃO observadas** no fluxo mapeado → **não exigir no MVP** (ver §17). |

- O app deve **coletar e validar** o Documento de Identificação Pessoal (formato,
  legibilidade) **antes** do login no SINARM.
- **Não** anexar documentos reais em ambiente de teste.

---

## 6. Fluxo do usuário (jornada no app)

1. Usuário escolhe **"Guia de Tráfego"** no app.
2. App **verifica pré-requisitos** (§3) e avisa o que é necessário.
3. App coleta **dados do destino** (clube/evento).
4. App coleta o **Documento de Identificação Pessoal**.
5. App pergunta/valida **qual arma/PCE** será usada.
6. App confirma que o usuário **já possui CR/arma** e **acesso Gov.br**.
7. App apresenta **resumo + preço** e coleta **consentimentos** (§16).
8. Usuário **paga via Pix** (§9).
9. App instrui o usuário a **fazer login Gov.br** na **janela oficial** (o app
   nunca vê a senha).
10. Processo entra em **fila de operação** para execução assistida no SINARM/CAC.
11. Usuário **acompanha o status** (§11) e recebe **mensagens** (§14).
12. Ao final, usuário recebe **protocolo** e, quando disponível, o **PDF da GRU**.

---

## 7. Fluxo interno / admin

1. Operação recebe o processo **pago e consentido** na fila.
2. Operador (ou automação assistida futura) **abre o SINARM/CAC** com o login do
   usuário já autenticado no Gov.br.
3. Preenche o formulário conforme §8, chegando à tela **"Dados da GRU"**.
4. Executa o **checkpoint de validação** (§13) — **revisão humana obrigatória** nos
   primeiros processos (§12).
5. Só então clica em **"Gerar GRU e Salvar"**.
6. **Captura** número de protocolo e **PDF da GRU**; anexa ao processo.
7. **Empresa paga a GRU** manualmente (§10) e registra o comprovante.
8. Atualiza o **status** e **notifica** o usuário.
9. Casos ambíguos/instáveis → **revisão humana** / suporte (nunca "empurrar" o
   protocolo no escuro).

---

## 8. Fluxo no SINARM/CAC (execução assistida)

Baseado em `docs/09 §15`. Caminho: **Solicitação de Serviço → Pessoa Física (PF)
→ Preencher Formulário (Requerimento)** (`.../#/preencher-formulario`).

Etapas do formulário (5):
1. **Confira os dados do Solicitante.**
2. **Escolha as Atividades e os Serviços:**
   - Serviço: **Emitir Guia de Tráfego Pessoa Física (CAC)**
   - Tipo de Taxa: Taxas Diversas · **Valor: R$ 20**
   - Tipo de Atividade: **Tiro Desportivo - Atirador Desportivo**
   - Tipo de PCE: **ARMA DE FOGO**
   - Finalidade: **TREINAMENTO TIRO DESPORTIVO**
3. **Condições de Exigências:** anexar **Documento de Identificação Pessoal** (item 42).
4. **Informações adicionais** (opcional — pode ser pulada).
   - Preencher **Endereço SIGMA** (origem, do acervo), **local de destino**,
     **selecionar armamento** do acervo, **justificativa** "Guia para treino".
5. **Gere GRU** → abre a tela **"Dados da GRU"** (checkpoint, §13).
   - **Ação final irreversível: "Gerar GRU e Salvar"** → protocola, gera PDF da
     GRU, salva e cria o número de protocolo.

> **Sessão SINARM/CAC expira em ~60 min** e a **autorização Gov.br pode exigir
> clique duplo** — a operação/assistência deve prever isso.

---

## 9. Pagamento Pix (do usuário para a empresa)

- **Cobrança por processo** (não assinatura). **Preço inicial provável: R$ 100.**
- **Pix primeiro** (cartão fica para depois — fora do MVP).
- O **pagamento do usuário ocorre ANTES** da execução no SINARM/CAC.
- **Se o Gov/SINARM estiver instável antes do pagamento → bloquear o pagamento.**
- Após pagamento confirmado, o processo entra na **fila de operação**.
- **Não confundir** este Pix (usuário → empresa) com a **GRU** (§10).

---

## 10. GRU paga pela empresa

- A **GRU (R$ 20, Fundo do Exército, código 11300-0)** é **paga pela empresa**,
  **manualmente**, no MVP.
- Ocorre **depois** de "Gerar GRU e Salvar" (a GRU só existe após o protocolo).
- Operação registra **comprovante** e vincula ao processo.
- O **preço ao usuário (§9)** já **embute** o custo da GRU + serviço.
- Futuro: automação/conciliação do pagamento da GRU (fora do MVP).

---

## 11. Estados do processo

Sugestão de máquina de estados para o MVP (nomes podem ser ajustados na modelagem):

| Estado | Significado |
|--------|-------------|
| `Rascunho` | Usuário preenchendo dados no app. |
| `Aguardando pagamento` | Resumo aceito, aguardando Pix do usuário. |
| `Pago / em fila` | Pix confirmado; aguardando operação. |
| `Aguardando login Gov.br` | Precisa do login/autorização do usuário na janela oficial. |
| `Sessão Gov.br expirada` | Sessão SINARM caiu (~60 min); precisa re-login. |
| `Em preenchimento (SINARM)` | Operação executando o formulário. |
| `Em revisão humana` | Checkpoint "Dados da GRU" aguardando validação (§12/§13). |
| `Protocolado / GRU gerada` | "Gerar GRU e Salvar" executado; protocolo + PDF capturados. |
| `GRU paga (empresa)` | Empresa quitou a GRU e registrou comprovante. |
| `Concluído` | Guia de Tráfego emitida e entregue ao usuário. |
| `Bloqueado / instabilidade` | Gov/SINARM instável; aguardando janela. |
| `Cancelado / reembolsado` | Encerrado conforme política de reembolso (§15). |

> Estados `Aguardando login Gov.br` e `Sessão Gov.br expirada` vêm do doc 09 (§6/§11).

---

## 12. Revisão humana obrigatória nos primeiros processos

- **Revisão humana obrigatória nos primeiros 50–100 processos** (decisão do doc 00).
- Aplica-se **especialmente** ao **checkpoint "Dados da GRU"** (§13): **nenhum**
  clique em "Gerar GRU e Salvar" sem validação humana neste período.
- Casos **ambíguos ou inconclusivos** vão **sempre** para revisão humana (regra
  permanente do doc 00 §8).
- Objetivo: validar seleção de **arma correta**, dados da GRU e consistência antes
  do ato irreversível.

---

## 13. Checkpoint antes de "Gerar GRU e Salvar"

A tela **"Dados da GRU"** é o **último ponto seguro** antes do protocolo. **Antes**
de clicar em **"Gerar GRU e Salvar"**, validar (ver `docs/09 §15.11`):

- usuário **pagou via Pix**;
- **serviço correto**: Guia de Tráfego;
- **valor da GRU**: 20,00;
- **contribuinte** e **CPF** corretos;
- **UG/Gestão** (167086/00001);
- **Fundo do Exército**;
- **código de recolhimento** (11300-0);
- **vencimento** (lido do sistema);
- **instruções** corretas;
- **origem** (Endereço SIGMA) e **destino** (evento/clube);
- **arma/PCE** selecionada é a **certa**;
- **documento anexado**;
- **justificativa**;
- **consentimento** do usuário registrado;
- **revisão humana** feita (nos primeiros 50–100 processos).

> **"Gerar GRU e Salvar" = ação irreversível.** Não clicar em teste/reconhecimento
> sem intenção real. Se algo não bate → **parar** e resolver antes.

---

## 14. Mensagens principais para o usuário

Tom **claro, honesto e não oficial** (nunca parecer órgão público; nunca prometer
aprovação). Exemplos de conteúdo (texto final a definir):

- **Pré-requisitos:** "Para emitir sua Guia de Tráfego você precisa de conta
  Gov.br ativa e já ter CR/arma registrada."
- **Antes do pagamento:** "Este é um serviço privado de assistência; não somos
  órgão público. O valor cobre nosso serviço e a taxa da GRU (R$ 20)."
- **Login Gov.br:** "Você fará login na janela oficial do Gov.br. Nós nunca vemos
  sua senha."
- **Instabilidade:** "O sistema da PF pode estar instável; seu processo fica em
  fila e seguimos assim que possível."
- **Sessão expirada:** "Sua sessão no Gov.br expirou; precisamos que você entre
  novamente."
- **Protocolado:** "Sua Guia foi protocolada. Protocolo: __. Enviaremos o PDF da
  GRU e o andamento."
- **Conclusão:** "Sua Guia de Tráfego está emitida. Segue o documento."

---

## 15. Política de reembolso (este MVP)

Alinhada ao doc 00 §2:

- **100% de reembolso** **apenas ANTES** do envio de documentos / início da
  execução no SINARM.
- **Após início do envio de documentos:** reembolso **depende do estágio**.
- **Após protocolo / GRU gerada** (`Gerar GRU e Salvar` executado): **não
  reembolsável** (houve custo e ato irreversível no órgão).
- Regra deve ser **exibida antes do pagamento** (§14) e registrada no consentimento.

---

## 16. LGPD e consentimentos necessários

Base: `docs/05-logs-auditoria-lgpd.md` e doc 09 §12.

**Consentimentos a coletar (antes de abrir o Gov.br):**
- Consentimento de **tratamento de dados** para prestar o serviço.
- Ciência de que, **após autorizar no Gov.br**, o **responsável pelo tratamento é
  a PF** (o serviço acessado).
- Ciência da **política de reembolso** (§15).

**Regras permanentes:**
- **Nunca armazenar a senha Gov.br.** O usuário digita **direto na janela oficial**.
- **Registrar apenas o fato** de que o usuário autorizou — nunca credenciais.
- **Minimização de dados**; guardar só o necessário para o processo.
- **Logs de acesso** ao SINARM/CAC e do ciclo do processo.
- **Não commitar/screenshot com PII** (CPF, nome, empresa, nº de série, endereço).

---

## 17. O que fica FORA do MVP

- **Módulo de certidões/antecedentes (M1):** **não** exigido no fluxo mapeado da
  Guia de Tráfego → fora do MVP (fica para CR novo/renovação/processos maiores,
  salvo reconhecimento posterior em contrário).
- **Cadastro inicial PF como fluxo obrigatório:** vira **fallback**, pois o público
  do MVP já tem CR/arma (§2/§3).
- **Automação ponta a ponta** do SINARM/CAC (o MVP é **assistido**, com humano).
- **Outros processos** (CR novo, renovação, transferência, PJ).
- **Pagamento por cartão** (só Pix no MVP).
- **Pagamento automático da GRU** (empresa paga manual).
- **Conciliação automática** de pagamento/compensação.

---

## 18. Riscos

| Risco | Mitigação no MVP |
|-------|------------------|
| **Selecionar a arma/PCE errada** | Validação forte + **revisão humana** no checkpoint (§12/§13). |
| **"Gerar GRU e Salvar" irreversível** | Checkpoint obrigatório antes do clique; não clicar em teste. |
| **Sessão Gov.br expira (~60 min)** | Estado próprio + re-login; operação ágil. |
| **Dupla autorização Gov.br / instabilidade** | Prever repetição; não tratar 1º retorno como erro; fila. |
| **Gov/SINARM instável antes do pagamento** | **Bloquear pagamento**; avisar usuário. |
| **Instabilidade após pagamento** | Processo em **fila**; comunicação clara (§14). |
| **Captcha (não observado, mas possível)** | Não burlar; cair para atendimento humano. |
| **Certidões exigidas em algum ponto não mapeado** | Marcado como **pendente confirmação**; revisão humana pega. |
| **Foto Gov.br inválida** | Checar pré-requisito; orientar usuário antes de cobrar. |
| **PII vazando em logs/prints** | Minimização; regra de não versionar PII. |
| **Parecer órgão oficial / prometer aprovação** | Marca neutra; mensagens honestas (§14). |

---

## 19. Critérios para dizer que o MVP está pronto

O MVP está pronto quando, para a **Guia de Tráfego**:

1. O app **coleta** todos os dados de §4 e o documento de §5.
2. O app **checa pré-requisitos** (§3) e **bloqueia pagamento** quando aplicável.
3. **Pagamento Pix** funciona e leva o processo para a **fila** (§9).
4. A operação consegue **executar o fluxo SINARM** (§8) até **"Dados da GRU"**.
5. O **checkpoint** (§13) é aplicado com **revisão humana** (§12).
6. "Gerar GRU e Salvar" gera **protocolo + PDF**, ambos **capturados**.
7. A **empresa paga a GRU** e registra comprovante (§10).
8. O usuário **acompanha estados** (§11) e recebe **mensagens** (§14).
9. **Reembolso** (§15) e **consentimentos/LGPD** (§16) estão implementados.
10. Nenhuma regra permanente de segurança é violada (doc 00 §8).

> Meta de qualidade: os **primeiros 50–100 processos** passam por **revisão
> humana** e servem para validar o fluxo antes de qualquer automação maior.

---

## 20. Próximos passos depois do MVP

1. **Mapear o pós-protocolo** em processo real/controlado (doc 09 §15.14):
   protocolo, PDF, onde baixar, status, "Listar Processo", "Acompanhamento da GRU",
   consulta posterior e identificação de pagamento/compensação.
2. **Confirmar** definitivamente se **certidões** entram em algum ponto (fechar o
   "pendente confirmação").
3. Evoluir de **assistido** para **semiautomático** por módulos (validar o mais
   difícil primeiro): preenchimento do formulário e seleção de armamento.
4. Adicionar **pagamento por cartão** e **conciliação** da GRU.
5. Preparar **próximos processos** (CR novo, renovação) — aí sim o **módulo de
   certidões (M1)** tende a entrar.
6. Automação/conciliação do **pagamento da GRU** pela empresa.

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências, automatizar Gov.br/SINARM ou protocolar processo real.
> É especificação. Próximas ações dependem de **confirmação explícita** do usuário.
