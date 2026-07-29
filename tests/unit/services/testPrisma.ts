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
const SUPPORTED_OPERATORS = ["gt", "lt", "in", "notIn"] as const;

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

    // `lt`: usado pelo reaper de PROCESSANDO (`updatedAt: { lt: cutoff }`).
    // `null` NAO e "menor que": ausencia de valor nao pode ser lida como antiga,
    // ou o reaper varreria linhas que nunca comecaram a processar.
    if ("lt" in expected) {
      const limit = (expected as { lt: unknown }).lt;
      if (rowValue == null) return false;
      return (rowValue as Date) < (limit as Date);
    }

    // `notIn`: complemento de `in`. Precisa de ramo PROPRIO — sem ele, cairia no
    // fallback abaixo, leria `.in` como `undefined` e lancaria "filtro `in` exige
    // um array": falha ruidosa, mas pela razao errada, e quem lesse o erro
    // procuraria o defeito no lugar errado.
    if ("notIn" in expected) {
      const excluidos = (expected as { notIn: unknown }).notIn;
      if (!Array.isArray(excluidos)) {
        throw new Error("[fake-prisma] filtro `notIn` exige um array.");
      }
      // Lista VAZIA nao exclui nada — mesma semantica do Prisma. Tratar `[]` como
      // "exclui tudo" faria a fila de enfileiramento sumir em silencio justamente
      // na primeira execucao, quando ainda nao ha nenhuma tentativa ativa.
      return !excluidos.includes(rowValue);
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

/**
 * Argumentos de topo que `findMany` entende.
 *
 * `include` e ACEITO mas NAO resolvido — mesmo comportamento de sempre. Nenhum
 * teste exercita hoje um `findMany` com relacao (so `findFirst` o faz), entao
 * resolve-lo aqui seria escrever comportamento sem cobertura. Esta anotado para
 * que ninguem assuma o contrario ao ver a chave na lista.
 */
const FIND_MANY_ARGS = ["where", "select", "orderBy", "take", "include"] as const;

/**
 * LANCA se o chamador passou um argumento que o fake nao implementa.
 *
 * Existe por um defeito real encontrado no #47D-1: `take` era ignorado em
 * silencio, e um teste de "o lote respeita o batch size" passava sem que o corte
 * jamais tivesse acontecido — o pior tipo de verde, o que afirma exatamente a
 * garantia que nao existe. Operador desconhecido ja lancava (ver
 * `SUPPORTED_OPERATORS`); argumento desconhecido nao. Agora lanca tambem.
 *
 * Ao adicionar uma chave aqui, IMPLEMENTE-A junto e cubra com teste. Incluir o
 * nome so para calar o erro recria exatamente o defeito que isto veio impedir.
 */
function assertKnownArgs(method: string, args: Row, permitidos: readonly string[]): void {
  for (const key of Object.keys(args)) {
    if (!permitidos.includes(key)) {
      throw new Error(
        `[fake-prisma] ${method}: argumento nao suportado \`${key}\`. ` +
          `Implemente-o no fake antes de usa-lo no repositorio.`,
      );
    }
  }
}

/** Erro no formato que o codigo de producao trata como falha do banco. */
function notFound(model: string): Error {
  return new Error(`[fake-prisma] ${model}: registro nao encontrado`);
}

/**
 * Projeta a linha conforme o `select` do Prisma, INCLUSIVE aninhado.
 *
 * Precisa existir de verdade: os repositorios usam `select` como GATE DE PII (o
 * select base de extracao nao inclui `fields`; o da fila de automacao nao inclui
 * `fields` nem `storageKey`). Um fake que devolvesse a linha inteira faria o
 * teste de "PII nao vaza" passar em falso.
 *
 * O aninhamento e projetado de verdade, nao repassado: `{ documents: { select:
 * { id, type } } }` devolve SO essas chaves de cada documento semeado. Repassar
 * o objeto semeado inteiro seria confortavel e destruiria a garantia — um teste
 * poderia semear `fields` num documento e ve-lo sair por um select que, em
 * producao, nunca o traria.
 */
function project(row: Row, select?: Row): Row {
  if (!select) return row;
  const out: Row = {};

  for (const [key, wanted] of Object.entries(select)) {
    if (wanted === true) {
      out[key] = row[key] ?? null;
      continue;
    }
    // Relacao: `{ select: {...}, orderBy?, take? }`. Só `select` projeta.
    if (!wanted || typeof wanted !== "object") continue;

    const nested = (wanted as { select?: Row }).select;
    if (!nested) continue;

    const value = row[key];
    if (Array.isArray(value)) {
      // ORDEM ANTES DE `take` — nesta sequencia, sempre. Os selects da fila e do
      // admin usam `orderBy: { createdAt: "desc" }, take: 1` para pegar o MAIS
      // RECENTE, e varios services leem `[0]` direto. Cortar antes de ordenar
      // devolveria o mais ANTIGO com cara de deliberado: o `take` teria sido
      // respeitado, e o teste afirmaria o oposto da producao sem quebrar.
      const { orderBy, take } = wanted as { orderBy?: Row | readonly Row[]; take?: number };
      const ordenados = sortRows(value as Row[], orderBy);
      const cortados = typeof take === "number" ? ordenados.slice(0, take) : ordenados;
      out[key] = cortados.map((item) => project(item, nested));
    } else if (value && typeof value === "object") {
      out[key] = project(value as Row, nested);
    } else {
      out[key] = null;
    }
  }
  return out;
}

/**
 * Ordena por um OU MAIS campos: `{ campo: "desc" }` ou
 * `[{ createdAt: "desc" }, { id: "desc" }]`.
 *
 * O array importa de verdade: o repositorio de extracao usa
 * `[{ createdAt: "desc" }, { id: "desc" }]` para desempatar "a mais recente"
 * quando dois `created_at` caem no mesmo milissegundo. Um fake que lesse so a
 * primeira chave deixaria o desempate sem cobertura — e ele existe exatamente
 * porque, sem desempate, a mesma pergunta podia ter duas respostas.
 */
function sortRows(rows: Row[], orderBy?: Row | readonly Row[]): Row[] {
  if (!orderBy) return rows;

  const criterios = (Array.isArray(orderBy) ? orderBy : [orderBy])
    .flatMap((criterio) => Object.entries(criterio as Row))
    .filter(([key]) => key);
  if (criterios.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const [key, direction] of criterios) {
      const left = a[key] as number | Date | string;
      const right = b[key] as number | Date | string;
      if (left === right) continue;
      // Empate no primeiro criterio cai para o proximo — igual ao Postgres.
      return (left < right ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
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
    orderBy?: Row | readonly Row[];
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

  async findMany(
    args: {
      where?: Where;
      select?: Row;
      orderBy?: Row | readonly Row[];
      take?: number;
      include?: Row;
    } = {},
  ): Promise<Row[]> {
    assertKnownArgs("findMany", args, FIND_MANY_ARGS);

    const filtradas = args.where ? this.rows.filter((row) => matches(row, args.where!)) : this.rows;
    const ordenadas = sortRows(filtradas, args.orderBy);
    // ORDENA ANTES DE CORTAR — nesta sequencia, sempre. Cortar antes de ordenar
    // devolveria linhas arbitrarias com cara de deliberado: o `take` teria sido
    // respeitado, e o teste afirmaria o oposto da producao sem quebrar. Mesmo
    // motivo do `take` aninhado em `project`.
    const cortadas = typeof args.take === "number" ? ordenadas.slice(0, args.take) : ordenadas;
    return cortadas.map((row) => project(row, args.select));
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

  /** Todas as tabelas do fake — base do snapshot de `$transaction`. */
  private tabelas(): FakeTable[] {
    return [
      this.process,
      this.processDocument,
      this.documentExtraction,
      this.destination,
      this.payment,
      this.processStatusEvent,
    ];
  }

  /**
   * `$transaction` interativa — SNAPSHOT/RESTORE, nao transacao de verdade.
   *
   * O QUE ELA FAZ: copia as linhas de TODAS as tabelas antes do callback; se ele
   * lancar, restaura as copias e repropaga o erro. Isso torna o rollback
   * OBSERVAVEL num teste unitario: da para provar que um `update` bem-sucedido
   * volta atras quando a operacao seguinte falha.
   *
   * O QUE ELA NAO FAZ — E ISTO IMPORTA:
   *
   * - **Nao simula isolamento.** Duas `$transaction` concorrentes no mesmo teste
   *   se atropelariam: a segunda tira snapshot de um estado ja sujo pela
   *   primeira. Nenhum teste faz isso hoje; se algum passar a fazer, este fake
   *   dara resposta errada com cara de certa.
   * - **Nao prova nada sobre Postgres.** Nao ha `BEGIN`/`ROLLBACK`, nao ha
   *   niveis de isolamento, nao ha deadlock, nao ha constraint diferida. O CI
   *   roda SEM banco (`.github/workflows/ci.yml`), entao a atomicidade real —
   *   aquela que depende do Prisma e do servidor — continua NAO exercitada por
   *   teste nenhum. O que se prova aqui e que o CODIGO agrupa as operacoes.
   * - **Nao aceita array de promises** (`$transaction([p1, p2])`), so o callback.
   *   A forma em array executa as promises FORA do escopo transacional que este
   *   fake entende, e aceitar as duas esconderia essa diferenca.
   *
   * `tx` e o proprio fake: as tabelas tem a mesma API, entao `tx.process.update`
   * e `getPrisma().process.update` sao literalmente o mesmo objeto. Isso e o
   * bastante para provar que chamador e repositorio usaram o MESMO client.
   */
  async $transaction<T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> {
    if (typeof fn !== "function") {
      throw new Error("FakePrisma.$transaction aceita somente a forma com callback.");
    }

    const snapshot = this.tabelas().map((tabela) => structuredClone(tabela.rows));

    try {
      return await fn(this);
    } catch (erro) {
      this.tabelas().forEach((tabela, i) => {
        // `rows` e `readonly` (nao reatribuivel), mas o CONTEUDO nao e: zerar e
        // repopular restaura sem tocar a declaracao do campo.
        tabela.rows.length = 0;
        tabela.rows.push(...snapshot[i]);
      });
      throw erro;
    }
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
