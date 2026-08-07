/**
 * Fake do Prisma DEDICADO ao store sintético — instalado via `globalThis`,
 * mesmo mecanismo de `tests/unit/services/testPrisma.ts`.
 *
 * NÃO estende o `FakePrisma` compartilhado: aquele não simula violação de
 * UNIQUE (nenhum consumidor atual precisa disso), e é justamente disso que
 * `PrismaSyntheticRunStore.create`/`claimNext` dependem (capturam `P2002`
 * para resolver idempotência e corrida de claim). Um fake pequeno e dedicado
 * evita inflar um arquivo compartilhado por muitos outros testes com
 * comportamento que só este PR usa.
 *
 * LIMITE HONESTO (mesmo do `documentExtractionConcurrency.test.ts`): isto
 * prova a POLÍTICA e a FORMA das consultas — `where` com versão/estado no
 * `updateMany`, captura de `P2002`, `select` fechado. NÃO prova o
 * comportamento do Postgres de verdade: isolamento de transação, deadlock e
 * a atomicidade real de duas conexões concorrentes continuam sem cobertura
 * em CI, que roda sem banco (`.github/workflows/ci.yml`).
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

type Row = Record<string, unknown>;

function p2002(target: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on the fields: (\`${target}\`)`, {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [target] },
  });
}

function matchesWhere(row: Row, where: Row): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue;
    if (key === "OR") {
      const alternatives = expected as Row[];
      if (!alternatives.some((alt) => matchesWhere(row, alt))) return false;
      continue;
    }
    if (key === "claim") {
      const claimWhere = expected as { is?: null } | Row | null;
      const claim = row.claim as Row | null;
      if (claimWhere === null || (typeof claimWhere === "object" && "is" in claimWhere && claimWhere.is === null)) {
        if (claim !== null) return false;
        continue;
      }
      if (claim === null) return false;
      if (!matchesWhere(claim, claimWhere as Row)) return false;
      continue;
    }
    if (typeof expected === "object" && expected !== null && !(expected instanceof Date)) {
      const op = expected as Row;
      const rowValue = row[key];
      if ("notIn" in op) {
        const excluded = op.notIn as unknown[];
        if (excluded.includes(rowValue)) return false;
        continue;
      }
      if ("in" in op) {
        const included = op.in as unknown[];
        if (!included.includes(rowValue)) return false;
        continue;
      }
      if ("lt" in op) {
        if (!(rowValue instanceof Date) || !(rowValue < (op.lt as Date))) return false;
        continue;
      }
      if ("lte" in op) {
        if (!(rowValue instanceof Date) || !(rowValue <= (op.lte as Date))) return false;
        continue;
      }
      if ("gt" in op) {
        if (!(rowValue instanceof Date) || !(rowValue > (op.gt as Date))) return false;
        continue;
      }
      throw new Error(`[fake-synthetic-prisma] operador não suportado: ${JSON.stringify(op)}`);
    }
    if (row[key] !== expected) return false;
  }
  return true;
}

class FakeSyntheticRunTable {
  rows: Row[] = [];

  async create({ data, select }: { data: Row; select?: Row }): Promise<Row> {
    if (this.rows.some((r) => r.runId === data.runId)) throw p2002("run_id");
    if (this.rows.some((r) => r.idempotencyKey === data.idempotencyKey)) throw p2002("idempotency_key");
    const now = new Date();
    const row: Row = { id: randomUUID(), createdAt: now, updatedAt: now, claim: null, ...data };
    this.rows.push(row);
    return this.project(row, select);
  }

  async findUnique({ where, select }: { where: Row; select?: Row }): Promise<Row | null> {
    const row = this.rows.find((r) => (where.runId !== undefined ? r.runId === where.runId : r.idempotencyKey === where.idempotencyKey));
    return row ? this.project(row, select) : null;
  }

  async findMany({ where, select }: { where?: Row; select?: Row } = {}): Promise<Row[]> {
    const filtered = where ? this.rows.filter((r) => matchesWhere(r, where)) : this.rows;
    return filtered.map((r) => this.project(r, select));
  }

  async updateMany({ where, data }: { where: Row; data: Row }): Promise<{ count: number }> {
    const targets = this.rows.filter((r) => matchesWhere(r, where));
    for (const row of targets) {
      Object.assign(row, resolveIncrements(row, data), { updatedAt: new Date() });
    }
    return { count: targets.length };
  }

  private project(row: Row, select?: Row): Row {
    if (!select) return row;
    const out: Row = {};
    for (const [key, wanted] of Object.entries(select)) {
      if (wanted === true) {
        out[key] = row[key] ?? null;
      } else if (key === "claim" && wanted && typeof wanted === "object") {
        const claim = row.claim as Row | null;
        out.claim = claim ? this.project(claim, (wanted as { select?: Row }).select) : null;
      }
    }
    return out;
  }
}

class FakeSyntheticRunClaimTable {
  rows: Row[] = [];

  constructor(private readonly runs: FakeSyntheticRunTable) {}

  async create({ data, select }: { data: Row; select?: Row }): Promise<Row> {
    if (this.rows.some((r) => r.runId === data.runId)) throw p2002("run_id");
    if (this.rows.some((r) => r.claimId === data.claimId)) throw p2002("claim_id");
    const row: Row = { id: randomUUID(), ...data };
    this.rows.push(row);
    const run = this.runs.rows.find((r) => r.runId === data.runId);
    if (run) run.claim = row;
    return this.project(row, select);
  }

  async findUnique({ where, select }: { where: Row; select?: Row }): Promise<Row | null> {
    const row = this.rows.find((r) => r.runId === where.runId);
    return row ? this.project(row, select) : null;
  }

  async updateMany({ where, data }: { where: Row; data: Row }): Promise<{ count: number }> {
    const targets = this.rows.filter((r) => matchesWhere(r, where));
    for (const row of targets) Object.assign(row, data);
    return { count: targets.length };
  }

  async deleteMany({ where }: { where: Row }): Promise<{ count: number }> {
    const targets = this.rows.filter((r) => matchesWhere(r, where));
    for (const row of targets) {
      this.rows.splice(this.rows.indexOf(row), 1);
      const run = this.runs.rows.find((r) => r.runId === row.runId);
      if (run) run.claim = null;
    }
    return { count: targets.length };
  }

  private project(row: Row, select?: Row): Row {
    if (!select) return row;
    const out: Row = {};
    for (const key of Object.keys(select)) out[key] = row[key] ?? null;
    return out;
  }
}

/** Resolve `{ increment: n }` do jeito que o Prisma faz — só onde o adaptador usa. */
function resolveIncrements(row: Row, data: Row): Row {
  const resolved: Row = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in (value as Row)) {
      resolved[key] = (row[key] as number) + ((value as Row).increment as number);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export class FakeSyntheticRunPrisma {
  readonly syntheticRun = new FakeSyntheticRunTable();
  readonly syntheticRunClaim = new FakeSyntheticRunClaimTable(this.syntheticRun);

  /** Interativa, SEM rollback — as poucas etapas de `claimNext` são todas leitura+insert condicional, sem necessidade de desfazer. */
  async $transaction<T>(fn: (tx: FakeSyntheticRunPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

export function installFakeSyntheticRunPrisma(): FakeSyntheticRunPrisma {
  const fake = new FakeSyntheticRunPrisma();
  (globalThis as unknown as { prisma?: unknown }).prisma = fake;
  return fake;
}
