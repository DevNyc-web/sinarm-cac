/**
 * Ponto de composição EXPLÍCITO: escolhe qual `SyntheticRunStore` usar.
 *
 * Sem fallback silencioso — `kind` é obrigatório. Quem chama decide, sempre:
 * `"memory"` para unitários e laboratório simples (sem I/O, sem Postgres);
 * `"prisma"` para integração local contra um banco real.
 *
 * NÃO substitui nenhum consumidor existente: `syntheticStoredRunExecutor.ts`
 * continua recebendo o store por injeção como já fazia — isto é só uma forma
 * conveniente de construir um, não uma migração forçada.
 */
import { InMemorySyntheticRunStore } from "./inMemorySyntheticRunStore";
import { PrismaSyntheticRunStore } from "./prismaSyntheticRunStore";
import type { SyntheticRunStore } from "./syntheticRunStore";

export const SYNTHETIC_RUN_STORE_KINDS = ["memory", "prisma"] as const;
export type SyntheticRunStoreKind = (typeof SYNTHETIC_RUN_STORE_KINDS)[number];

export function createSyntheticRunStore(kind: SyntheticRunStoreKind): SyntheticRunStore {
  switch (kind) {
    case "memory":
      return new InMemorySyntheticRunStore();
    case "prisma":
      return new PrismaSyntheticRunStore();
  }
}
