# 08 — Inventário de Provedores de Certidão

> Documento de trabalho. **Não** contém código, automação ou dados reais.
> Serve para mapear, provedor a provedor, o que precisamos saber **antes** de
> construir qualquer protótipo da Fase 1.

## 1. Objetivo do inventário

Mapear **todos** os provedores de certidões/antecedentes potencialmente
necessários para processos SINARM/CAC, começando pela **Guia de Tráfego**, e
para cada um decidir, com base técnica e jurídica, se e como pode ser
automatizado.

O inventário responde três perguntas por provedor:

1. **É necessário?** Para qual(is) processo(s) e em quais UFs.
2. **É viável tecnicamente?** URL, campos, captcha, login, gera PDF.
3. **É permitido juridicamente?** Termos de uso, base legal, risco LGPD.

Nenhum provedor entra em protótipo sem as três respondidas (a jurídica pode
estar em `PENDENTE_JURIDICO`, mas **nunca** ignorada).

## 2. Como preencher a tabela

- Uma linha na tabela-resumo (§4) **e** uma ficha detalhada (§5) por provedor.
- Campo desconhecido = `PENDENTE` (nunca deixar em branco nem "chutar").
- Datas/validades sempre com unidade (ex.: `90 dias`, `indeterminada`).
- `automação permitida?` só vira `SIM` **após** análise dos Termos de Uso
  registrada em `docs/legal/analise-termos-de-uso.md`.
- Toda afirmação jurídica precisa de fonte (link do termo de uso / parecer).
- Quem preenche marca **iniciais + data** em `observações`.

## 3. Critérios de classificação do provedor (status técnico)

| Status | Critério |
|--------|----------|
| **AUTOMATIZAVEL** | URL e campos conhecidos, sem captcha (ou captcha com fallback humano viável), gera PDF/resultado salvável, **e** automação permitida juridicamente (`SIM`). Pode rodar ponta a ponta. |
| **SEMIAUTOMATICO** | Parte do fluxo automatizável, mas exige **1 intervenção humana** previsível (resolver captcha, confirmar dado, clicar em etapa autenticada). Automação assiste, humano completa. |
| **MANUAL** | Precisa ser feito por humano de ponta a ponta (ex.: exige acesso autenticado pessoal, presencial, ou não gera resultado digital). Registrado no sistema, mas sem automação. |
| **BLOQUEADO** | Termo de uso **proíbe** automação, ou há barreira anti-bot que só se venceria por meios ilícitos/frágeis. Não automatizar. Fica manual até mudança de contexto legal. |
| **PENDENTE_JURIDICO** | Tecnicamente parece viável, mas **falta análise jurídica**. Estado padrão de todo provedor novo. Não pode ir a protótipo real de produção; pode ser estudado só com dados consentidos. |

> Um provedor pode ser tecnicamente `AUTOMATIZAVEL` e ainda assim ficar retido em
> `PENDENTE_JURIDICO` até a revisão legal. Jurídico é bloqueante.

## 4. Tabela principal de provedores (resumo)

Colunas completas ficam na ficha de cada provedor (§5). A tabela-resumo abaixo é
o índice. Preencher `status téc.` e `status jur.` conforme §3.

| id | Certidão / Provedor | Esfera | UF | Gera PDF? | Captcha? | Login? | Gov.br? | Autom. permitida? | Status téc. | Status jur. |
|----|--------------------|--------|-----|-----------|----------|--------|---------|-------------------|-------------|-------------|
| `pf-antecedentes` | Antecedentes Criminais — Polícia Federal | Federal | Todas | **Sim (PDF)** | PENDENTE (indício anti-bot) | PENDENTE (fontes divergem) | PENDENTE | A_VERIFICAR | SEMIAUTOMATICO (provável) | PENDENTE_JURIDICO |
| `jf-criminal` | Certidão Criminal — Justiça Federal | Federal | por região | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `tj-criminal-uf` | Certidão Criminal Estadual — TJ da UF | Estadual | por UF | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `distribuidor-criminal-uf` | Distribuidor Criminal — Comarca/UF | Estadual | por UF | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `jme-criminal-uf` | Certidão — Justiça Militar Estadual | Estadual | por UF (se aplicável) | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `jmu-criminal` | Certidão — Justiça Militar da União (STM) | Federal | Todas (se aplicável) | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `je-criminal` | Certidão de Crimes Eleitorais — Justiça Eleitoral | Federal | Todas (se aplicável) | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `certidao-estadual-especifica` | Certidões estaduais específicas por domicílio | Estadual | por UF | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |
| `outros-por-processo` | Outros antecedentes exigidos por processo | Outro | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE_JURIDICO |

