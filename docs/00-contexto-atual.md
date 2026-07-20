# 00 — Contexto Atual do Projeto (memória do projeto)

> **Leia este arquivo primeiro.** Ele resume o estado do projeto, decisões
> tomadas e o próximo passo, para que qualquer pessoa (ou o Claude, numa nova
> sessão) entenda o contexto só lendo os arquivos.
>
> **Última atualização:** 2026-07-20
> **Estado geral:** **Fases 1–7 implementadas e validadas localmente** com
> **Postgres real** e **dados 100% fictícios** (ver `docs/18`, `docs/19`,
> `docs/20` e `docs/22`). O **ciclo dev/fictício está completo de ponta a
> ponta**: rascunho → documento fictício → Pix sandbox/fake → operação admin
> (fila, responsável, prioridade, checklists, indicadores) → **execução manual
> auditável** (etapas, protocolo, GRU e pagamento da GRU registrados por
> humano).
>
> **Nada real:** sem PII, sem documento real, sem cobrança real, **sem
> Gov.br/SINARM, sem GRU real, sem protocolo real**. Na Fase 7 o app **não
> executa atos no órgão** — ele **registra o trabalho humano feito fora do
> app**, com trilha auditável.

---

## 1. Resumo do produto

- Plataforma **web responsiva / PWA** (funciona em celular e computador).
- Serviço **privado, não oficial** (não é órgão público; não usa identidade
  visual do Gov/PF/SINARM).
- Foco inicial no **CAC final** (Colecionador, Atirador, Caçador).
- **Primeiro processo do MVP: Guia de Tráfego.**
- **Venda direta**; **cobrança por processo** (não assinatura).
- Pagamento: **Pix primeiro**, cartão depois.
- **GRU paga pela empresa**, inicialmente de forma **manual**.
- **Painel admin** interno e **suporte humano**.
- **Automação por módulos** (validar o mais difícil primeiro).

## 2. Decisões já tomadas

- Começar como **site responsivo/PWA**, não app nativo.
- Funcionar em **celular e computador**.
- **Marca neutra.**
- Atende **Brasil todo**.
- **Guia de Tráfego** como primeiro processo provável.
- **Preço inicial provável: R$ 100.**
- **Prazo estimado: 14 dias.**
- **Reembolso:**
  - 100% **apenas antes** do envio de documentos;
  - depois do envio, **depende do estágio**;
  - após **protocolo/GRU, não reembolsável**.
- **Não armazenar senha Gov.br no MVP.**
- Usuário **digita a senha diretamente na janela oficial Gov.br**.
- Se **Gov/SINARM instável antes do pagamento** → **bloquear pagamento**.
- Se **cair depois do pagamento** → processo **fica em fila**.
- **Revisão humana obrigatória** nos primeiros **50–100 processos**.

## 3. Arquitetura por módulos

| Mód. | Nome | Escopo |
|------|------|--------|
| M1 | Certidões / antecedentes | Automação, download e classificação de certidões |
| M2 | Documentos | Upload / scanner / OCR de documentos |
| M3 | Pagamentos | Pix (primeiro), cartão depois |
| M4 | Gov.br / SINARM | Login seguro, autorização de compartilhamento |
| M5 | Protocolo e GRU | Processo (Guia de Tráfego), protocolo, GRU |
| M6 | Status / acompanhamento | Andamento do processo para o usuário |
| M7 | Painel admin / suporte | Operação interna e atendimento humano |
| M8 | LGPD / auditoria / segurança | Transversal a tudo |

> Detalhamento em `docs/01-arquitetura-geral.md`. (Obs.: no doc 01 os módulos
> transversais recebem numeração própria; a tabela acima é a visão de negócio.)

## 4. Estado atual da documentação

Arquivos existentes:

