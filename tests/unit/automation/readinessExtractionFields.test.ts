/**
 * Prontidao lendo extracao PERSISTIDA (PR #47C-2) — testes comportamentais.
 *
 * A regra que este PR implementa: PERMISSAO GOVERNA DIVULGACAO, NAO COMPUTACAO.
 * A fila le `DocumentExtraction.fields` para DECIDIR, e o que sai e uma contagem
 * de bloqueios. Os testes de PII abaixo sao o que torna isso seguro: se um campo
 * extraido algum dia alcancar o DTO, o payload ou o log, eles quebram.
 *
 * Banco: fake via `globalThis.prisma`. Sem Postgres, OCR, worker ou rede.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma, type Row } from "../services/testPrisma";
import { loadReadinessExtractionFields } from "../../../src/server/automation/readinessExtractionFields";
import { getAutomationQueue } from "../../../src/server/services/getAutomationQueue";
import {
  EXTRACTION_REJECT_REASONS,
  inspectExtractionFields,
  usableExtractionFields,
} from "../../../src/server/documents/documentExtractionFields";
import { logger } from "../../../src/lib/logger";

let db: FakePrisma = installFakePrisma();

const PROC = "proc-1";
const DOC = "doc-destino";

/** Valor persistido distinto do mock — se aparecer, veio do banco. */
const VALOR_PERSISTIDO = "Clube Persistido (banco)";

const CAMPOS_PERSISTIDOS = [
  {
    key: "nomeLocalEvento",
    label: "Nome do local / evento",
    value: VALOR_PERSISTIDO,
    confidence: "ALTA",
  },
];

/** Captura o que o logger emite, sem deixar sair para o stdout do teste. */
function capturarLogs(): { eventos: unknown[]; restaurar: () => void } {
  const eventos: unknown[] = [];
  const original = logger.warn.bind(logger);
  (logger as { warn: typeof original }).warn = ((obj: unknown, msg?: string) => {
    eventos.push(obj);
    return undefined;
  }) as typeof original;
  return { eventos, restaurar: () => ((logger as { warn: typeof original }).warn = original) };
}