> **Aviso:** esta lista é de provedores **candidatos**, não uma afirmação de que
> todos são obrigatórios. A obrigatoriedade real por processo (§7) precisa de
> validação operacional/jurídica.

## 5. Fichas detalhadas por provedor

Modelo de ficha (copiar para cada provedor). Todos os campos abaixo compõem o
"schema completo" pedido: id, nome, órgão/site, URL, esfera, UF, processos,
campos, gera PDF, validade, captcha, login, Gov.br, pode positiva/inconclusiva,
automação permitida, status técnico, status jurídico, estratégia, fallback,
risco LGPD, observações.

### Modelo (copiar)

```
- id:
- nome da certidão/provedor:
- órgão / site:
- URL:
- esfera: (federal | estadual | municipal | outro)
- UF aplicável:
- processos que exigem: (Guia de Tráfego | Registro | Porte | Aquisição | ...)
- campos necessários: (nome, CPF, RG, nascimento, mãe, pai?, UF, cidade, end?)
- gera PDF?: (sim | não | outro formato)
- validade: (ex.: 90 dias | indeterminada | PENDENTE)
- tem captcha?: (não | imagem | reCAPTCHA | hCaptcha | desconhecido)
- exige login?: (não | sim — qual)
- exige assinatura Gov.br?: (não | sim)
- pode retornar positiva/inconclusiva?: (sim | não)
- automação permitida?: (SIM | NAO | A_VERIFICAR)  ← fonte obrigatória
- status técnico: (AUTOMATIZAVEL | SEMIAUTOMATICO | MANUAL | BLOQUEADO | PENDENTE_JURIDICO)
- status jurídico: (APROVADO | REPROVADO | PENDENTE_JURIDICO)
- estratégia de automação: (Playwright cheio | HTTP puro | assistido | manual)
- fallback humano: (descrição do que o operador faz se falhar)
- risco LGPD: (baixo | médio | alto + motivo)
- observações: (iniciais + data + fontes)
```

### Fichas (preencher — todas iniciam em PENDENTE)

#### `pf-antecedentes` — Antecedentes Criminais / Polícia Federal
```
- id: pf-antecedentes
- órgão / site: Polícia Federal (SINIC — Sistema Nacional de Informações Criminais)
- URL: página oficial do serviço:
    https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais
  endpoint do sistema (retornou HTTP 403 a acesso não-navegador — ver observações):
    https://servicos.pf.gov.br/epol-sinic-publico/
- esfera: federal
- UF aplicável: todas (base nacional, site único)
- processos que exigem: CAC em geral; para Guia de Tráfego = A CONFIRMAR oficialmente
- campos necessários (confirmado em fontes oficiais/gov.br):
    nome completo, filiação (nome da mãe e do pai), data de nascimento,
    naturalidade, número do RG, CPF. Passaporte = opcional (não obrigatório).
- gera PDF?: SIM — certidão em PDF imprimível, em português
- validade: 90 dias
- tem captcha?: PENDENTE — não confirmado em fonte oficial. Indício de proteção
    anti-bot: o endpoint retornou HTTP 403 a acesso automatizado. VERIFICAR no
    navegador antes de qualquer automação.
- exige login?: PENDENTE — FONTES DIVERGEM. Página de serviço gov.br sugere
    emissão direta sem login; conteúdo de terceiros menciona Gov.br nível
    prata/ouro ou certificado digital. CONFIRMAR na fonte oficial.
- exige assinatura Gov.br?: PENDENTE (ligado ao item acima)
- pode retornar positiva/inconclusiva?: SIM.
    * NEGATIVA = "NADA CONSTA" (sem condenação com trânsito em julgado).
    * Considera apenas "decisões condenatórias com trânsito em julgado"
      (vedado mencionar identificação criminal antes — Lei 12.037/2009, art. 6º).
    * INCONCLUSIVA = homônimo ou divergência de CPF com a Receita → sistema
      gera número de PROTOCOLO e exige comparecimento presencial à PF
      (processamento em até ~15 dias). Este é o caminho de revisão humana.
- automação permitida?: A_VERIFICAR — termo/aviso do site ainda não lido.
    Ver docs/legal/analise-termos-de-uso.md. O 403 acima reforça cautela.
- status técnico: SEMIAUTOMATICO (provável) — gera PDF e campos conhecidos, mas
    captcha/login não confirmados e casos de homônimo exigem humano.
- status jurídico: PENDENTE_JURIDICO
- estratégia de automação (hipótese, NÃO decidida): Playwright + human-in-the-loop
    para eventual captcha; casos de protocolo/homônimo → fallback humano.
- fallback humano: operador emite manualmente e anexa PDF; casos de protocolo
    presencial ficam como tarefa manual/suporte.
- risco LGPD: ALTO — dado de antecedentes criminais + filiação + CPF/RG.
    Exige base legal, consentimento, minimização, cifragem e trilha de acesso.
- observações: preenchido por Claude via pesquisa web em 2026-07-16 (fontes:
    portal gov.br de serviços e página institucional PF). Itens PENDENTE exigem
    verificação direta no navegador e leitura do aviso legal do próprio sistema.
    NÃO foi feita consulta real nem uso de dados pessoais.
```

