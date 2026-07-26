/**
 * Fase 8D — Relatorio estruturado de execucao do LABORATORIO SINTETICO (docs/37).
 *
 * Recebe o que ja aconteceu (cenario, passos, artefatos, erros) e MONTA um
 * objeto de relatorio seguro. Nao executa nada: nao abre navegador, nao roda
 * Playwright, nao le/escreve arquivo, nao acessa rede, nao toca Prisma.
 *
 * Modulo PURO e DETERMINISTICO: nenhum `Date.now()`, `Math.random()` ou leitura
 * de ambiente — o mesmo input produz sempre o mesmo relatorio.
 *
 * Garantias inegociaveis (docs/27 §3, docs/30 §2):
 * - todo relatorio se declara LAB/SINTETICO;
 * - segredo nenhum atravessa (tudo passa por `labRedaction`);
 * - falha NUNCA produz protocolo;
 * - protocolo, quando existe, e o sintetico `PROT-FICT-*` — nunca um numero real;
 * - artefato so pode ser caminho local do proprio laboratorio.
 */
import {
  mergeRedactionSummary,
  redactLabErrorWithSummary,
  redactLabMeta,
  redactLabText,
  type LabRedactedError,
  type LabRedactionSummary,
  type LabSafeValue,
} from "../redaction";

/** Marcacao obrigatoria: nenhum consumidor pode confundir com execucao real. */
export const LAB_REPORT_KIND = "LAB_SINTETICO" as const;

export const LAB_REPORT_DISCLAIMER =
  "Relatório de LABORATÓRIO SINTÉTICO. Dados fictícios, execução local. " +
  "Nenhum processo real foi protocolado. Não acessa Gov.br nem SINARM.";

/** Unico prefixo de protocolo aceito — deixa explicito que e ficticio. */
export const LAB_SYNTHETIC_PROTOCOL_PREFIX = "PROT-FICT-";

/** Raiz permitida para artefatos (a mesma que o .gitignore ja cobre). */
export const LAB_ARTIFACTS_ROOT = "tests/e2e/artifacts";

export const LAB_ARTIFACT_REJECTED = "[ARTEFATO_FORA_DO_LAB]";

export const LAB_RUN_STATUSES = ["SUCESSO", "FALHA", "BLOQUEADO", "PAUSA_HUMANA"] as const;
export type LabRunStatus = (typeof LAB_RUN_STATUSES)[number];

export const LAB_STEP_STATUSES = ["OK", "FALHOU", "BLOQUEADO", "PULADO"] as const;
export type LabStepStatus = (typeof LAB_STEP_STATUSES)[number];

/**
 * UNICO status que admite protocolo, e ainda assim so o sintetico.
 *
 * A porta e ALLOW-LIST de proposito: qualquer outro valor — status novo que
 * venha a ser adicionado, ou chamador JavaScript sem tipos — cai no `null`. O
 * contrario (listar os status de falha) deixaria a porta aberta por omissao.
 */
const PROTOCOL_ALLOWED_STATUS = "SUCESSO" as const satisfies LabRunStatus;

// -------------------------------------------------------------------- input

export interface LabStepInput {
  name: string;
  status: LabStepStatus;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  meta?: Readonly<Record<string, unknown>>;
}

export interface LabNetworkPolicyInput {
  /** Hosts que a execucao podia tocar. Default: apenas loopback local. */
  allowedHosts?: readonly string[];
  /** Sempre `false` nesta fase; `true` e registrado como violacao. */
  externalAccessAllowed?: boolean;
  /** URLs observadas fora da politica (prova negativa do network guard). */
  offenders?: readonly string[];
}

export interface LabRunInput {
  scenario: string;
  status: LabRunStatus;
  startedAt: Date | string;
  finishedAt: Date | string;
  steps?: readonly LabStepInput[];
  artifacts?: readonly string[];
  networkPolicy?: LabNetworkPolicyInput;
  warnings?: readonly string[];
  errors?: readonly unknown[];
  /** Protocolo SINTETICO do lab; ignorado se o run nao teve sucesso. */
  syntheticProtocol?: string | null;
}

// ------------------------------------------------------------------- output

export interface LabReportStep {
  index: number;
  name: string;
  status: LabStepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  meta: Record<string, LabSafeValue>;
}

export interface LabReportNetworkPolicy {
  allowedHosts: string[];
  externalAccessAllowed: false;
  offenders: string[];
}

export interface LabRunReport {
  kind: typeof LAB_REPORT_KIND;
  synthetic: true;
  disclaimer: string;
  scenario: string;
  status: LabRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
  steps: LabReportStep[];
  artifacts: string[];
  syntheticProtocol: string | null;
  networkPolicy: LabReportNetworkPolicy;
  redactionSummary: LabRedactionSummary;
  warnings: string[];
  errors: LabRedactedError[];
}

/** Politica de rede padrao do laboratorio: so loopback, nada externo. */
export const LAB_DEFAULT_ALLOWED_HOSTS: readonly string[] = ["localhost", "127.0.0.1"];

// ------------------------------------------------------------------ helpers

/** `Date`/ISO -> ISO string. Invalido -> `null` (nunca a hora atual). */
function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function durationBetween(startedAt: string | null, finishedAt: string | null): number | null {
  if (startedAt === null || finishedAt === null) return null;
  return Date.parse(finishedAt) - Date.parse(startedAt);
}

/**
 * Aceita apenas caminho relativo dentro de `tests/e2e/artifacts`. Barra
 * absolutos, unidade do Windows, `..` e URLs — e sinaliza no relatorio.
 */
