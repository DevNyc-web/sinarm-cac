/**
 * Fake do Prisma para testes de SERVICE — instalado via `globalThis`.
 *
 * COMO FUNCIONA: `getPrisma()` (src/server/db/prisma.ts) so constroi um
 * `PrismaClient` se `globalThis.prisma` estiver vazio. Preenchendo essa
 * propriedade ANTES de exercitar o service, todo acesso a banco cai aqui e
 * nenhum cliente real chega a ser instanciado — sem conexao, sem Postgres,
 * sem variavel de ambiente de banco valida.
 *
 * LIMITE HONESTO (mesmo do `authenticate.test.ts`): isto prova a POLITICA e a
 * LOGICA do service — ordem das chamadas, regras de guarda, dados gravados.
 * NAO prova o comportamento do Postgres: unique de `webhookEventId`, cascade,
 * transacao e concorrencia continuam sem cobertura em CI, que roda sem banco
 * por decisao registrada em `.github/workflows/ci.yml`.
 *
 * O fake e DELIBERADAMENTE burro: guarda linhas em array e compara campos. Nao
 * simula o query engine. Se um repositorio passar a usar um filtro que ele nao
 * entende, o teste quebra — e e isso mesmo que se quer, em vez de um falso verde.
 */
import { randomUUID } from "node:crypto";

export type Row = Record<string, unknown>;

/** Valor de filtro aceito: escalar, `null` ou operador `{ gt }`. */
type Where = Record<string, unknown>;

function matchesValue(rowValue: unknown, expected: unknown): boolean {
  if (expected !== null && typeof expected === "object" && "gt" in (expected as Row)) {
    const limit = (expected as { gt: unknown }).gt;
    if (rowValue == null) return false;
    return (rowValue as Date) > (limit as Date);
  }
  return rowValue === expected;
}

function matches(row: Row, where: Where): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (key === "OR") {
      const alternativas = expected as Where[];
      if (!alternativas.some((alt) => matches(row, alt))) return false;
      continue;
    }
    if (!matchesValue(row[key], expected)) return false;
  }
  return true;
}

/** Erro no formato que o codigo de producao trata como falha do banco. */
function notFound(model: string): Error {
  return new Error(`[fake-prisma] ${model}: registro nao encontrado`);
}

class FakeTable {
  readonly rows: Row[] = [];

  constructor(
    private readonly model: string,
    private readonly defaults: () => Row,
    /** Resolve relacoes pedidas via `include`. */
    private readonly resolveInclude: (row: Row, include: Row) => Row = (row) => row,
  ) {}

  seed(row: Row): Row {
    const full = { ...this.defaults(), ...row };
    this.rows.push(full);
    return full;
  }

  async create({ data }: { data: Row }): Promise<Row> {
    return this.seed(data);
  }

  async findFirst(args: { where: Where; include?: Row }): Promise<Row | null> {
    const row = this.rows.find((candidate) => matches(candidate, args.where)) ?? null;
    return row && args.include ? this.resolveInclude(row, args.include) : row;
  }

  async findUnique(args: { where: Where; include?: Row }): Promise<Row | null> {
    return this.findFirst(args);
  }

  async findMany(args: { where?: Where } = {}): Promise<Row[]> {
    return args.where ? this.rows.filter((row) => matches(row, args.where!)) : [...this.rows];
  }

  async update({ where, data }: { where: Where; data: Row }): Promise<Row> {
    const row = this.rows.find((candidate) => matches(candidate, where));
    if (!row) throw notFound(this.model);
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}

export class FakePrisma {
  readonly process: FakeTable;
  readonly processDocument: FakeTable;
  readonly payment: FakeTable;
  readonly processStatusEvent: FakeTable;

  constructor() {
    const linkProcess = (row: Row, include: Row): Row =>
      include.process ? { ...row, process: this.findProcess(row.processId as string) } : row;

    this.process = new FakeTable("process", () => ({
      id: randomUUID(),
      userId: "user-dono",
      code: "GT-0001",
      operationalStatus: "RASCUNHO",
      internalStatus: "RASCUNHO",
      userFacingStatus: "RECEBIDO",
      createdAt: new Date(),
    }));

    this.processDocument = new FakeTable(
      "processDocument",
      () => ({
        id: randomUUID(),
        // Espelha o default do schema: a conferencia continua sendo humana.
        status: "ENVIADO",
        reviewedByMockUserId: null,
        reviewedByRole: null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: new Date(),
      }),
      linkProcess,
    );

    this.payment = new FakeTable(
      "payment",
      () => ({
        id: randomUUID(),
        status: "PENDENTE",
        currency: "BRL",
        providerPaymentId: null,
        pixQrCode: null,
        pixCopyPaste: null,
        expiresAt: null,
        paidAt: null,
        webhookEventId: null,
        createdAt: new Date(),
      }),
      linkProcess,
    );

    this.processStatusEvent = new FakeTable("processStatusEvent", () => ({
      id: randomUUID(),
      note: null,
      createdAt: new Date(),
    }));
  }

  findProcess(id: string): Row | undefined {
    return this.process.rows.find((row) => row.id === id);
  }
}

/**
 * Instala o fake em `globalThis.prisma` e devolve a instancia.
 *
 * Chamar no TOPO do arquivo de teste, antes de qualquer caminho que use
 * `getPrisma()`. O Node roda cada arquivo de teste em processo proprio, entao
 * nao ha vazamento entre arquivos; dentro do arquivo, chame de novo para zerar.
 */
export function installFakePrisma(): FakePrisma {
  const fake = new FakePrisma();
  (globalThis as unknown as { prisma?: unknown }).prisma = fake;
  return fake;
}

/** `true` se nada instalou um cliente real por engano. */
export function prismaIsFake(): boolean {
  return (globalThis as unknown as { prisma?: unknown }).prisma instanceof FakePrisma;
}
