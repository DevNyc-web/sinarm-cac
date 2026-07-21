/**
 * Fase 9 — Validacoes/bloqueios de seguranca (docs/34 §2, docs/35 §11).
 *
 * Regra de ouro: retornar SEMPRE uma decisao segura (`Phase9SafetyDecision`),
 * NUNCA uma exception crua. O runner decide o que fazer com a decisao.
 *
 * Invariantes obrigatorias nesta fase:
 * - stopPoint === "DADOS_DA_GRU"
 * - dryRun === true
 * - allowRealExternalAccess === false
 * - realMode: sempre bloqueado
 * - dados reais conhecidos (Gov/SINARM/PF): bloqueados
 */
import { assertUrlAllowed, createPhase9NetworkPolicy } from "./networkGuard";
import type {
  Phase9ExecutionRequest,
  Phase9NetworkPolicy,
  Phase9SafetyCode,
  Phase9SafetyDecision,
} from "./types";

/** Ponto de parada obrigatorio (docs/34 §2). */
export const REQUIRED_STOP_POINT = "DADOS_DA_GRU" as const;

/**
 * Feature flag / bloqueio explicito da execucao real.
 *
 * HARD-CODED `false`: a execucao real da Fase 9 NAO e habilitada por padrao e nao e
 * ligada por env. Ligar exige o bloco `docs/34 §16` assinado + alteracao deliberada
 * de codigo sob revisao. NAO mudar sem autorizacao registrada.
 */
export const PHASE9_REAL_EXECUTION_ENABLED = false as const;

/** Mensagem canonica quando a execucao real e barrada por falta de autorizacao. */
export const PHASE9_NOT_AUTHORIZED_MESSAGE =
  "Execução real da Fase 9 ainda não autorizada. docs/34 §16 pendente.";

/** `true` somente se a execucao real estiver explicitamente habilitada (hoje: nunca). */
export function isPhase9RealExecutionEnabled(): boolean {
  // Cast para boolean: a flag e um literal `false`, mas a checagem e intencional
  // (ponto unico de leitura da flag, para nao espalhar o literal pelo codigo).
  return (PHASE9_REAL_EXECUTION_ENABLED as boolean) === true;
}

function ok(): Phase9SafetyDecision {
  return { allowed: true, code: "OK", reason: "Safety checks aprovados (modo bloqueado/seguro)." };
}

function block(code: Phase9SafetyCode, reason: string): Phase9SafetyDecision {
  return { allowed: false, code, reason };
}

/**
 * Marcadores de dado real conhecido que NUNCA podem entrar num pedido de Fase 9.
 * Enquanto a execucao real nao for autorizada, mencionar esses sistemas em campos
 * do request e tratado como bloqueio (evita apontar acidentalmente para o real).
 */
const FORBIDDEN_REAL_MARKERS = /gov\.br|servicos\.pf|sinarm|acesso\.gov/i;

function requestMentionsRealSystem(request: Phase9ExecutionRequest): boolean {
  const haystack = [
    request.executionId,
    request.processId,
    request.requestedByUserId,
    request.authorizedAccountLabel,
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  return FORBIDDEN_REAL_MARKERS.test(haystack);
}

/**
 * Avalia o pedido de execucao. Ordem dos bloqueios e deterministica para que o
 * runner e os testes possam depender do `code`/`reason` retornado.
 */
export function evaluateSafety(request: Phase9ExecutionRequest): Phase9SafetyDecision {
  if (request.stopPoint !== REQUIRED_STOP_POINT) {
    return block(
      "STOP_POINT_INVALID",
      `Ponto de parada deve ser "${REQUIRED_STOP_POINT}" (docs/34 §2).`,
    );
  }
  if (request.dryRun !== true) {
    return block("DRY_RUN_REQUIRED", "dryRun deve ser true nesta fase (sem execucao real).");
  }
  if (request.allowRealExternalAccess !== false) {
    return block(
      "REAL_ACCESS_BLOCKED",
      "allowRealExternalAccess deve ser false (sem acesso externo real).",
    );
  }
  if (requestMentionsRealSystem(request)) {
    return block(
      "REAL_DATA_BLOCKED",
      "Pedido referencia sistema oficial real (Gov.br/SINARM/PF) — bloqueado.",
    );
  }
  return ok();
}

/**
 * Bloqueio explicito de qualquer tentativa de "modo real". Sempre bloqueia enquanto
 * `PHASE9_REAL_EXECUTION_ENABLED` for false.
 */
export function assertNotRealMode(): Phase9SafetyDecision {
  if (isPhase9RealExecutionEnabled()) {
    // Defesa em profundidade: mesmo se a flag mudar, este ponto exige revisao.
    return ok();
  }
  return block("REAL_MODE_BLOCKED", PHASE9_NOT_AUTHORIZED_MESSAGE);
}

/**
 * Bloqueio de ato irreversivel (gerar GRU / protocolo real). SEMPRE bloqueado nesta
 * fase — a Fase 9 para em "Dados da GRU" e nunca clica "Gerar GRU e Salvar".
 */
export function assertNoRealGru(action: string): Phase9SafetyDecision {
  return block(
    "REAL_GRU_BLOCKED",
    `Acao "${action}" bloqueada: gerar GRU/protocolo real e proibido na Fase 9 (docs/34 §2).`,
  );
}

/** Reuso do guard de rede como decisao de seguranca (URL nao permitida = bloqueio). */
export function assertUrlSafe(
  url: string,
  policy: Phase9NetworkPolicy = createPhase9NetworkPolicy(),
): Phase9SafetyDecision {
  const check = assertUrlAllowed(url, policy);
  if (check.allowed) return ok();
  return block("URL_NOT_ALLOWED", check.reason);
}
