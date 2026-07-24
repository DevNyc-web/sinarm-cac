/**
 * PREPARACAO (inerte) da Emissao de CRAF — descritor de dominio PURO.
 *
 * Compoe o que ja existe: definicao do catalogo (`processCatalog`), requisitos
 * documentais (`processDocumentRequirements`) e disponibilidade
 * (`processAvailability`), e ACRESCENTA metadados de servico, os dados esperados
 * da AUTORIZACAO anterior e a REFERENCIA ao PCE reaproveitado — apenas rotulos,
 * NUNCA valores nem opcoes.
 *
 * ESTADO (docs/25): a Emissao de CRAF continua SO em preparacao. Pre-condicao
 * inegociavel: Autorizacao de Compra DEFERIDA (`dependsOn`). `available` vem de
 * `isProcessAvailable` (segue `false`) e `canCreate` e `false` explicito.
 * Requisitos vem REUSADOS do dominio (os 5 atuais, `futureStage:true`).
 *
 * PCE: NAO remodela os campos de Arma de Fogo (esses vivem na Autorizacao de
 * Compra e sao REAPROVEITADOS) — aqui e so uma REFERENCIA/nota. Nao importa o
 * modulo da Autorizacao para nao acoplar os dominios.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React. Inerte ate ser ligado.
 */
import {
  dependenciesOf,
  getProcessDefinition,
  gruFeeCentsOf,
  type LaunchProcessCode,
} from "./processCatalog";
import { isProcessAvailable } from "./processAvailability";
import {
  documentRequirementsForProcess,
  type ProcessDocumentRequirement,
} from "./processDocumentRequirements";

/** Codigo do catalogo da Emissao de CRAF (dominio de produto). */
const EMISSAO_CRAF: LaunchProcessCode = "EMISSAO_CRAF";

/** Metadados do servico da Emissao de CRAF (rotulos fixos de produto). */
export interface EmissaoCrafServiceMeta {
  service: "Registrar Arma com Emissão de CRAF";
  defaultActivity: "Tiro Desportivo - Atirador Desportivo";
  defaultPceType: "Arma de Fogo";
}

/** Campo esperado (metadado — nunca valor, nunca opcoes). */
export interface CrafFieldSpec {
  key: string;
  label: string;
  /** Sempre `true`: campo preparado, jamais ativo. */
  futureStage: true;
  note?: string;
}

/** Referencia ao PCE reaproveitado — so nota, sem remodelar os campos. */
export interface PceReference {
  note: string;
}

/** Descritor read-only da preparacao da Emissao de CRAF (nada executavel). */
export interface EmissaoCrafPreparation {
  catalogCode: "EMISSAO_CRAF";
  name: string;
  gruFeeCents: number;
  dependsOn: readonly LaunchProcessCode[];
  available: false;
  canCreate: false;
  service: EmissaoCrafServiceMeta;
  requirements: readonly ProcessDocumentRequirement[];
  /** Dados lidos da Autorizacao de Compra deferida (metadados, nunca valores). */
  authorizationData: readonly CrafFieldSpec[];
  pceReference: PceReference;
}

/** Atalho para declarar um campo preparado (futureStage sempre `true`). */
function crafField(key: string, label: string, note?: string): CrafFieldSpec {
  return { key, label, futureStage: true, ...(note ? { note } : {}) };
}

const AUTHORIZATION_DATA: readonly CrafFieldSpec[] = [
  crafField("numero_autorizacao", "Número da autorização", "Lido da Autorização de Compra deferida."),
  crafField("sfpc", "SFPC", "Lido da Autorização de Compra deferida."),
  crafField("data_autorizacao", "Data da autorização", "Lido da Autorização de Compra deferida."),
  crafField("data_validade", "Data de validade", "Lido da Autorização de Compra deferida."),
];

const SERVICE_META: EmissaoCrafServiceMeta = {
  service: "Registrar Arma com Emissão de CRAF",
  defaultActivity: "Tiro Desportivo - Atirador Desportivo",
  defaultPceType: "Arma de Fogo",
};

const PCE_REFERENCE: PceReference = {
  note: "PCE já cadastrado na Autorização de Compra — reaproveitado, não recadastrado aqui.",
};

/**
 * Monta o descritor de preparacao da Emissao de CRAF a partir do dominio ja
 * existente. Invariante do catalogo: o codigo tem definicao e taxa.
 */
export function getEmissaoCrafPreparation(): EmissaoCrafPreparation {
  const definition = getProcessDefinition(EMISSAO_CRAF);
  const gruFeeCents = gruFeeCentsOf(EMISSAO_CRAF);
  if (!definition || gruFeeCents === undefined) {
    throw new Error("Catalogo inconsistente para a Emissao de CRAF.");
  }

  // Enquanto a regra de disponibilidade nao liberar, o descritor fica bloqueado.
  const available = isProcessAvailable(EMISSAO_CRAF) as false;

  return {
    catalogCode: "EMISSAO_CRAF",
    name: definition.name,
    gruFeeCents,
    dependsOn: dependenciesOf(EMISSAO_CRAF),
    available,
    canCreate: false,
    service: SERVICE_META,
    // Reuso dos requisitos ATUAIS do dominio (5, futureStage:true) — inclui a
    // Nota fiscal de aquisicao. Sem alterar processDocumentRequirements.
    requirements: documentRequirementsForProcess(EMISSAO_CRAF),
    authorizationData: AUTHORIZATION_DATA,
    pceReference: PCE_REFERENCE,
  };
}