#### `jf-criminal` — Certidão Criminal / Justiça Federal
```
(mesmo modelo — PENDENTE; atenção: pode variar por Região/TRF)
```

#### `tj-criminal-uf` — Certidão Criminal Estadual / TJ da UF
```
(mesmo modelo — PENDENTE; UM registro por UF, pois cada TJ é um site diferente)
```

#### `distribuidor-criminal-uf` — Distribuidor Criminal / Comarca
```
(mesmo modelo — PENDENTE; pode variar por comarca dentro da UF)
```

#### `jme-criminal-uf` — Justiça Militar Estadual (se aplicável)
```
(mesmo modelo — PENDENTE; confirmar se exigida para o perfil do CAC)
```

#### `jmu-criminal` — Justiça Militar da União / STM (se aplicável)
```
(mesmo modelo — PENDENTE)
```

#### `je-criminal` — Crimes Eleitorais / Justiça Eleitoral (se aplicável)
```
(mesmo modelo — PENDENTE)
```

#### `certidao-estadual-especifica` — específicas por domicílio
```
(mesmo modelo — PENDENTE; depende da UF/cidade de domicílio)
```

#### `outros-por-processo`
```
(mesmo modelo — PENDENTE; abrir novas fichas conforme surgirem exigências)
```

## 6. Recorte: Guia de Tráfego

> Preencher com base na exigência **oficial** vigente do processo de Guia de
> Tráfego. A lista abaixo é hipótese de trabalho, **não** verdade confirmada.

**Quais certidões entram (a confirmar oficialmente):**
- [ ] `pf-antecedentes` — Antecedentes PF
- [ ] `jf-criminal` — Criminal Justiça Federal
- [ ] `tj-criminal-uf` — Criminal Estadual (UF de domicílio)
- [ ] `distribuidor-criminal-uf` — Distribuidor Criminal (se exigido)
- [ ] `je-criminal` / `jmu-criminal` / `jme-criminal-uf` — se aplicável ao perfil

**Quais tendem a ser automáticas (federais, mesmo site nacional):**
- Candidatas: `pf-antecedentes`, `je-criminal`, `jmu-criminal` — *depende de
  captcha/login/termos; confirmar por ficha.*

**Quais dependem da UF (um provedor por estado, alta variação):**
- `tj-criminal-uf`, `distribuidor-criminal-uf`, `jme-criminal-uf`,
  `certidao-estadual-especifica`.

**Quais tendem a exigir revisão humana:**
- Qualquer uma com captcha sem fallback automatizável, login pessoal, resultado
  `POSITIVA` ou `INCONCLUSIVA`, ou status técnico `MANUAL`/`BLOQUEADO`.

## 7. Perguntas para validação operacional (por provedor)

Responder para cada provedor antes de aprová-lo:

1. A certidão é **obrigatória** para qual processo (Guia de Tráfego, registro, porte…)?
2. Qual **documento/dado** exato o site exige?
3. Em **quais UFs** se aplica?
4. Qual a **validade** da certidão emitida?
5. Se o resultado for **POSITIVO**, isso **bloqueia** o andamento/pagamento?
6. Se o resultado for **INCONCLUSIVO**, vai automaticamente para **suporte humano**?
7. Existe risco de **homônimo** (só nome não identifica unicamente)?
8. O site **permite automação**?
9. Existe **termo de uso proibindo** automação? (link)
10. Precisa de **parecer jurídico** antes de habilitar? (sim por padrão)

## 8. Critério para entrar no protótipo da Fase 1

Um provedor só entra no protótipo se **todos** forem verdadeiros:

- [ ] URL conhecida e estável
- [ ] Campos de entrada conhecidos
- [ ] Sem captcha **ou** com fallback humano viável
- [ ] Gera PDF ou resultado salvável
- [ ] Risco LGPD mapeado
- [ ] Status jurídico **no mínimo** `PENDENTE_JURIDICO` (nunca ignorado); para
      produção real, `APROVADO`
- [ ] Testes iniciais só com **dados consentidos** (ex.: sócios)

## 9. Não fazer

