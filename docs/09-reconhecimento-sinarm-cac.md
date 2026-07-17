# 09 — Reconhecimento do Fluxo SINARM/CAC (Gov.br)

> Registro do **reconhecimento manual** feito pelo usuário no navegador em
> **2026-07-16**. Documenta o fluxo de acesso ao sistema da PF (SINARM/CAC) via
> login Gov.br, autorização de compartilhamento e cadastro inicial de Pessoa
> Física.
>
> **Este documento NÃO é sobre `pf-antecedentes`** (certidão de antecedentes).
> Refere-se aos módulos **M4 (Gov.br)** e **M5 (Protocolo SINARM)**.
>
> Nenhuma automação foi executada. Nenhum dado pessoal real deve ser versionado.

## 1. Escopo

Fluxo observado: entrar no sistema **SISGCORP / SINARM-CAC** da Polícia Federal,
que exige **login Gov.br** do próprio usuário e **autorização de compartilhamento
de dados** da conta Gov.br para o serviço da PF, culminando no **cadastro inicial
do solicitante Pessoa Física**.

## 2. Mapa do fluxo observado

```
[1] servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/   (entrada)
      │  (não autenticado → redireciona)
      ▼
[2] sso.acesso.gov.br/login?client_id=servicos.dpf.gov.br&authorization_id=...
      │  Gov.br: tela de CPF
      ▼
[3] Gov.br: tela de SENHA
      ▼
[4] sso.acesso.gov.br/authorize?client_id=servicos.dpf.gov.br
        &redirect_uri=.../sisgcorpgatewayexterno/api/login/openid
        &response_type=code
        &scope=openid email phone profile govbr_empresa
        &state=...
      │  Tela: "Autorização para compartilhamento de Dados Pessoais"
      │  ⚠️ comportamento instável: às vezes é preciso clicar "Autorizar" 2x
      ▼
[5] redirect → servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/  (autenticado)
      │  Sessão com contador: "Sessão expira em 00:59:00" (~60 min)
      ▼
[6] Menu SINARM/CAC: Empresa · Solicitação de Serviço · Consulta de Documentos
                     · Pessoa Física (PF) · Pessoa Jurídica (PJ)
      ▼
[7] .../#/cadastro/manter-cadastro-inicial
      "Cadastro Inicial do Solicitante de Pessoa Física (PF)"
      Botões: Incluir · Editar · Visualizar Cadastro Inicial
```

## 3. Login Gov.br (observado)

- **Entrada:** `https://servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/`
- **Redireciona para SSO:**
  `https://sso.acesso.gov.br/login?client_id=servicos.dpf.gov.br&authorization_id=...`
- **Sequência:** tela de **CPF** → tela de **senha Gov.br**.
- **Login Gov.br: CONFIRMADO (obrigatório).**
- **Senha Gov.br: NÃO deve ser armazenada no MVP.** O usuário digita CPF/senha
  **diretamente na janela oficial Gov.br**. Nosso app nunca vê a senha.

## 4. Autorização de compartilhamento de dados (OAuth/OIDC)

Após o login, o Gov.br exibe **"Autorização para compartilhamento de Dados
Pessoais"** para o serviço **"Serviços da Polícia Federal"**.

**Dados solicitados pela conta Gov.br (escopo OIDC):**
- Identidade gov.br
- Nome e foto
- Endereço de e-mail
- Número de telefone celular
- Dados de vinculação de empresas do gov.br (`govbr_empresa`)

Escopo técnico observado na URL: `scope=openid email phone profile govbr_empresa`.

**Textos relevantes transcritos:**
> "O serviço que você está acessando precisa utilizar os seguintes dados
> associados à sua conta gov.br..."
>
> "Após o compartilhamento, o serviço que você está acessando passa a ser
> responsável pelo uso e tratamento dos seus dados."
>
> "Ao clicar em Autorizar, você concorda com o compartilhamento dos dados
> listados e com o tratamento destas informações pelo serviço."

**Implicação:** o responsável pelo tratamento após o compartilhamento é a PF
(o serviço acessado). Nosso app **assiste** o usuário a chegar até aqui, mas
**não** substitui o consentimento do usuário no Gov.br. Registrar apenas o
**fato** de que o usuário autorizou — nunca a senha.

## 5. ⚠️ Instabilidade observada na autorização

