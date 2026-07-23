/**
 * Dados de SEED dos tipos de processo — DERIVADOS do catalogo + mapeamento.
 *
 * Evita drift: nome e taxa vem do catalogo (`processCatalog`), o `code`
 * persistido vem do mapeamento (`processTypeMapping`) e `active` espelha a
 * disponibilidade (`processAvailability`) — so a Guia esta ativa hoje.
 *
 * A GUIA DE TRAFEGO NAO entra aqui: o registro dela (code GUIA_TRAFEGO_PF_CAC,
 * name e baseFeeCents atuais) permanece EXPLICITO e INALTERADO em prisma/seed.ts.
 * Nao renomeamos a Guia. Este modulo cobre apenas os tipos FUTUROS, todos com
 * `active: false` — registram o tipo no banco SEM liberar criacao real.
 *
 * PURO: sem Prisma, sem I/O, sem rede, sem React. Consumido pelo seed e por teste.
 */
import { LAUNCH_PROCESS_CODES, getProcessDefinition } from "./processCatalog";
import { isProcessAvailable } from "./processAvailability";
import {
  persistedProcessTypeCodeFromCatalogCode,
  type PersistedProcessTypeCode,
} from "./processTypeMapping";

/** Linha de `process_types` a semear (formato do upsert do seed). */
export interface ProcessTypeSeedEntry {
  code: PersistedProcessTypeCode;
  name: string;
  baseFeeCents: number;
  active: boolean;
}

/**
 * Tipos FUTUROS (ainda nao disponiveis): CONCESSAO_CR, AUTORIZACAO_COMPRA,
 * EMISSAO_CRAF — todos `active: false`. A Guia e excluida por ja estar
 * disponivel (e por ter registro proprio, inalterado, no seed).
 */
export const FUTURE_PROCESS_TYPE_SEED: readonly ProcessTypeSeedEntry[] = LAUNCH_PROCESS_CODES.filter(
  (code) => !isProcessAvailable(code),
).map((code) => {
  const definition = getProcessDefinition(code);
  const persistedCode = persistedProcessTypeCodeFromCatalogCode(code);
  // Invariante do catalogo: todo codigo tem definicao e codigo persistido.
  if (!definition || !persistedCode) {
    throw new Error(`Catalogo/mapeamento inconsistente para o processo "${code}".`);
  }
  return {
    code: persistedCode,
    name: definition.name,
    baseFeeCents: definition.gruFeeCents,
    active: isProcessAvailable(code), // false para os futuros
  };
});
