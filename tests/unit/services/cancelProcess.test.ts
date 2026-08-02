/**
 * cancelProcess — testes COMPORTAMENTAIS (sem Postgres).
 *
 * O primeiro fluxo que produz `CANCELADO_OPERACIONAL` (docs/51), preparado
 * SEM FLUXO no PR anterior. Ainda SEM UI/action (docs/51 §7, PR 6) — so o
 * service/backend.
 *
 * PERMISSAO E TESTADA AQUI, ao contrario de `reopenDocumentReview.test.ts`/
 * `approveDocumentOutOfFlow.test.ts`: aqueles confiam a checagem de RBAC a
 * server action, que este PR nao cria (nao altera `src/app`). O service
 * decide `process.cancel` sozinho — mesmo precedente de
 * `createProcessNote.ts`.
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { type InternalStatus } from "@prisma/client";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { cancelProcess, MIN_CANCEL_REASON_LENGTH } from "../../../src/server/services/cancelProcess";
import { ROLE_PERMISSIONS } from "../../../src/server/auth/permissions";
import { isOperationalStatus } from "../../../src/server/services/updateProcessOperations";

let db: FakePrisma = installFakePrisma();

const ADMIN = { id: "mock-admin", name: "Admin", email: "admin@example.com", role: "ADMIN" } as const;
const OPERADOR = {
  id: "mock-operador",
  name: "Operador",
  email: "operador@example.com",
  role: "OPERADOR",
} as const;

const PROCESS_ID = "test-cancel-process";
const MOTIVO_VALIDO = "cliente desistiu por telefone";

function semear(overrides: Record<string, unknown> = {}) {
  return db.process.seed({
    id: PROCESS_ID,
    operationalStatus: "RASCUNHO",
    internalStatus: "RASCUNHO",
    ...overrides,
  });
}

beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ---------------------------------------------------------------- guardas --- */

test("usuario sem process.cancel nao cancela", async () => {
  const processo = semear();
  const result = await cancelProcess(OPERADOR, PROCESS_ID, MOTIVO_VALIDO);

  assert.equal(result.ok, false);
  assert.equal(processo.internalStatus, "RASCUNHO", "nao pode ter mudado");
  assert.equal(db.processStatusEvent.rows.length, 0, "recusa nao grava evento");
});