Na tela de autorização, ao clicar em **Autorizar**:
- a página carregou;
- **voltou para a mesma tela**;
- foi necessário **clicar em Autorizar novamente** para entrar no sistema.

**Registro:** possível **bug/instabilidade do fluxo Gov.br/SINARM**. A automação
(futura) e o suporte devem **prever dupla autorização** e não tratar o primeiro
retorno à tela como erro definitivo. Candidato a `errorCode` próprio no M5, ex.:
`AUTORIZACAO_REPETIR`.

## 6. Sessão

- Contador observado: **"Sessão expira em 00:59:00"** (~**60 minutos**).
- **Requisito:** qualquer automação/assistência deve considerar **sessão curta**,
  **expiração** e **necessidade de retomada** (re-login).
- **Status de processo sugeridos:** `Aguardando login Gov.br`,
  `Sessão Gov.br expirada`.

## 7. Tela inicial SINARM/CAC

Menu lateral observado:
- **Empresa**
- **Solicitação de Serviço**
- **Consulta de Documentos**
- **Pessoa Física (PF)**
- **Pessoa Jurídica (PJ)**

## 8. Cadastro inicial de Pessoa Física

- **URL:** `.../sisgcorp-cliente-web-externo/#/cadastro/manter-cadastro-inicial`
- **Tela:** "Cadastro Inicial do Solicitante de Pessoa Física (PF)"
- **Botões:** Incluir Cadastro Inicial · Editar Cadastro Inicial · Visualizar
  Cadastro Inicial
- **Regra observada:** quando é o **primeiro processo** da pessoa, pode ser
  necessário **criar o cadastro inicial** antes.

### Requisito pré-processo: foto válida no Gov.br
> "O usuário deve ter **foto válida no Gov.br** antes de iniciar o processo."

Se a conta estiver sem foto, o usuário precisa **atualizar no Gov.br antes** de
conseguir concluir o cadastro inicial.

### Campos do cadastro inicial (observados operacionalmente)
- nome completo
- data de nascimento
- número do título de eleitor
- RG
- CPF
- cidade onde nasceu
- endereço
- CEP
- número
- latitude
- longitude
- profissão
- nome da mãe
- nome do pai

> Observação: presença de **latitude/longitude** sugere geolocalização do
> endereço — mapear como isso é preenchido (mapa? automático pelo CEP?) num
> reconhecimento futuro.

## 9. Captcha

- **Nas telas observadas: NÃO OBSERVADO.**
- **Risco mantido:** "Pode aparecer em cenários de segurança, IP suspeito,
  múltiplas tentativas ou mudança futura." Não assumir ausência permanente.

## 10. Classificação técnica do módulo

**SINARM/CAC (M4 + M5): `SEMIAUTOMATICO`**

Motivos:
- exige **login Gov.br** do usuário;
- exige **autorização de compartilhamento** de dados;
- pode exigir **foto Gov.br** válida;
- **sessão** expira em ~60 min;
- **comportamento instável** na autorização (dupla autorização);
- ainda falta **mapear formulários internos e o protocolo** em si.

> A automação assiste; o usuário faz login e autoriza na janela oficial. Nunca
> será totalmente sem humano por causa do login/autorização/foto.

## 11. Requisitos que este reconhecimento gera para o produto

- Antes de aceitar **pagamento**, avisar que o usuário precisa de **conta Gov.br ativa**.
- Avisar que pode ser necessário **foto válida no Gov.br**.
- **Nunca armazenar senha Gov.br.**
- **Registrar consentimento** do usuário no nosso app **antes** de abrir o Gov.br.
- **Registrar** que o usuário **autorizou o compartilhamento** no Gov.br — sem capturar senha.
- **Fallback humano** caso o fluxo de autorização falhe (inclui a dupla autorização).
- **Tratamento de sessão expirada** (re-login, retomada).
- Status de processo: **"Aguardando login Gov.br"** e **"Sessão Gov.br expirada"**.

## 12. LGPD (este fluxo)

Dados pessoais compartilhados pelo Gov.br neste fluxo: **identidade, nome/foto,
e-mail, telefone, vínculos de empresa**. Requisitos de tratamento estão
detalhados e integrados em `docs/05-logs-auditoria-lgpd.md` (seção Gov.br/SINARM):
- registro do **consentimento interno** do usuário;
- registro de **abertura da sessão Gov.br**;
- registro de **autorização de compartilhamento**;
- **proibição de armazenar senha Gov.br** no MVP;
- **minimização** de dados;
- **logs de acesso** ao SINARM/CAC.

