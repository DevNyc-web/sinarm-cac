/**
 * Fase 2 — fluxo do laboratório para o coordenador de execução sintética
 * (`labSyntheticRunFlow.ts`). O comportamento do COORDENADOR já está coberto
 * em `syntheticRunCoordinator.test.ts`; aqui o que importa é que a tela
 * consuma o módulo real, acumule violações sem mexer no run e nunca exponha
 * o handle. Dados 100% fictícios.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyLabRunAction,
  demoSyntheticRunPlan,
  initialLabRunFlowState,
  labRunView,
  type LabRunAction,
  type LabRunFlowState,
} from "../../../src/server/automation/synthetic/labSyntheticRunFlow";

function run(...actions: readonly LabRunAction[]): LabRunFlowState {
  return actions.reduce(applyLabRunAction, initialLabRunFlowState());
}

const CREATE: LabRunAction = { kind: "create-run" };
const NEXT: LabRunAction = { kind: "execute-next" };

test("começa sem run e sem violação", () => {
  const state = initialLabRunFlowState();
  assert.equal(state.run, null);
  assert.deepEqual(state.violations, []);
  assert.equal(labRunView(state), null);
});

test("o plano fictício tem 4 etapas com os tipos previstos", () => {
  const plan = demoSyntheticRunPlan(0);
  assert.equal(plan.steps.length, 4);
  assert.deepEqual(
    plan.steps.map((s) => s.type),
    ["VALIDATE_INPUT", "OPEN_FORM", "FILL_FORM", "CONFIRM_RESULT"],
  );
});

test("criar run popula a fila e o estado inicial é QUEUED", () => {
  const state = run(CREATE);
  const view = labRunView(state);
  assert.equal(view?.state, "QUEUED");
  assert.equal(view?.pendingStepIds.length, 4);
  assert.equal(view?.runNumber, 1);
});

test("criar run duas vezes é recusado sem alterar o run existente", () => {
  const first = run(CREATE);
  const second = applyLabRunAction(first, CREATE);
  assert.deepEqual(second.run, first.run);
  assert.ok(second.violations.length > 0);
});

test("executar etapas até concluir, então iniciar novo run", () => {
  let state = run(CREATE, NEXT, NEXT, NEXT, NEXT);
  assert.equal(labRunView(state)?.state, "COMPLETED");
  assert.equal(labRunView(state)?.terminal, true);

  state = applyLabRunAction(state, { kind: "new-run" });
  assert.equal(labRunView(state)?.state, "QUEUED");
  assert.equal(labRunView(state)?.runNumber, 2);
});

test("captcha leva o run a WAITING_HUMAN e nenhuma etapa roda depois", () => {
  const state = run(CREATE, { kind: "captcha" });
  const view = labRunView(state);
  assert.equal(view?.state, "WAITING_HUMAN");
  assert.equal(view?.humanFallbackRequired, true);

  const blocked = applyLabRunAction(state, NEXT);
  assert.deepEqual(blocked.run, state.run);
  assert.ok(blocked.violations.length > 0);
});

test("nenhum sessionHandle aparece no estado exposto à tela", () => {
  const state = run(CREATE, NEXT);
  const view = labRunView(state);
  assert.equal(Object.prototype.hasOwnProperty.call(view ?? {}, "session"), false);
  assert.equal(JSON.stringify(view).includes("sh_lab_run"), false);
});
