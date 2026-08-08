/**
 * Registro EM MEMÓRIA de pedidos administrativos — só para laboratório e
 * testes, mesmo padrão de `InMemorySyntheticRunStore`/
 * `InMemorySyntheticEngineLogger`: cada instância tem seu PRÓPRIO estado
 * (sem singleton, sem variável de módulo mutável), toda leitura/escrita
 * passa por cópia defensiva.
 *
 * A garantia de concorrência aqui é a mesma do `InMemorySyntheticRunStore`:
 * síncrona por natureza (Node é single-threaded, sem `await` real entre a
 * checagem e a escrita) — suficiente para testes e laboratório, mas não
 * prova o comportamento de duas CONEXÕES Postgres reais (isso é
 * responsabilidade do adaptador Prisma).
 */
import { randomUUID } from "node:crypto";
import type {
  FinishManualDispatchRequestInput,
  FinishManualDispatchRequestResult,
  ManualDispatchRegistryViolation,
  ManualDispatchRequestRegistry,
  ManualDispatchRequestRegistryEntry,
  ReleaseManualDispatchRequestInput,
  ReleaseManualDispatchRequestResult,
  ReserveManualDispatchRequestInput,
  ReserveManualDispatchRequestResult,
} from "./manualDispatchRequestRegistry";
import { isTerminalManualDispatchRequestStatus } from "./manualDispatchRequestRegistry";
import { validateManualSyntheticDispatchResult } from "./manualSyntheticDispatchTypes";

function cloneEntry(entry: ManualDispatchRequestRegistryEntry): ManualDispatchRequestRegistryEntry {
  return {
    ...entry,
    result:
      entry.result === null
        ? null
        : { ...entry.result, batch: entry.result.batch === null ? null : { ...entry.result.batch }, metrics: entry.result.metrics === null ? null : { ...entry.result.metrics }, warnings: entry.result.warnings.map((w) => ({ ...w })) },
    lease: entry.lease === null ? null : { ...entry.lease },
  };
}

function violationResult(code: ManualDispatchRegistryViolation["code"], detail: string): { ok: false; violation: ManualDispatchRegistryViolation } {
  return { ok: false, violation: { code, detail } };
}

export class InMemoryManualDispatchRequestRegistry implements ManualDispatchRequestRegistry {
  private readonly entries = new Map<string, ManualDispatchRequestRegistryEntry>();

  async reserve(input: ReserveManualDispatchRequestInput): Promise<ReserveManualDispatchRequestResult> {
    const existing = this.entries.get(input.requestId);

    if (existing === undefined) {
      const lease = { executionToken: randomUUID(), claimedBy: input.claimedBy, claimedAt: input.at, expiresAt: new Date(Date.parse(input.at) + input.leaseTtlMs).toISOString() };
      const entry: ManualDispatchRequestRegistryEntry = {
        requestId: input.requestId,
        batchId: input.batchId,
        fingerprint: input.fingerprint,
        status: "PENDING",
        requestedBy: input.requestedBy,
        environment: input.environment,
        reason: input.reason,
        requestedAt: input.requestedAt,
        result: null,
        lease,
        createdAt: input.at,
        updatedAt: input.at,
      };
      this.entries.set(input.requestId, entry);
      return { outcome: "RESERVED", lease: { ...lease } };
    }

    if (existing.fingerprint !== input.fingerprint) {
      return { outcome: "FINGERPRINT_CONFLICT" };
    }
    if (isTerminalManualDispatchRequestStatus(existing.status)) {
      return { outcome: "REPLAY", entry: cloneEntry(existing) };
    }
    // status === "PENDING"
    const leaseValid = existing.lease !== null && Date.parse(existing.lease.expiresAt) > Date.parse(input.at);
    if (leaseValid) return { outcome: "ALREADY_RUNNING" };
    return { outcome: "RECOVERY_REQUIRED", entry: cloneEntry(existing) };
  }

  async find(requestId: string): Promise<ManualDispatchRequestRegistryEntry | null> {
    const entry = this.entries.get(requestId);
    return entry === undefined ? null : cloneEntry(entry);
  }

  async finish(input: FinishManualDispatchRequestInput): Promise<FinishManualDispatchRequestResult> {
    const validation = validateManualSyntheticDispatchResult(input.result);
    if (!validation.ok) {
      return violationResult("REQUEST_INVALID_STORED_RESULT", `resultado inválido antes de persistir: ${validation.violations.map((v) => v.code).join(", ")}`);
    }

    const diagnosis = this.checkOwnership(input.requestId, input.executionToken);
    if (diagnosis !== null) return diagnosis;

    const existing = this.entries.get(input.requestId)!;
    // `lease` é MANTIDO (auditoria da última reserva) — quem decide se ainda
    // vale é `status`, o mesmo critério do adaptador Prisma.
    const updated: ManualDispatchRequestRegistryEntry = { ...existing, status: input.status, result: input.result, updatedAt: input.at };
    this.entries.set(input.requestId, updated);
    return { ok: true, entry: cloneEntry(updated) };
  }

  async release(input: ReleaseManualDispatchRequestInput): Promise<ReleaseManualDispatchRequestResult> {
    const diagnosis = this.checkOwnership(input.requestId, input.executionToken);
    if (diagnosis !== null) return diagnosis;
    this.entries.delete(input.requestId);
    return { ok: true };
  }

  /** `null` = posse confirmada e request ainda PENDING; senão, a violação diagnosticada. */
  private checkOwnership(requestId: string, executionToken: string): { ok: false; violation: ManualDispatchRegistryViolation } | null {
    const existing = this.entries.get(requestId);
    if (existing === undefined) return violationResult("REQUEST_NOT_FOUND", `pedido ${requestId} não encontrado`);
    if (existing.lease === null || existing.lease.executionToken !== executionToken) {
      return violationResult("REQUEST_OWNER_MISMATCH", "token de execução não confere com a reserva ativa");
    }
    if (existing.status !== "PENDING") {
      return violationResult("REQUEST_VERSION_CONFLICT", "pedido já não está mais PENDING — outra chamada já concluiu ou liberou a reserva");
    }
    return null;
  }

  async listRecoverable(at: string): Promise<readonly ManualDispatchRequestRegistryEntry[]> {
    const recoverable: ManualDispatchRequestRegistryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.status !== "PENDING") continue;
      if (entry.lease !== null && Date.parse(entry.lease.expiresAt) > Date.parse(at)) continue;
      recoverable.push(cloneEntry(entry));
    }
    return recoverable;
  }

  async count(): Promise<number> {
    return this.entries.size;
  }

  /** Limpa só o histórico DESTA instância. */
  clear(): void {
    this.entries.clear();
  }
}