## 13. Não fazer agora

- ❌ Não automatizar o protocolo ainda.
- ❌ Não armazenar senha Gov.br.
- ❌ Não tentar contornar o login.
- ❌ Não salvar screenshots com PII real.
- ❌ Não commitar prints com CPF, nome, empresa ou outros dados pessoais.
- ❌ **Não confundir este fluxo com `pf-antecedentes`.**

## 14. Próximos reconhecimentos sugeridos (sem automação)

- ✅ Mapear a tela **"Solicitação de Serviço"** e onde entra a **Guia de Tráfego**
  — **FEITO** (ver §15: Solicitação de Serviço → Pessoa Física → Preencher
  Formulário → serviço "Emitir Guia de Tráfego Pessoa Física (CAC)").
- ✅ **Mapear a tela de confirmação da etapa 5 "Gere GRU"** (sem confirmar)
  — **FEITO** (tela "Dados da GRU", botão "Gerar GRU e Salvar" — §15.11).
- **Mapear o pós-protocolo** (após "Gerar GRU e Salvar") — só em processo
  real/controlado (§15.14).
- Mapear o formulário completo do **cadastro inicial** (validações, obrigatórios,
  como latitude/longitude são preenchidas).
- Confirmar em que etapa as **certidões/antecedentes** (`pf-antecedentes` etc.)
  são exigidas — na Guia de Tráfego **não foram observadas** (§15.4); confirmar
  para **CR novo / renovação / processos maiores** (ponto de conexão M1 ↔ M5).

---

## 15 — Reconhecimento manual da Guia de Tráfego

> **Objetivo:** mapear **onde fica a Guia de Tráfego** dentro do SINARM/CAC e
> **quais etapas/telas** aparecem **até antes da confirmação final** — sem
> protocolar. A Guia de Tráfego é o **primeiro processo do MVP comercial**.
>
> **Status desta etapa:** 🟢 **FLUXO MAPEADO até o checkpoint final** — inclui a
> tela de confirmação **"Dados da GRU"** e o botão final **"Gerar GRU e Salvar"**
> (ver §15.11). **Falta apenas** mapear o **pós-protocolo** (o que aparece
> **depois** de clicar em "Gerar GRU e Salvar"), o que **só pode ser observado em
> processo real/controlado** (ver §15.14).
> **Data do reconhecimento:** 2026-07-17 (confirmação da GRU consolidada no mesmo dia)
>
> **Regras desta sessão de reconhecimento:**
> - Navegar **só até antes da confirmação final**; **não protocolar** processo real.
> - **Não anexar documentos reais** só para testar.
> - Screenshots **sem PII** (mascarar CPF, nome, empresa, endereço, nº de série).
> - **Não clicar na confirmação final** da etapa "Gere GRU".
> - Copiar URLs/hash **sem tokens** (o trecho após `#/`).
>
> **Descoberta estrutural:** a Guia de Tráfego **não é uma tela isolada** — é
> um serviço dentro do fluxo genérico **"Preencher Formulário (Requerimento)"**,
> que tem **5 etapas numeradas** na mesma tela (ver §15.3).

---

### 15.1 — Caminho no menu e URL/hash

**Caminho de menu observado:**
1. **Solicitação de Serviço**
2. → **Pessoa Física (PF)**
3. → **Preencher Formulário (Requerimento)**

**URL / hash observada:**
`https://servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/preencher-formulario`

- **Screenshot esperado:** `gt-01-menu.png`

---

### 15.2 — Estrutura do fluxo (5 etapas do formulário)

O formulário "Preencher Formulário (Requerimento)" exibe **5 etapas numeradas**:

1. **Confira os dados do Solicitante**
2. **Escolha as Atividades e os Serviços**
3. **Preencha as Condições de Exigências**
4. **Preencha com informações adicionais julgadas úteis**
5. **Gere GRU**

> A Guia de Tráfego é selecionada como **serviço** na etapa 2. As etapas seguintes
> se ajustam ao serviço escolhido.

---

### 15.3 — Etapa 2 · Escolha das Atividades e Serviços (Guia de Tráfego)

Seleções observadas para gerar a Guia de Tráfego:

