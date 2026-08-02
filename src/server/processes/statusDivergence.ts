/**
 * Diagnostico de divergencia `internalStatus` x `operationalStatus` — Fase 5c
 * (docs/46-inventario-operational-status.md §9).
 *
 * POR QUE ESTE MODULO EXISTE: docs/46 mediu o desequilibrio (5 caminhos de
 * escrita e 9/9 valores alcancaveis em `operationalStatus`, contra 1 caminho e
 * 2/17 em `internalStatus`) mas nao decidiu nada — decisao sobre novos
 * `InternalStatus` para os 6 estados de workflow humano (docs/46 §7) e a Fase
 * 5d. Antes dessa decisao, este modulo so MEDE e NOMEIA a divergencia atual
 * entre os dois campos, para leitura humana. Ele nao resolve nada.
 *
 * O QUE ELE NAO FAZ:
 *  - NAO e o mapa `operationalFromInternalStatus` que docs/46 §11 proibe: nao
 *    e fonte operacional, ninguem deve decidir fila, permissao, readiness ou
 *    status visivel a partir do que sai daqui.
 *  - NAO muta o processo. Recebe um retrato e devolve leitura (mesmo padrao de
 *    `operationalSignals.ts`).
 *  - NAO le `userFacingStatus`: aquela coluna nao decide nada desde docs/45 —
 *    nao seria fonte visual nem fonte de decisao aqui tambem.
 *  - NAO usa os estados da Fase 2 (`AGUARDANDO_CONFIRMACAO_HUMANA`,
 *    `AGUARDANDO_CAPTCHA`) como validos: eles nao tem consumidor real hoje
 *    (docs/44 §6), entao a combinacao nunca deveria aparecer em producao — e
 *    o diagnostico nunca reporta `hasDivergence: false` para eles.
 *  - NAO acessa banco, rede ou arquivo. Modulo PURO: mesma entrada, mesma
 *    saida, sempre.
 *
 * COMO LER A SAIDA:
 *  - `severity: "none"` — os dois campos concordam num par com projecao
 *    segura: os 3 originais de docs/46 §6 (`RASCUNHO`, `AGUARDANDO_PAGAMENTO`,
 *    `PAGO_EM_FILA`, mesmo valor nos dois campos) mais os pares migrados fase
 *    a fase pela porta canonica (`DOCUMENTO_RECEBIDO_PARA_ANALISE` ↔
 *    `DOCUMENTO_ENVIADO`, Fase 5e; `DOCUMENTO_VALIDADO` ↔ `DOCUMENTO_APROVADO`,
 *    Fase 5f — docs/47; `BLOQUEADO_OPERACIONAL` ↔ `BLOQUEADO`, Fase 5f
 *    completa — docs/48). Unico caso sem divergencia.
 *  - `severity: "expected_legacy"` — divergencia CONHECIDA e de baixo risco:
 *    `operationalStatus` avancou via um write legado (docs/46 §3) que ainda
 *    nao tem porta canonica, mas o hop e simples e sem ambiguidade.
 *  - `severity: "operational_only"` — NAO ha o que decidir: o
 *    `operationalStatus` atual e um estado da EQUIPE, nao da jornada do
 *    processo, e docs/49 decidiu que ele permanece so operacional. A
 *    divergencia e PERMANENTE e esperada — `hasDivergence` continua `true`
 *    porque os dois campos realmente dizem coisas diferentes; o que muda e que
 *    ninguem precisa agir. NAO confundir com `none`: aqui nao ha par migrado.
 *  - `severity: "needs_decision"` — divergencia real que ainda espera decisao:
 *    o `internalStatus` avancou para um valor sem correspondencia documentada,
 *    e projetar antes de decidir afirmaria algo que ninguem analisou.
 *  - `severity: "invalid_projection"` — a MELHOR projecao disponivel para este
 *    `internalStatus` e documentadamente ERRADA ou inexistente (docs/46 §6):
 *    projetar aqui afirmaria algo falso, nao apenas incompleto.
 *
 * `expectedOperationalStatus`, quando presente, e o candidato citado em
 * docs/46 §6 — mesmo quando esse candidato e o proprio motivo do
 * `invalid_projection` (ex.: `CANCELADO_REEMBOLSADO` -> `CANCELADO_DEV` esta
 * documentado, mas e uma projecao FALSA, nao uma sugestao de uso).
 */
import { type InternalStatus, type ManualExecutionStatus, type OperationalStatus } from "@prisma/client";
import {
  CANONICAL_OPERATIONAL_PROJECTION,
  hasCanonicalProjection,
  type CanonicalInternalStatus,
} from "./operationalStatusProjection";