function seedProcessoComDocumento() {
  db = installFakePrisma();
  db.process.seed({
    id: PROC,
    userId: "user-dono",
    code: "GT-0001",
    processType: { code: "GUIA_TRAFEGO" },
    destination: {
      eventName: "Clube Atual (exemplo)",
      uf: "SP",
      city: "São Paulo",
      street: "Rua Exemplo",
      number: "10",
    },
    firearm: { id: "firearm-1" },
    documents: [
      {
        id: DOC,
        type: "DECLARACAO_DESTINO_EVENTO",
        status: "APROVADO",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
    ],
    payments: [{ status: "PAGO" }],
    statusEvents: [],
  });
  db.processDocument.seed({ id: DOC, processId: PROC, type: "DECLARACAO_DESTINO_EVENTO" });
}

function seedExtracao(over: Record<string, unknown> = {}) {
  return db.documentExtraction.seed({
    documentId: DOC,
    state: "EXTRAIDA",
    engine: "mock",
    engineVersion: "0.1.0-mock",
    fields: CAMPOS_PERSISTIDOS,
    createdAt: new Date(),
    ...over,
  });
}

beforeEach(seedProcessoComDocumento);

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ----------------------------------------------------- fonte persistida --- */

test("a prontidao USA o persistido quando existe", async () => {
  seedExtracao();
  const mapa = await loadReadinessExtractionFields([DOC]);

  assert.equal(mapa.get(DOC)?.[0].value, VALOR_PERSISTIDO);
});

test("persistido SUBSTITUI o mock na decisao da fila", async () => {
  // O mock de DECLARACAO_DESTINO_EVENTO traz "Clube de Exemplo (fictício)", que
  // DIFERE do destino atual => sugestao aplicavel => um bloqueio a mais.
  const [comMock] = await getAutomationQueue();

  // Persistido IGUAL ao destino atual => `isNoOpSuggestion` => sugestao some.
  // Comparar a CONTAGEM isola o efeito da troca de fonte dos demais bloqueios
  // do processo (documentos faltando etc.), que sao os mesmos nos dois casos.
  seedProcessoComDocumento();
  seedExtracao({
    fields: [
      {
        key: "nomeLocalEvento",
        label: "Nome do local / evento",
        value: "Clube Atual (exemplo)",
        confidence: "ALTA",
      },
    ],
  });
  const [comPersistido] = await getAutomationQueue();

  assert.equal(
    comPersistido.blockerCount,
    comMock.blockerCount - 1,
    "a fonte persistida tem de mudar o veredito da prontidao, nao so a tela",
  );
});

test("mapa vazio preserva o comportamento anterior ao #47C-2", async () => {
  const semLinha = await getAutomationQueue();

  seedProcessoComDocumento();
  seedExtracao({ state: "PENDENTE" });
  const comLinhaInutil = await getAutomationQueue();

  assert.deepEqual(comLinhaInutil, semLinha, "estado nao utilizavel = como se nao houvesse linha");
});

test("PENDENTE, PROCESSANDO e FALHOU caem no fallback", async () => {
  for (const state of ["PENDENTE", "PROCESSANDO", "FALHOU"]) {
    seedProcessoComDocumento();
    seedExtracao({ state });

    const mapa = await loadReadinessExtractionFields([DOC]);
    assert.ok(!mapa.has(DOC), `${state} nao pode entregar campos`);
  }
});

test("JSON invalido cai no fallback, sem lancar", async () => {
  for (const lixo of ["texto", 42, {}, [], [null], [{ key: "x" }]]) {
    seedProcessoComDocumento();
    seedExtracao({ fields: lixo });

    const mapa = await loadReadinessExtractionFields([DOC]);
    assert.ok(!mapa.has(DOC), `${JSON.stringify(lixo)} nao pode entrar no mapa`);
  }
});

test("banco fora do ar cai no fallback — a fila continua respondendo", async () => {
  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  (db.documentExtraction as { findMany: typeof original }).findMany = async () => {
    throw new Error("conexao recusada");
  };

  try {
    const mapa = await loadReadinessExtractionFields([DOC]);
    assert.equal(mapa.size, 0);
  } finally {
    (db.documentExtraction as { findMany: typeof original }).findMany = original;
  }
});

test("lista vazia nao consulta o banco", async () => {
  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  let chamadas = 0;
  (db.documentExtraction as { findMany: typeof original }).findMany = async (args) => {
    chamadas += 1;
    return original(args);
  };

  try {
    assert.equal((await loadReadinessExtractionFields([])).size, 0);
  } finally {
    (db.documentExtraction as { findMany: typeof original }).findMany = original;
  }
  assert.equal(chamadas, 0);
});

/* ------------------------------------------------------------- N+1 --- */

test("a fila faz UMA leitura de extracao em lote, nao uma por processo", async () => {
  for (const n of [2, 3]) {
    db.process.seed({
      id: `proc-extra-${n}`,
      userId: "user-dono",
      code: `GT-000${n}`,
      processType: { code: "GUIA_TRAFEGO" },
      destination: null,
      firearm: null,
      documents: [
        {
          id: `doc-${n}`,
          type: "IDENTIFICACAO_PESSOAL",
          status: "APROVADO",
          createdAt: new Date(),
        },
      ],
      payments: [],
      statusEvents: [],
    });
  }

  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  let chamadas = 0;
  (db.documentExtraction as { findMany: typeof original }).findMany = async (args) => {
    chamadas += 1;
    return original(args);
  };

  try {
    const rows = await getAutomationQueue();
    assert.equal(rows.length, 3, "controle: tres processos na fila");
  } finally {
    (db.documentExtraction as { findMany: typeof original }).findMany = original;
  }

  assert.equal(chamadas, 1, "uma query para a fila inteira — N+1 aqui cresce com o negocio");
});

/* --------------------------------------------- observabilidade sem PII --- */

test("rejeicao emite reasonCode correto para cada causa", async () => {
  const casos: ReadonlyArray<[Record<string, unknown>, string]> = [
    [{ state: "PENDENTE" }, "ESTADO_NAO_UTILIZAVEL"],
    [{ fields: "nao e array" }, "JSON_INVALIDO"],
    [{ fields: [] }, "LISTA_VAZIA"],
    [{ fields: [{ key: "x", label: "X", value: "v", confidence: "TALVEZ" }] }, "CAMPO_INVALIDO"],
  ];

  for (const [over, esperado] of casos) {
    seedProcessoComDocumento();
    seedExtracao(over);

    const captura = capturarLogs();
    try {
      await loadReadinessExtractionFields([DOC]);
    } finally {
      captura.restaurar();
    }

    assert.equal(captura.eventos.length, 1, `${esperado}: um evento`);
    const evento = captura.eventos[0] as Record<string, unknown>;
    assert.equal(evento.event, "extraction_fields_rejected");
    assert.equal(evento.reasonCode, esperado);
    assert.equal(evento.documentId, DOC);
  }
});

test("todo reason code emitido pertence ao conjunto fechado", async () => {
  seedExtracao({ fields: "lixo" });

  const captura = capturarLogs();
  try {
    await loadReadinessExtractionFields([DOC]);
  } finally {
    captura.restaurar();
  }

  const evento = captura.eventos[0] as Record<string, unknown>;
  assert.ok(
    (EXTRACTION_REJECT_REASONS as readonly string[]).includes(String(evento.reasonCode)),
    "motivo tem de ser codigo fechado, nunca texto livre",
  );
});

test("SUCESSO nao emite log — sem ruido", async () => {
  seedExtracao();

  const captura = capturarLogs();
  try {
    await loadReadinessExtractionFields([DOC]);
  } finally {
    captura.restaurar();
  }

  assert.deepEqual(captura.eventos, []);
});

test("o log NAO carrega PII nem conteudo do documento", async () => {
  seedProcessoComDocumento();
  // Campo com valor real E chave invalida: o evento tem de sair sem o valor.
  seedExtracao({
    fields: [
      { key: "nome", label: "Nome", value: "MARIA DA SILVA 123.456.789-00", confidence: "NAO" },
    ],
  });

  const captura = capturarLogs();
  try {
    await loadReadinessExtractionFields([DOC]);
  } finally {
    captura.restaurar();
  }

  // Chaves fechadas: e a garantia forte. `fields` nao entra na varredura por
  // substring porque o PROPRIO nome do evento e "extraction_fields_rejected" —
  // o que importa e que nenhuma CHAVE de campo extraido exista.
  assert.deepEqual(Object.keys(captura.eventos[0] as object).sort(), [
    "documentId",
    "event",
    "reasonCode",
  ]);

  // E nenhum VALOR carrega conteudo do documento.
  const valores = JSON.stringify(Object.values(captura.eventos[0] as object));
  for (const proibido of ["MARIA", "123.456", "ALTA", "BAIXA", "Nome"]) {
    assert.ok(!valores.includes(proibido), `log nao pode conter ${proibido}: ${valores}`);
  }
});

/* ---------------------------------------------------- PII: DTO e payload --- */

const CHAVES_QUEUE_ROW = [
  "blockerCount",
  "category",
  "code",
  "id",
  "mainBlockerLabel",
  "ownerLabel",
  "ready",
  "status",
  "submitted",
];

test("AutomationQueueRow tem chaves FECHADAS — campo novo e decisao de PII", async () => {
  seedExtracao();
  const [row] = await getAutomationQueue();

  assert.deepEqual(
    Object.keys(row).sort(),
    CHAVES_QUEUE_ROW,
    "acrescentar chave aqui exige decidir se ela pode ser divulgada",
  );
});

test("a serializacao da fila NAO contem campo extraido", async () => {
  seedExtracao();
  const serializado = JSON.stringify(await getAutomationQueue());

  for (const proibido of [
    VALOR_PERSISTIDO,
    "nomeLocalEvento",
    "confidence",
    "storageKey",
    "rawOcrText",
    "fields",
  ]) {
    assert.ok(!serializado.includes(proibido), `payload da fila nao pode conter ${proibido}`);
  }
});

test("nenhum componente de automacao recebe campo extraido", () => {
  const arquivos = readdirSync("src/components/automation", { withFileTypes: true })
    .filter((e) => /\.tsx?$/.test(e.name))
    .map((e) => `src/components/automation/${e.name}`);

  for (const arquivo of arquivos) {
    const code = readFileSync(arquivo, "utf8");
    assert.doesNotMatch(
      code,
      /loadReadinessExtractionFields|loadOwnerExtractionFields|extractionFields|documentExtractionRepository/,
      `${arquivo}: campos extraidos sao insumo de servidor, nao prop de UI`,
    );
  }
});

/* -------------------------------------------------- invariantes de regra --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const LOADER = "src/server/automation/readinessExtractionFields.ts";

test("a prontidao NAO PODE depender de quem olha", () => {
  // A garantia mais forte possivel: nao e que nao dependa — e que nao tenha como.
  // Nem a fila nem o loader recebem actor/role/permissao.
  assert.equal(getAutomationQueue.length, 0, "getAutomationQueue nao recebe actor");
  assert.equal(loadReadinessExtractionFields.length, 1, "o loader so recebe ids");

  for (const arquivo of [LOADER, "src/server/services/getAutomationQueue.ts"]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(
      code,
      /hasPermission|roleHasPermission|requirePermission|AuthUser|actor/,
      `${arquivo}: prontidao e fato sobre o processo, nao sobre o perfil`,
    );
  }
});

test("snapshotFromRow continua PURO", () => {
  const code = codeOnly(readFileSync("src/server/automation/automationReadinessInput.ts", "utf8"));

  assert.doesNotMatch(code, /getPrisma|Repository|loadReadiness|loadOwner/, "nao busca nada");
  assert.doesNotMatch(code, /\b(async|await)\b/, "continua sincrono");
});

test("o select de prontidao traz id e NAO traz fields nem storageKey", () => {
  // Só os selects de prontidao (fila e gate), que sao os que trazem `id`.
  // `listAdminQueue` tem outro select de documentos e NAO foi tocado por este PR.
  const code = codeOnly(readFileSync("src/server/repositories/processRepository.ts", "utf8"));
  const selects = (code.match(/documents: \{ select: \{[^}]*\}/g) ?? []).filter((s) =>
    s.includes("id: true"),
  );

  assert.equal(selects.length, 2, "fila e gate");
  for (const select of selects) {
    assert.doesNotMatch(select, /fields|storageKey|sha256|originalFileName/, "sem PII no select");
  }
});

test("o loader de readiness nao cria, nao executa e nao grava extracao", () => {
  const code = codeOnly(readFileSync(LOADER, "utf8"));

  assert.doesNotMatch(code, /requestDocumentExtraction|runDocumentExtraction/, "nao executa");
  assert.doesNotMatch(code, /getExtractionEngine|mockExtractionEngine/, "nao chama engine");
  assert.doesNotMatch(code, /createPendingExtraction|updateExtractionState/, "nao grava");
  assert.doesNotMatch(code, /loadOwnerExtractionFields/, "nao reusa o loader do dono");
});

test("a leitura de prontidao nao faz rede, OCR real, Gov.br/SINARM nem Fase 9", () => {
  for (const arquivo of [
    LOADER,
    "src/server/services/getAutomationQueue.ts",
    "src/server/services/submitToAutomationQueue.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, `${arquivo}: sem rede`);
    assert.doesNotMatch(
      code,
      /\b(tesseract|openai|anthropic|textract|rekognition)/i,
      `${arquivo}: sem OCR/IA`,
    );
    assert.doesNotMatch(code, /gov\.?br|sinarm/i, `${arquivo}: sem Gov.br/SINARM`);
    assert.doesNotMatch(code, /phase9|PHASE9/i, `${arquivo}: sem Fase 9`);
    assert.doesNotMatch(code, /storageKey|getStorageAdapter/, `${arquivo}: sem storage`);
  }
});

/* --------------------------- fake: select aninhado, ordem antes de take --- */

/**
 * A prontidao so pode ser testada porque o fake projeta `select` ANINHADO. Estes
 * testes travam as duas propriedades que fazem essa projecao ser honesta: ela
 * ordena antes de cortar, e nao deixa passar nada que o `select` nao pediu.
 *
 * A ordem importa de verdade: `processRepository` usa `orderBy: { createdAt:
 * "desc" }, take: 1` para pegar o MAIS RECENTE, e varios services leem `[0]`.
 * Um fake que cortasse antes de ordenar devolveria o mais ANTIGO — com o `take`
 * respeitado, parecendo deliberado.
 */
const ANTIGO = new Date("2026-01-01T10:00:00Z");
const RECENTE = new Date("2026-06-01T10:00:00Z");

/** Semeado do MAIS ANTIGO para o mais recente: sem ordenar, `[0]` erra. */
function seedProcessoComPagamentos() {
  db = installFakePrisma();
  db.process.seed({
    id: "proc-ordem",
    payments: [
      { status: "PENDENTE", createdAt: ANTIGO },
      { status: "EXPIRADO", createdAt: RECENTE },
    ],
  });
}

test("select aninhado com orderBy desc + take 1 devolve o MAIS RECENTE", async () => {
  seedProcessoComPagamentos();

  const row = await db.process.findFirst({
    where: { id: "proc-ordem" },
    select: {
      payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  assert.deepEqual(row?.payments, [{ status: "EXPIRADO" }], "cortar antes de ordenar daria PENDENTE");
});

test("select aninhado com orderBy asc + take 1 devolve o MAIS ANTIGO", async () => {
  seedProcessoComPagamentos();

  const row = await db.process.findFirst({
    where: { id: "proc-ordem" },
    select: {
      payments: { select: { status: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  assert.deepEqual(row?.payments, [{ status: "PENDENTE" }]);
});

test("sem orderBy, a ordem de semeadura e preservada", async () => {
  seedProcessoComPagamentos();

  const row = await db.process.findFirst({
    where: { id: "proc-ordem" },
    select: { payments: { select: { status: true } } },
  });

  assert.deepEqual(row?.payments, [{ status: "PENDENTE" }, { status: "EXPIRADO" }]);
});

test("orderBy aninhado vale para qualquer relacao — documentos e eventos", async () => {
  db = installFakePrisma();
  db.process.seed({
    id: "proc-ordem",
    documents: [
      { status: "PENDENTE", createdAt: ANTIGO },
      { status: "APROVADO", createdAt: RECENTE },
    ],
    statusEvents: [
      { toValue: "antigo", createdAt: ANTIGO },
      { toValue: "recente", createdAt: RECENTE },
    ],
  });

  const row = await db.process.findFirst({
    where: { id: "proc-ordem" },
    select: {
      documents: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      statusEvents: { select: { toValue: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  assert.deepEqual(row?.documents, [{ status: "APROVADO" }]);
  assert.deepEqual(row?.statusEvents, [{ toValue: "recente" }]);
});

test("select aninhado NAO deixa vazar o que nao foi pedido", async () => {
  db = installFakePrisma();
  db.process.seed({
    id: "proc-vazamento",
    documents: [
      {
        id: "d1",
        type: "IDENTIFICACAO_PESSOAL",
        status: "APROVADO",
        createdAt: ANTIGO,
        // Semeados de proposito: o select abaixo NAO os pede.
        fields: [{ key: "cpf", label: "CPF", value: "000.000.000-00", confidence: "ALTA" }],
        storageKey: "processos/proc/d1.pdf",
        sha256: "abc123",
      },
    ],
  });

  const row = await db.process.findFirst({
    where: { id: "proc-vazamento" },
    select: { documents: { select: { id: true, status: true } } },
  });

  const documento = (row?.documents as Row[])[0];
  assert.deepEqual(Object.keys(documento).sort(), ["id", "status"]);

  const serializado = JSON.stringify(row);
  for (const proibido of ["cpf", "000.000", "storageKey", "sha256", "fields"]) {
    assert.ok(!serializado.includes(proibido), `select aninhado vazou ${proibido}`);
  }
});

/* ------------------------------------------ guard: wrapper sem mudanca --- */

test("usableExtractionFields continua com o MESMO comportamento", () => {
  // O caminho do dono nao pode ter mudado: `inspectExtractionFields` e aditivo.
  const validos = [{ key: "nome", label: "Nome", value: "X", confidence: "ALTA" }];

  assert.deepEqual(usableExtractionFields("EXTRAIDA", validos), validos);
  assert.equal(usableExtractionFields("PENDENTE", validos), null);
  assert.equal(usableExtractionFields("EXTRAIDA", "lixo"), null);
  assert.equal(usableExtractionFields("EXTRAIDA", []), null);
});

test("inspect e usable concordam sempre", () => {
  const casos: Array<[string, unknown]> = [
    ["EXTRAIDA", [{ key: "n", label: "N", value: "v", confidence: "ALTA" }]],
    ["CONFIRMADA", [{ key: "n", label: "N", value: "v", confidence: "BAIXA" }]],
    ["PENDENTE", [{ key: "n", label: "N", value: "v", confidence: "ALTA" }]],
    ["FALHOU", null],
    ["EXTRAIDA", []],
    ["EXTRAIDA", "texto"],
    ["EXTRAIDA", [{ key: "n" }]],
  ];

  for (const [state, raw] of casos) {
    const inspection = inspectExtractionFields(state, raw);
    const usable = usableExtractionFields(state, raw);
    assert.equal(
      inspection.ok,
      usable !== null,
      `divergencia em ${state}/${JSON.stringify(raw)} — a regra tem de ser uma so`,
    );
  }
});