| Campo | Valor observado |
|-------|-----------------|
| **Serviço** | **Emitir Guia de Tráfego Pessoa Física (CAC)** |
| **Tipo de Taxa** | Taxas Diversas |
| **Valor da Taxa** | **R$ 20** |
| **Tipo de Atividade** | Tiro Desportivo - Atirador Desportivo |
| **Tipo de PCE** | ARMA DE FOGO |
| **Finalidade (observada)** | TREINAMENTO TIRO DESPORTIVO |
| **Finalidade (outra opção listada)** | TIRO DESPORTIVO - MUDANÇA DE LOCAL DO ACERVO |

- **Screenshot esperado:** `gt-02-servico.png`

---

### 15.4 — Etapa 3 · Condições de Exigências (documentos / anexos)

**Item/documento observado:**

| Item | Documento | Obrigatório? | Botões de anexo |
|------|-----------|--------------|-----------------|
| 42 | **Documento de Identificação Pessoal** | (a confirmar) | Escolher · Carregar · Cancelar |

**Confirmação operacional:**
- Para a Guia de Tráfego mapeada, o **único anexo observado** foi
  **Documento de Identificação Pessoal**.
- **Certidões/antecedentes NÃO apareceram** neste fluxo até o ponto mapeado.

- **Screenshot esperado:** `gt-03-exigencias.png`

#### Certidões / antecedentes na Guia de Tráfego
- ✅ **Não observadas** neste fluxo até o ponto mapeado.
- ⚠️ **Pendente confirmação final** se são exigidas em alguma etapa posterior
  (ex.: na tela de confirmação da etapa 5 ou após o pagamento).
- **Implicação:** o **módulo M1 (Certidões/Antecedentes) provavelmente NÃO é
  requisito inicial** para o MVP da Guia de Tráfego (ver §15.11 e doc 00).

---

### 15.5 — Validade da Guia

- **Validade exibida:** 17/01/2027.
- ⚠️ **Registrar:** a validade deve ser **lida dinamicamente do sistema**, nunca
  fixada (hardcoded) no app.

---

### 15.6 — Local de origem (Endereço SIGMA)

- **Campo observado:** **Endereço SIGMA**.
- **Confirmação operacional:**
  - O Endereço SIGMA **vem de endereço já cadastrado** no cadastro/acervo do usuário.
  - Para gerar Guia de Tráfego, a pessoa **já precisa ter arma ou CR**.
  - Portanto, em regra, **já deve ter cadastro inicial** no SINARM/CAC.
- **Conclusão:** **Cadastro inicial PF fica como risco/fallback**, **não** como
  fluxo obrigatório do MVP de Guia de Tráfego.

---

### 15.7 — Local de destino (evento / clube)

**Campos observados (informados pelo solicitante):**

| Campo | Tipo |
|-------|------|
| Nome Evento | texto |
| UF | seleção |
| Cidade | seleção / texto |
| Logradouro | texto |
| Número | texto |

- **Confirmação operacional:** o endereço de destino/clube/evento é **informado
  pelo solicitante** para o sistema preencher.
- **Requisito para o app:** ter **etapa própria** para coletar e validar:
  nome do clube/evento/local, UF, cidade, logradouro, número e **dados adicionais**
  que apareçam depois.

---

### 15.8 — PCE / Armamento

**Tabela de PCE/armamento observada (colunas):**
Número SIGMA · Código PCE · Espécie · Marca · Modelo · Calibre · Nº de Série ·
Nº de Lote · Quantidade.

**Controles observados:**
- Botão **Cadastrar**
- **Modal/lista** para selecionar armamento do acervo
- Botão **Incluir Armamento**

**Registrar:**
- O usuário **indica qual arma/PCE** deseja usar na Guia.
- O sistema **seleciona o armamento correto a partir do acervo** exibido.
- ⚠️ Exige **validação forte** para evitar selecionar a **arma errada**.

- **Screenshot esperado:** `gt-04-pce.png` (mascarar Nº de Série / SIGMA)

---

### 15.9 — Justificativa

- **Campo observado:** **Justificativa** (texto livre).
- **Confirmação operacional:** para Guia de Tráfego de treino, a justificativa
  padrão pode ser **"Guia para treino"**.
- **Registrar:**
  - A justificativa pode ser **pré-preenchida** no MVP.
  - Deve permitir **edição** se necessário.
  - A **etapa 4** ("informações adicionais julgadas úteis") **não é necessária**
    neste caso e **pode ser pulada** se não houver informações adicionais.

