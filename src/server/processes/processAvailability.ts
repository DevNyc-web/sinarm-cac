/**
 * Disponibilidade dos processos de lancamento na ENTRADA de novo processo.
 *
 * Regra de PRODUTO desta etapa (docs/25): so a Guia de Trafego tem fluxo
 * persistido real; CR, Autorizacao de Compra e CRAF aparecem no catalogo, porem
 * "em preparacao" (bloqueados). Isto NAO cria fluxo real dos demais, NAO executa
 * automacao, NAO acessa Gov.br/SINARM e NAO muda persistencia.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React. A lista dos processos
 * vem do catalogo (`processCatalog`) — nada e hardcoded aqui alem da REGRA de
 * quais estao liberados.
 */
import {
  LOGICAL_ORDER,
  listProcessesInLogicalOrder,
  type LaunchProcessCode,
  type LaunchProcessDefinition,
} from "./processCatalog";

export const PROCESS_AVAILABILITIES = ["DISPONIVEL", "EM_PREPARACAO"] as const;

export type ProcessAvailability = (typeof PROCESS_AVAILABILITIES)[number];

export const PROCESS_AVAILABILITY_LABELS: Record<ProcessAvailability, string> = {
  DISPONIVEL: "Disponível agora",
  EM_PREPARACAO: "Em preparação",
};

/**
 * Unico processo com fluxo persistido real hoje: a Guia de Trafego. Os demais
 * ficam "em preparacao" ate ganharem fluxo proprio (etapa futura e aprovada).
 * Esta e a UNICA regra desta camada — a lista de processos vem do catalogo.
 */
export const AVAILABLE_PROCESS_CODES: readonly LaunchProcessCode[] = ["GUIA_TRAFEGO"];

/** Mensagem fixa para os processos ainda nao liberados. */
export const IN_PREPARATION_MESSAGE = "Em preparação para o lançamento.";

/** `true` se o processo tem fluxo real disponivel agora. */
export function isProcessAvailable(code: string): boolean {
  return (AVAILABLE_PROCESS_CODES as readonly string[]).includes(code);
}

/** Estado de disponibilidade do processo (desconhecido tambem cai em preparacao). */
export function processAvailabilityOf(code: string): ProcessAvailability {
  return isProcessAvailable(code) ? "DISPONIVEL" : "EM_PREPARACAO";
}

/** Processo + disponibilidade + posicao na ordem logica, para a tela de entrada. */
export interface LaunchProcessEntry {
  definition: LaunchProcessDefinition;
  availability: ProcessAvailability;
  available: boolean;
  /** Posicao (1-based) na ordem logica de dependencia do cliente. */
  logicalOrderPosition: number;
}

/**
 * Entradas para a tela de novo processo, na ORDEM LOGICA (CR -> ... -> Guia).
 * Deriva tudo do catalogo + regra de disponibilidade — sem lista hardcoded na UI.
 */
export function launchProcessEntries(): LaunchProcessEntry[] {
  return listProcessesInLogicalOrder().map((definition) => ({
    definition,
    availability: processAvailabilityOf(definition.code),
    available: isProcessAvailable(definition.code),
    logicalOrderPosition: LOGICAL_ORDER.indexOf(definition.code) + 1,
  }));
}
