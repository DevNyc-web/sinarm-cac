/**
 * Adaptador EM MEMÓRIA do contrato `SyntheticRunStore` — só para testes e
 * laboratório. Nenhuma persistência real: os dados somem quando a instância
 * é descartada.
 *
 * Cada instância tem seu PRÓPRIO estado (dois `new InMemorySyntheticRunStore()`
 * não compartilham nada — não é singleton, não há variável de módulo
 * mutável). Toda leitura e escrita passa por CÓPIA DEFENSIVA: o chamador
 * nunca recebe nem entrega uma referência viva que possa mutar o registro
 * por fora do contrato.
 *
 * Sem timer real, sem relógio próprio: todo `at`/`ttlMs` vem do chamador.
 * Async de propósito (mesma forma que um adaptador de banco teria), mas sem
 * `await` real de I/O nenhum.
 */
import { isSyntheticRunTerminalState } from "../syntheticRunCoordinator";
import { classifySyntheticRunRecovery } from "./syntheticRunRecovery";
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
  type SyntheticRunStore,
  type SyntheticRunStoreViolation,
} from "./syntheticRunStore";

function cloneStoredRun(stored: StoredSyntheticRun): StoredSyntheticRun {
  return {
    ...stored,
    plan: { ...stored.plan, steps: [...stored.plan.steps], allowedSyntheticData: [...stored.plan.allowedSyntheticData] },
    pendingSteps: [...stored.pendingSteps],
    completedSteps: stored.completedSteps.map((c) => ({ ...c, step: { ...c.step } })),
    events: [...stored.events],
    evidence: [...stored.evidence],
    result: stored.result === null ? null : { ...stored.result },
    claim: stored.claim === null ? null : { ...stored.claim },
  };
}

function rejectRun(violations: readonly SyntheticRunStoreViolation[]): { ok: false; run: null; violations: readonly SyntheticRunStoreViolation[] } {
  return { ok: false, run: null, violations };
}

function rejectClaim(violations: readonly SyntheticRunStoreViolation[]): { ok: false; claim: null; violations: readonly SyntheticRunStoreViolation[] } {
  return { ok: false, claim: null, violations };
}

export class InMemorySyntheticRunStore implements SyntheticRunStore {
  private readonly records = new Map<string, StoredSyntheticRun>();
  /** `idempotencyKey` de CRIAÇÃO -> runId — fecha "mesma chave, payload incompatível". */
  private readonly creationKeys = new Map<string, string>();
  private claimSeq = 0;

  async create(input: CreateStoredRunInput): Promise<CreateStoredRunResult> {
    const { run, idempotencyKey, at } = input;

    if (idempotencyKey.trim() === "") {
      return rejectRun([{ code: "EMPTY_VALUE", field: "idempotencyKey", detail: "chave de idempotência vazia" }]);
    }

    const existingRunIdForKey = this.creationKeys.get(idempotencyKey);
    if (existingRunIdForKey !== undefined) {
      const existing = this.records.get(existingRunIdForKey);
      if (existing !== undefined && isCompatibleCreation(existing, run)) {
        return { ok: true, created: false, run: cloneStoredRun(existing), violations: [] };
      }
      return rejectRun([
        { code: "IDEMPOTENCY_CONFLICT", field: "idempotencyKey", detail: "mesma chave, run ou plano incompatível" },
      ]);
    }

    if (this.records.has(run.runId)) {
      return rejectRun([{ code: "RUN_ALREADY_EXISTS", field: "runId", detail: `run ${run.runId} já existe com outra chave` }]);
    }

    const stored = toStoredSyntheticRun(run, {
      version: 1,
      idempotencyKey,
      lastStepIdempotencyKey: null,
      createdAt: at,
      updatedAt: at,
      attempts: 0,
      claim: null,
    });

    const validation = validateStoredSyntheticRun(stored);
    if (!validation.ok) return rejectRun(validation.violations);

    this.records.set(run.runId, stored);
    this.creationKeys.set(idempotencyKey, run.runId);

    return { ok: true, created: true, run: cloneStoredRun(stored), violations: [] };
  }

  async getById(runId: string): Promise<StoredSyntheticRun | null> {
    const record = this.records.get(runId);
    return record === undefined ? null : cloneStoredRun(record);
  }

  async save(input: SaveStoredRunInput): Promise<SaveStoredRunResult> {
    const record = this.records.get(input.runId);
    if (record === undefined) {
      return rejectRun([{ code: "RUN_NOT_FOUND", field: "runId", detail: `run ${input.runId} não encontrado` }]);
    }

    // Replay idempotente: mesma chave do último save de etapa bem-sucedido ->
    // devolve o registro atual, sem reaplicar (não duplica evento/evidência/
    // etapa/protocolo). Checado ANTES da terminalidade de propósito: a última
    // etapa de um plano pode muito bem levar o run a COMPLETED, e repetir a
    // MESMA chave depois disso ainda precisa devolver o resultado, não RUN_TERMINAL.
    if (input.idempotencyKey !== undefined && input.idempotencyKey === record.lastStepIdempotencyKey) {
      return { ok: true, run: cloneStoredRun(record), violations: [] };
    }

    if (isSyntheticRunTerminalState(record.runState)) {
      return { ok: false, run: cloneStoredRun(record), violations: [{ code: "RUN_TERMINAL", field: "runState", detail: "run terminal é imutável — abra outro run" }] };
    }

    if (record.version !== input.expectedVersion) {
      return {
        ok: false,
        run: cloneStoredRun(record),
        violations: [{ code: "VERSION_CONFLICT", field: "expectedVersion", detail: `esperado ${record.version}, recebido ${input.expectedVersion}` }],
      };
    }

    const nextStored = toStoredSyntheticRun(input.run, {
      version: record.version + 1,
      idempotencyKey: record.idempotencyKey,
      lastStepIdempotencyKey: input.idempotencyKey ?? record.lastStepIdempotencyKey,
      createdAt: record.createdAt,
      updatedAt: input.at,
      attempts: record.attempts + 1,
      claim: record.claim,
    });

    const validation = validateStoredSyntheticRun(nextStored);
    if (!validation.ok) return rejectRun(validation.violations);

    this.records.set(input.runId, nextStored);

    return { ok: true, run: cloneStoredRun(nextStored), violations: [] };
  }