- `README.md`
- `docs/00-contexto-atual.md` (este arquivo)
- `docs/01-arquitetura-geral.md`
- `docs/02-fase1-laboratorio-certidoes.md`
- `docs/03-stack-automacao.md`
- `docs/04-modelo-dados.md`
- `docs/05-logs-auditoria-lgpd.md`
- `docs/06-riscos-e-escopo.md`
- `docs/07-estrutura-pastas.md`
- `docs/08-inventario-provedores.md`
- `docs/09-reconhecimento-sinarm-cac.md`
- `docs/10-mvp-guia-de-trafego.md`
- `docs/11-painel-admin-operacao.md`
- `docs/12-modelo-dados-mvp.md`
- `docs/13-stack-tecnica-mvp.md`
- `docs/14-roadmap-implementacao-mvp.md`
- `docs/15-decisoes-fase-0.md`
- `docs/16-fase-1-esqueleto-tecnico.md`
- `docs/17-decisao-pix-mvp.md`
- `docs/18-validacao-integrada-fases-1-5.md`
- `docs/19-validacao-fase-6-operacao-admin.md`
- `docs/20-validacao-fase-6-5-indicadores-operacionais.md`
- `docs/21-preparacao-fase-7-execucao-assistida-manual.md`
- `docs/22-validacao-fase-7-execucao-manual.md`
- `docs/23-checklist-piloto-real.md`
- `docs/24-revisao-ux-textos-conformidade.md`
- `docs/25-visao-automacao-e-decisoes-negocio.md`
- `docs/26-arquitetura-automacao-hibrida.md`
- `docs/27-fase-8a-laboratorio-sintetico.md`
- `docs/legal/analise-termos-de-uso.md`

**Código de aplicação:** o app do MVP existe (Next.js + TypeScript + Prisma),
com as **Fases 1–7** implementadas e **validadas localmente com dados
fictícios** (`docs/18`, `docs/19`, `docs/20` e `docs/22`). Roda com **Postgres
local**, **auth mock/dev**, **storage local/dev** e **Pix em modo fake/sandbox**
— nenhum provedor de produção conectado. **Gov.br, SINARM/CAC, GRU real e
protocolo real continuam FORA** do app: o protocolo é humano, manual e externo,
e o painel apenas **registra e audita** o que a pessoa fez.

## 5. O que já foi descoberto sobre o SINARM/CAC

Reconhecimento manual em 2026-07-16 (detalhes em `docs/09-reconhecimento-sinarm-cac.md`):

- **URL inicial observada:** `https://servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/`
- **Login via Gov.br confirmado.**
- **Redireciona** para `sso.acesso.gov.br`.
- Sequência de telas: **CPF** → **senha** → **autorização de compartilhamento**.
- **Serviço exibido:** "Serviços da Polícia Federal".
- **Dados compartilhados (via Gov.br):** identidade gov.br, nome e foto, e-mail,
  telefone celular, dados de vinculação de empresas.
- Após autorização, **volta para o sistema SINARM/CAC**.
- **Sessão expira em ~60 minutos.**
- **Captcha NÃO observado** neste reconhecimento (risco mantido para o futuro).
- **Instabilidade:** a **autorização precisou ser clicada duas vezes**.
- **Classificação técnica atual do módulo: `SEMIAUTOMATICO`.**

### 5.1 Guia de Tráfego — reconhecimento (2026-07-17)

Fluxo mapeado até o **checkpoint final** (detalhes em `docs/09-reconhecimento-sinarm-cac.md §15`):

- **Caminho:** Solicitação de Serviço → Pessoa Física (PF) → **Preencher
  Formulário (Requerimento)**. URL: `.../#/preencher-formulario`.
- **Não é tela isolada:** é um serviço dentro do formulário genérico, com
  **5 etapas** (Solicitante → Atividades/Serviços → Condições de Exigências →
  Info. adicionais → **Gere GRU**).
- **Serviço:** "Emitir Guia de Tráfego Pessoa Física (CAC)" · **Taxa R$ 20** ·
  Atividade "Tiro Desportivo - Atirador Desportivo" · PCE "ARMA DE FOGO" ·
  Finalidade "TREINAMENTO TIRO DESPORTIVO".
- **Único anexo observado:** Documento de Identificação Pessoal (item 42).
- **Certidões/antecedentes NÃO observadas** neste fluxo (pendente confirmação final).
- **Origem:** campo "Endereço SIGMA" (vem do acervo — exige CR/arma já cadastrada).
- **Destino:** Nome Evento, UF, Cidade, Logradouro, Número (informados pelo usuário).
- **Armamento:** tabela PCE (Nº SIGMA, Código PCE, Espécie, Marca, Modelo, Calibre,
  Nº Série, Nº Lote, Qtde) + seleção do acervo — **exige validação forte**.
