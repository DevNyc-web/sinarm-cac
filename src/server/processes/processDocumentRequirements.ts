/**
 * Requisitos documentais POR TIPO DE PROCESSO (dominio puro).
 *
 * Descreve, para cada processo do catalogo (`processCatalog`), quais documentos/
 * requisitos existem, seu TIPO (enviado pelo solicitante, geravel pelo sistema,
 * derivado de outro processo ou complementar), se sao OBRIGATORIOS e se ainda
 * pertencem a uma ETAPA FUTURA (fluxo real nao implementado).
 *
 * ESCOPO desta etapa (docs/25): apenas DOMINIO. So a Guia de Trafego tem fluxo
 * real; CR, Autorizacao de Compra e CRAF ficam com `futureStage: true`. Nada
 * aqui executa automacao, gera documento, acessa Gov.br/SINARM, faz OCR/IA, chama
 * rede ou grava no banco. Nao altera o fluxo real da Guia nem o schema.
 *
 * Nao duplica o catalogo: os documentos do CR sao DERIVADOS das listas ja
 * definidas em `processCatalog` (applicant/system). Os demais processos tem
 * requisitos proprios (mais detalhados que os `keyRequirements` do catalogo).
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import {
  applicantDocumentsOf,
  isLaunchProcessCode,
  systemGeneratedDocumentsOf,
  type LaunchProcessCode,
} from "./processCatalog";

/** Origem/natureza do requisito documental. */
export const REQUIREMENT_TYPES = [
  "ENVIADO_PELO_SOLICITANTE",
  "GERAVEL_PELO_SISTEMA",
  "DERIVADO_DO_PROCESSO",
  "COMPLEMENTAR",
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  ENVIADO_PELO_SOLICITANTE: "Enviado pelo solicitante",
  GERAVEL_PELO_SISTEMA: "Gerável pelo sistema",
  DERIVADO_DO_PROCESSO: "Derivado de outro processo",
  COMPLEMENTAR: "Complementar",
};

export interface ProcessDocumentRequirement {
  processCode: LaunchProcessCode;
  label: string;
  type: RequirementType;
  /** `true` quando o requisito e obrigatorio para o processo. */
  required: boolean;
  /**
   * `true` quando o requisito pertence a um fluxo AINDA NAO implementado de
   * verdade (CR/Autorizacao/CRAF). A Guia de Trafego (fluxo real) usa `false`.
   */
  futureStage: boolean;
  /** Observacao curta opcional (sem PII). */
  note?: string;
}

/** Documentos do CR ENVIADOS pelo solicitante — derivados do catalogo. */
function crApplicantRequirements(): ProcessDocumentRequirement[] {
  return applicantDocumentsOf("CONCESSAO_CR").map((label) => ({
    processCode: "CONCESSAO_CR",
    label,
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  }));
}

/** Documentos do CR GERAVEIS pelo sistema — derivados do catalogo. */
function crSystemRequirements(): ProcessDocumentRequirement[] {
  return systemGeneratedDocumentsOf("CONCESSAO_CR").map((label) => ({
    processCode: "CONCESSAO_CR",
    label,
    type: "GERAVEL_PELO_SISTEMA",
    required: true,
    futureStage: true,
    note: "Gerado/anexado pelo sistema em etapa futura — não implementado no fluxo real.",
  }));
}

