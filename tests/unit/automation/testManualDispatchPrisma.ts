/**
 * Fake do Prisma DEDICADO ao registry administrativo — instalado via
 * `globalThis`, mesmo mecanismo de `testSyntheticRunPrisma.ts`.
 *
 * NÃO estende o fake compartilhado nem o do store sintético: precisa
 * simular violação de UNIQUE em `request_id` (para `reserve()` capturar
 * `P2002`), o que nenhum dos outros fakes replica igual.
 *
 * LIMITE HONESTO (mesmo critério de `testSyntheticRunPrisma.ts`): prova a
 * POLÍTICA e a FORMA das consultas — `where` com dono/status no
 * `updateMany`, captura de `P2002`, `select` fechado. NÃO prova o
 * comportamento do Postgres de verdade — isso é responsabilidade de rodar
 * a migration real contra um banco (já validado manualmente nesta PR).
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
    if (typeof expected === "object" && expected !== null && !(expected instanceof Date)) {
      const op = expected as Row;
      const rowValue = row[key];
      if ("lte" in op) {
        if (!(rowValue instanceof Date) || !(rowValue <= (op.lte as Date))) return false;
        continue;
      }
      throw new Error(`[fake-manual-dispatch-prisma] operador não suportado: ${JSON.stringify(op)}`);
    }
    if (row[key] !== expected) return false;
  }
  return true;
}

class FakeManualDispatchRequestTable {
  rows: Row[] = [];

  async create({ data, select }: { data: Row; select?: Row }): Promise<Row> {
    if (this.rows.some((r) => r.requestId === data.requestId)) throw p2002("request_id");
    const now = new Date();
    const row: Row = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      result: null,
      executionToken: null,
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
      ...data,
    };
    this.rows.push(row);
    return this.project(row, select);
  }

  async findUnique({ where, select }: { where: Row; select?: Row }): Promise<Row | null> {
    const row = this.rows.find((r) => r.requestId === where.requestId);
    return row ? this.project(row, select) : null;
  }

  async findMany({ where, select }: { where?: Row; select?: Row } = {}): Promise<Row[]> {
    const filtered = where ? this.rows.filter((r) => matchesWhere(r, where)) : this.rows;
    return filtered.map((r) => this.project(r, select));
  }

  async updateMany({ where, data }: { where: Row; data: Row }): Promise<{ count: number }> {
    const targets = this.rows.filter((r) => matchesWhere(r, where));
    for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
    return { count: targets.length };
  }

  async deleteMany({ where }: { where: Row }): Promise<{ count: number }> {
    const targets = this.rows.filter((r) => matchesWhere(r, where));
    for (const row of targets) this.rows.splice(this.rows.indexOf(row), 1);
    return { count: targets.length };
  }

  async count(): Promise<number> {
    return this.rows.length;
  }

  private project(row: Row, select?: Row): Row {
    if (!select) return row;
    const out: Row = {};
    for (const key of Object.keys(select)) out[key] = row[key] ?? null;
    return out;
  }
}

export class FakeManualDispatchPrisma {
  readonly manualDispatchRequest = new FakeManualDispatchRequestTable();
}

export function installFakeManualDispatchPrisma(): FakeManualDispatchPrisma {
  const fake = new FakeManualDispatchPrisma();
  (globalThis as unknown as { prisma?: unknown }).prisma = fake;
  return fake;
}