---

### 15.10 — Etapa 5 · Gere GRU + confirmação intermediária

> **Correção importante (vs. suposição anterior):** o clique em **"Gere GRU"**
> **NÃO gera/protocola imediatamente.**

**Comportamento observado:**
- Ao clicar na etapa 5 **"Gere GRU"**, o sistema abre a tela/seção
  **"Dados da GRU"** (detalhada em §15.11) **antes** de gerar/protocolar.
- A ação **realmente irreversível NÃO é** apenas entrar na etapa 5 — é clicar no
  botão **"Gerar GRU e Salvar"** dentro da tela "Dados da GRU".

**Registrar:**
- A automação futura **pode navegar até a tela "Dados da GRU" sem protocolar**.
- A tela **"Dados da GRU"** é o **checkpoint final seguro**.
- O botão **"Gerar GRU e Salvar"** é a **ação irreversível**.
- **Não clicar em "Gerar GRU e Salvar" em testes** sem intenção real.

- **Screenshot esperado:** `gt-05-gerar-gru.png` (**parar antes de confirmar**)

---

### 15.11 — Tela "Dados da GRU" (checkpoint final antes do protocolo)

> Esta é a tela aberta pela etapa 5 **"Gere GRU"**. É o **último ponto seguro**
> de observação: **nada é protocolado** até clicar em **"Gerar GRU e Salvar"**.

**O que faz o botão "Gerar GRU e Salvar" (observação operacional):**
- o processo é **protocolado**;
- o **PDF da GRU é gerado**;
- a **GRU é salva**;
- o **número de protocolo passa a existir**.

**Campos observados em "Dados da GRU":**

| Campo | Valor observado |
|-------|-----------------|
| Nome do Contribuinte/Recolhedor | (dado do usuário — não versionar) |
| CPF/CNPJ Contribuinte | (PII — não versionar) |
| **UG/Gestão** | 167086/00001 |
| **Nome da Unidade Favorecida** | Fundo do Exército |
| **Código de Recolhimento** | 11300-0 |
| Número de Referência | (gerado pelo sistema) |
| Data de Vencimento | (dinâmica — ler do sistema) |
| **Valor Principal** | 20,00 |
| **Valor Total** | 20,00 |
| Instruções | ver abaixo |

**Instruções observadas:**
> "Recolhimento de Tx de Fisc Prod Contr EB"
> "Serviço de emissão de Guia de Tráfego (CAC)"

**Seção "Acompanhamento da GRU"** — tabela com colunas:
Nr de Protocolo · Data de Vencimento · Data de Pagamento · Valor Total ·
Situação da GRU.
- No momento observado (**antes de gerar**): **"Não existem itens para mostrar."**

**Botões observados:** **Cancelar** · **Gerar GRU e Salvar**.

**⚠️ Risco crítico:** o botão **"Gerar GRU e Salvar"** deve ser tratado como
**ação final irreversível**. **Não clicar** em ambiente de reconhecimento/teste
sem intenção real.

**Checklist de validação ANTES de clicar em "Gerar GRU e Salvar"**
(nosso app/painel deve validar):
- usuário **pagou via Pix**;
- **serviço correto**: Guia de Tráfego;
- **valor da GRU**: 20,00;
- **contribuinte** correto;
- **CPF** correto;
- **UG/Gestão** (167086/00001);
- **Fundo do Exército**;
- **código de recolhimento** (11300-0);
- **vencimento**;
- **instruções**;
- **origem** (Endereço SIGMA);
- **destino** (evento/clube);
- **arma/PCE** selecionada;
- **documento anexado**;
- **justificativa**;
- **consentimento do usuário**;
- **revisão humana nos primeiros 50–100 processos**.

- **Screenshot esperado:** `gt-06-dados-gru.png` (**mascarar nome/CPF; não clicar em "Gerar GRU e Salvar"**)

---

### 15.12 — Classificação técnica da Guia de Tráfego

**Guia de Tráfego: `SEMIAUTOMATICO` — com alta chance de automação futura.**

Motivos:
- exige **login Gov.br**;
- depende de **sessão SINARM/CAC** (~60 min);
- possui **dados e seleção de armamento sensíveis**;
- possui **clique final irreversível** ("Gerar GRU e Salvar");
- **mas** o fluxo é **relativamente fixo**, **sem certidões observadas** e com
  **taxa de R$ 20**.

