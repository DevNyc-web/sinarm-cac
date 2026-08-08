/**
 * Idempotência de REQUEST administrativo — não confundir com a idempotência
 * de ETAPA/LOTE que `SyntheticRunStore`/`dispatchSyntheticBatch` já
 * garantem. Aqui a chave é `requestId` (o pedido administrativo em si);
 * repetir o mesmo pedido nunca deve chamar o dispatcher de novo.
 *
 * Só o CONTRATO mora aqui — a implementação em memória está em
 * `inMemoryManualDispatchRequestRegistry.ts` (mesmo padrão de
 * `syntheticRunStore.ts` / `inMemorySyntheticRunStore.ts`). Nenhum adaptador
 * de banco existe ainda de propósito (fora do escopo deste PR).
 */
import type { ManualSyntheticDispatchResult } from "./manualSyntheticDispatchTypes";

/** Só os campos que decidem se um replay é COMPATÍVEL — nunca sessão, executor ou store. */
export interface ManualDispatchRequestFingerprintInput {
  batchId: string;
  /** Já redigido por quem chama — o fingerprint nunca redige de novo nem guarda o cru. */
  requestedBy: string;
  reason: string;
  maxRuns: number;
  maxConcurrency: number;
  deadlineAt: string;
}

/**
 * Deriva um identificador determinístico do "payload que importa" de um
 * pedido. Duas chamadas com os mesmos valores produzem sempre a mesma
 * string — sem hash criptográfico: não é segredo, só precisa ser estável e
 * distinguir payloads diferentes.
 */
export function computeManualDispatchRequestFingerprint(input: ManualDispatchRequestFingerprintInput): string {
  return JSON.stringify([input.batchId, input.requestedBy, input.reason, input.maxRuns, input.maxConcurrency, input.deadlineAt]);
}

export interface ManualDispatchRequestRegistryEntry {
  requestId: string;
  fingerprint: string;
  /** Já é o resultado ADMINISTRATIVO seguro — nunca sessão, run completo ou plano. */
  result: ManualSyntheticDispatchResult;
}

/**
 * Contrato assíncrono de propósito — mesma forma que um adaptador
 * persistente teria depois, mesmo que a única implementação desta PR seja
 * em memória.
 */
export interface ManualDispatchRequestRegistry {
  find(requestId: string): Promise<ManualDispatchRequestRegistryEntry | null>;
  save(entry: ManualDispatchRequestRegistryEntry): Promise<void>;
  /**
   * Quantidade de pedidos já registrados — usada pela política como sinal
   * de limite de taxa (`DENIED_RATE_LIMIT`).
   *
   * ponytail: contagem TOTAL da instância, não uma janela deslizante por
   * tempo — mais simples, determinístico e suficiente para o limite
   * administrativo atual; trocar por janela por tempo é o caminho quando o
   * volume real exigir.
   */
  count(): Promise<number>;
}