- **Justificativa:** texto livre; padrão "Guia para treino".
- **Validade da Guia observada:** 17/01/2027 (ler **dinamicamente**, nunca hardcoded).
- **"Gere GRU" NÃO protocola direto:** abre a tela **"Dados da GRU"** (checkpoint).
- **Tela "Dados da GRU" mapeada:** exibe contribuinte, CPF, **UG/Gestão 167086/00001**,
  **Fundo do Exército**, **Código de Recolhimento 11300-0**, nº de referência,
  vencimento, **Valor 20,00**, instruções e seção **"Acompanhamento da GRU"**
  (vazia antes de gerar). Botões: **Cancelar** · **Gerar GRU e Salvar**.
- **Botão final = "Gerar GRU e Salvar"** → ação **irreversível**: protocola, gera o
  **PDF da GRU**, salva e cria o **número de protocolo**. É o **checkpoint seguro**
  antes do protocolo — **não clicar em teste**.
- **Classificação da Guia de Tráfego: `SEMIAUTOMATICO`** com **alta chance de
  automação futura** (fluxo fixo, sem certidões, taxa baixa); **risco operacional
  reduzido** pela existência do checkpoint.

## 6. Cadastro inicial PF

- Tela: **"Cadastro Inicial do Solicitante de Pessoa Física (PF)"**
- URL: `https://servicos.pf.gov.br/sisgcorp-cliente-web-externo/#/cadastro/manter-cadastro-inicial`
- Botões: **Incluir** · **Editar** · **Visualizar** Cadastro Inicial
- Campos citados operacionalmente: nome completo, data de nascimento, título de
  eleitor, RG, CPF, cidade de nascimento, endereço, CEP, número, latitude,
  longitude, profissão, nome da mãe, nome do pai.
- **Observações:** para o **primeiro processo** pode ser necessário criar o
  cadastro inicial; pode ser necessário que a conta Gov.br **tenha foto válida**.
- **Atualização (2026-07-17):** para a **Guia de Tráfego**, o cadastro inicial PF
  fica como **risco/fallback, NÃO como fluxo obrigatório** do MVP — quem gera Guia
  de Tráfego **já possui CR/arma** (endereço vem do "Endereço SIGMA" do acervo) e,
  portanto, **já deve ter cadastro inicial**.

## 7. Próximo passo planejado

