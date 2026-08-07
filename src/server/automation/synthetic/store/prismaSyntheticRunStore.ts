/**
 * Adaptador PRISMA/POSTGRES do contrato `SyntheticRunStore` — persistência
 * REAL, só para o motor sintético (registro seguro, versão, claim,
 * idempotência, recuperação). Implementa EXATAMENTE a mesma interface do
 * adaptador em memória (`inMemorySyntheticRunStore.ts`) — nenhuma mudança de
 * contrato para acomodar o banco.
 *
 * NUNCA persiste sessão viva nem `sessionHandle`: só `sessionState`
 * (`SyntheticHandoffState`) e `auditCorrelationId` — a mesma projeção segura
 * `StoredSyntheticRun` do adaptador em memória. Não roda Playwright.
 *
 * Concorrência real via Postgres, não simulada em memória:
 * - `create`: `idempotency_key` e `run_id` são UNIQUE no banco — o Postgres
 *   arbitra, a aplicação só interpreta o `P2002`.
 * - `save`: um único `updateMany` condicional em `(run_id, version,
 *   run_state NOT IN terminal)` — "zero linhas afetadas" É o conflito, sem
 *   leitura-decide-escreve.
 * - `claimNext`/`renewClaim`/`releaseClaim`/`completeClaim`: claim é tabela
 *   PRÓPRIA, 1:1 (`run_id` UNIQUE) — só uma linha de claim por run existe,
 *   garantido pelo próprio banco.
 *
 * JSON (`plan`/`pendingSteps`/`completedSteps`/`events`/`evidence`/`result`)
 * só entra já validado por `validateStoredSyntheticRun` (reusado, não
 * duplicado) e é REVALIDADO na leitura — nunca um objeto de banco em quem
 * confia cegamente.
 */
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import {
  SYNTHETIC_RUN_STATES,
  isSyntheticRunTerminalState,
  type SyntheticAutomationRun,
} from "../syntheticRunCoordinator";
import { isSyntheticHandoffState, type SyntheticHandoffState } from "../sessionContract";
import { SYNTHETIC_FAILURE_KINDS } from "../sessionLifecycle";
import {
  toStoredSyntheticRun,
  validateStoredSyntheticRun,
  type ClaimNextInput,
  type ClaimResult,
  type CreateStoredRunInput,
  type CreateStoredRunResult,
  type ListRecoverableInput,
  type ReleaseClaimInput,
  type ReleaseClaimResult,
  type RenewClaimInput,
  type SaveStoredRunInput,
  type SaveStoredRunResult,
  type StoredSyntheticRun,
  type SyntheticRunClaim,
  type SyntheticRunInterruptionReason,
  type SyntheticRunStore,
  type SyntheticRunStoreViolation,
} from "./syntheticRunStore";

/** Lançado quando uma linha lida do banco não passa na revalidação — nunca deveria acontecer se só este adaptador escreve. */
export class InvalidStoredSyntheticRunError extends Error {
  constructor(runId: string, violations: readonly SyntheticRunStoreViolation[]) {
    super(`registro sintético ${runId} inválido após leitura: ${violations.map((v) => v.code).join(", ")}`);
    this.name = "InvalidStoredSyntheticRunError";
  }
}

const RUN_STATE_SET: ReadonlySet<string> = new Set(SYNTHETIC_RUN_STATES);
const INTERRUPTION_REASON_SET: ReadonlySet<string> = new Set<SyntheticRunInterruptionReason>([
  ...SYNTHETIC_FAILURE_KINDS,
  "CAPTCHA",
]);

// -------------------------------------------------------------- fingerprint

/**
 * Fingerprint ESTÁVEL e seguro do payload de criação — sha256 sobre
 * `runId + planId + planVersion + auditCorrelationId`. Nunca o plano
 * inteiro nem a sessão: só o suficiente para decidir "mesmo payload" sem
 * duplicar dado já gravado noutra coluna.
 */
