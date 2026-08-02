/**
 * `operationalStatusProjection.ts` — Fase 5h: projecao PARCIAL e segura
 * `internalStatus` -> `operationalStatus`, extraida de `statusDivergence.ts`
 * (Fase 5c) para virar conhecimento reutilizavel.
 *
 * Estes testes cobrem tres coisas:
 *  (1) os 6 pares canonicos, um a um;
 *  (2) as duas classificacoes de `OperationalStatus` (so-operacional / alvo
 *      legado com nome diferente), inclusive que `CANCELADO_DEV` nunca vira
 *      par canonico;
 *  (3) equivalencia com `statusDivergence.ts` — mesma classificacao, nenhuma
 *      divergencia entre os dois modulos.
 *
 * O que este arquivo NAO faz: nao testa `needs_decision`/`invalid_projection`
 * nem os 12 InternalStatus avancados — esses continuam sendo assunto exclusivo
 * de `statusDivergence.test.ts`, porque a projecao aqui e PARCIAL de proposito
 * (so os 6 pares seguros + os 3 valores so-operacionais).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type InternalStatus, type OperationalStatus } from "@prisma/client";
import {
  CANONICAL_OPERATIONAL_PROJECTION,
  hasCanonicalProjection,
  isCoherentPair,
  isLegacyExpectedOperationalStatus,
  isOperationalOnlyStatus,
  LEGACY_EXPECTED_OPERATIONAL_STATUSES,
  OPERATIONAL_ONLY_STATUSES,
  projectOperationalStatus,
} from "../../../src/server/processes/operationalStatusProjection";
import { diagnoseStatusDivergence } from "../../../src/server/processes/statusDivergence";

const MODULE_PATH = "src/server/processes/operationalStatusProjection.ts";
const MODULE_SOURCE = readFileSync(MODULE_PATH, "utf8");

/* --------------------------------------------------- 1. os 6 pares canonicos */

const CANONICAL_PAIRS: [InternalStatus, OperationalStatus][] = [
  ["RASCUNHO", "RASCUNHO"],
  ["AGUARDANDO_PAGAMENTO", "AGUARDANDO_PAGAMENTO"],
  ["PAGO_EM_FILA", "PAGO_EM_FILA"],
  ["DOCUMENTO_RECEBIDO_PARA_ANALISE", "DOCUMENTO_ENVIADO"],
  ["DOCUMENTO_VALIDADO", "DOCUMENTO_APROVADO"],
  ["BLOQUEADO_OPERACIONAL", "BLOQUEADO"],
];

test("projectOperationalStatus devolve o operationalStatus esperado para os 6 pares canonicos", () => {
  for (const [internalStatus, expected] of CANONICAL_PAIRS) {
    assert.equal(projectOperationalStatus(internalStatus), expected, internalStatus);
  }
});

test("hasCanonicalProjection e true so para os 6 internalStatus canonicos", () => {
  for (const [internalStatus] of CANONICAL_PAIRS) {
    assert.ok(hasCanonicalProjection(internalStatus), internalStatus);
  }
  for (const internalStatus of [
    "EM_REVISAO_HUMANA",
    "CONCLUIDO",
    "AGUARDANDO_CONFIRMACAO_HUMANA",
  ] as const) {
    assert.ok(!hasCanonicalProjection(internalStatus), internalStatus);
  }
});

test("isCoherentPair e true so para o par EXATO, nunca para mismatch entre valores conhecidos", () => {
  for (const [internalStatus, operationalStatus] of CANONICAL_PAIRS) {
    assert.ok(isCoherentPair(internalStatus, operationalStatus), `${internalStatus}+${operationalStatus}`);
  }
  // internalStatus canonico com operationalStatus canonico DIFERENTE do seu par
  // continua incoerente — nao basta os dois serem "conhecidos".
  assert.ok(!isCoherentPair("RASCUNHO", "PAGO_EM_FILA"));
  assert.ok(!isCoherentPair("DOCUMENTO_VALIDADO", "DOCUMENTO_ENVIADO"));
});

