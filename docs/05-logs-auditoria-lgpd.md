# 05 — Logs, Auditoria e LGPD

## 11. Como registrar logs e auditoria

Duas trilhas distintas, com propósitos diferentes:

### a) Log operacional (depuração / observabilidade)
- **Estruturado em JSON** (pino), uma linha por evento.
- **Correlação por `attemptId`** — todo evento de uma tentativa carrega o mesmo
  id, então dá pra reconstruir a tentativa inteira.
- Registra, por passo: timestamp, provedor + versão do roteiro, ação, resultado
  do passo, `errorCode` quando falha.
- **Artefatos de diagnóstico** anexados por tentativa: screenshots dos passos
  chave, trace do Playwright, HTML bruto em caso de falha.
- **PII redigida.** Logs **nunca** contêm CPF/RG/nome da mãe em claro. Onde for
  necessário indicar "qual campo foi usado", registrar só o **nome do campo** e,
  no máximo, forma mascarada (`cpf: ***.***.**9-00`).

### b) Trilha de auditoria (imutável, append-only)
- Registra **fatos de negócio**: solicitação criada, tentativa iniciada/encerrada,
  classificação atribuída, artefato gerado, acesso a PII.
- **Append-only**: nunca se edita/apaga um registro de auditoria.
- Cada registro: quem/o quê/quando + referência ao artefato ou entidade.
- **Log de acesso a PII separado** (exigência LGPD): quem/qual processo leu quais
  dados pessoais, quando e para quê.

### O que registrar por tentativa (resumo)
- Campos usados (nomes, não valores sensíveis em claro) → `CertidaoAttempt.camposUsados`
- Data/hora início e fim
- Provedor + versão do roteiro
- Resultado + classificação + `errorCode`
- Ponteiros para PDF, screenshots e trace

## 15 (parte LGPD). Considerações de LGPD

Esta plataforma processa **muito dado pessoal sensível por natureza do contexto**
(CPF, RG, nome da mãe, endereço, e o próprio fato de investigar antecedentes
criminais). LGPD não é um item de checklist no fim — é requisito de arquitetura.

Medidas já embutidas na arquitetura da Fase 1:

- **Base legal e finalidade.** Definir e registrar a base legal (execução do
  serviço solicitado pelo titular) e a finalidade específica. Não usar os dados
  para nada além de emitir a certidão pedida.
- **Minimização.** Coletar só os campos que cada provedor exige. `camposUsados`
  documenta isso por tentativa.
- **Cifragem em repouso** dos campos de PII na `Person` + **TLS** em trânsito.
- **Segregação.** PII isolada dos logs; logs redigidos; storage de PDFs com
  acesso controlado.
- **Retenção e expurgo.** Política de tempo de guarda por tipo de dado/artefato
  e rotina de exclusão. Direito de eliminação do titular deve ser executável.
- **Trilha de acesso a PII** (item 11b).
- **Operadores/subcontratados.** Qualquer storage/serviço externo (S3, resolutor
  de captcha, PSP no futuro) exige contrato de tratamento de dados (DPA) e
  avaliação. Na Fase 1, mantendo tudo local, reduzimos essa superfície.
- **DPO / registro de operações (ROPA).** Manter o registro das operações de
  tratamento desde já, mesmo no laboratório.
- **Incidentes.** Procedimento de resposta e notificação a incidentes.

> **Regra de ouro do laboratório:** usar, sempre que possível, **dados de teste /
> consentidos** (ex.: os próprios sócios) na Fase 1. Não processar dados de
> terceiros reais sem consentimento explícito, mesmo em ambiente de teste.

## Seção Gov.br / SINARM (módulos M4 e M5)

> Origem: reconhecimento manual do fluxo SINARM/CAC — ver
> `docs/09-reconhecimento-sinarm-cac.md`. Este fluxo usa **login Gov.br do
> próprio usuário** e **autorização de compartilhamento de dados** (OIDC, escopo
> `openid email phone profile govbr_empresa`).

### Dados pessoais envolvidos neste fluxo
Compartilhados pelo Gov.br mediante autorização do titular: **identidade gov.br,
nome/foto, e-mail, telefone, vínculos de empresa**. Após a autorização, o
**responsável pelo tratamento é o serviço da PF** — nosso app apenas **assiste** o
usuário até a janela oficial.

### Registros obrigatórios (trilha de auditoria)
- **Consentimento interno do usuário** no nosso app, registrado **antes** de abrir
  a janela Gov.br (quem, quando, versão do termo aceito).
- **Abertura da sessão Gov.br** (evento de que a janela oficial foi iniciada).
- **Autorização de compartilhamento** concedida no Gov.br — registrar apenas o
  **fato** (autorizou sim/não, data/hora), **nunca** a senha nem o conteúdo.
- **Logs de acesso ao SINARM/CAC** (entrou no sistema, acessou cadastro inicial,
  etc.), correlacionados ao processo do usuário.
- **Expiração/retomada de sessão** (~60 min) como eventos de auditoria.

### Proibições específicas (LGPD + segurança)
- ❌ **Nunca armazenar a senha Gov.br** — em nenhuma hipótese, nem no MVP. O
  usuário digita CPF/senha **somente na janela oficial Gov.br**.
- ❌ Não capturar/interceptar credenciais na janela Gov.br.
- ❌ Não versionar screenshots com PII (CPF, nome, foto, empresa).

### Minimização
Guardar apenas o que o processo exige. Dados como **foto** e **vínculos de
empresa** só devem ser retidos por nós se houver finalidade concreta; caso
contrário, não persistir — o compartilhamento vive no lado da PF.

### Base legal (a confirmar com jurídico)
Provável **execução de procedimento a pedido do titular** + **consentimento**
para o compartilhamento intermediado. Registrar no ROPA. Ver
`docs/legal/analise-termos-de-uso.md`.
