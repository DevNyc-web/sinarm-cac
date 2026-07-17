# 02 — Fase 1: Laboratório de Certidões

Laboratório técnico **isolado**. Sem app, sem Pix, sem Gov.br, sem OCR, sem
SINARM. Objetivo único: **validar a automação de emissão e classificação de
certidões/antecedentes**.

## 4. Arquitetura específica da Fase 1

```
┌──────────────────────────────────────────────────────────────┐
│  ENTRADA (manual na Fase 1)                                    │
│  CLI / arquivo JSON / API interna mínima                       │
│  Dados: nome, CPF, RG, nascimento, mãe, pai?, UF, cidade, end? │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
                ┌───────────────────────┐
                │  Orquestrador de Jobs │  (fila; 1 tentativa = 1 job)
                └───────────┬───────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │  Provider Registry                     │
        │  seleciona provedor(es) por tipo/UF    │
        └───────────────────┬───────────────────┘
                            ▼
        ┌───────────────────────────────────────┐
        │  Worker de Automação (Playwright)      │
        │   1. abre site do provedor             │
        │   2. preenche campos permitidos        │
        │   3. trata captcha / erro / site fora  │
        │   4. baixa PDF                          │
        │   5. extrai texto                       │
        └───────────────────┬───────────────────┘
                            ▼
        ┌──────────────┬────────────────┬────────────────┐
        ▼              ▼                ▼                ▼
  ┌──────────┐  ┌────────────┐   ┌────────────┐   ┌──────────────┐
  │Classific.│  │  Storage   │   │  Logs /    │   │  Banco       │
  │NEG/POS/  │  │ PDF+prints │   │  trilha    │   │ request/     │
  │INCONC/ERR│  │ +trace     │   │  por tent. │   │ attempt/...  │
  └──────────┘  └────────────┘   └────────────┘   └──────────────┘
```

### Componentes

- **Entrada manual.** Um comando de CLI ou um JSON de teste com os dados da
  pessoa. Sem tela.
- **Orquestrador de jobs.** Uma tentativa de certidão = um job na fila. Permite
  retentativa, isolamento de falha e concorrência controlada (não martelar o
  site do provedor).
- **Provider Registry.** Descobre e seleciona provedores por tipo de certidão +
  UF/abrangência. Provedores são plugáveis (ver §7).
- **Worker de automação.** Executa o roteiro do provedor no Playwright, em
  processo separado da (futura) API.
- **Classificador.** Traduz o resultado em `NEGATIVA | POSITIVA | INCONCLUSIVA | ERRO`.
- **Storage.** PDF + screenshots + trace do Playwright, por tentativa.
- **Logs/trilha.** Registro estruturado de cada passo, campos usados, data/hora.
- **Banco.** `Person`, `CertidaoRequest`, `CertidaoAttempt`, `Artifact`, `Provider`.

### Fluxo de uma tentativa

1. Recebe input → cria/reutiliza `Person` (PII cifrada) → cria `CertidaoRequest`.
2. Enfileira job → cria `CertidaoAttempt` (nº da tentativa, snapshot dos campos).
3. Worker abre browser, executa roteiro do provedor.
4. Em cada passo relevante: screenshot + log com `attemptId` como correlação.
5. Sucesso → baixa PDF → extrai texto → classifica → grava `Artifact` + resultado.
6. Falha → captura print/trace, define `errorCode`, marca se é retentável.
7. Fecha o attempt com status final e `finishedAt`.

## 5/7. Como estruturar os provedores de certidão

Cada provedor é **declarativo + roteiro**. A ideia é isolar a fragilidade (o
site externo muda) em um único arquivo por provedor, sem espalhar pelo código.

Interface conceitual de um provedor:

```ts
interface CertidaoProvider {
  id: string;                 // ex.: "pf-antecedentes-federal"
  nome: string;               // "Antecedentes Criminais - Polícia Federal"
  tipo: CertidaoTipo;         // ANTECEDENTES_FEDERAL, DISTRIBUICAO_ESTADUAL, ...
  abrangencia: 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL';
  ufs?: string[];             // quando estadual/municipal
  url: string;
  camposObrigatorios: CampoPessoa[];   // ex.: ['nome','cpf','nascimento','mae']
  captcha: 'NENHUM' | 'IMAGEM' | 'RECAPTCHA' | 'HCAPTCHA' | 'DESCONHECIDO';
  legal: {
    automacaoPermitida: 'SIM' | 'NAO' | 'A_VERIFICAR';
    observacao?: string;      // referência aos Termos de Uso do site
  };
  habilitado: boolean;        // liga/desliga sem apagar o provedor

  executar(ctx: AutomationContext, input: PessoaInput): Promise<ProviderResult>;
  classificar(raw: RawResultado): Classificacao;   // regras próprias do provedor
}
```

- **Um provedor = uma pasta** (`providers/pf-antecedentes-federal/`): config +
  roteiro + regras de classificação + fixtures de teste (HTML/PDF salvos).
- **Registry** carrega todos os provedores habilitados e indexa por `tipo`+`uf`.
- **`legal.automacaoPermitida`** é obrigatório e revisado juridicamente antes de
  habilitar (ver `05-...lgpd.md` e `06-riscos...`). Nenhum provedor entra no ar
  com automação sem essa análise.
- **Fixtures.** Cada provedor guarda exemplos reais de "nada consta" e "consta"
  para testar o classificador sem bater no site.

### Catálogo inicial de tipos de certidão (a mapear na Fase 1)

Para Guia de Tráfego / CAC, tipicamente:

- Antecedentes Criminais — Polícia Federal
- Certidão de Distribuição Criminal — Justiça Federal
- Certidão Criminal Estadual (TJ da UF) — Justiça Estadual
- Certidão Criminal — Justiça Militar (Estadual e da União)
- Certidão — Justiça Eleitoral (crimes eleitorais)

> **Não** assumir que todos permitem automação. O primeiro trabalho da Fase 1 é
> um **inventário por provedor**: URL, campos, captcha, e status jurídico.

## 12. Falha, instabilidade, captcha e retentativas

Estratégia de robustez do worker:

- **Taxonomia de erro** (guardada em `CertidaoAttempt.errorCode`):
  `SITE_FORA_DO_AR`, `TIMEOUT`, `CAPTCHA_REQUERIDO`, `ERRO_PREENCHIMENTO`,
  `VALIDACAO_DADOS` (ex.: CPF inválido no site), `NAO_ENCONTRADO`,
  `BLOQUEIO_ANTIBOT`, `DESCONHECIDO`.
- **Timeouts explícitos** em cada passo + retentativa com **backoff exponencial**
  e `maxTentativas` por provedor.
- **Detecção de site fora do ar / instável** → marca provedor com `health`
  degradado e evita novas tentativas por um período (circuit breaker simples).
- **Idempotência**: retentativa cria um novo `CertidaoAttempt`, nunca sobrescreve
  o anterior. Histórico completo é preservado.
- **Captcha** — nunca burlar mecanismo antifraude ilegalmente. Estratégias, por
  ordem de preferência:
  1. `human-in-the-loop`: pausa o job, notifica operador, humano resolve, job
     continua. (Padrão da Fase 1.)
  2. Serviço de resolução de captcha **apenas se** os Termos de Uso do provedor
     permitirem — decisão jurídica, provedor a provedor.
  3. Se nada for permitido → resultado `INCONCLUSIVA` com motivo
     `REQUER_ACAO_MANUAL`.
- **Dead-letter**: jobs que estouram `maxTentativas` vão para uma fila de revisão
  humana, com todo o material (prints/trace) anexado.
- **Diagnóstico**: em toda falha, salvar screenshot + trace do Playwright para
  reproduzir o problema depois sem re-executar contra o site.