export const DIVERGENCE_SEVERITIES = [
  "none",
  "expected_legacy",
  "operational_only",
  "needs_decision",
  "invalid_projection",
] as const;

export type DivergenceSeverity = (typeof DIVERGENCE_SEVERITIES)[number];

export type StatusDivergenceInput = {
  internalStatus: InternalStatus;
  operationalStatus: OperationalStatus;
  /**
   * Contexto apenas — NAO entra no calculo de `severity`. A execucao manual
   * sobrepoe o que o CLIENTE ve (docs/21 §11, `clientVisibleStatusLabel`), mas
   * nao muda o que `internalStatus` e `operationalStatus` significam entre si,
   * que e o unico par que este diagnostico compara.
   */
  manualExecutionStatus?: ManualExecutionStatus;
};

export type StatusDivergenceDiagnosis = {
  hasDivergence: boolean;
  severity: DivergenceSeverity;
  reason: string;
  expectedOperationalStatus?: OperationalStatus;
};

// --------------------------------------------------------- zonas conhecidas

/**
 * Os 6 pares com projecao segura vivem em `operationalStatusProjection.ts`
 * (Fase 5h) — `CANONICAL_OPERATIONAL_PROJECTION`/`hasCanonicalProjection`,
 * reexportado aqui so como `SafeInternalStatus` para nao mudar o nome que o
 * resto deste arquivo ja usa. Extraido para modulo proprio porque a
 * classificacao "par canonico" passou a ser conhecimento reutilizavel por
 * outros consumidores, nao so por este diagnostico (docs/46 §6, docs/49).
 */
type SafeInternalStatus = CanonicalInternalStatus;
const isSafeInternalStatus = hasCanonicalProjection;

const SAFE_OPERATIONAL_VALUES = [
  "RASCUNHO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO_EM_FILA",
] as const satisfies readonly OperationalStatus[];
type SafeOperationalStatus = (typeof SAFE_OPERATIONAL_VALUES)[number];

function isSafeOperationalStatus(status: OperationalStatus): status is SafeOperationalStatus {
  return (SAFE_OPERATIONAL_VALUES as readonly OperationalStatus[]).includes(status);
}

/**
 * Estados da Fase 2 (docs/44 §6) — SEM CONSUMIDOR neste PR, exatamente como o
 * schema documenta. Tratados a parte para que nenhum ramo abaixo possa
 * classifica-los como seguros por acidente.
 */
const PHASE_2_VALUES = ["AGUARDANDO_CONFIRMACAO_HUMANA", "AGUARDANDO_CAPTCHA"] as const;
type Phase2InternalStatus = (typeof PHASE_2_VALUES)[number];

function isPhase2InternalStatus(status: InternalStatus): status is Phase2InternalStatus {
  return (PHASE_2_VALUES as readonly InternalStatus[]).includes(status);
}

// ---------------------------------------- operationalStatus fora da zona segura

/**
 * Os 6 estados sem equivalente canonico (docs/46 §7), como aparecem quando
 * `internalStatus` ainda esta num valor seguro mas `operationalStatus` ja
 * avancou por um dos writes legados (docs/46 §3.2-3.5). `Record` completo (as
 * 9 chaves de `OperationalStatus` menos as 3 seguras): se o enum ganhar um
 * valor, o typecheck acusa a lacuna aqui.
 */
const LEGACY_OPERATIONAL_DRIFT: Record<
  Exclude<OperationalStatus, SafeOperationalStatus>,
  { severity: DivergenceSeverity; reason: string }
