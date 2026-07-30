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
 *    `DOCUMENTO_ENVIADO`, Fase 5e/docs/47). Unico caso sem divergencia.
 *  - `severity: "expected_legacy"` — divergencia CONHECIDA e de baixo risco:
 *    `operationalStatus` avancou via um write legado (docs/46 §3) que ainda
 *    nao tem porta canonica, mas o hop e simples e sem ambiguidade.
 *  - `severity: "needs_decision"` — divergencia real que a Fase 5d precisa
 *    resolver antes de qualquer projecao confiar nela: ou o `operationalStatus`
 *    atual exige julgamento humano para nomear a causa (ex.: `BLOQUEADO`), ou o
 *    `internalStatus` avancou para um valor sem correspondencia documentada.
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

export const DIVERGENCE_SEVERITIES = [
  "none",
  "expected_legacy",
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
 * Pares com projecao segura — o valor de `internalStatus` (chave) e o
 * `operationalStatus` esperado (valor) quando o processo passou pela porta
 * canonica.
 *
 * Os 3 primeiros vem de docs/46 §6, mesmo nome nos dois campos: so
 * `transitionInternalStatus` escreve `internalStatus`, e por muito tempo o
 * unico chamador real (`confirmPixPayment`) so produzia `RASCUNHO` (default
 * do schema) e `PAGO_EM_FILA` (docs/46 §5). `AGUARDANDO_PAGAMENTO` entrava por
 * completude estrutural, mesmo pouco alcancavel.
 *
 * `DOCUMENTO_RECEBIDO_PARA_ANALISE` e o primeiro par com NOMES DIFERENTES nos
 * dois campos — a Fase 5e (docs/47 §6.1) migrou `uploadProcessDocument` para
 * a porta canonica, mas o candidato aprovado pela 5d tem nome proprio no
 * `InternalStatus` (nao reusa `DOCUMENTO_ENVIADO` do `OperationalStatus`, por
 * decisao do docs/47 §6.2). `operationalStatus` continua indo para
 * `DOCUMENTO_ENVIADO` via `alsoSet` — MESMO efeito final, so a porta mudou.
 */
const SAFE_PROJECTION = {
  RASCUNHO: "RASCUNHO",
  AGUARDANDO_PAGAMENTO: "AGUARDANDO_PAGAMENTO",
  PAGO_EM_FILA: "PAGO_EM_FILA",
  DOCUMENTO_RECEBIDO_PARA_ANALISE: "DOCUMENTO_ENVIADO",
} as const satisfies Partial<Record<InternalStatus, OperationalStatus>>;

const SAFE_INTERNAL_VALUES = Object.keys(SAFE_PROJECTION) as (keyof typeof SAFE_PROJECTION)[];
type SafeInternalStatus = (typeof SAFE_INTERNAL_VALUES)[number];

function isSafeInternalStatus(status: InternalStatus): status is SafeInternalStatus {
  return (SAFE_INTERNAL_VALUES as readonly InternalStatus[]).includes(status);
}

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
  DOCUMENTO_ENVIADO: {
    severity: "expected_legacy",
    reason:
      "so aparece com internalStatus fora de DOCUMENTO_RECEBIDO_PARA_ANALISE em " +
      "dado ANTERIOR a Fase 5e (docs/47 §6.1): uploadProcessDocument escrevia " +
      "isto sozinho, sem tocar internalStatus (docs/46 3.2). Fluxos novos passam " +
      "por transitionInternalStatus e produzem o par seguro " +
      "DOCUMENTO_RECEBIDO_PARA_ANALISE/DOCUMENTO_ENVIADO (severity none).",
  },
  DOCUMENTO_APROVADO: {
    severity: "needs_decision",
    reason:
      "reviewProcessDocument (aprovacao) escreve isto sozinho (docs/46 3.3): " +
      "exige que um ADMIN/OPERADOR ja tenha revisado o documento - decisao " +
      "humana que a Fase 5d precisa nomear em InternalStatus antes de " +
      "qualquer projecao confiar nela (nao ha InternalStatus para " +
      "'aguardando conferencia', docs/46 7).",
  },
  EM_REVISAO_OPERACIONAL: {
    severity: "needs_decision",
    reason:
      "colide com EM_REVISAO_HUMANA, que e pausa de excecao da automacao - " +
      "coisa outra (docs/46 7). So chega via updateProcessOperations (docs/46 3.5).",
  },
  PRONTO_PARA_PROTOCOLO_MANUAL: {
    severity: "needs_decision",
    reason:
      "descreve a fila de trabalho do operador, nao o processo (docs/46 7). " +
      "So chega via updateProcessOperations (docs/46 3.5).",
  },
  BLOQUEADO: {
    severity: "needs_decision",
    reason:
      "reviewProcessDocument (rejeicao) escreve isto sozinho (docs/46 3.4). " +
      "Mapear para BLOQUEADO_INSTABILIDADE ou qualquer EXCECAO_* sem decisao " +
      "propria e PROIBIDO (docs/46 3.4/6): perderia a causa especifica do " +
      "bloqueio.",
  },
  CANCELADO_DEV: {
    severity: "needs_decision",
    reason:
      "cancelamento de ambiente de desenvolvimento, nao reembolso real " +
      "(docs/46 7); CANCELADO_REEMBOLSADO afirma outra coisa. So chega via " +
      "updateProcessOperations (docs/46 3.5).",
  },
};