**Risco operacional:** **diminuiu** — existe a tela **"Dados da GRU"** como
**checkpoint** antes da ação final, permitindo revisão/validação sem protocolar.

---

### 15.13 — Fluxo MVP provável para a Guia de Tráfego

1. Usuário escolhe Guia de Tráfego no app.
2. App coleta dados do destino/clube/evento.
3. App coleta Documento de Identificação Pessoal.
4. App pergunta/valida qual arma/PCE será usada.
5. App confirma que o usuário já possui CR/arma e acesso Gov.br.
6. Usuário paga via Pix.
7. Usuário faz login Gov.br em janela oficial.
8. Sistema acessa SINARM/CAC.
9. Sistema seleciona: **Serviço** = Emitir Guia de Tráfego Pessoa Física (CAC);
   **Tipo de Atividade** = Tiro Desportivo - Atirador Desportivo;
   **Finalidade** = TREINAMENTO TIRO DESPORTIVO; **Tipo de PCE** = ARMA DE FOGO.
10. Sistema seleciona **Endereço SIGMA** de origem.
11. Sistema preenche **local de destino**.
12. Sistema seleciona **armamento do acervo**.
13. Sistema anexa **Documento de Identificação Pessoal**.
14. Sistema preenche **justificativa** "Guia para treino".
15. Sistema avança para **"Gere GRU"**.
16. Sistema chega à tela **"Dados da GRU"** (checkpoint).
17. Sistema **valida os dados da GRU** (§15.11) + nosso app/painel faz **revisão
    final interna** / autorização.
18. **Somente após revisão/autorização**, sistema clica em **"Gerar GRU e Salvar"**.
19. Processo é **protocolado** e **GRU é gerada**; sistema **captura o número de
    protocolo e o PDF da GRU**.
20. **Empresa paga GRU manualmente.**
21. Usuário **acompanha status**.

---

### 15.14 — Próximo reconhecimento recomendado (pós-protocolo)

**Mapear o resultado APÓS clicar em "Gerar GRU e Salvar" — apenas em um processo
real/controlado** (não em teste sem intenção). Isso protocola de verdade, então
só fazer quando houver um processo legítimo a protocolar.

O que observar:
- **número de protocolo** gerado;
- **PDF da GRU** (conteúdo);
- **local onde baixar/imprimir** a GRU;
- **status inicial** do processo;
- se aparece em **"Listar Processo"**;
- se aparece em **"Acompanhamento da GRU"**;
- **como consultar depois**;
- **como identificar compensação/pagamento** (quando a GRU é quitada).

- **Screenshot esperado:** `gt-07-pos-protocolo.png` (**só em processo real; mascarar PII**)

---

### 15.15 — Não fazer agora

- ❌ Não clicar em **"Gerar GRU e Salvar"** em reconhecimento/teste.
- ❌ Não **protocolar** processo real sem intenção.
- ❌ Não iniciar o **módulo de certidões (M1)** agora.
- ❌ Não implementar **código** ainda.
- ❌ Não **instalar dependências**.
- ❌ Não **automatizar Gov.br/SINARM** ainda.

---

### 15.16 — Registro de screenshots (Guia de Tráfego)

| Etapa | Descrição | Arquivo | Observações (sem PII) |
|-------|-----------|---------|------------------------|
| GT-1 | Caminho no menu até "Preencher Formulário" | `gt-01-menu.png` | |
| GT-2 | Etapa 2 — serviço/atividade/finalidade | `gt-02-servico.png` | |
| GT-3 | Etapa 3 — Condições de Exigências (Doc. Identificação) | `gt-03-exigencias.png` | |
| GT-4 | Tabela PCE / armamento | `gt-04-pce.png` | mascarar Nº Série / SIGMA |
| GT-5 | Etapa 5 — Gere GRU (antes de confirmar) | `gt-05-gerar-gru.png` | **parar antes de confirmar** |
| GT-6 | Tela "Dados da GRU" (checkpoint final) | `gt-06-dados-gru.png` | mascarar nome/CPF; **não clicar em "Gerar GRU e Salvar"** |
| GT-7 | Pós-protocolo (protocolo + PDF da GRU) | `gt-07-pos-protocolo.png` | **só em processo real**; mascarar PII |
