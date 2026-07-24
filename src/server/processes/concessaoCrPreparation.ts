/**
 * PREPARACAO (inerte) da Concessao de CR — descritor de dominio PURO.
 *
 * Compoe, num unico lugar, o que ja existe para a Concessao de CR: definicao do
 * catalogo (`processCatalog`), requisitos documentais (`processDocumentRequirements`)
 * e disponibilidade (`processAvailability`). NAO introduz nenhum campo/PII novo,
 * NAO cria formulario, NAO persiste e NAO liga em UI.
 *
 * ESTADO (docs/25): a Concessao de CR continua SO em preparacao. `available` vem
 * de `isProcessAvailable` (segue `false`) e `canCreate` e `false` explicito — este
 * modulo NAO libera criacao real, NAO cria rascunho, NAO cria action. Todos os
 * requisitos de CR permanecem `futureStage: true` (nenhum ativo).
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
  applicantRequirementsForProcess,
  systemGeneratedRequirementsForProcess,
  type ProcessDocumentRequirement,
} from "./processDocumentRequirements";

/** Codigo do catalogo da Concessao de CR (dominio de produto, nao o code do banco). */
const CONCESSAO_CR: LaunchProcessCode = "CONCESSAO_CR";

/** Descritor read-only da preparacao da Concessao de CR (nada executavel). */
export interface ConcessaoCrPreparation {
  catalogCode: "CONCESSAO_CR";
  name: string;
  gruFeeCents: number;
  dependsOn: readonly LaunchProcessCode[];
  /** Disponibilidade real (segue `false` — so a Guia esta liberada). */
  available: false;
  /** Gate explicito: este modulo NAO libera criacao real da Concessao de CR. */
  canCreate: false;
  /** Documentos ENVIADOS pelo solicitante (todos `futureStage: true`). */
  applicantRequirements: readonly ProcessDocumentRequirement[];
  /** Documentos GERAVEIS pelo sistema (todos `futureStage: true`). */
  systemGeneratedRequirements: readonly ProcessDocumentRequirement[];
}

/**
 * Monta o descritor de preparacao da Concessao de CR a partir do dominio ja
 * existente. Invariante do catalogo: o codigo tem definicao e taxa. `available`
 * so seria `true` se `isProcessAvailable` mudasse — o que NAO acontece aqui.
 */
export function getConcessaoCrPreparation(): ConcessaoCrPreparation {
  const definition = getProcessDefinition(CONCESSAO_CR);
  const gruFeeCents = gruFeeCentsOf(CONCESSAO_CR);
  if (!definition || gruFeeCents === undefined) {
    throw new Error("Catalogo inconsistente para a Concessao de CR.");
  }

  // Sanidade: enquanto a regra de disponibilidade nao liberar CR, o descritor
  // permanece bloqueado. Se algum dia CR virar disponivel, este modulo (inerte)
  // deixa de refletir "preparacao" e devera ser revisto conscientemente.
  const available = isProcessAvailable(CONCESSAO_CR) as false;

  return {
    catalogCode: "CONCESSAO_CR",
    name: definition.name,
    gruFeeCents,
    dependsOn: dependenciesOf(CONCESSAO_CR),
    available,
    canCreate: false,
    applicantRequirements: applicantRequirementsForProcess(CONCESSAO_CR),
    systemGeneratedRequirements: systemGeneratedRequirementsForProcess(CONCESSAO_CR),
  };
}