test("motivo vazio e recusado antes de tocar o banco", async () => {
  const processo = semear();
  const result = await cancelProcess(ADMIN, PROCESS_ID);

  assert.equal(result.ok, false);
  assert.equal(processo.internalStatus, "RASCUNHO");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("motivo so com espacos conta como ausente", async () => {
  semear();
  const result = await cancelProcess(ADMIN, PROCESS_ID, "    ");
  assert.equal(result.ok, false);
});

test(`motivo com menos de ${MIN_CANCEL_REASON_LENGTH} caracteres e recusado`, async () => {
  semear();
  const result = await cancelProcess(ADMIN, PROCESS_ID, "curto");
  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /curto/i);
});

test("processo inexistente e recusado", async () => {
  const result = await cancelProcess(ADMIN, "nao-existe", MOTIVO_VALIDO);
  assert.equal(result.ok, false);
});

/* ---------------------------------------------------------- estados aceitos */

const ESTADOS_CANCELAVEIS: InternalStatus[] = [
  "RASCUNHO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO_EM_FILA",
  "DOCUMENTO_RECEBIDO_PARA_ANALISE",
  "DOCUMENTO_VALIDADO",
  "BLOQUEADO_OPERACIONAL",
];

for (const internalStatus of ESTADOS_CANCELAVEIS) {
  test(`${internalStatus}: pode ser cancelado (vira CANCELADO_OPERACIONAL)`, async () => {
    const processo = semear({ internalStatus, operationalStatus: "RASCUNHO" });
    const result = await cancelProcess(ADMIN, PROCESS_ID, MOTIVO_VALIDO);

    assert.deepEqual(result, { ok: true });
    assert.equal(processo.internalStatus, "CANCELADO_OPERACIONAL");
  });
}

/* -------------------------------------------------------- estados bloqueados */

const ESTADOS_BLOQUEADOS: InternalStatus[] = [
  "AGUARDANDO_LOGIN_GOVBR",
  "SESSAO_GOVBR_EXPIRADA",
  "EM_PREENCHIMENTO_SINARM",
  "EM_REVISAO_HUMANA",
  "BLOQUEADO_INSTABILIDADE",
  "EXCECAO_DOC_INVALIDO",
  "EXCECAO_ARMA_DIVERGENTE",
  "EXCECAO_DESTINO_INCOMPLETO",
  "PROTOCOLADO_GRU_GERADA",
  "GRU_PAGA_EMPRESA",
  "CONCLUIDO",
  "CANCELADO_REEMBOLSADO",
  "CANCELADO_OPERACIONAL",
  "AGUARDANDO_CONFIRMACAO_HUMANA",
  "AGUARDANDO_CAPTCHA",
];

for (const internalStatus of ESTADOS_BLOQUEADOS) {
  test(`${internalStatus}: NAO pode ser cancelado neste PR`, async () => {
    const processo = semear({ internalStatus, operationalStatus: "RASCUNHO" });
    const result = await cancelProcess(ADMIN, PROCESS_ID, MOTIVO_VALIDO);

    assert.equal(result.ok, false, internalStatus);
    assert.equal(processo.internalStatus, internalStatus, "nao pode ter mudado");
    assert.equal(db.processStatusEvent.rows.length, 0, `${internalStatus} nao deveria gravar evento`);
  });
}

test("a allowlist cobre TODOS os 21 valores de InternalStatus, sem lacuna silenciosa", () => {
  // Os dois arrays acima (cancelaveis + bloqueados) juntos precisam ser
  // EXATAMENTE o enum inteiro — se um valor novo aparecer no schema sem
  // classificacao aqui, este teste (nao so o typecheck do service) acusa.
  const cobertos = [...ESTADOS_CANCELAVEIS, ...ESTADOS_BLOQUEADOS].sort();
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const bloco = /enum InternalStatus \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(bloco, "enum InternalStatus nao encontrado em prisma/schema.prisma");
  const doSchema = bloco![1]
    .split("\n")
    .map((line) => line.replace(/\/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line))
    .sort();
  assert.deepEqual(cobertos, doSchema);
});

/* ------------------------------------------- CANCELADO_DEV (docs/51 regra 6) */

test("CANCELADO_DEV (operationalStatus) nunca e tratado como cancelamento real, mesmo com internalStatus cancelavel", async () => {
  const processo = semear({ internalStatus: "RASCUNHO", operationalStatus: "CANCELADO_DEV" });
  const result = await cancelProcess(ADMIN, PROCESS_ID, MOTIVO_VALIDO);

  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /desenvolvimento/i);
  assert.equal(processo.internalStatus, "RASCUNHO", "nao pode ter mudado");
  assert.equal(processo.operationalStatus, "CANCELADO_DEV");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

/* --------------------------------------------------------- lado do PROCESSO */

test("internalStatus vira CANCELADO_OPERACIONAL pela porta canonica", async () => {
  const processo = semear();
  await cancelProcess(ADMIN, PROCESS_ID, MOTIVO_VALIDO);
  assert.equal(processo.internalStatus, "CANCELADO_OPERACIONAL");
});

test("operationalStatus NAO e alterado — nao ha alsoSet, divergencia e intencional (docs/51)", async () => {
  const processo = semear({ operationalStatus: "PAGO_EM_FILA", internalStatus: "PAGO_EM_FILA" });
  await cancelProcess(ADMIN, PROCESS_ID, MOTIVO_VALIDO);
  assert.equal(processo.internalStatus, "CANCELADO_OPERACIONAL");
  assert.equal(processo.operationalStatus, "PAGO_EM_FILA", "operationalStatus fica como estava");
});

test("registra EXATAMENTE um evento TIPADO com fromStatus/toStatus e o motivo aparado", async () => {
  semear();
  await cancelProcess(ADMIN, PROCESS_ID, `  ${MOTIVO_VALIDO}  `);

  assert.equal(db.processStatusEvent.rows.length, 1, "so um evento por cancelamento");
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.fromStatus, "RASCUNHO", "lido do banco, nao suposto");
  assert.equal(evento.toStatus, "CANCELADO_OPERACIONAL");
  assert.equal(evento.actorMockUserId, ADMIN.id);
  assert.equal(evento.actorRole, ADMIN.role);
  assert.match(String(evento.note), new RegExp(MOTIVO_VALIDO));
  assert.doesNotMatch(String(evento.note), /\s{2,}/, "motivo entra aparado, sem espacos duplicados");
});

/* --------------------------------------------------- estrutura/RBAC/escopo --- */

test("process.cancel NAO e concedida a OPERADOR/FINANCEIRO/SUPORTE/USER, so ADMIN", () => {
  assert.ok(ROLE_PERMISSIONS.ADMIN.includes("process.cancel"));
  for (const role of ["OPERADOR", "FINANCEIRO", "SUPORTE", "USER"] as const) {
    assert.ok(!ROLE_PERMISSIONS[role].includes("process.cancel"), role);
  }
});

test("o service usa a porta canonica, sem alsoSet, e nunca toca documentos/pagamentos/storage", () => {
  const source = readFileSync("src/server/services/cancelProcess.ts", "utf8");
  assert.match(source, /transitionInternalStatus\s*\(/);
  assert.match(source, /toStatus:\s*"CANCELADO_OPERACIONAL"/);
  assert.doesNotMatch(
    source,
    /alsoSet\s*:/,
    "nao deveria escrever operationalStatus por projecao automatica",
  );
  assert.doesNotMatch(source, /updateProcessOperations\s*\(/);
  for (const proibido of [/processDocumentRepository/, /paymentRepository/, /storageAdapter|storage\/adapter/i]) {
    assert.doesNotMatch(source, proibido, `service nao deveria importar/tocar: ${proibido}`);
  }
});

test("CANCELADO_OPERACIONAL nao e OperationalStatus — updateProcessOperations nunca o aceitaria por definicao de tipo", () => {
  // Confirma o limite entre os dois enums: a acao desta PR escreve
  // InternalStatus; a porta manual (updateProcessOperations) so aceita
  // OperationalStatus, que nunca teve nem ganhou este valor.
  assert.equal(isOperationalStatus("CANCELADO_OPERACIONAL"), false);
});