  async claimNext(input: ClaimNextInput): Promise<ClaimResult> {
    const record = this.records.get(input.runId);
    if (record === undefined) {
      return rejectClaim([{ code: "RUN_NOT_FOUND", field: "runId", detail: `run ${input.runId} não encontrado` }]);
    }
    if (isSyntheticRunTerminalState(record.runState)) {
      return rejectClaim([{ code: "RUN_TERMINAL", field: "runState", detail: "run terminal não pode ser reservado" }]);
    }
    if (record.runState === "WAITING_HUMAN") {
      return rejectClaim([{ code: "RUN_WAITING_HUMAN", field: "runState", detail: "WAITING_HUMAN não é reservável para execução automática" }]);
    }

    const currentClaim = record.claim;
    if (currentClaim !== null && Date.parse(currentClaim.expiresAt) > Date.parse(input.at)) {
      return rejectClaim([{ code: "CLAIM_ALREADY_ACTIVE", field: "claim", detail: "já existe reserva válida para este run" }]);
    }

    this.claimSeq += 1;
    const claim: SyntheticRunClaim = {
      claimId: `claim-${input.runId}-${this.claimSeq}`,
      runId: input.runId,
      workerId: input.workerId,
      claimedAt: input.at,
      expiresAt: new Date(Date.parse(input.at) + input.ttlMs).toISOString(),
      runVersionAtClaim: record.version,
    };
    this.records.set(input.runId, { ...record, claim });

    return { ok: true, claim: { ...claim }, violations: [] };
  }

  async renewClaim(input: RenewClaimInput): Promise<ClaimResult> {
    const record = this.records.get(input.runId);
    if (record === undefined) {
      return rejectClaim([{ code: "RUN_NOT_FOUND", field: "runId", detail: `run ${input.runId} não encontrado` }]);
    }
    const claimCheck = this.checkClaimOwnership(record.claim, input.claimId, input.workerId, input.at);
    if (!claimCheck.ok) return rejectClaim(claimCheck.violations);

    const renewed: SyntheticRunClaim = {
      ...claimCheck.claim,
      expiresAt: new Date(Date.parse(input.at) + input.ttlMs).toISOString(),
    };
    this.records.set(input.runId, { ...record, claim: renewed });

    return { ok: true, claim: { ...renewed }, violations: [] };
  }

  async releaseClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    return this.clearClaim(input);
  }

  async completeClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    return this.clearClaim(input);
  }

  async listRecoverable(input: ListRecoverableInput): Promise<readonly StoredSyntheticRun[]> {
    const recoverable: StoredSyntheticRun[] = [];
    for (const record of this.records.values()) {
      if (classifySyntheticRunRecovery(record, input.at) === "RECOVERABLE") {
        recoverable.push(cloneStoredRun(record));
      }
    }
    return recoverable;
  }

  // ------------------------------------------------------------ helpers

  private clearClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    const record = this.records.get(input.runId);
    if (record === undefined) {
      return Promise.resolve({ ok: false, violations: [{ code: "RUN_NOT_FOUND", field: "runId", detail: `run ${input.runId} não encontrado` }] });
    }
    // `at` não importa para posse — dono errado é recusado mesmo com claim expirado.
    const claimCheck = this.checkClaimOwnership(record.claim, input.claimId, input.workerId, null);
    if (!claimCheck.ok) return Promise.resolve({ ok: false, violations: claimCheck.violations });

    this.records.set(input.runId, { ...record, claim: null });
    return Promise.resolve({ ok: true, violations: [] });
  }

  private checkClaimOwnership(
    claim: SyntheticRunClaim | null,
    claimId: string,
    workerId: string,
    at: string | null,
  ): { ok: true; claim: SyntheticRunClaim } | { ok: false; violations: readonly SyntheticRunStoreViolation[] } {
    if (claim === null) {
      return { ok: false, violations: [{ code: "CLAIM_NOT_FOUND", field: "claim", detail: "nenhuma reserva ativa para este run" }] };
    }
    if (claim.claimId !== claimId || claim.workerId !== workerId) {
      return { ok: false, violations: [{ code: "CLAIM_OWNER_MISMATCH", field: "workerId", detail: "reserva pertence a outro worker" }] };
    }
    if (at !== null && Date.parse(claim.expiresAt) <= Date.parse(at)) {
      return { ok: false, violations: [{ code: "CLAIM_EXPIRED", field: "claim", detail: "reserva expirada — reserve de novo com claimNext" }] };
    }
    return { ok: true, claim };
  }
}

/** "Payload compatível" para replay idempotente de CRIAÇÃO: mesmo run, mesmo plano, mesma sessão. */
function isCompatibleCreation(existing: StoredSyntheticRun, run: { runId: string; plan: { planId: string; version: string }; session: { auditCorrelationId: string } }): boolean {
  return (
    existing.runId === run.runId &&
    existing.plan.planId === run.plan.planId &&
    existing.plan.version === run.plan.version &&
    existing.auditCorrelationId === run.session.auditCorrelationId
  );
}
