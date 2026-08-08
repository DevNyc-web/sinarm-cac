/**
 * Adaptador PRISMA/POSTGRES de `ManualDispatchRequestRegistry` —
 * persistência REAL da idempotência do PEDIDO administrativo. Implementa
 * EXATAMENTE o mesmo contrato do adaptador em memória
 * (`inMemoryManualDispatchRequestRegistry.ts`) — nenhuma mudança de
 * interface para acomodar o banco.
 *
 * Concorrência real via Postgres, não simulada em memória:
 * - `reserve`: `request_id` é UNIQUE — o Postgres arbitra quem cria a linha
 *   primeiro; a aplicação só interpreta o `P2002` e reclassifica a partir do
 *   registro existente (replay/conflito/em execução/recuperável), nunca com
 *   leitura-decide-escreve;
 * - `finish`/`release`: um único `updateMany`/`deleteMany` condicional em
 *   `(request_id, execution_token, status = PENDING)` — zero linhas
 *   afetadas É o conflito (dono errado ou reserva já concluída), sem
 *   corrida entre checar e escrever.
 *
 * `result` (JSON) só entra já validado por
 * `validateManualSyntheticDispatchResult` (reusado, não duplicado) e é
 * REVALIDADO na leitura — nunca um objeto de banco em quem confia
 * cegamente.
 */
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import {
  MANUAL_DISPATCH_ENVIRONMENTS,
  MANUAL_DISPATCH_RESULT_FORMAT_VERSION,
  validateManualSyntheticDispatchResult,
  type ManualDispatchEnvironment,
  type ManualSyntheticDispatchResult,
} from "./manualSyntheticDispatchTypes";
import {
  isTerminalManualDispatchRequestStatus,
  type FinishManualDispatchRequestInput,
  type FinishManualDispatchRequestResult,
  type ManualDispatchLease,
  type ManualDispatchRegistryViolation,
  type ManualDispatchRequestRegistry,
  type ManualDispatchRequestRegistryEntry,
  type ManualDispatchRequestStatus,
  type ReleaseManualDispatchRequestInput,
  type ReleaseManualDispatchRequestResult,
  type ReserveManualDispatchRequestInput,
  type ReserveManualDispatchRequestResult,
} from "./manualDispatchRequestRegistry";

/** Lançado quando uma linha lida do banco não passa na revalidação — nunca deveria acontecer se só este adaptador escreve. */
export class InvalidStoredManualDispatchRequestError extends Error {
  constructor(requestId: string, detail: string) {
    super(`pedido administrativo ${requestId} inválido após leitura: ${detail}`);
    this.name = "InvalidStoredManualDispatchRequestError";
  }
}

const ENVIRONMENT_SET: ReadonlySet<string> = new Set(MANUAL_DISPATCH_ENVIRONMENTS);

