/**
 * Fundacao do modulo de documentos — REQUISITOS por tipo de processo.
 *
 * Define os "documentos esperados" da Guia de Trafego. IMPORTANTE (docs/09 §15.1):
 * o UNICO anexo observado no fluxo real foi o Documento de Identificacao; os demais
 * NAO estao consolidados. Por isso separamos em TIERS e NAO afirmamos que todos sao
 * obrigatorios. Nada aqui acessa Gov.br/SINARM nem persiste no banco.
 */
import { type DocumentKind } from "./documentTypes";

/** Grau de exigencia de um documento — sem afirmar obrigatoriedade juridica indevida. */
export const REQUIREMENT_TIERS = [
  "OBRIGATORIO_MVP",
  "RECOMENDADO",
  "COMPLEMENTAR",
  "PENDENTE_VALIDACAO",
] as const;

export type RequirementTier = (typeof REQUIREMENT_TIERS)[number];

export const REQUIREMENT_TIER_LABELS: Record<RequirementTier, string> = {
  OBRIGATORIO_MVP: "Obrigatório",
  RECOMENDADO: "Recomendado",
  COMPLEMENTAR: "Complementar",
  PENDENTE_VALIDACAO: "A confirmar",
};

export interface DocumentRequirement {
  kind: DocumentKind;
  tier: RequirementTier;
  title: string;
  /** Ajuda curta para o usuario — sem prometer aprovacao, sem PII. */
  help: string;
}

/** Codigo do tipo de processo (Prisma ProcessType.code) — ver prisma/seed.ts. */
export const GUIA_TRAFEGO_PROCESS_CODE = "GUIA_TRAFEGO_PF_CAC";

/**
 * Guia de Trafego — documentos esperados.
 * So o de identificacao e OBRIGATORIO_MVP (unico observado); os demais ficam
 * PENDENTE_VALIDACAO/RECOMENDADO/COMPLEMENTAR ate a validacao operacional.
 */
const GUIA_TRAFEGO_REQUIREMENTS: readonly DocumentRequirement[] = [
  {
    kind: "IDENTIFICACAO_PESSOAL",
    tier: "OBRIGATORIO_MVP",
    title: "Documento de identificação pessoal",
    help: "Documento oficial com foto. Único anexo observado no fluxo da Guia de Tráfego.",
  },
  {
    kind: "CR_REGISTRO_CAC",
    tier: "PENDENTE_VALIDACAO",
    title: "CR / registro / autorização (CAC)",
    help: "Quem gera Guia de Tráfego já possui CR/arma cadastrada — anexo a confirmar operacionalmente.",
  },
  {
    kind: "COMPROVANTE_ORIGEM_ENDERECO",
    tier: "PENDENTE_VALIDACAO",
    title: "Comprovante de origem / endereço",
    help: "A origem costuma vir do acervo (Endereço SIGMA) — necessidade de anexo a confirmar.",
  },
  {
    kind: "DECLARACAO_DESTINO_EVENTO",
    tier: "RECOMENDADO",
    title: "Declaração do destino / evento / clube",
    help: "Convite ou declaração do evento/clube de destino, quando houver.",
  },
  {
    kind: "COMPLEMENTAR",
    tier: "COMPLEMENTAR",
    title: "Documento complementar",
    help: "Qualquer documento adicional pedido pela equipe durante a conferência.",
  },
];

const REQUIREMENTS_BY_PROCESS_CODE: Record<string, readonly DocumentRequirement[]> = {
  [GUIA_TRAFEGO_PROCESS_CODE]: GUIA_TRAFEGO_REQUIREMENTS,
};

/** Requisitos de documentos para um tipo de processo (vazio se desconhecido). */
export function documentRequirementsFor(
  processTypeCode: string,
): readonly DocumentRequirement[] {
  return REQUIREMENTS_BY_PROCESS_CODE[processTypeCode] ?? [];
}

/** Atalho para a Guia de Trafego (unico processo do MVP). */
export function guiaTrafegoRequirements(): readonly DocumentRequirement[] {
  return GUIA_TRAFEGO_REQUIREMENTS;
}
