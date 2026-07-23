/**
 * PREPARACAO do checklist pre-execucao para requisitos POR TIPO DE PROCESSO.
 *
 * Adaptador PURO que traduz os requisitos documentais de cada processo do
 * catalogo (`processDocumentRequirements`) para o formato de bloqueio do
 * checklist de prontidao (`automationReadiness` — tipo `ReadinessItem`).
 *
 * ESTADO ATUAL (docs/25): so a Guia de Trafego tem fluxo REAL persistido. Este
 * modulo NAO altera o checklist real (`deriveAutomationReadiness`) nem o fluxo da
 * Guia — apenas PREPARA as funcoes que um checklist por processo usaria no
 * futuro. Requisitos de CR/Autorizacao/CRAF vem marcados `futureStage: true` e
 * NAO entram no fluxo ativo.
 *
 * DECISAO (sem schema): o banco ainda nao guarda o TIPO de processo — so ha Guia.
 * `getCurrentPersistedProcessCatalogCode()` devolve GUIA_TRAFEGO por enquanto; a
 * reconciliacao catalogo <-> ProcessType persistido e ETAPA FUTURA e aprovada.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React. Nao executa o checklist,
 * nao acessa Gov.br/SINARM, nao gera documento.
 */
import { type ReadinessItem } from "./automationReadiness";
import { isLaunchProcessCode, type LaunchProcessCode } from "@/server/processes/processCatalog";
import { catalogCodeFromPersistedProcessTypeCode } from "@/server/processes/processTypeMapping";
import {
  documentRequirementsForProcess,
  type ProcessDocumentRequirement,
  type RequirementType,
} from "@/server/processes/processDocumentRequirements";

/**
 * Codigo de CATALOGO do processo, a partir do `process_types.code` persistido.
 *
 * Recebe o `code` gravado no banco e reconcilia via `processTypeMapping`. Quando
 * o code vem vazio/nulo/desconhecido, cai num FALLBACK TEMPORARIO para a Guia de
 * Trafego — valido APENAS enquanto ela e o unico fluxo real persistido. Assim
 * que os demais tipos existirem no banco (e forem reconciliados no seed), este
 * fallback deve ser removido para nao mascarar um tipo desconhecido.
 */
export function getCurrentPersistedProcessCatalogCode(
  persistedProcessTypeCode?: string | null,
): LaunchProcessCode {
  if (persistedProcessTypeCode) {
    const catalogCode = catalogCodeFromPersistedProcessTypeCode(persistedProcessTypeCode);
    if (catalogCode) return catalogCode;
  }
  // Fallback temporario: so a Guia e fluxo real hoje (ver comentario acima).
  return "GUIA_TRAFEGO";
}

/** Requisito de prontidao derivado de um requisito documental do processo. */
export interface ReadinessRequirement {
  processCode: LaunchProcessCode;
  label: string;
  type: RequirementType;
  required: boolean;
  /** `true` => requisito de fluxo AINDA NAO implementado (nao entra no ativo). */
  futureStage: boolean;
  /** Bloqueio correspondente, no formato do checklist (`code` + `label`). */
  blocker: ReadinessItem;
  note?: string;
}

/** Slug ASCII estavel para compor codigos de bloqueio (sem acento, A-Z0-9_). */
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Converte um requisito documental no bloqueio equivalente do checklist.
 * Codigo estavel e deterministico: `REQ_<PROCESSO>_<SLUG_DO_LABEL>`. Nao reusa os
 * codigos do checklist real da Guia — este e um bloqueio de PREPARACAO.
 */
export function mapDocumentRequirementToReadinessBlocker(
  requirement: ProcessDocumentRequirement,
): ReadinessItem {
  return {
    code: `REQ_${requirement.processCode}_${slugify(requirement.label)}`,
    label: requirement.label,
  };
}

function toReadinessRequirement(requirement: ProcessDocumentRequirement): ReadinessRequirement {
  return {
    processCode: requirement.processCode,
    label: requirement.label,
    type: requirement.type,
    required: requirement.required,
    futureStage: requirement.futureStage,
    blocker: mapDocumentRequirementToReadinessBlocker(requirement),
    ...(requirement.note ? { note: requirement.note } : {}),
  };
}

/** TODOS os requisitos de prontidao do processo (vazio para o desconhecido). */
export function readinessRequirementsForProcess(code: string): ReadinessRequirement[] {
  if (!isLaunchProcessCode(code)) return [];
  return documentRequirementsForProcess(code).map(toReadinessRequirement);
}

/**
 * Requisitos ATIVOS (fluxo real) — os que NAO sao etapa futura. So a Guia de
 * Trafego tem requisitos ativos hoje; CR/Autorizacao/CRAF devolvem lista vazia.
 */
export function activeReadinessRequirementsForProcess(code: string): ReadinessRequirement[] {
  return readinessRequirementsForProcess(code).filter((requirement) => !requirement.futureStage);
}

/** Requisitos de ETAPA FUTURA — preparados, porem ainda nao ativos. */
export function futureReadinessRequirementsForProcess(code: string): ReadinessRequirement[] {
  return readinessRequirementsForProcess(code).filter((requirement) => requirement.futureStage);
}
