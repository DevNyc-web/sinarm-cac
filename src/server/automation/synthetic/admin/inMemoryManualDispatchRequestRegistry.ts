/**
 * Registro EM MEMÓRIA de pedidos administrativos — só para laboratório e
 * testes, mesmo padrão de `InMemorySyntheticRunStore`/
 * `InMemorySyntheticEngineLogger`: cada instância tem seu PRÓPRIO estado
 * (sem singleton, sem variável de módulo mutável), toda leitura/escrita
 * passa por cópia defensiva.
 */
import type { ManualDispatchRequestRegistry, ManualDispatchRequestRegistryEntry } from "./manualDispatchRequestRegistry";

function cloneEntry(entry: ManualDispatchRequestRegistryEntry): ManualDispatchRequestRegistryEntry {
  return {
    ...entry,
    result: { ...entry.result, batch: entry.result.batch === null ? null : { ...entry.result.batch }, metrics: entry.result.metrics === null ? null : { ...entry.result.metrics }, warnings: entry.result.warnings.map((w) => ({ ...w })) },
  };
}

export class InMemoryManualDispatchRequestRegistry implements ManualDispatchRequestRegistry {
  private readonly entries = new Map<string, ManualDispatchRequestRegistryEntry>();

  async find(requestId: string): Promise<ManualDispatchRequestRegistryEntry | null> {
    const entry = this.entries.get(requestId);
    return entry === undefined ? null : cloneEntry(entry);
  }

  async save(entry: ManualDispatchRequestRegistryEntry): Promise<void> {
    this.entries.set(entry.requestId, cloneEntry(entry));
  }

  async count(): Promise<number> {
    return this.entries.size;
  }

  /** Limpa só o histórico DESTA instância. */
  clear(): void {
    this.entries.clear();
  }
}
