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

/** Valor de filtro aceito: escalar, `Date`, `null` ou operador `{ gt }` / `{ in }`. */
type Where = Record<string, unknown>;

/**
 * Operadores que o fake entende de verdade.
 *
 * Fechado de proposito: qualquer outro operador LANCA, em vez de cair no
 * `===` e devolver "nenhuma linha". Um filtro nao suportado que retorna vazio e
 * a pior falha possivel num fake — o teste fica verde afirmando que o
 * repositorio nao achou nada, quando na verdade o fake e que nao sabe procurar.
 */
const SUPPORTED_OPERATORS = ["gt", "in"] as const;

/** `true` quando o valor e um operador (`{ gt }`), nao um escalar comparavel. */
function isOperator(expected: unknown): expected is Row {
  return (
    typeof expected === "object" &&
    expected !== null &&
    !(expected instanceof Date) &&
    !Array.isArray(expected)
  );
}

function matchesValue(rowValue: unknown, expected: unknown): boolean {
  if (isOperator(expected)) {
    for (const operator of Object.keys(expected)) {
      if (!(SUPPORTED_OPERATORS as readonly string[]).includes(operator)) {
        throw new Error(
          `[fake-prisma] filtro nao suportado: { ${operator}: ... }. ` +
            `Ensine o fake antes de usa-lo no repositorio.`,
        );
      }
    }

    if ("gt" in expected) {
      const limit = (expected as { gt: unknown }).gt;
      if (rowValue == null) return false;
      return (rowValue as Date) > (limit as Date);
    }

    // `in`: pertinencia por igualdade, como o Prisma faz para escalares.
    const list = (expected as { in: unknown }).in;
    if (!Array.isArray(list)) {
      throw new Error("[fake-prisma] filtro `in` exige um array.");
    }
    return list.includes(rowValue);
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

/**
 * Projeta a linha conforme o `select` do Prisma.
 *
 * Precisa existir de verdade: o repositorio de extracao usa `select` como GATE DE
 * PII (o select base nao inclui `fields`). Um fake que devolvesse a linha inteira
 * faria o teste de "PII nao vaza" passar em falso.
 */
function project(row: Row, select?: Row): Row {
  if (!select) return row;
  const out: Row = {};
  for (const [key, wanted] of Object.entries(select)) {
    if (wanted === true) out[key] = row[key] ?? null;
  }
  return out;
}

/** Ordena por UM campo, como `orderBy: { campo: "asc" | "desc" }`. */
function sortRows(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) return rows;
  const [key, direction] = Object.entries(orderBy)[0] ?? [];
  if (!key) return rows;
  const factor = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[key] as number | Date;
    const right = b[key] as number | Date;
    if (left === right) return 0;
    return (left < right ? -1 : 1) * factor;
  });
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

  async create({ data, select }: { data: Row; select?: Row }): Promise<Row> {
    return project(this.seed(data), select);
  }

  async findFirst(args: {
    where: Where;
    include?: Row;
    select?: Row;
    orderBy?: Row;
  }): Promise<Row | null> {
    const candidatos = sortRows(
      this.rows.filter((row) => matches(row, args.where)),
      args.orderBy,
    );
    const row = candidatos[0] ?? null;
    if (!row) return null;
    if (args.include) return this.resolveInclude(row, args.include);
    return project(row, args.select);
  }

  async findUnique(args: {
    where: Where;
    include?: Row;
    select?: Row;
  }): Promise<Row | null> {
    return this.findFirst(args);
  }

  async findMany(args: { where?: Where; select?: Row; orderBy?: Row } = {}): Promise<Row[]> {
    const filtradas = args.where ? this.rows.filter((row) => matches(row, args.where!)) : this.rows;
    return sortRows(filtradas, args.orderBy).map((row) => project(row, args.select));
  }

  async update({ where, data, select }: { where: Where; data: Row; select?: Row }): Promise<Row> {
    const row = this.rows.find((candidate) => matches(candidate, where));
    if (!row) throw notFound(this.model);
    Object.assign(row, data, { updatedAt: new Date() });
    return project(row, select);
  }

  /**
   * Atualiza TODAS as linhas que casam e devolve `{ count }`.
   *
   * O `count` importa de verdade: `updateProcessDestination` usa "0 linhas
   * afetadas" para detectar processo SEM destino e abortar antes de gravar
   * trilha — um fake que devolvesse sempre 1 esconderia essa guarda.
   */
  async updateMany({ where, data }: { where: Where; data: Row }): Promise<{ count: number }> {
    const alvos = this.rows.filter((row) => matches(row, where));
    for (const row of alvos) Object.assign(row, data, { updatedAt: new Date() });
    return { count: alvos.length };
  }
}

export class FakePrisma {
  readonly process: FakeTable;
  readonly processDocument: FakeTable;
  readonly documentExtraction: FakeTable;
  readonly destination: FakeTable;
  readonly payment: FakeTable;
  readonly processStatusEvent: FakeTable;

  constructor() {
    const linkProcess = (row: Row, include: Row): Row =>
      include.process ? { ...row, process: this.findProcess(row.processId as string) } : row;

    // `findProcessByIdForUser` pede destination/firearm/processType. Sem resolver
    // aqui, o service receberia `destination: undefined` e os testes de aplicacao
    // de sugestao passariam por um caminho que nao existe em producao.
    //
    // RESOLVE, NAO INVENTA: cada relacao sai do que o teste SEMEOU — `destination`
    // da sua tabela, `firearm`/`processType` da propria linha do processo. Devolver
    // um `processType` fixo pareceria conveniente e seria a pior especie de verde
    // falso: tipo de processo governa preco e requisitos, entao um teste de outro
    // tipo passaria afirmando algo que nunca foi exercitado. Quem precisa do dado,
    // semeia; quem nao semeou, recebe `null` e descobre na hora.
    const linkProcessRelations = (row: Row, include: Row): Row => ({
      ...row,
      ...(include.destination
        ? { destination: this.destination.rows.find((d) => d.processId === row.id) ?? null }
        : {}),
      ...(include.firearm ? { firearm: row.firearm ?? null } : {}),
      ...(include.processType ? { processType: row.processType ?? null } : {}),
    });

    this.process = new FakeTable(
      "process",
      () => ({
        id: randomUUID(),
        userId: "user-dono",
        code: "GT-0001",
        operationalStatus: "RASCUNHO",
        internalStatus: "RASCUNHO",
        userFacingStatus: "RECEBIDO",
        createdAt: new Date(),
      }),
      linkProcessRelations,
    );

    this.destination = new FakeTable("destination", () => ({
      id: randomUUID(),
      eventName: "",
      uf: "",
      city: "",
      street: "",
      number: "",
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

    this.documentExtraction = new FakeTable("documentExtraction", () => ({
      id: randomUUID(),
      // Espelha o default do schema.
      state: "PENDENTE",
      fields: null,
      confidence: null,
      failureReason: null,
      extractedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewedByRole: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

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