- ❌ **Não burlar captcha** por meios automatizados/ilícitos.
- ❌ **Não automatizar** site com proibição explícita antes de revisão jurídica.
- ❌ **Não consultar dados** de pessoas sem consentimento (nem em teste).
- ❌ **Não classificar NEGATIVA por ausência de erro** — só com âncora textual.
- ❌ **Não armazenar mais dados** do que o provedor exige (minimização LGPD).
- ❌ **Não usar dados reais de terceiros** no laboratório.

---

## 10. Reconhecimento visual — `pf-antecedentes`

> Etapa de **observação assistida** da interface real, **sem automação**, **sem
> submeter dados pessoais** e **sem tentar contornar 403/captcha/anti-bot**.
> Objetivo: resolver os itens `PENDENTE` da ficha antes de decidir sobre protótipo.

**Status desta etapa:** ⬜ NÃO EXECUTADA (aguardando execução assistida)
**Executor:** _______  **Data:** _______

### Regras da etapa (relembrando)
- Navegar apenas até onde a interface é visível sem enviar dados.
- Se para avançar uma tela **for necessário** preencher/enviar dados reais →
  **PARAR e perguntar** antes. Não usar dados de terceiros.
- Não repetir requisições em volume (nada de scraping). Uma passada, observando.
- Screenshots **sem PII**. Se um campo tiver dado de teste, mascarar antes de salvar.
- Screenshots ficam em `docs/legal/screenshots/pf-antecedentes/` (fora do git se
  contiverem qualquer PII).

### Checklist do reconhecimento
Marcar `[x]` e preencher o achado ao lado. `PENDENTE` se não observado.

- [ ] **URL inicial** (onde o fluxo começa): __________
- [ ] **Redirecionamentos** (a URL muda? para onde? passa por gov.br/sso?): __________
- [ ] **Campos exibidos** no formulário (listar todos, marcar obrigatórios): __________
- [ ] **Captcha?** (não / imagem / reCAPTCHA v2/v3 / hCaptcha / outro): __________
- [ ] **Exige login Gov.br?** (não / sim — qual nível: bronze/prata/ouro / cert. digital): __________
- [ ] **Aviso legal / Termo de Uso** visível? (link + trecho literal): __________
- [ ] **Política sobre uso automatizado / robôs / scraping?** (sim/não + trecho): __________
- [ ] **Resultado é PDF ou HTML?** (e como é entregue: download / nova aba): __________
- [ ] **Texto de NADA CONSTA** (transcrição literal da âncora): __________
- [ ] **Textos de erro / divergência / protocolo presencial** (transcrever): __________
- [ ] **Comportamento com anti-bot** (apareceu bloqueio/desafio ao navegar?): __________

### Tabela de registro de screenshots
| Etapa | Descrição | Arquivo / screenshot | Observações |
|-------|-----------|----------------------|-------------|
| 1 | Página inicial do serviço | `01-inicial.png` | |
| 2 | Após clicar em "Emitir/Iniciar" (redirecionamento?) | `02-inicio.png` | |
| 3 | Tela de login (se houver) | `03-login.png` | login Gov.br? nível? |
| 4 | Formulário de dados (campos visíveis) | `04-formulario.png` | listar campos, **sem PII** |
| 5 | Captcha (se houver) | `05-captcha.png` | tipo do captcha |
| 6 | Aviso legal / termo de uso | `06-termo.png` | transcrever trecho |
| 7 | (parar antes de submeter dados reais) | — | conforme regra da etapa |

### Classificação após o reconhecimento
Preencher **somente após** executar a etapa acima.

```
- Captcha confirmado?:            PENDENTE
- Login Gov.br confirmado?:       PENDENTE
- Termo proíbe automação?:        PENDENTE
- Resultado (PDF/HTML):           PENDENTE (fontes indicam PDF)
- Âncora NADA CONSTA confirmada?: PENDENTE
- Classificação final:  [ ] AUTOMATIZAVEL  [ ] SEMIAUTOMATICO  [ ] MANUAL
                        [ ] BLOQUEADO      [ ] PENDENTE_JURIDICO
- Justificativa:                 __________
```

### Regra de decisão (como classificar)
- **BLOQUEADO** se: termo proíbe automação **ou** há anti-bot que só se venceria
  por meios ilícitos.
- **MANUAL** se: exige login pessoal do titular sem caminho legal de representação,
  **ou** captcha sem fallback humano viável.
- **SEMIAUTOMATICO** se: fluxo automatizável com **uma** intervenção humana
  previsível (captcha via human-in-the-loop, ou casos de protocolo/homônimo).
- **AUTOMATIZAVEL** se: sem captcha (ou com fallback), sem login pessoal, gera PDF,
  **e** jurídico não impede.
- Em qualquer caso, o **status jurídico** permanece `PENDENTE_JURIDICO` até o
  parecer — o reconhecimento decide o eixo **técnico**, não o jurídico.