> **Estado da implementação (2026-07-18):** Fases 1–7 concluídas, testadas e
> versionadas — ver `docs/18`, `docs/19` (commit `4634e5b`), `docs/20`
> (commit `79bc3b8`) e `docs/22` (commit `75a78b0`).
> Fluxo fictício completo: login mock → rascunho → revisão → documento fictício
> → fila admin **com filtros e indicadores** → aprovação/rejeição → checklists
> (revisão e checkpoint GRU fictício) → Pix sandbox → processo em fila, com
> **responsável, prioridade, status operacional, notas/mensagens**, histórico
> auditável, **prontidão operacional** (o que falta, quem atua, quão perto está)
> e, por fim, **execução manual auditável** — etapas, protocolo, GRU e pagamento
> da GRU **registrados por humano**, nunca executados pelo app.
>
> **F7 — EXECUÇÃO ASSISTIDA MANUAL: implementada, testada e versionada**
> (commit `75a78b0`; plano em `docs/21`, validação em `docs/22`).
> **Conceito em vigor:** o app **guia**, o **humano executa fora do app** na
> janela oficial, o humano **registra** no painel e o app **audita**.
> **O sistema NÃO acessa Gov.br, NÃO acessa SINARM/CAC, NÃO automatiza (sem
> Playwright/Puppeteer/Selenium), NÃO protocola e NUNCA clica em "Gerar GRU e
> Salvar"** — nem guarda credencial ou senha do Gov.br.
>
> **➡️ Bloco atual: NÃO é nova funcionalidade — é PREPARAÇÃO DE PILOTO REAL +
> REVISÃO DE COMUNICAÇÃO.** Não é hora de adicionar funcionalidade sensível
> (`docs/22 §13`).
> - `docs/23-checklist-piloto-real.md` — escopo do piloto, checklists
>   (técnico/jurídico/financeiro/operacional/UX/segurança/suporte), critérios de
>   aceite e recusa de cliente, fluxo controlado, responsáveis, evidências,
>   rollback e critérios de sucesso/pausa.
> - `docs/24-revisao-ux-textos-conformidade.md` — **revisão de UX e textos tela
>   a tela** (feita, nenhuma tela alterada): frases proibidas/recomendadas,
>   microcopy proposta e **7 avisos obrigatórios**. Achados de prioridade alta a
>   corrigir antes do piloto: **termos/privacidade/reembolso ausentes nas telas**,
>   **composição de preço (serviço + GRU) não explicada**, **jargão dev e status
>   cru visíveis ao usuário**, **erro técnico exposto no dashboard** e
>   **"protocolado ≠ aprovado"** não dito.
>
> **Produção e piloto seguem BLOQUEADOS** pelas 12 pendências do `docs/23 §5`:
> auth real · MFA admin · storage de produção · KMS/criptografia · retenção
> final · Mercado Pago produção · webhook público · termos de uso · política de
> reembolso · revisão jurídica · política operacional · treinamento do operador.
> **Regra:** o piloto só começa com os 12 fechados — não há "resolve durante o
> piloto".
>
> **Pendências que travam produção** (docs/20 §11): auth real + MFA, storage de
> produção + KMS + retenção, conta Mercado Pago de produção + webhook público
> real, termos/reembolso, revisão jurídica.
>
> **➡️ Próximo bloco planejado: ARQUITETURA / LABORATÓRIO DE AUTOMAÇÃO HÍBRIDA
> (planejamento, não implementação).**
> - `docs/25-visao-automacao-e-decisoes-negocio.md` — **visão futura**: automação
>   **server-side autorizada**, com consentimento e presença do usuário, atrás de
>   **gates** jurídico/segurança/produção/validação. Registra decisões do dono e
>   go-to-market (clube).
> - `docs/26-arquitetura-automacao-hibrida.md` — **arquitetura híbrida (Caminho
>   3)**: **Playwright/Puppeteer** como motor determinístico previsível, **backend
>   orquestrando**, **IA só em exceção/validação/diagnóstico** (fora do caminho
>   crítico), **humano** confirmando atos sensíveis. Propõe **Fase 8 — Laboratório
>   de Automação Sintética** (página **fake/sintética**, dados fictícios) e
>   **Fase 9 — Prova técnica controlada** (só após os gates).
> - `docs/27-fase-8a-laboratorio-sintetico.md` — **Fase 8A IMPLEMENTADA e validada
>   (dev)**: rota interna `/admin/lab/guia-trafego` (ADMIN/OPERADOR) — uma **página
>   fake/sintética** que imita o fluxo da Guia de Tráfego, com dados **100%
>   fictícios** e `data-testid` estáveis, para servir de **alvo** à automação
>   futura. **Sem Playwright, sem Gov.br/SINARM, sem rede, sem upload/pagamento/
>   protocolo real.** Próximo: **Fase 8B** (automação Playwright **só** contra essa
>   página fake), mediante confirmação.
>
> **Automação real NÃO está liberada.** O laboratório **começa em página
> fake/sintética** com **dados fictícios** — **sem tocar Gov.br/SINARM real, sem
> site público real, sem dados reais, sem instalar Playwright ainda**. Qualquer
> automação contra o sistema real depende dos **gates do `docs/26 §19`** (escopo
> jurídico por escrito + 12 pendências do `docs/23 §5` + segurança de sessão +
> Fase 8 concluída + confirmação explícita). As **regras permanentes** (§8) e os
> **bloqueios de fase** (docs/15) seguem valendo integralmente.

**Reconhecimento da Guia de Tráfego MAPEADO até o checkpoint final** — inclui a
tela **"Dados da GRU"** e o botão **"Gerar GRU e Salvar"**. Detalhes em
`docs/09-reconhecimento-sinarm-cac.md §15`.

**Conclusões:**
- **Guia de Tráfego parece VIÁVEL para o MVP.**
- **Certidões/antecedentes NÃO observadas** neste fluxo → **M1 provavelmente NÃO
  é bloqueador** para o MVP da Guia (pode ficar para CR novo/renovação/processos
  maiores, salvo reconhecimento posterior em contrário).