function normalizeArtifact(raw: string): string | null {
  const path = raw.trim().replace(/\\/g, "/");
  if (path === "") return null;
  if (path.startsWith("/") || /^[a-zA-Z]:[/]/.test(path)) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return null; // esquema de URL
  if (path.split("/").includes("..")) return null;
  if (!path.startsWith(`${LAB_ARTIFACTS_ROOT}/`)) return null;
  // O nome ainda passa pela mascara — pode carregar CPF/e-mail —, mas so pelos
  // identificadores fortes: mascarar o timestamp do arquivo tornaria o caminho
  // inutil, e a contencao no diretorio do lab ja limita o risco.
  return redactLabText(path, "identifiers").text;
}

// -------------------------------------------------------------------- build

/**
 * Monta o relatorio seguro de UMA execucao do laboratorio sintetico.
 *
 * Funcao pura: nao escreve arquivo. Quem quiser persistir serializa o retorno —
 * e so dentro de `tests/e2e/artifacts` (gitignored).
 */
export function buildLabRunReport(input: LabRunInput): LabRunReport {
  const warnings: string[] = [];
  const summaries: LabRedactionSummary[] = [];

  const scenarioRedaction = redactLabText(input.scenario);
  summaries.push({ redactedKeys: 0, maskedValues: scenarioRedaction.masked, total: 0 });

  const startedAt = toIsoOrNull(input.startedAt);
  const finishedAt = toIsoOrNull(input.finishedAt);
  if (startedAt === null) warnings.push("startedAt ausente ou inválido.");
  if (finishedAt === null) warnings.push("finishedAt ausente ou inválido.");

  const rawDuration = durationBetween(startedAt, finishedAt);
  let durationMs = 0;
  if (rawDuration !== null) {
    if (rawDuration < 0) {
      warnings.push("finishedAt anterior a startedAt; duração normalizada para 0.");
    } else {
      durationMs = rawDuration;
    }
  }

  // ---- passos
  const steps: LabReportStep[] = (input.steps ?? []).map((step, index) => {
    const nameRedaction = redactLabText(step.name);
    const metaRedaction = redactLabMeta(step.meta ?? {});
    summaries.push({ redactedKeys: 0, maskedValues: nameRedaction.masked, total: 0 });
    summaries.push(metaRedaction.summary);

    const stepStartedAt = toIsoOrNull(step.startedAt);
    const stepFinishedAt = toIsoOrNull(step.finishedAt);
    const stepDuration = durationBetween(stepStartedAt, stepFinishedAt);

    return {
      index,
      name: nameRedaction.text,
      status: step.status,
      startedAt: stepStartedAt,
      finishedAt: stepFinishedAt,
      durationMs: stepDuration === null || stepDuration < 0 ? null : stepDuration,
      meta: metaRedaction.value,
    };
  });

  // ---- artefatos
  const artifacts: string[] = [];
  for (const raw of input.artifacts ?? []) {
    const normalized = normalizeArtifact(raw);
    if (normalized === null) {
      artifacts.push(LAB_ARTIFACT_REJECTED);
      warnings.push(`Artefato fora de ${LAB_ARTIFACTS_ROOT} descartado.`);
      continue;
    }
    artifacts.push(normalized);
  }

  // ---- politica de rede
  const offenders = (input.networkPolicy?.offenders ?? []).map((url) => {
    // Query string pode carregar token: fica so o que identifica o destino.
    const withoutQuery = url.split(/[?#]/)[0] ?? "";
    return redactLabText(withoutQuery).text;
  });
  if (input.networkPolicy?.externalAccessAllowed === true) {
    warnings.push("externalAccessAllowed=true recusado: o laboratório é sempre local.");
  }
  if (offenders.length > 0) {
    warnings.push(`${offenders.length} requisição(ões) fora da política de rede.`);
  }
  const networkPolicy: LabReportNetworkPolicy = {
    allowedHosts: [...(input.networkPolicy?.allowedHosts ?? LAB_DEFAULT_ALLOWED_HOSTS)],
    externalAccessAllowed: false,
    offenders,
  };

  // ---- erros (a redacao deles TAMBEM conta para o resumo)
  const errors = (input.errors ?? []).map((error) => {
    const { value, summary } = redactLabErrorWithSummary(error);
    summaries.push(summary);
    return value;
  });

  // ---- protocolo: so no sucesso, so o sintetico
  let syntheticProtocol: string | null = null;
  const requestedProtocol = input.syntheticProtocol ?? null;
  if (requestedProtocol !== null && requestedProtocol !== "") {
    if (input.status !== PROTOCOL_ALLOWED_STATUS) {
      warnings.push("Protocolo descartado: execução sem sucesso não gera protocolo.");
    } else if (!requestedProtocol.startsWith(LAB_SYNTHETIC_PROTOCOL_PREFIX)) {
      warnings.push(
        `Protocolo descartado: fora do padrão sintético ${LAB_SYNTHETIC_PROTOCOL_PREFIX}*.`,
      );
    } else {
      syntheticProtocol = requestedProtocol;
    }
  }

  const inputWarnings = (input.warnings ?? []).map((warning) => {
    const redaction = redactLabText(warning);
    summaries.push({ redactedKeys: 0, maskedValues: redaction.masked, total: 0 });
    return redaction.text;
  });

  return {
    kind: LAB_REPORT_KIND,
    synthetic: true,
    disclaimer: LAB_REPORT_DISCLAIMER,
    scenario: scenarioRedaction.text,
    status: input.status,
    startedAt,
    finishedAt,
    durationMs,
    steps,
    artifacts,
    syntheticProtocol,
    networkPolicy,
    redactionSummary: mergeRedactionSummary(...summaries),
    warnings: [...inputWarnings, ...warnings],
    errors,
  };
}
