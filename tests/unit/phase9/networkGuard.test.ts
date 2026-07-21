/**
 * Fase 9 — Testes do guard de rede / allowlist.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertUrlAllowed,
  createPhase9NetworkPolicy,
  isExternalAccessAllowed,
  PHASE9_DEFAULT_ALLOWED_HOSTS,
} from "../../../src/server/automation/phase9/networkGuard";

test("politica default: sem acesso externo, so localhost/127.0.0.1", () => {
  const policy = createPhase9NetworkPolicy();
  assert.equal(policy.externalAccessAllowed, false);
  assert.deepEqual(policy.allowedHosts, [...PHASE9_DEFAULT_ALLOWED_HOSTS]);
  assert.equal(isExternalAccessAllowed(policy), false);
});

test("permite localhost", () => {
  const check = assertUrlAllowed("http://localhost:3000/qualquer");
  assert.equal(check.allowed, true);
  assert.equal(check.host, "localhost");
});

test("permite 127.0.0.1", () => {
  const check = assertUrlAllowed("http://127.0.0.1:8080/");
  assert.equal(check.allowed, true);
});

test("bloqueia URL externa arbitraria", () => {
  const check = assertUrlAllowed("https://exemplo-externo.com/pagina");
  assert.equal(check.allowed, false);
  assert.equal(check.host, "exemplo-externo.com");
});

test("bloqueia Gov.br mesmo se estiver na allowlist (trava dura)", () => {
  const policy = createPhase9NetworkPolicy({
    externalAccessAllowed: true,
    allowedHosts: ["servicos.pf.gov.br", "localhost"],
  });
  const check = assertUrlAllowed("https://servicos.pf.gov.br/sisgcorp", policy);
  assert.equal(check.allowed, false);
});

test("bloqueia URL vazia/invalida", () => {
  assert.equal(assertUrlAllowed("").allowed, false);
  assert.equal(assertUrlAllowed("nao-e-url").allowed, false);
});
