/**
 * Fase 2 — consultas puras sobre a maquina de estados sintetica (docs/74).
 *
 * O modulo e camada de CONSULTA: nao aplica transicao, nao emite evento e nao
 * pode virar segunda fonte de verdade. Os testes abaixo cobrem os 8 estados, a
 * copia defensiva e a exaustividade das descricoes. Dados 100% ficticios.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SYNTHETIC_HANDOFF_STATES,
  SYNTHETIC_TRANSITIONS,
} from "../../../src/server/automation/synthetic/sessionContract";
import {
  describeSyntheticState,
  getAllowedSyntheticTransitions,
} from "../../../src/server/automation/synthetic/sessionState";

const SOURCE_PATH = "src/server/automation/synthetic/sessionState.ts";

// ------------------------------------------------------------- transições

test("getAllowedSyntheticTransitions responde para os 8 estados", () => {
  assert.equal(SYNTHETIC_HANDOFF_STATES.length, 8);

  for (const state of SYNTHETIC_HANDOFF_STATES) {
    assert.deepEqual(
      getAllowedSyntheticTransitions(state),
      [...SYNTHETIC_TRANSITIONS[state]],
      `${state} deve espelhar a tabela do contrato`,
    );
  }
});

test("os 4 terminais não oferecem nenhuma saída", () => {
  for (const terminal of ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]) {
    assert.deepEqual(getAllowedSyntheticTransitions(terminal), []);
  }
});

test("BLOCKED oferece apenas saídas laterais e para trás", () => {
  assert.deepEqual(getAllowedSyntheticTransitions("BLOCKED"), ["CANCELLED", "FAILED", "EXPIRED"]);
});

test("estado desconhecido devolve lista vazia, sem lançar", () => {
  assert.deepEqual(getAllowedSyntheticTransitions("PAUSED"), []);
  assert.deepEqual(getAllowedSyntheticTransitions(""), []);
});

// ------------------------------------------------------- cópia defensiva

test("devolve CÓPIA, não a referência viva da tabela de transições", () => {
  const primeira = getAllowedSyntheticTransitions("CREATED");
  const segunda = getAllowedSyntheticTransitions("CREATED");

  assert.notEqual(primeira, segunda, "cada chamada devolve um array próprio");
  assert.notEqual(
    primeira,
    SYNTHETIC_TRANSITIONS.CREATED,
    "nunca a referência interna do contrato",
  );
  assert.deepEqual(primeira, segunda);
});

test("mutar o retorno não corrompe a fonte de verdade", () => {
  const antes = [...SYNTHETIC_TRANSITIONS.CREATED];

  // Um consumidor JavaScript sem tipos consegue fazer isto; o contrato não pode
  // sentir. `readonly` é garantia de compilação, não de runtime.
  (getAllowedSyntheticTransitions("CREATED") as string[]).push("COMPLETED");

  assert.deepEqual(SYNTHETIC_TRANSITIONS.CREATED, antes, "a tabela do contrato ficou intacta");
  assert.deepEqual(getAllowedSyntheticTransitions("CREATED"), antes);
});

// ---------------------------------------------------------------- descrições

test("describeSyntheticState cobre exatamente os 8 estados", () => {
  const descritos = SYNTHETIC_HANDOFF_STATES.map((state) => describeSyntheticState(state));

  assert.equal(descritos.length, 8);
  assert.equal(new Set(descritos).size, 8, "cada estado tem descrição própria");

  for (const [index, state] of SYNTHETIC_HANDOFF_STATES.entries()) {
    assert.ok(descritos[index]?.startsWith(state), `${state} deve abrir a própria descrição`);
    assert.ok((descritos[index]?.length ?? 0) > state.length + 3, `${state} sem descrição`);
  }
});

test("as descrições são estáveis e determinísticas", () => {
  for (const state of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(describeSyntheticState(state), describeSyntheticState(state));
  }
});

test("nenhuma descrição ecoa termo sensível", () => {
  for (const state of SYNTHETIC_HANDOFF_STATES) {
    const texto = describeSyntheticState(state).toLowerCase();
    for (const proibido of ["senha", "password", "cookie", "cpf", "token", "gov.br", "sinarm"]) {
      assert.equal(texto.includes(proibido), false, `${state} não pode citar ${proibido}`);
    }
  }
});

test("a exaustividade é de compilação: o mapa tem uma entrada por estado", () => {
  // Se alguém acrescentar um nono estado ao contrato sem descrevê-lo aqui, o
  // `Record<SyntheticHandoffState, string>` quebra o build antes deste teste.
  const source = readFileSync(SOURCE_PATH, "utf8");
  const bloco = source.slice(source.indexOf("STATE_DESCRIPTIONS"));

  for (const state of SYNTHETIC_HANDOFF_STATES) {
    assert.ok(bloco.includes(`${state}:`), `${state} sem entrada em STATE_DESCRIPTIONS`);
  }
});

// ------------------------------------------------------- provas estruturais

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o módulo é só consulta: não aplica transição nem emite evento", () => {
  const code = sourceCode();

  for (const forbidden of ["synthetic_session_", "handoffState:", "throw ", "let ", "= {}"]) {
    assert.equal(
      code.includes(forbidden),
      false,
      `camada de consulta não pode conter ${forbidden}`,
    );
  }
});

test("o módulo não duplica a tabela de transições — só a lê", () => {
  const code = sourceCode();

  assert.ok(code.includes("SYNTHETIC_TRANSITIONS"), "deve ler a tabela do contrato");
  assert.equal(
    code.includes('CLAIMED", "EXPIRED'),
    false,
    "não pode reescrever as listas de destino",
  );
});

test("o módulo não toca Phase 9, Prisma, rede nem I/O", () => {
  const code = sourceCode();

  for (const forbidden of [
    "phase9",
    "safety",
    "networkGuard",
    "@prisma/client",
    "node:fs",
    "playwright",
    "next/",
    "process.env",
    "fetch(",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o módulo não lê relógio nem sorteia", () => {
  const code = sourceCode();

  assert.equal(code.includes("Date.now()"), false);
  assert.equal(code.includes("Math.random()"), false);
  assert.equal(code.includes("new Date()"), false);
});