type RequestRow = {
  requestId: string;
  batchId: string;
  fingerprint: string;
  status: ManualDispatchRequestStatus;
  requestedBy: string;
  environment: string;
  reason: string;
  requestedAt: Date;
  result: Prisma.JsonValue | null;
  formatVersion: string;
  executionToken: string | null;
  claimedBy: string | null;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const REQUEST_SELECT = {
  requestId: true,
  batchId: true,
  fingerprint: true,
  status: true,
  requestedBy: true,
  environment: true,
  reason: true,
  requestedAt: true,
  result: true,
  formatVersion: true,
  executionToken: true,
  claimedBy: true,
  claimedAt: true,
  leaseExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function assertEnvironment(value: string, requestId: string): asserts value is ManualDispatchEnvironment {
  if (!ENVIRONMENT_SET.has(value)) {
    throw new InvalidStoredManualDispatchRequestError(requestId, `ambiente fora do vocabulário do domínio: ${value}`);
  }
}

function fromRow(row: RequestRow): ManualDispatchRequestRegistryEntry {
  assertEnvironment(row.environment, row.requestId);

  let result: ManualSyntheticDispatchResult | null = null;
  if (row.result !== null) {
    const validation = validateManualSyntheticDispatchResult(row.result);
    if (!validation.ok) {
      throw new InvalidStoredManualDispatchRequestError(row.requestId, validation.violations.map((v) => v.code).join(", "));
    }
    result = row.result as unknown as ManualSyntheticDispatchResult;
  }

  const lease: ManualDispatchLease | null =
    row.executionToken === null || row.claimedBy === null || row.claimedAt === null || row.leaseExpiresAt === null
      ? null
      : { executionToken: row.executionToken, claimedBy: row.claimedBy, claimedAt: row.claimedAt.toISOString(), expiresAt: row.leaseExpiresAt.toISOString() };

  return {
    requestId: row.requestId,
    batchId: row.batchId,
    fingerprint: row.fingerprint,
    status: row.status,
    requestedBy: row.requestedBy,
    environment: row.environment,
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    result,
    lease,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function violation(code: ManualDispatchRegistryViolation["code"], detail: string): { ok: false; violation: ManualDispatchRegistryViolation } {
  return { ok: false, violation: { code, detail } };
}

function isUniqueConstraintError(error: unknown, target: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const meta = error.meta as { target?: string | string[] } | undefined;
  const fields = Array.isArray(meta?.target) ? meta.target : typeof meta?.target === "string" ? [meta.target] : [];
  return fields.some((f) => f.includes(target));
}

/** Classifica um registro JÁ EXISTENTE contra o fingerprint do pedido atual — usado tanto após `P2002` quanto para manter uma única fonte de verdade da regra. */
function classifyExisting(row: RequestRow, fingerprint: string, at: string): ReserveManualDispatchRequestResult {
  if (row.fingerprint !== fingerprint) return { outcome: "FINGERPRINT_CONFLICT" };
  if (isTerminalManualDispatchRequestStatus(row.status)) return { outcome: "REPLAY", entry: fromRow(row) };
  // status === "PENDING"
  const leaseValid = row.leaseExpiresAt !== null && row.leaseExpiresAt.getTime() > Date.parse(at);
  if (leaseValid) return { outcome: "ALREADY_RUNNING" };
  return { outcome: "RECOVERY_REQUIRED", entry: fromRow(row) };
}

export class PrismaManualDispatchRequestRegistry implements ManualDispatchRequestRegistry {
  constructor(private readonly prisma: PrismaClient = getPrisma()) {}

  async reserve(input: ReserveManualDispatchRequestInput): Promise<ReserveManualDispatchRequestResult> {
    const executionToken = randomUUID();
    const claimedAt = new Date(input.at);
    const expiresAt = new Date(Date.parse(input.at) + input.leaseTtlMs);

    try {
      await this.prisma.manualDispatchRequest.create({
        data: {
          requestId: input.requestId,
          batchId: input.batchId,
          fingerprint: input.fingerprint,
          status: "PENDING",
          requestedBy: input.requestedBy,
          environment: input.environment,
          reason: input.reason,
          requestedAt: new Date(input.requestedAt),
          formatVersion: MANUAL_DISPATCH_RESULT_FORMAT_VERSION,
          executionToken,
          claimedBy: input.claimedBy,
          claimedAt,
          leaseExpiresAt: expiresAt,
        },
        select: REQUEST_SELECT,
      });
      return { outcome: "RESERVED", lease: { executionToken, claimedBy: input.claimedBy, claimedAt: input.at, expiresAt: expiresAt.toISOString() } };
    } catch (error) {
      if (!isUniqueConstraintError(error, "request_id")) throw error;

      const existing = await this.prisma.manualDispatchRequest.findUnique({ where: { requestId: input.requestId }, select: REQUEST_SELECT });
      if (existing === null) {
        // Corrida extrema: a linha que causou o P2002 já sumiu (não deveria
        // acontecer — nada deleta linhas terminais). Sinaliza sem inventar
        // um resultado.
        return { outcome: "FINGERPRINT_CONFLICT" };
      }
      return classifyExisting(existing as RequestRow, input.fingerprint, input.at);
    }
  }

  async find(requestId: string): Promise<ManualDispatchRequestRegistryEntry | null> {
    const row = await this.prisma.manualDispatchRequest.findUnique({ where: { requestId }, select: REQUEST_SELECT });
    return row === null ? null : fromRow(row as RequestRow);
  }

  async finish(input: FinishManualDispatchRequestInput): Promise<FinishManualDispatchRequestResult> {
    const validation = validateManualSyntheticDispatchResult(input.result);
    if (!validation.ok) {
      return violation("REQUEST_INVALID_STORED_RESULT", `resultado inválido antes de persistir: ${validation.violations.map((v) => v.code).join(", ")}`);
    }

    // UM update atômico: dono E ainda-pendente no MESMO where. Zero linhas
    // afetadas é o conflito — sem leitura-decide-escreve. `execution_token`/
    // `claimed_by`/`claimed_at`/`lease_expires_at` são MANTIDOS (auditoria da
    // última reserva) — quem decide se a reserva ainda vale é `status`.
    const { count } = await this.prisma.manualDispatchRequest.updateMany({
      where: { requestId: input.requestId, executionToken: input.executionToken, status: "PENDING" },
      data: {
        status: input.status,
        result: input.result as unknown as Prisma.InputJsonValue,
        formatVersion: input.result.formatVersion,
        completedAt: new Date(input.at),
      },
    });

    if (count === 0) return this.diagnoseOwnership(input.requestId, input.executionToken);

    const row = await this.prisma.manualDispatchRequest.findUnique({ where: { requestId: input.requestId }, select: REQUEST_SELECT });
    if (row === null) return violation("REQUEST_NOT_FOUND", `pedido ${input.requestId} não encontrado`);
    return { ok: true, entry: fromRow(row as RequestRow) };
  }

  async release(input: ReleaseManualDispatchRequestInput): Promise<ReleaseManualDispatchRequestResult> {
    const { count } = await this.prisma.manualDispatchRequest.deleteMany({
      where: { requestId: input.requestId, executionToken: input.executionToken, status: "PENDING" },
    });
    if (count === 1) return { ok: true };
    const diagnosis = await this.diagnoseOwnership(input.requestId, input.executionToken);
    return diagnosis.ok ? { ok: true } : diagnosis;
  }

  async listRecoverable(at: string): Promise<readonly ManualDispatchRequestRegistryEntry[]> {
    const rows = await this.prisma.manualDispatchRequest.findMany({
      where: { status: "PENDING", leaseExpiresAt: { lte: new Date(at) } },
      select: REQUEST_SELECT,
    });
    return rows.map((row) => fromRow(row as RequestRow));
  }

  async count(): Promise<number> {
    return this.prisma.manualDispatchRequest.count();
  }

  private async diagnoseOwnership(requestId: string, executionToken: string): Promise<{ ok: false; violation: ManualDispatchRegistryViolation }> {
    const row = await this.prisma.manualDispatchRequest.findUnique({ where: { requestId }, select: REQUEST_SELECT });
    if (row === null) return violation("REQUEST_NOT_FOUND", `pedido ${requestId} não encontrado`);
    if (row.executionToken !== executionToken) return violation("REQUEST_OWNER_MISMATCH", "token de execução não confere com a reserva ativa");
    return violation("REQUEST_VERSION_CONFLICT", "pedido já não está mais PENDING — outra chamada já concluiu ou liberou a reserva");
  }
}