> = {
  // Categoria A do docs/49: TEM candidato canonico e o fluxo natural ja migrou.
  // A porta MANUAL/admin ja RECUSA os dois hoje (DOCUMENTO_ENVIADO desde o
  // docs/50 §5/PR #86; DOCUMENTO_APROVADO desde o docs/50 §6/PR #88+seguinte)
  // — por isso a razao dos dois nomeia so DADO ANTIGO, inclusive o que a porta
  // escreveu antes de passar a recusar. Nenhum escritor vivo produz nenhuma
  // das duas combinacoes.
  DOCUMENTO_ENVIADO: {
    severity: "expected_legacy",
    reason:
      "so aparece com internalStatus fora de DOCUMENTO_RECEBIDO_PARA_ANALISE " +
      "em DADO ANTIGO: ANTERIOR a Fase 5e (docs/47 §6.1), quando " +
      "uploadProcessDocument escrevia isto sozinho, ou escrito pelo dropdown " +
      "de updateProcessOperations ANTES de a porta manual passar a recusar " +
      "este valor (docs/50 §3 — mover para ca deixava o processo aguardando " +
      "conferencia com o documento ainda revisado). Nenhum escritor vivo " +
      "produz a combinacao: o uploadProcessDocument novo passa por " +
      "transitionInternalStatus e produz o par seguro " +
      "DOCUMENTO_RECEBIDO_PARA_ANALISE/DOCUMENTO_ENVIADO (severity none).",
  },
  DOCUMENTO_APROVADO: {
    severity: "expected_legacy",
    reason:
      "so aparece com internalStatus fora de DOCUMENTO_VALIDADO em DADO " +
      "ANTIGO: ANTERIOR a Fase 5f (docs/47 §6.2), quando reviewProcessDocument " +
      "ainda nao passava por transitionInternalStatus, ou escrito pelo " +
      "dropdown de updateProcessOperations ANTES de a porta manual passar a " +
      "recusar este valor (docs/50 §6 — mover para ca aprovava o processo sem " +
      "revisor, data ou motivo registrados no documento). Nenhum escritor " +
      "vivo produz a combinacao: reviewProcessDocument (aprovacao) e " +
      "approveDocumentOutOfFlow passam por transitionInternalStatus e " +
      "produzem o par seguro DOCUMENTO_VALIDADO/DOCUMENTO_APROVADO " +
      "(severity none).",
  },
  // Categoria B do docs/49: estado da EQUIPE, nao da jornada do processo. Nao
  // ha candidato canonico, nem havera — a divergencia e permanente e decidida.
  EM_REVISAO_OPERACIONAL: {
    severity: "operational_only",
    reason:
      "conferencia interna da equipe: docs/49 decidiu que permanece SO " +
      "operationalStatus, sem InternalStatus 1:1. Nao ha o que decidir. " +
      "EM_REVISAO_HUMANA nao serve — e pausa de excecao da automacao, coisa " +
      "outra (docs/46 7). So chega via updateProcessOperations (docs/46 3.5).",
  },
  PRONTO_PARA_PROTOCOLO_MANUAL: {
    severity: "operational_only",
    reason:
      "fila de trabalho do operador, nao o processo: docs/49 decidiu que " +
      "permanece SO operationalStatus, sem InternalStatus 1:1. Nao confundir " +
      "com o ReadinessLevel homonimo de operationalSignals, que e DERIVADO de " +
      "criterios e nao e projecao deste campo (docs/49 §3.4). So chega via " +
      "updateProcessOperations (docs/46 3.5).",
  },
  BLOQUEADO: {
    // Passou de `needs_decision` para `expected_legacy` quando o SEGUNDO (e
    // ultimo) escritor de BLOQUEADO migrou: a rejeicao de
    // `reviewProcessDocument` primeiro, o dropdown de
    // `updateProcessOperations` depois. Sem escritor vivo produzindo a
    // combinacao, so DADO ANTIGO chega aqui — mesmo criterio que ja valia para
    // DOCUMENTO_ENVIADO/DOCUMENTO_APROVADO acima.
    severity: "expected_legacy",
    reason:
      "so aparece com internalStatus fora de BLOQUEADO_OPERACIONAL em dado " +
      "ANTERIOR as migracoes do docs/48: a rejeicao de reviewProcessDocument " +
      "(docs/46 3.4) e o dropdown de updateProcessOperations (docs/46 3.5) " +
      "escreviam BLOQUEADO sem tocar internalStatus. Fluxos novos passam por " +
      "transitionInternalStatus e produzem o par seguro " +
      "BLOQUEADO_OPERACIONAL/BLOQUEADO (severity none). Mapear dado antigo " +
      "para BLOQUEADO_INSTABILIDADE ou qualquer EXCECAO_* continua PROIBIDO " +
      "(docs/46 3.4/6): afirmaria causa apurada pela automacao onde houve " +
      "decisao humana.",
  },
  // Categoria C do docs/49: operacional por ora, mas com decisao FORMAL
  // pendente — diferente de B, que e permanente. Fica em `operational_only`
  // mesmo assim porque a pergunta aberta e de PRODUTO ("existe cancelamento
  // real de cliente?"), nao de diagnostico: enquanto nao existir, nao ha o que
  // decidir aqui, e `needs_decision` mandaria agir sobre algo ja resolvido.
  CANCELADO_DEV: {
    severity: "operational_only",
    reason:
      "cancelamento de ambiente de desenvolvimento: docs/49 decidiu que fica " +
      "FORA da projecao canonica por ora. PROIBIDO mapear para " +
      "CANCELADO_REEMBOLSADO, que afirma um reembolso que nao houve (docs/46 " +
      "7). DECISAO FORMAL PENDENTE: se um dia existir cancelamento real de " +
      "cliente, provavelmente exige estado canonico novo — nunca reuso deste " +
      "(docs/49 §3.5). So chega via updateProcessOperations (docs/46 3.5).",
  },
};