const AUTORIZACAO_COMPRA_REQUIREMENTS: readonly ProcessDocumentRequirement[] = [
  {
    processCode: "AUTORIZACAO_COMPRA",
    label: "CR válido",
    type: "DERIVADO_DO_PROCESSO",
    required: true,
    futureStage: true,
    note: "Vem da Concessão de CR já concedida.",
  },
  {
    processCode: "AUTORIZACAO_COMPRA",
    label: "Comprovante de habitualidade/capacidade técnica",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: false,
    futureStage: true,
    note: "Quando aplicável.",
  },
  {
    processCode: "AUTORIZACAO_COMPRA",
    label: "Identificação do PCE pretendido",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
  {
    processCode: "AUTORIZACAO_COMPRA",
    label: "Dados do fornecedor/CNPJ",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
  {
    processCode: "AUTORIZACAO_COMPRA",
    label: "Justificativa/finalidade da compra",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
];

const EMISSAO_CRAF_REQUIREMENTS: readonly ProcessDocumentRequirement[] = [
  {
    processCode: "EMISSAO_CRAF",
    label: "Autorização de compra aprovada",
    type: "DERIVADO_DO_PROCESSO",
    required: true,
    futureStage: true,
    note: "Vem da Autorização de Compra aprovada.",
  },
  {
    processCode: "EMISSAO_CRAF",
    label: "Nota fiscal de aquisição",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
  {
    processCode: "EMISSAO_CRAF",
    label: "Dados da arma/PCE",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
  {
    processCode: "EMISSAO_CRAF",
    label: "Comprovante de pagamento da taxa",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
  {
    processCode: "EMISSAO_CRAF",
    label: "Dados de registro da arma",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: true,
  },
];

/**
 * Guia de Trafego — requisitos ATUAIS do MVP (fluxo real, `futureStage: false`).
 * Espelha o intake ja existente: so a identificacao e obrigatoria (unico anexo
 * observado — ver `documents/documentRequirements.ts`); os demais sao a confirmar
 * e o complementar entra quando necessario.
 */
const GUIA_TRAFEGO_REQUIREMENTS: readonly ProcessDocumentRequirement[] = [
  {
    processCode: "GUIA_TRAFEGO",
    label: "Documento de identificação pessoal",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: true,
    futureStage: false,
  },
  {
    processCode: "GUIA_TRAFEGO",
    label: "CR / registro CAC",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: false,
    futureStage: false,
    note: "A confirmar operacionalmente.",
  },
  {
    processCode: "GUIA_TRAFEGO",
    label: "Comprovante de origem/endereço",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: false,
    futureStage: false,
  },
  {
    processCode: "GUIA_TRAFEGO",
    label: "Declaração de destino/evento",
    type: "ENVIADO_PELO_SOLICITANTE",
    required: false,
    futureStage: false,
  },
  {
    processCode: "GUIA_TRAFEGO",
    label: "Documentos complementares",
    type: "COMPLEMENTAR",
    required: false,
    futureStage: false,
    note: "Quando necessário.",
  },
];

/** Requisitos por processo — fonte de verdade deste dominio. */
const REQUIREMENTS_BY_PROCESS: Record<LaunchProcessCode, readonly ProcessDocumentRequirement[]> = {
  CONCESSAO_CR: [...crApplicantRequirements(), ...crSystemRequirements()],
  AUTORIZACAO_COMPRA: AUTORIZACAO_COMPRA_REQUIREMENTS,
  EMISSAO_CRAF: EMISSAO_CRAF_REQUIREMENTS,
  GUIA_TRAFEGO: GUIA_TRAFEGO_REQUIREMENTS,
};

/** Requisitos do processo, ou array VAZIO para codigo desconhecido. */
export function documentRequirementsForProcess(
  code: string,
): readonly ProcessDocumentRequirement[] {
  return isLaunchProcessCode(code) ? REQUIREMENTS_BY_PROCESS[code] : [];
}

/** Apenas os requisitos OBRIGATORIOS do processo. */
export function requiredRequirementsForProcess(
  code: string,
): readonly ProcessDocumentRequirement[] {
  return documentRequirementsForProcess(code).filter((requirement) => requirement.required);
}

/** Requisitos por TIPO (vazio para o desconhecido). */
export function requirementsByType(
  code: string,
  type: RequirementType,
): readonly ProcessDocumentRequirement[] {
  return documentRequirementsForProcess(code).filter((requirement) => requirement.type === type);
}

/** Documentos ENVIADOS pelo solicitante. */
export function applicantRequirementsForProcess(
  code: string,
): readonly ProcessDocumentRequirement[] {
  return requirementsByType(code, "ENVIADO_PELO_SOLICITANTE");
}

/** Documentos GERAVEIS pelo sistema. */
export function systemGeneratedRequirementsForProcess(
  code: string,
): readonly ProcessDocumentRequirement[] {
  return requirementsByType(code, "GERAVEL_PELO_SISTEMA");
}

/** Quantidade total de requisitos do processo (0 para o desconhecido). */
export function countRequirementsForProcess(code: string): number {
  return documentRequirementsForProcess(code).length;
}

/** Resumo de contagens por tipo — para exibir na selecao sem listar documentos. */
export interface RequirementSummary {
  total: number;
  /** Contagem por tipo (todas as chaves presentes, mesmo que zero). */
  byType: Record<RequirementType, number>;
  /** Quantos sao obrigatorios. */
  requiredCount: number;
}

/**
 * Resumo DERIVADO das contagens de requisitos do processo. Mantem a contagem no
 * dominio (puro/testavel) para a UI so apresentar. Processo desconhecido -> tudo
 * zerado, sem quebrar.
 */
export function requirementSummaryForProcess(code: string): RequirementSummary {
  const requirements = documentRequirementsForProcess(code);
  const byType = Object.fromEntries(REQUIREMENT_TYPES.map((type) => [type, 0])) as Record<
    RequirementType,
    number
  >;
  for (const requirement of requirements) byType[requirement.type] += 1;

  return {
    total: requirements.length,
    byType,
    requiredCount: requirements.filter((requirement) => requirement.required).length,
  };
}
