/**
 * Ponto de composição EXPLÍCITO: escolhe qual `ManualDispatchRequestRegistry`
 * usar. Mesmo padrão de `syntheticRunStoreFactory.ts`.
 *
 * Sem fallback silencioso — `kind` é obrigatório. Quem chama decide, sempre:
 * `"memory"` para unitários e laboratório simples (sem I/O, sem Postgres);
 * `"prisma"` para persistência durável real. Modo `"prisma"` sem
 * `DATABASE_URL` válido falha ao primeiro uso do cliente (o mesmo
 * comportamento de `getPrisma()`), nunca cai para memória sem avisar.
 *
 * NÃO é exposto ao cliente — é decisão de composição do servidor
 * (script/laboratório/futura Server Action), nunca um parâmetro vindo de
 * requisição HTTP.
 */
import { InMemoryManualDispatchRequestRegistry } from "./inMemoryManualDispatchRequestRegistry";
import { PrismaManualDispatchRequestRegistry } from "./prismaManualDispatchRequestRegistry";
import type { ManualDispatchRequestRegistry } from "./manualDispatchRequestRegistry";

export const MANUAL_DISPATCH_REGISTRY_KINDS = ["memory", "prisma"] as const;
export type ManualDispatchRegistryKind = (typeof MANUAL_DISPATCH_REGISTRY_KINDS)[number];

export function createManualDispatchRequestRegistry(kind: ManualDispatchRegistryKind): ManualDispatchRequestRegistry {
  switch (kind) {
    case "memory":
      return new InMemoryManualDispatchRequestRegistry();
    case "prisma":
      return new PrismaManualDispatchRequestRegistry();
  }
}