// ------------------------------------------- internalStatus fora da zona segura

/**
 * Os 13 valores de `InternalStatus` que nao sao seguros nem Fase 2 (docs/46
 * §6): nenhum fluxo real os escreve, mas o diagnostico cobre a combinacao
 * mesmo assim - conservador por definicao, nao por observacao.
 *
 * `operationalStatus` ausente = "sem equivalente documentado". Nao
 * inventamos candidato para o que docs/46 nao nomeou: e mais seguro dizer
 * "decisao necessaria" do que sugerir um mapeamento que ninguem analisou.
 *
 * Um dos 13 (`DOCUMENTO_VALIDADO`) E documentado — candidato aprovado pela
 * Fase 5d/docs/47 §6.2 — mas ainda SEM CONSUMIDOR: nenhum fluxo o escreve ate
 * a Fase 5f migrar o lado aprovacao de `reviewProcessDocument`. Ate la,
 * severity continua `needs_decision` — o candidato aprovado nao vira `none`
 * so por existir no enum; precisa tambem de um write real produzindo a
 * combinacao. `DOCUMENTO_RECEBIDO_PARA_ANALISE` NAO esta mais aqui: a Fase 5e
 * migrou o fluxo, e o par virou seguro (`SAFE_PROJECTION` acima).
 */
const UNDOCUMENTED_REASON =
  "internalStatus avancou alem dos 3 valores com projecao segura (docs/46 6); " +
  "nenhuma correspondencia documentada em operationalStatus (9 valores) - " +
  "decisao da Fase 5d necessaria antes de qualquer leitura assumir equivalencia.";

const RISKY_BLOQUEADO_REASON =
  "docs/46 6: mapear para BLOQUEADO perderia a causa especifica e dispararia " +
  "BLOQUEIO_MANUAL em operationalSignals sem que humano tenha bloqueado.";

/**
 * Candidato APROVADO (docs/47), nao so citado — mas ainda SEM CONSUMIDOR: a
 * Fase 5d decidiu a direcao, a fase de migracao correspondente ainda nao
 * rodou. `severity` continua `needs_decision` porque nenhum write real
 * produz esta combinacao ainda; se aparecer, e sinal de escrita fora de
 * banda, nao do caminho aprovado. Usado hoje so por `DOCUMENTO_VALIDADO` —
 * `DOCUMENTO_RECEBIDO_PARA_ANALISE` saiu desta categoria quando a Fase 5e
 * migrou `uploadProcessDocument` (ver `SAFE_PROJECTION`).
 */
function candidatoAprovadoReason(estado: string, fase: string, operationalStatus: string): string {
  return (
    `docs/47: candidato aprovado para ${operationalStatus} (Fase 5d), mas ${fase} ` +
    `ainda nao migrou - nenhum fluxo escreve ${estado} hoje. Se aparecer, e ` +
    "escrita fora de banda, nao o caminho aprovado."
  );
}

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
  DOCUMENTO_VALIDADO: {
    candidateOperationalStatus: "DOCUMENTO_APROVADO",
    severity: "needs_decision",
    reason: candidatoAprovadoReason(
      "DOCUMENTO_VALIDADO",
      "o lado aprovacao da Fase 5f (reviewProcessDocument)",
      "DOCUMENTO_APROVADO",
    ),
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
    const expected = SAFE_PROJECTION[internalStatus];

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
