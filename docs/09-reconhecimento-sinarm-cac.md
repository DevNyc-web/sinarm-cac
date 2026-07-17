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

- Mapear a tela **"Solicitação de Serviço"** e onde entra a **Guia de Tráfego**.
- Mapear o formulário completo do **cadastro inicial** (validações, obrigatórios,
  como latitude/longitude são preenchidas).
- Confirmar em que etapa as **certidões/antecedentes** (`pf-antecedentes` etc.)
  são exigidas dentro do processo — é o ponto de conexão entre M1 e M5.

---

## 15. Reconhecimento — Guia de Tráfego

> **Objetivo:** mapear **onde fica a Guia de Tráfego** dentro do SINARM/CAC e
> **quais etapas/telas** aparecem **até antes do envio final** — sem protocolar.
> A Guia de Tráfego é o **primeiro processo do MVP comercial**, por isso precede
> a automação de certidões.
>
> **Status desta etapa:** ⬜ NÃO EXECUTADA (aguardando reconhecimento manual)
> **Executor:** _______  **Data:** _______
>
> **Regras:** navegar só até **antes do envio final**; **não protocolar**
> processo real; **não anexar documentos reais** só para testar; screenshots
> **sem PII**; se para avançar for obrigatório enviar/protocolar → **parar**.

### 15.1 Caminho no menu
| Nível | O que você clicou | Rótulo exato na tela |
|-------|-------------------|----------------------|
| Menu principal | | |
| Submenu | | |
| Tela final | | |

### 15.2 URL / hash de cada etapa
Copiar da barra de endereço (o trecho após `#/`), sem tokens/PII.
| Etapa | URL / hash |
|-------|-----------|
| Tela inicial do processo | |
| Tela de formulário | |
| Tela de anexos | |
| Tela de confirmação | |
| Tela de protocolo/GRU (se chegar) | |

### 15.3 Nome exato do serviço/processo
- Como a **Guia de Tráfego** aparece escrita no sistema (rótulo/opção): __________
- Categoria/grupo em que ela está listada (se houver): __________

### 15.4 Campos do formulário
Uma linha por campo. Tipo = texto / número / data / seleção / upload / mapa / etc.
| Campo (rótulo exato) | Obrigatório? | Tipo | Observações |
|----------------------|--------------|------|-------------|
| | | | |
| | | | |
| | | | |
| | | | |

### 15.5 Documentos / anexos exigidos
| Documento (rótulo) | Obrig.? | Formato aceito | Tam. máx. | Exige assinatura Gov.br? | Depende do cadastro inicial? |
|--------------------|---------|----------------|-----------|--------------------------|------------------------------|
| | | | | | |
| | | | | | |

### 15.6 Certidões / antecedentes (ponto de conexão M1 ↔ M5)
Responder sim/não/não observado e detalhar:
- [ ] Aparecem como **anexos obrigatórios**? __________
- [ ] O sistema exige **upload** da certidão pelo usuário? __________
- [ ] O sistema **busca automaticamente** (não exige upload)? __________
- [ ] Existe **campo específico** para certidão/antecedente? __________
- [ ] Depende da **UF / domicílio** (pede certidão estadual específica)? __________
- [ ] Quais certidões são citadas nominalmente (PF, TJ, eleitoral, militar…)? __________

### 15.7 GRU (Guia de Recolhimento da União)
- [ ] Em que **momento** é gerada (antes do envio / após protocolo)? __________
- [ ] Aparece **antes ou depois** do número de protocolo? __________
- [ ] Mostra **valor**? Qual (se puder copiar)? __________
- [ ] Mostra **vencimento**? __________
- [ ] Permite **imprimir/baixar** (PDF)? __________
- [ ] O **status muda para "Aguardando pagamento"** (ou equivalente)? __________

### 15.8 Status / protocolo
- [ ] Gera **número de protocolo** imediatamente? __________
- [ ] **Mensagem** que aparece após o envio (transcrever): __________
- [ ] **Status inicial** exibido (transcrever): __________
- [ ] Existe **tela de comprovante**? Baixável? __________

> ⚠️ Só chegue aqui se conseguir observar **sem** protocolar um processo real.
> Se o sistema exigir envio para mostrar protocolo/GRU, **pare antes** e registre
> "não observado — exigiria protocolo real".

### 15.9 Erros / validações observados
| Situação | Mensagem exata / comportamento |
|----------|-------------------------------|
| Campo obrigatório vazio | |
| Documento faltante | |
| Sessão expirada | |
| Comportamento instável (ex.: repetição) | |
| Outro | |

### 15.10 Observações de automação (sua leitura)
- Parece **simples de automatizar**: __________
- Parece **exigir humano**: __________
- Depende de **login Gov.br**: __________
- Depende de **cadastro inicial** (§8): __________
- Depende de **certidões externas** (M1): __________

### 15.11 Registro de screenshots (Guia de Tráfego)
| Etapa | Descrição | Arquivo | Observações (sem PII) |
|-------|-----------|---------|------------------------|
| GT-1 | Seleção da Guia de Tráfego no menu | `gt-01-menu.png` | |
| GT-2 | Tela inicial do processo | `gt-02-inicial.png` | |
| GT-3 | Formulário (campos) | `gt-03-form.png` | mascarar PII |
| GT-4 | Anexos exigidos | `gt-04-anexos.png` | |
| GT-5 | Confirmação (antes de enviar) | `gt-05-confirmacao.png` | **parar aqui** |
| GT-6 | GRU / protocolo (só se observável sem protocolar) | `gt-06-gru.png` | |

### 15.12 Classificação após o reconhecimento (preencher depois)
```
- Onde fica a Guia de Tráfego:      PENDENTE
- Certidões: upload manual / auto / não exige:  PENDENTE
- GRU: antes/depois do protocolo:   PENDENTE
- Etapas automatizáveis:            PENDENTE
- Etapas que exigem humano:         PENDENTE
- Bloqueadores para o MVP:          PENDENTE
```