// ------------------------------------------- internalStatus fora da zona segura

/**
 * Os 12 valores de `InternalStatus` que nao sao seguros nem Fase 2 (docs/46
 * §6): nenhum fluxo real os escreve, mas o diagnostico cobre a combinacao
 * mesmo assim - conservador por definicao, nao por observacao.
 *
 * `operationalStatus` ausente = "sem equivalente documentado". Nao
 * inventamos candidato para o que docs/46 nao nomeou: e mais seguro dizer
 * "decisao necessaria" do que sugerir um mapeamento que ninguem analisou.
 *
 * Nenhum dos 12 tem candidato APROVADO pendente de migracao — os tres que
 * tinham (`DOCUMENTO_RECEBIDO_PARA_ANALISE`, Fase 5e; `DOCUMENTO_VALIDADO`,
 * Fase 5f; `BLOQUEADO_OPERACIONAL`, Fase 5f completa/docs/48) saíram desta
 * tabela quando os fluxos correspondentes migraram, e os pares viraram
 * seguros (`CANONICAL_OPERATIONAL_PROJECTION`, `operationalStatusProjection.ts`).
 * Os candidatos restantes
 * (`BLOQUEADO_INSTABILIDADE`/`EXCECAO_*` → `BLOQUEADO`,
 * `PROTOCOLADO_GRU_GERADA` → `PRONTO_PARA_PROTOCOLO_MANUAL`,
 * `CANCELADO_REEMBOLSADO` → `CANCELADO_DEV`) sao ARRISCADOS ou FALSOS, nao
 * aprovados — nao tem migracao proposta.
 */
const UNDOCUMENTED_REASON =
  "internalStatus avancou alem dos 3 valores com projecao segura (docs/46 6); " +
  "nenhuma correspondencia documentada em operationalStatus (9 valores) - " +
  "decisao da Fase 5d necessaria antes de qualquer leitura assumir equivalencia.";

const RISKY_BLOQUEADO_REASON =
  "docs/46 6: mapear para BLOQUEADO perderia a causa especifica e dispararia " +
  "BLOQUEIO_MANUAL em operationalSignals sem que humano tenha bloqueado.";

type AdvancedInternalStatus = Exclude<InternalStatus, SafeInternalStatus | Phase2InternalStatus>;

/**
 * Nomeado `candidateOperationalStatus`, nao `operationalStatus`: e um valor
 * CITADO em docs/46 §6, nunca gravado. Uma coluna `operationalStatus: "X"`
 * literal aqui pareceria write para a trava da Fase 5b
 * (`operationalStatusWrites.test.ts`), que reage a qualquer literal do enum
 * fora de sink conhecido - de proposito, para pegar bypass por objeto
 * intermediario. Este modulo e exatamente o tipo de tabela legitima que a
 * trava nao deveria confundir com um write; o nome do campo e o que evita a
 * colisao sem precisar mexer na 5b.
 */
const ADVANCED_INTERNAL_PROJECTION: Record<
  AdvancedInternalStatus,
  { candidateOperationalStatus?: OperationalStatus; severity: DivergenceSeverity; reason: string }
