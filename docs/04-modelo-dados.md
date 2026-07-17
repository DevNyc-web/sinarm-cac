# 04 — Modelo de Dados, PDFs e Classificação

## 8. Como representar cada certidão no banco

Modelo mínimo da Fase 1. PII fica separada e cifrada. Uma **solicitação** pode
ter **várias tentativas** (retentativa preserva histórico).

```
Person 1───* CertidaoRequest 1───* CertidaoAttempt 1───* Artifact
                    │                       │
                    └── Provider ───────────┘
```

### Entidades

**Person** — dados pessoais (PII sensível, cifrada em repouso)
```
id
nomeCompleto        (cifrado)
cpf                 (cifrado; hash separado p/ busca/deduplicação)
rg                  (cifrado)
dataNascimento      (cifrado)
nomeMae             (cifrado)
nomePai             (cifrado, opcional)
uf
cidade
endereco            (cifrado, opcional)
createdAt / updatedAt
```

**Provider** — provedor de certidão (metadados; espelha a config em código)
```
id
nome
tipo                (enum CertidaoTipo)
abrangencia         (FEDERAL | ESTADUAL | MUNICIPAL)
uf?
automacaoPermitida  (SIM | NAO | A_VERIFICAR)
health              (OK | DEGRADADO | FORA_DO_AR)
habilitado          (bool)
```

**CertidaoRequest** — pedido de uma certidão para uma pessoa
```
id
personId  -> Person
providerId -> Provider
tipo
statusAtual         (PENDENTE | EM_ANDAMENTO | CONCLUIDA | FALHA | REQUER_MANUAL)
classificacaoFinal  (NEGATIVA | POSITIVA | INCONCLUSIVA | ERRO | null)
createdAt
```

**CertidaoAttempt** — uma tentativa de automação (o coração da auditoria)
```
id
requestId -> CertidaoRequest
numeroTentativa     (1,2,3...)
startedAt / finishedAt
status              (SUCESSO | FALHA)
classificacao       (NEGATIVA | POSITIVA | INCONCLUSIVA | ERRO)
errorCode           (SITE_FORA_DO_AR | TIMEOUT | CAPTCHA_REQUERIDO |
                     ERRO_PREENCHIMENTO | VALIDACAO_DADOS | NAO_ENCONTRADO |
                     BLOQUEIO_ANTIBOT | DESCONHECIDO | null)
camposUsados        (JSON: snapshot de QUAIS campos foram enviados — sem valores
                     sensíveis em claro; ver LGPD)
providerVersao      (versão do roteiro do provedor usada)
logRef              (ponteiro p/ arquivo de log estruturado da tentativa)
retentavel          (bool)
```

**Artifact** — arquivo gerado (PDF, screenshot, trace)
```
id
attemptId -> CertidaoAttempt
tipo                (PDF_CERTIDAO | SCREENSHOT | TRACE | HTML_BRUTO)
storageKey          (caminho no storage)
sha256              (hash do conteúdo — integridade e deduplicação)
mime
tamanhoBytes
createdAt
```

> Enums centralizados: `CertidaoTipo`, `Classificacao`, `ErrorCode`,
> `AttemptStatus`. Guardar como enum no código + coluna string no banco.

## 9. Como salvar PDFs

- **Storage por adapter.** Interface `StorageAdapter` com `put/get/exists`.
  Implementação local no lab (`FileSystemStorage`), S3/MinIO depois — o engine
  não muda.
- **Layout de chaves**, previsível e por tentativa:
  ```
  storage/certidoes/{requestId}/{attemptId}/certidao.pdf
  storage/certidoes/{requestId}/{attemptId}/screenshot-passo-3.png
  storage/certidoes/{requestId}/{attemptId}/trace.zip
  ```
- **Integridade:** calcular `sha256` do PDF ao salvar e guardar em `Artifact`.
  Serve para deduplicar e para provar que o arquivo não foi alterado (auditoria).
- **Metadados no banco, bytes no storage.** Nunca guardar o PDF como blob no
  Postgres.
- **Retenção/expurgo** (LGPD): política de tempo de guarda por tipo de artefato.
  Screenshots de depuração podem expirar antes do PDF oficial. Ver
  `05-...lgpd.md`.

## 10. Como classificar resultados

Objetivo: transformar o resultado bruto em
`NEGATIVA | POSITIVA | INCONCLUSIVA | ERRO`.

- **Regras por provedor** (cada site escreve diferente). Ficam junto do provedor.
  Ex.: extrair texto do PDF e aplicar:
  ```
  "nada consta" / "não constam registros"     -> NEGATIVA
  "constam os seguintes" / "consta registro"   -> POSITIVA
  texto ambíguo / faltando âncora esperada     -> INCONCLUSIVA
  exceção / arquivo ilegível / erro no fluxo    -> ERRO
  ```
- **Guardar a evidência da decisão:** texto extraído (`HTML_BRUTO`/texto do PDF),
  a **regra que casou** e uma **confiança** (alta/baixa). Isso permite auditar
  por que classificamos algo como NEGATIVA.
- **`INCONCLUSIVA` sempre vira fila de revisão humana.** Nada ambíguo é
  autoclassificado como definitivo. Segurança > automação.
- **Nunca** inferir "negativa" por ausência de erro. Só classificamos como
  NEGATIVA quando a âncora textual esperada é encontrada. Ausência de prova ≠
  prova de ausência.
- **Fixtures de teste** (PDFs reais de "consta"/"nada consta" por provedor)
  validam o classificador em CI, sem depender do site.