test("projectOperationalStatus devolve undefined para internalStatus SEM projecao segura", () => {
  // undefined, nao null: "sem projecao segura" e resposta valida desta funcao,
  // nao ausencia de dado. `statusDivergence.ts` decide o que fazer com isso.
  for (const internalStatus of [
    "EM_REVISAO_HUMANA",
    "CONCLUIDO",
    "AGUARDANDO_LOGIN_GOVBR",
    "AGUARDANDO_CONFIRMACAO_HUMANA",
    "CANCELADO_REEMBOLSADO",
  ] as const) {
    assert.equal(projectOperationalStatus(internalStatus), undefined, internalStatus);
  }
});

/* ---------------------------------------------- 2. classificacao de operationalStatus */

test("isOperationalOnlyStatus classifica EXATAMENTE os 3 valores so-operacionais", () => {
  for (const status of OPERATIONAL_ONLY_STATUSES) {
    assert.ok(isOperationalOnlyStatus(status), status);
  }
  assert.deepEqual(
    [...OPERATIONAL_ONLY_STATUSES].sort(),
    ["CANCELADO_DEV", "EM_REVISAO_OPERACIONAL", "PRONTO_PARA_PROTOCOLO_MANUAL"].sort(),
  );
  for (const status of [
    "RASCUNHO",
    "DOCUMENTO_ENVIADO",
    "DOCUMENTO_APROVADO",
    "AGUARDANDO_PAGAMENTO",
    "PAGO_EM_FILA",
    "BLOQUEADO",
  ] as const) {
    assert.ok(!isOperationalOnlyStatus(status), status);
  }
});

test("CANCELADO_DEV nunca e projecao canonica, so operational-only (docs/49 §3.5)", () => {
  // A guarda central desta Fase 5h: CANCELADO_DEV NAO pode aparecer como valor
  // de CANONICAL_OPERATIONAL_PROJECTION, sob risco algum, mesmo que um dia
  // ganhe candidato — essa e uma decisao FORMAL separada (docs/49 §3.5).
  const canonicalValues = Object.values(CANONICAL_OPERATIONAL_PROJECTION) as OperationalStatus[];
  assert.ok(!canonicalValues.includes("CANCELADO_DEV"));
  assert.ok(isOperationalOnlyStatus("CANCELADO_DEV"));
  // Nenhum internalStatus projeta para CANCELADO_DEV — coerencia nunca bate.
  for (const internalStatus of Object.keys(CANONICAL_OPERATIONAL_PROJECTION) as InternalStatus[]) {
    assert.ok(!isCoherentPair(internalStatus, "CANCELADO_DEV"), internalStatus);
  }
});

test("isLegacyExpectedOperationalStatus classifica EXATAMENTE os 3 alvos com nome diferente", () => {
  for (const status of LEGACY_EXPECTED_OPERATIONAL_STATUSES) {
    assert.ok(isLegacyExpectedOperationalStatus(status), status);
  }
  assert.deepEqual(
    [...LEGACY_EXPECTED_OPERATIONAL_STATUSES].sort(),
    ["BLOQUEADO", "DOCUMENTO_APROVADO", "DOCUMENTO_ENVIADO"].sort(),
  );
  // Os 3 pares com MESMO nome nos dois campos ficam de fora desta lista de
  // proposito (ver docstring do modulo): mismatch entre eles e needs_decision,
  // nao expected_legacy.
  for (const status of ["RASCUNHO", "AGUARDANDO_PAGAMENTO", "PAGO_EM_FILA"] as const) {
    assert.ok(!isLegacyExpectedOperationalStatus(status), status);
  }
  // operational-only e legacy-expected sao categorias DISJUNTAS.
  for (const status of OPERATIONAL_ONLY_STATUSES) {
    assert.ok(!isLegacyExpectedOperationalStatus(status), status);
  }
});

/* --------------------------------------- 3. equivalencia com statusDivergence */

