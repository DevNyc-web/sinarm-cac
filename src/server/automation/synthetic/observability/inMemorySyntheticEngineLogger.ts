/**
 * Sumidouro EM MEMÓRIA para `SyntheticEngineLogEvent` — só para
 * laboratório/testes/comando local. Cada instância tem seu PRÓPRIO estado
 * (isolado; sem variável de módulo mutável, sem singleton). Nenhuma saída em
 * `console`, nenhuma persistência.
 *
 * Toda leitura e escrita passa por cópia defensiva: o chamador nunca recebe
 * nem entrega uma referência viva que possa mutar o histórico por fora do
 * `emit`.
 */
import type { SyntheticEngineLogEvent, SyntheticEngineLogger } from "./syntheticEngineLogger";

function cloneEvent(event: SyntheticEngineLogEvent): SyntheticEngineLogEvent {
  return { ...event, counters: event.counters === null ? null : { ...event.counters } };
}

export class InMemorySyntheticEngineLogger implements SyntheticEngineLogger {
  private readonly events: SyntheticEngineLogEvent[] = [];

  emit(event: SyntheticEngineLogEvent): void {
    this.events.push(cloneEvent(event));
  }

  /** Cópia segura do histórico acumulado NESTA instância, na ordem de emissão. */
  snapshot(): readonly SyntheticEngineLogEvent[] {
    return this.events.map(cloneEvent);
  }

  /** Limpa só o histórico DESTA instância. */
  clear(): void {
    this.events.length = 0;
  }
}