function computePayloadFingerprint(run: SyntheticAutomationRun): string {
  const canonical = JSON.stringify({
    runId: run.runId,
    planId: run.plan.planId,
    planVersion: run.plan.version,
    correlationId: run.session.auditCorrelationId,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// -------------------------------------------------------------------- linha

type RunRow = {
  runId: string;
  idempotencyKey: string;
  /** Só usado para a comparação de replay idempotente em `create` — não faz parte de `StoredSyntheticRun`. */
  payloadFingerprint?: string;
  version: number;
  runState: string;
  sessionState: string;
  auditCorrelationId: string;
  plan: Prisma.JsonValue;
  pendingSteps: Prisma.JsonValue;
  completedSteps: Prisma.JsonValue;
  events: Prisma.JsonValue;
  evidence: Prisma.JsonValue;
  humanFallbackRequired: boolean;
  result: Prisma.JsonValue | null;
  attempts: number;
  lastStepIdempotencyKey: string | null;
  lastInterruptionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  claim: {
    claimId: string;
    workerId: string;
    claimedAt: Date;
    expiresAt: Date;
    runVersionAtClaim: number;
  } | null;
};

/** Campos selecionados em toda leitura — fechado, sem `SELECT *` implícito. */
const RUN_SELECT = {
  runId: true,
  idempotencyKey: true,
  payloadFingerprint: true,
  version: true,
  runState: true,
  sessionState: true,
  auditCorrelationId: true,
  plan: true,
  pendingSteps: true,
  completedSteps: true,
  events: true,
  evidence: true,
  humanFallbackRequired: true,
  result: true,
  attempts: true,
  lastStepIdempotencyKey: true,
  lastInterruptionReason: true,
  createdAt: true,
  updatedAt: true,
  claim: {
    select: {
      claimId: true,
      workerId: true,
      claimedAt: true,
      expiresAt: true,
      runVersionAtClaim: true,
    },
  },
} as const;

function assertRunState(value: string, runId: string): void {
  if (!RUN_STATE_SET.has(value)) {
    throw new InvalidStoredSyntheticRunError(runId, [
      { code: "INVALID_TYPE", field: "runState", detail: `estado fora do vocabulário do domínio: ${value}` },
    ]);
  }
}

function assertSessionState(value: string, runId: string): asserts value is SyntheticHandoffState {
  if (!isSyntheticHandoffState(value)) {
    throw new InvalidStoredSyntheticRunError(runId, [
      { code: "INVALID_TYPE", field: "sessionState", detail: `estado fora do vocabulário do domínio: ${value}` },
    ]);
  }
}

function assertInterruptionReason(value: string | null, runId: string): void {
  if (value !== null && !INTERRUPTION_REASON_SET.has(value)) {
    throw new InvalidStoredSyntheticRunError(runId, [
      { code: "INVALID_TYPE", field: "lastInterruptionReason", detail: `motivo fora do vocabulário do domínio: ${value}` },
    ]);
  }
}

/**
 * Linha do banco -> `StoredSyntheticRun`. NÃO confia cegamente no JSON: cada
 * coluna fechada é conferida contra o vocabulário do domínio, e o registro
 * inteiro passa de novo por `validateStoredSyntheticRun` — a MESMA validação
 * que roda antes de gravar, reusada sem cópia.
 */
function fromRow(row: RunRow): StoredSyntheticRun {
  assertRunState(row.runState, row.runId);
  assertSessionState(row.sessionState, row.runId);
  assertInterruptionReason(row.lastInterruptionReason, row.runId);

  const claim: SyntheticRunClaim | null =
    row.claim === null
      ? null
      : {
          claimId: row.claim.claimId,
          runId: row.runId,
          workerId: row.claim.workerId,
          claimedAt: row.claim.claimedAt.toISOString(),
          expiresAt: row.claim.expiresAt.toISOString(),
          runVersionAtClaim: row.claim.runVersionAtClaim,
        };

  const candidate: StoredSyntheticRun = {
    runId: row.runId,
    version: row.version,
    runState: row.runState as StoredSyntheticRun["runState"],
    sessionState: row.sessionState as SyntheticHandoffState,
    plan: row.plan as unknown as StoredSyntheticRun["plan"],
    pendingSteps: row.pendingSteps as unknown as StoredSyntheticRun["pendingSteps"],
    completedSteps: row.completedSteps as unknown as StoredSyntheticRun["completedSteps"],
    events: row.events as unknown as StoredSyntheticRun["events"],
    evidence: row.evidence as unknown as StoredSyntheticRun["evidence"],
    humanFallbackRequired: row.humanFallbackRequired,
    result: row.result as unknown as StoredSyntheticRun["result"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    auditCorrelationId: row.auditCorrelationId,
    claim,
    attempts: row.attempts,
    idempotencyKey: row.idempotencyKey,
    lastStepIdempotencyKey: row.lastStepIdempotencyKey,
    lastInterruptionReason: row.lastInterruptionReason as SyntheticRunInterruptionReason | null,
  };

  const validation = validateStoredSyntheticRun(candidate);
  if (!validation.ok) throw new InvalidStoredSyntheticRunError(row.runId, validation.violations);

  return candidate;
}

/** `StoredSyntheticRun` projetado -> colunas do `SyntheticRun` (sem `claim`, que é tabela própria). */
function toRunColumns(stored: StoredSyntheticRun) {
  return {
    version: stored.version,
    runState: stored.runState,
    sessionState: stored.sessionState,
    auditCorrelationId: stored.auditCorrelationId,
    plan: stored.plan as unknown as Prisma.InputJsonValue,
    pendingSteps: stored.pendingSteps as unknown as Prisma.InputJsonValue,
    completedSteps: stored.completedSteps as unknown as Prisma.InputJsonValue,
    events: stored.events as unknown as Prisma.InputJsonValue,
    evidence: stored.evidence as unknown as Prisma.InputJsonValue,
    humanFallbackRequired: stored.humanFallbackRequired,
    result: (stored.result as unknown as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
    attempts: stored.attempts,
    lastStepIdempotencyKey: stored.lastStepIdempotencyKey,
    lastInterruptionReason: stored.lastInterruptionReason,
  };
}

function violation(code: SyntheticRunStoreViolation["code"], field: string | null, detail: string): SyntheticRunStoreViolation {
  return { code, field, detail };
}

function isUniqueConstraintError(error: unknown, target: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const meta = error.meta as { target?: string | string[] } | undefined;
  const fields = Array.isArray(meta?.target) ? meta.target : typeof meta?.target === "string" ? [meta.target] : [];
  return fields.some((f) => f.includes(target));
}

// -------------------------------------------------------------- adaptador

export class PrismaSyntheticRunStore implements SyntheticRunStore {
  constructor(private readonly prisma: PrismaClient = getPrisma()) {}

  async create(input: CreateStoredRunInput): Promise<CreateStoredRunResult> {
    const { run, idempotencyKey, at } = input;

    if (idempotencyKey.trim() === "") {
      return { ok: false, run: null, violations: [violation("EMPTY_VALUE", "idempotencyKey", "chave de idempotência vazia")] };
    }

    const fingerprint = computePayloadFingerprint(run);
    const stored = toStoredSyntheticRun(run, {
      version: 1,
      idempotencyKey,
      lastStepIdempotencyKey: null,
      createdAt: at,
      updatedAt: at,
      attempts: 0,
      claim: null,
    });

    const preValidation = validateStoredSyntheticRun(stored);
    if (!preValidation.ok) return { ok: false, run: null, violations: preValidation.violations };

    try {
      const row = await this.prisma.syntheticRun.create({
        data: { runId: run.runId, idempotencyKey, payloadFingerprint: fingerprint, ...toRunColumns(stored) },
        select: RUN_SELECT,
      });
      return { ok: true, created: true, run: fromRow(row as RunRow), violations: [] };
    } catch (error) {
      if (!isUniqueConstraintError(error, "idempotency_key") && !isUniqueConstraintError(error, "run_id")) throw error;

      // Repetir EXATAMENTE o mesmo run com a mesma chave viola as DUAS
      // unicidades ao mesmo tempo (run_id e idempotency_key) — qual delas o
      // Postgres reporta primeiro não é garantido. Por isso a idempotência
      // SEMPRE é resolvida pela chave, não pelo alvo do erro: se a chave já
      // existe, é replay (compatível) ou conflito (incompatível); só quando a
      // chave é NOVA é que o conflito só pode ser o `runId`.
      const existing = await this.prisma.syntheticRun.findUnique({ where: { idempotencyKey }, select: RUN_SELECT });
      if (existing !== null) {
        if (existing.payloadFingerprint === fingerprint) {
          return { ok: true, created: false, run: fromRow(existing as RunRow), violations: [] };
        }
        return {
          ok: false,
          run: null,
          violations: [violation("IDEMPOTENCY_CONFLICT", "idempotencyKey", "mesma chave, run ou plano incompatível")],
        };
      }
      return {
        ok: false,
        run: null,
        violations: [violation("RUN_ALREADY_EXISTS", "runId", `run ${run.runId} já existe com outra chave`)],
      };
    }
  }

  async getById(runId: string): Promise<StoredSyntheticRun | null> {
    const row = await this.prisma.syntheticRun.findUnique({ where: { runId }, select: RUN_SELECT });
    return row === null ? null : fromRow(row as RunRow);
  }

  async save(input: SaveStoredRunInput): Promise<SaveStoredRunResult> {
    const { runId, expectedVersion, run, at } = input;

    const current = await this.prisma.syntheticRun.findUnique({ where: { runId }, select: RUN_SELECT });
    if (current === null) {
      return { ok: false, run: null, violations: [violation("RUN_NOT_FOUND", "runId", `run ${runId} não encontrado`)] };
    }

    // Idempotência de ETAPA: mesma chave do último save de etapa bem-sucedido
    // -> devolve o registro atual, sem reaplicar. Esta leitura NÃO decide o
    // conflito de versão — só o `updateMany` condicional abaixo decide isso.
    if (input.idempotencyKey !== undefined && current.lastStepIdempotencyKey === input.idempotencyKey) {
      return { ok: true, run: fromRow(current as RunRow), violations: [] };
    }

    const stored = toStoredSyntheticRun(run, {
      version: expectedVersion + 1,
      idempotencyKey: current.idempotencyKey,
      lastStepIdempotencyKey: input.idempotencyKey ?? current.lastStepIdempotencyKey,
      createdAt: current.createdAt.toISOString(),
      updatedAt: at,
      attempts: current.attempts + 1,
      claim: null, // claim vive em tabela própria — não é tocado por `save`
    });
    const validation = validateStoredSyntheticRun(stored);
    if (!validation.ok) return { ok: false, run: null, violations: validation.violations };

    // UM update atômico: versão E não-terminalidade no MESMO where. Zero
    // linhas afetadas é o conflito — sem leitura-decide-escreve.
    const { count } = await this.prisma.syntheticRun.updateMany({
      where: { runId, version: expectedVersion, runState: { notIn: [...TERMINAL_RUN_STATES] } },
      data: {
        version: stored.version,
        runState: stored.runState,
        sessionState: stored.sessionState,
        auditCorrelationId: stored.auditCorrelationId,
        plan: stored.plan as unknown as Prisma.InputJsonValue,
        pendingSteps: stored.pendingSteps as unknown as Prisma.InputJsonValue,
        completedSteps: stored.completedSteps as unknown as Prisma.InputJsonValue,
        events: stored.events as unknown as Prisma.InputJsonValue,
        evidence: stored.evidence as unknown as Prisma.InputJsonValue,
        humanFallbackRequired: stored.humanFallbackRequired,
        result: (stored.result as unknown as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        attempts: stored.attempts,
        lastStepIdempotencyKey: stored.lastStepIdempotencyKey,
        lastInterruptionReason: stored.lastInterruptionReason,
        updatedAt: new Date(at),
      },
    });

    if (count === 0) {
      const current = await this.prisma.syntheticRun.findUnique({ where: { runId }, select: RUN_SELECT });
      if (current === null) {
        return { ok: false, run: null, violations: [violation("RUN_NOT_FOUND", "runId", `run ${runId} não encontrado`)] };
      }
      const currentStored = fromRow(current as RunRow);
      if (isSyntheticRunTerminalState(currentStored.runState)) {
        return { ok: false, run: currentStored, violations: [violation("RUN_TERMINAL", "runState", "run terminal é imutável — abra outro run")] };
      }
      return {
        ok: false,
        run: currentStored,
        violations: [violation("VERSION_CONFLICT", "expectedVersion", `esperado ${currentStored.version}, recebido ${expectedVersion}`)],
      };
    }

    const saved = await this.prisma.syntheticRun.findUnique({ where: { runId }, select: RUN_SELECT });
    if (saved === null) {
      return { ok: false, run: null, violations: [violation("RUN_NOT_FOUND", "runId", `run ${runId} não encontrado`)] };
    }
    return { ok: true, run: fromRow(saved as RunRow), violations: [] };
  }

  async claimNext(input: ClaimNextInput): Promise<ClaimResult> {
    const { runId, workerId, at, ttlMs } = input;

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.syntheticRun.findUnique({ where: { runId }, select: RUN_SELECT });
      if (run === null) {
        return { ok: false as const, claim: null, violations: [violation("RUN_NOT_FOUND", "runId", `run ${runId} não encontrado`)] };
      }
      if (isSyntheticRunTerminalState(run.runState)) {
        return { ok: false as const, claim: null, violations: [violation("RUN_TERMINAL", "runState", "run terminal não pode ser reservado")] };
      }
      if (run.runState === "WAITING_HUMAN") {
        return {
          ok: false as const,
          claim: null,
          violations: [violation("RUN_WAITING_HUMAN", "runState", "WAITING_HUMAN não é reservável para execução automática")],
        };
      }

      const atDate = new Date(at);
      if (run.claim !== null && run.claim.expiresAt > atDate) {
        return { ok: false as const, claim: null, violations: [violation("CLAIM_ALREADY_ACTIVE", "claim", "já existe reserva válida para este run")] };
      }

      // Se havia claim (expirado), remove condicionalmente — inofensivo se já
      // não existir mais (outro worker chegou primeiro).
      if (run.claim !== null) {
        await tx.syntheticRunClaim.deleteMany({ where: { runId, expiresAt: { lt: atDate } } });
      }

      const claimId = `claim-${runId}-${randomUUID()}`;
      const expiresAt = new Date(Date.parse(at) + ttlMs);

      try {
        const created = await tx.syntheticRunClaim.create({
          data: { runId, claimId, workerId, claimedAt: atDate, expiresAt, runVersionAtClaim: run.version },
          select: { claimId: true, workerId: true, claimedAt: true, expiresAt: true, runVersionAtClaim: true },
        });
        return {
          ok: true as const,
          claim: {
            claimId: created.claimId,
            runId,
            workerId: created.workerId,
            claimedAt: created.claimedAt.toISOString(),
            expiresAt: created.expiresAt.toISOString(),
            runVersionAtClaim: created.runVersionAtClaim,
          },
          violations: [] as const,
        };
      } catch (error) {
        if (isUniqueConstraintError(error, "run_id")) {
          // Outro worker venceu a corrida entre o check acima e este create.
          return { ok: false as const, claim: null, violations: [violation("CLAIM_ALREADY_ACTIVE", "claim", "outro worker reservou este run primeiro")] };
        }
        throw error;
      }
    });
  }

  async renewClaim(input: RenewClaimInput): Promise<ClaimResult> {
    const { runId, claimId, workerId, at, ttlMs } = input;
    const atDate = new Date(at);
    const newExpiresAt = new Date(Date.parse(at) + ttlMs);

    const { count } = await this.prisma.syntheticRunClaim.updateMany({
      where: { runId, claimId, workerId, expiresAt: { gt: atDate } },
      data: { expiresAt: newExpiresAt },
    });

    if (count === 0) return this.diagnoseClaimFailure(runId, claimId, workerId, atDate);

    const renewed = await this.prisma.syntheticRunClaim.findUnique({
      where: { runId },
      select: { claimId: true, workerId: true, claimedAt: true, expiresAt: true, runVersionAtClaim: true },
    });
    if (renewed === null) {
      return { ok: false, claim: null, violations: [violation("CLAIM_NOT_FOUND", "claim", "nenhuma reserva ativa para este run")] };
    }
    return {
      ok: true,
      claim: {
        claimId: renewed.claimId,
        runId,
        workerId: renewed.workerId,
        claimedAt: renewed.claimedAt.toISOString(),
        expiresAt: renewed.expiresAt.toISOString(),
        runVersionAtClaim: renewed.runVersionAtClaim,
      },
      violations: [],
    };
  }

  async releaseClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    return this.clearClaim(input);
  }

  async completeClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    return this.clearClaim(input);
  }

  async listRecoverable(input: ListRecoverableInput): Promise<readonly StoredSyntheticRun[]> {
    const atDate = new Date(input.at);
    const rows = await this.prisma.syntheticRun.findMany({
      where: {
        runState: { notIn: [...TERMINAL_RUN_STATES, "WAITING_HUMAN"] },
        OR: [{ claim: null }, { claim: { expiresAt: { lte: atDate } } }],
      },
      select: RUN_SELECT,
    });
    return rows.map((row) => fromRow(row as RunRow));
  }

  // ------------------------------------------------------------ helpers

  private async clearClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    const { runId, claimId, workerId } = input;
    const { count } = await this.prisma.syntheticRunClaim.deleteMany({ where: { runId, claimId, workerId } });
    if (count === 1) return { ok: true, violations: [] };
    return this.diagnoseClaimFailure(runId, claimId, workerId, null);
  }

  /** Só para MENSAGEM de erro (posse errada vs. inexistente vs. expirado) — nunca decide a operação em si. */
  private async diagnoseClaimFailure(
    runId: string,
    claimId: string,
    workerId: string,
    at: Date | null,
  ): Promise<{ ok: false; claim: null; violations: readonly SyntheticRunStoreViolation[] }> {
    const claim = await this.prisma.syntheticRunClaim.findUnique({ where: { runId } });
    if (claim === null) {
      return { ok: false, claim: null, violations: [violation("CLAIM_NOT_FOUND", "claim", "nenhuma reserva ativa para este run")] };
    }
    if (claim.claimId !== claimId || claim.workerId !== workerId) {
      return { ok: false, claim: null, violations: [violation("CLAIM_OWNER_MISMATCH", "workerId", "reserva pertence a outro worker")] };
    }
    if (at !== null && claim.expiresAt <= at) {
      return { ok: false, claim: null, violations: [violation("CLAIM_EXPIRED", "claim", "reserva expirada — reserve de novo com claimNext")] };
    }
    return { ok: false, claim: null, violations: [violation("CLAIM_NOT_FOUND", "claim", "nenhuma reserva ativa para este run")] };
  }
}

const TERMINAL_RUN_STATES = ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"] as const;