test("equivalencia: par canonico produz severity none em diagnoseStatusDivergence", () => {
  for (const [internalStatus, operationalStatus] of CANONICAL_PAIRS) {
    const result = diagnoseStatusDivergence({ internalStatus, operationalStatus });
    assert.equal(result.severity, "none", `${internalStatus}+${operationalStatus}`);
    assert.equal(isCoherentPair(internalStatus, operationalStatus), true);
  }
});

test("equivalencia: todo OperationalStatus so-operacional produz severity operational_only", () => {
  for (const operationalStatus of OPERATIONAL_ONLY_STATUSES) {
    const result = diagnoseStatusDivergence({ internalStatus: "RASCUNHO", operationalStatus });
    assert.equal(result.severity, "operational_only", operationalStatus);
  }
});

test("equivalencia: todo OperationalStatus legado-esperado produz severity expected_legacy quando fora do par", () => {
  for (const operationalStatus of LEGACY_EXPECTED_OPERATIONAL_STATUSES) {
    const result = diagnoseStatusDivergence({ internalStatus: "RASCUNHO", operationalStatus });
    assert.equal(result.severity, "expected_legacy", operationalStatus);
  }
});

test("equivalencia: as 3 categorias desta Fase 5h cobrem exatamente os 9 valores de OperationalStatus, sem sobreposicao", () => {
  const canonicalTargets = Object.values(CANONICAL_OPERATIONAL_PROJECTION) as OperationalStatus[];
  const same = canonicalTargets.filter(
    (status) => !LEGACY_EXPECTED_OPERATIONAL_STATUSES.includes(status as never),
  );
  const all = [...same, ...LEGACY_EXPECTED_OPERATIONAL_STATUSES, ...OPERATIONAL_ONLY_STATUSES].sort();
  assert.deepEqual(all, [
    "AGUARDANDO_PAGAMENTO",
    "BLOQUEADO",
    "CANCELADO_DEV",
    "DOCUMENTO_APROVADO",
    "DOCUMENTO_ENVIADO",
    "EM_REVISAO_OPERACIONAL",
    "PAGO_EM_FILA",
    "PRONTO_PARA_PROTOCOLO_MANUAL",
    "RASCUNHO",
  ]);
});

/* --------------------------------------------------- 4. pureza estrutural */

test("o modulo e PARCIAL por desenho: nao tenta cobrir os 12 InternalStatus avancados", () => {
  // Nenhum dos valores exclusivos da Fase 2/avancados deveria aparecer no
  // codigo deste modulo - se aparecer, alguem tentou transformar a projecao
  // parcial em total.
  const codeOnly = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const advancedStatus of [
    "EM_REVISAO_HUMANA",
    "CONCLUIDO",
    "AGUARDANDO_LOGIN_GOVBR",
    "SESSAO_GOVBR_EXPIRADA",
    "GRU_PAGA_EMPRESA",
    "PROTOCOLADO_GRU_GERADA",
    "CANCELADO_REEMBOLSADO",
    "BLOQUEADO_INSTABILIDADE",
    "EXCECAO_DOC_INVALIDO",
    "EXCECAO_ARMA_DIVERGENTE",
    "EXCECAO_DESTINO_INCOMPLETO",
  ]) {
    assert.ok(!codeOnly.includes(advancedStatus), advancedStatus);
  }
});

test("o modulo e puro: sem Prisma runtime, sem fs, sem rede, sem Next", () => {
  assert.doesNotMatch(MODULE_SOURCE, /getPrisma|\$transaction|\.findUnique|\.update\(/);
  assert.doesNotMatch(MODULE_SOURCE, /\bfetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(MODULE_SOURCE, /node:fs|node:http|next\/(navigation|server)/);
  assert.match(
    MODULE_SOURCE,
    /import \{ type InternalStatus, type OperationalStatus \} from "@prisma\/client"/,
    "so tipos do Prisma, nunca o client",
  );
});