- **Cadastro inicial PF = fallback**, não fluxo obrigatório da Guia.
- **Tela "Dados da GRU" é o checkpoint seguro** antes do protocolo; o botão final
  **"Gerar GRU e Salvar"** é **irreversível** (protocola + gera PDF + cria protocolo).
  Isso **reduz o risco operacional** da automação futura.

**Próximo reconhecimento — mapear o PÓS-PROTOCOLO** (o que aparece **depois** de
clicar em "Gerar GRU e Salvar), **apenas em processo real/controlado** (ver §15.14).
Observar: número de protocolo, PDF da GRU, onde baixar/imprimir, status inicial,
se aparece em "Listar Processo" e "Acompanhamento da GRU", como consultar depois
e como identificar compensação/pagamento. **Por enquanto NÃO seguir para automação.**

## 8. Regras permanentes de segurança

- ❌ Não commitar screenshots com CPF, nome, empresa ou qualquer PII.
- ❌ Não armazenar senha Gov.br.
- ❌ Não burlar captcha.
- ❌ Não tentar contornar anti-bot.
- ❌ Não protocolar processo real em ambiente de teste.
- ❌ Não prometer aprovação.
- ❌ Não parecer órgão oficial.
- ❌ Não usar identidade visual oficial do Gov/PF/SINARM.
- ❌ Não consultar dados sem consentimento.
- ❌ Não classificar certidão negativa por ausência de erro.
- ✅ Ambíguo / inconclusivo vai para **revisão humana**.

## 9. Para retomar

**Sequência de leitura ao abrir o projeto na próxima sessão:**

1. Leia **este arquivo** (`docs/00-contexto-atual.md`) primeiro.
2. Depois as validações, na ordem: `docs/18` (Fases 1–5), `docs/19` (Fase 6),
   `docs/20` (Fase 6.5) e `docs/22` (Fase 7) — o que já está pronto e validado,
   e o que trava produção.
3. Depois `docs/15-decisoes-fase-0.md` (decisões e pendências) e
   `docs/09-reconhecimento-sinarm-cac.md` (fluxo SINARM).

### ➡️ PRÓXIMO PASSO (explícito)

> **Reconhecimento da Guia de Tráfego consolidado** em
> `docs/09-reconhecimento-sinarm-cac.md §15` — **fluxo mapeado até o checkpoint
> final** (tela "Dados da GRU" + botão "Gerar GRU e Salvar", §15.11).
>
> **Próximo passo (futuro):** **mapear o PÓS-PROTOCOLO** — o que aparece **depois**
> de clicar em "Gerar GRU e Salvar" — **apenas em processo real/controlado**
> (isso protocola de verdade). **Por enquanto NÃO seguir para automação.**

**O que observar no pós-protocolo (§15.14):**
1. **Número de protocolo** gerado.
2. **PDF da GRU** (conteúdo).
3. **Local onde baixar/imprimir** a GRU.
4. **Status inicial** do processo.
5. Se aparece em **"Listar Processo"**.
6. Se aparece em **"Acompanhamento da GRU"**.
7. **Como consultar depois.**
8. **Como identificar compensação/pagamento.**

→ Screenshot esperado: `gt-07-pos-protocolo.png` (**só em processo real; mascarar PII**).

**Ao voltar:** preencher §15.14 com os achados; onde não observar, "não
observado"; onde houver dúvida, "inconclusivo — confirmar".

### Regras de retomada (permanentes)

- ❌ **Não automatizar Gov.br/SINARM.** O MVP é **assistido/manual**.
- ❌ **Não usar dados reais / PII real** (CPF, RG, documento, cliente real).
- ❌ **Não gerar cobrança Pix real** nem conectar provedor de produção.
- ❌ **Não protocolar** processo real.
- ✅ **Documentar a decisão antes de implementar** a fase que depende dela.
- ✅ Código, dependências, mudança de fase ou provedor **só com confirmação
  explícita** do usuário.
- ✅ Ao criar tela nova, aplicar **permissão na query + DTO redigido**
  (docs/18 §6).

> **Nota:** a regra anterior "não implementar código ainda" valia até a Fase 0.
> As Fases 1–5 já foram implementadas **com confirmação explícita** e validadas
> em modo dev/fictício (docs/18).
