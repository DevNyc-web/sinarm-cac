/**
 * Factory de composição (`syntheticRunStoreFactory.ts`) — escolha EXPLÍCITA
 * de adaptador, sem fallback silencioso.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticRunStore } from "../../../src/server/automation/synthetic/store/syntheticRunStoreFactory";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { PrismaSyntheticRunStore } from "../../../src/server/automation/synthetic/store/prismaSyntheticRunStore";
import { installFakeSyntheticRunPrisma } from "./testSyntheticRunPrisma";

test('"memory" devolve InMemorySyntheticRunStore', () => {
  const store = createSyntheticRunStore("memory");
  assert.ok(store instanceof InMemorySyntheticRunStore);
});

test('"prisma" devolve PrismaSyntheticRunStore', () => {
  installFakeSyntheticRunPrisma();
  const store = createSyntheticRunStore("prisma");
  assert.ok(store instanceof PrismaSyntheticRunStore);
});

test("cada chamada devolve uma instância NOVA — não é singleton", () => {
  const a = createSyntheticRunStore("memory");
  const b = createSyntheticRunStore("memory");
  assert.notEqual(a, b);
});