> = {
  AGUARDANDO_LOGIN_GOVBR: { severity: "needs_decision", reason: UNDOCUMENTED_REASON },
  SESSAO_GOVBR_EXPIRADA: { severity: "needs_decision", reason: UNDOCUMENTED_REASON },
  EM_PREENCHIMENTO_SINARM: { severity: "needs_decision", reason: UNDOCUMENTED_REASON },
  EM_REVISAO_HUMANA: { severity: "needs_decision", reason: UNDOCUMENTED_REASON },
  GRU_PAGA_EMPRESA: { severity: "needs_decision", reason: UNDOCUMENTED_REASON },
  BLOQUEADO_INSTABILIDADE: {
    candidateOperationalStatus: "BLOQUEADO",
    severity: "needs_decision",
    reason: RISKY_BLOQUEADO_REASON,
  },
  EXCECAO_DOC_INVALIDO: {
    candidateOperationalStatus: "BLOQUEADO",
    severity: "needs_decision",
    reason: RISKY_BLOQUEADO_REASON,
  },
  EXCECAO_ARMA_DIVERGENTE: {
    candidateOperationalStatus: "BLOQUEADO",
    severity: "needs_decision",
    reason: RISKY_BLOQUEADO_REASON,
  },
  EXCECAO_DESTINO_INCOMPLETO: {
    candidateOperationalStatus: "BLOQUEADO",
    severity: "needs_decision",
    reason: RISKY_BLOQUEADO_REASON,
  },
  PROTOCOLADO_GRU_GERADA: {
    candidateOperationalStatus: "PRONTO_PARA_PROTOCOLO_MANUAL",
    severity: "invalid_projection",
    reason: "docs/46 6: inverte o tempo - protocolado nao e 'pronto para protocolar'.",
  },
  CONCLUIDO: {
    severity: "invalid_projection",
    reason:
      "docs/46 6: sem equivalente. isClosed() (operationalSignals.ts) so " +
      "reconhece CANCELADO_DEV - nenhum OperationalStatus fecha o processo " +
      "do mesmo jeito que CONCLUIDO.",
  },
  CANCELADO_REEMBOLSADO: {
    candidateOperationalStatus: "CANCELADO_DEV",
    severity: "invalid_projection",
    reason:
      "docs/46 6: CANCELADO_DEV afirmaria cancelamento de ambiente de " +
      "desenvolvimento onde houve reembolso real - projecao falsa, nao so " +
      "arriscada.",
  },
};

// ------------------------------------------------------------------- diagnostico

const PHASE_2_REASON =
  "internalStatus e um estado da Fase 2 (docs/44 6) sem consumidor real: " +
  "nenhum fluxo escreve isto hoje, entao esta combinacao nao deveria existir " +
  "em producao. Nunca trate como valido nem use para decidir operationalStatus.";

/**
 * Compara `internalStatus` x `operationalStatus` e nomeia a divergencia, se
 * houver. Puro: mesma entrada, mesma saida, sem efeito colateral. Nao muta
 * `input`, nao le nem escreve banco.
 */
export function diagnoseStatusDivergence(input: StatusDivergenceInput): StatusDivergenceDiagnosis {
  const { internalStatus, operationalStatus } = input;

  if (isPhase2InternalStatus(internalStatus)) {
    return { hasDivergence: true, severity: "needs_decision", reason: PHASE_2_REASON };
  }

  if (isSafeInternalStatus(internalStatus)) {
    const expected = CANONICAL_OPERATIONAL_PROJECTION[internalStatus];

    if (operationalStatus === expected) {
      // Mesmo nome nos dois campos (os 3 originais, docs/46 6) ou nomes
      // diferentes por um par migrado (ex.: DOCUMENTO_RECEBIDO_PARA_ANALISE /
      // DOCUMENTO_ENVIADO, Fase 5e/docs/47) — os dois casos sao "none".
      const mesmoNome = internalStatus === expected;
      return {
        hasDivergence: false,
        severity: "none",
        reason: mesmoNome
          ? `internalStatus e operationalStatus concordam no valor seguro (docs/46 6): ${expected}.`
          : `internalStatus (${internalStatus}) e o par seguro de operationalStatus ` +
            `(${expected}) migrado pela porta canonica (docs/47).`,
        expectedOperationalStatus: expected,
      };
    }

    if (isSafeOperationalStatus(operationalStatus)) {
      return {
        hasDivergence: true,
        severity: "needs_decision",
        reason:
          `internalStatus (${internalStatus}) e operationalStatus (${operationalStatus}) ` +
          "estao cada um em um dos 3 valores com projecao segura (docs/46 6), mas " +
          "nao no mesmo - indica escrita fora da porta atomica transitionInternalStatus " +
          "(docs/44, Fase 3a) ou dado anterior a ela.",
        expectedOperationalStatus: expected,
      };
    }

    const drift = LEGACY_OPERATIONAL_DRIFT[operationalStatus];
    return {
      hasDivergence: true,
      severity: drift.severity,
      reason: drift.reason,
      expectedOperationalStatus: expected,
    };
  }

  const advanced = ADVANCED_INTERNAL_PROJECTION[internalStatus];
  return {
    hasDivergence: true,
    severity: advanced.severity,
    reason: advanced.reason,
    ...(advanced.candidateOperationalStatus
      ? { expectedOperationalStatus: advanced.candidateOperationalStatus }
      : {}),
  };
}
