/**
 * PREPARACAO (inerte) da Autorizacao de Compra — descritor de dominio PURO.
 *
 * Compoe o que ja existe: definicao do catalogo (`processCatalog`), requisitos
 * documentais (`processDocumentRequirements`) e disponibilidade
 * (`processAvailability`), e ACRESCENTA metadados de servico e a ESTRUTURA de
 * preparacao do PCE (Acessorio / Arma de Fogo) — apenas rotulos de campo, NUNCA
 * valores nem listas de opcoes.
 *
 * ESTADO (docs/25): a Autorizacao de Compra continua SO em preparacao. Depende da
 * Concessao de CR (deferida). `available` vem de `isProcessAvailable` (segue
 * `false`) e `canCreate` e `false` explicito. Requisitos vem REUSADOS do dominio
 * (os 5 atuais, `futureStage:true`) — os 12 detalhados da memoria sao ETAPA
 * FUTURA e ficam para PR separado (nao expandidos aqui).
 *
 * PCE: so a estrutura de campos esperados. NAO hardcoda marca/calibre/especie/
 * pais/acabamento/funcionamento, NAO enumera opcoes do SISGCORP, NAO faz parsing
 * de contrato, NAO valida, NAO cria formulario.
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

/** Codigo do catalogo da Autorizacao de Compra (dominio de produto). */
const AUTORIZACAO_COMPRA: LaunchProcessCode = "AUTORIZACAO_COMPRA";

/** Metadados do servico da Autorizacao de Compra (rotulos fixos de produto). */
export interface AutorizacaoCompraServiceMeta {
  service: "Autorizar aquisição de arma de fogo";
  defaultActivity: "Tiro Desportivo - Atirador Desportivo";
  defaultPceType: "Arma de Fogo";
}

/** Especificacao de UM campo de PCE (metadado — nunca valor, nunca opcoes). */
export interface PceFieldSpec {
  key: string;
  label: string;
  /** Sempre `true`: campo preparado, jamais ativo. */
  futureStage: true;
  note?: string;
}

/** Caminho de preparacao do PCE. So Acessorio e Arma de Fogo (docs/25). */
export interface PcePathSpec {
  key: "ACESSORIO" | "ARMA_DE_FOGO";
  title: string;
  fields: readonly PceFieldSpec[];
}

/** Descritor read-only da preparacao da Autorizacao de Compra (nada executavel). */
export interface AutorizacaoCompraPreparation {
  catalogCode: "AUTORIZACAO_COMPRA";
  name: string;
  gruFeeCents: number;
  dependsOn: readonly LaunchProcessCode[];
  available: false;
  canCreate: false;
  service: AutorizacaoCompraServiceMeta;
  requirements: readonly ProcessDocumentRequirement[];
  pcePreparation: readonly PcePathSpec[];
}

/** Atalho para declarar um campo de PCE preparado (futureStage sempre `true`). */
function pceField(key: string, label: string, note?: string): PceFieldSpec {
  return { key, label, futureStage: true, ...(note ? { note } : {}) };
}

const PCE_ACESSORIO: PcePathSpec = {
  key: "ACESSORIO",
  title: "Acessório",
  fields: [
    pceField("complemento", "Complemento"),
    pceField("descricao_produto", "Descrição do produto"),
    pceField("especie", "Espécie"),
    pceField("marca", "Marca"),
    pceField("modelo", "Modelo"),
    pceField("pais_fabricacao", "País de fabricação"),
    pceField("fornecedor_cnpj", "Fornecedor/CNPJ"),
  ],
};

const PCE_ARMA_DE_FOGO: PcePathSpec = {
  key: "ARMA_DE_FOGO",
  title: "Arma de Fogo",
  fields: [
    pceField("tipo_pce", "Tipo de PCE"),
    pceField("grupo_pce", "Grupo PCE"),
    pceField("complemento", "Complemento"),
    pceField("numero_arma", "Número da arma"),
    pceField("modelo", "Modelo"),
    pceField("calibre", "Calibre"),
    pceField("especie", "Espécie"),
    pceField("marca", "Marca"),
    pceField("grupo_calibre", "Grupo calibre"),
    pceField("pais_fabricacao", "País de fabricação"),
    pceField("total_carregadores", "Total de carregadores"),
    pceField("capacidade_cartuchos", "Capacidade de cartuchos"),
    pceField("numero_canos", "Número de canos"),
    pceField("alma_cano", "Alma do cano"),
    pceField("unidade_comprimento_cano", "Unidade de medida do comprimento do cano"),
    pceField("comprimento_cano", "Comprimento do cano"),
    pceField("numero_raias", "Número de raias"),
    pceField("sentido_raias", "Sentido das raias"),
    pceField("acabamento", "Acabamento"),
    pceField("funcionamento", "Funcionamento"),
    pceField("fornecedor_cnpj", "Fornecedor/CNPJ"),
  ],
};

const SERVICE_META: AutorizacaoCompraServiceMeta = {
  service: "Autorizar aquisição de arma de fogo",
  defaultActivity: "Tiro Desportivo - Atirador Desportivo",
  defaultPceType: "Arma de Fogo",
};

/**
 * Monta o descritor de preparacao da Autorizacao de Compra a partir do dominio ja
 * existente. Invariante do catalogo: o codigo tem definicao e taxa.
 */
export function getAutorizacaoCompraPreparation(): AutorizacaoCompraPreparation {
  const definition = getProcessDefinition(AUTORIZACAO_COMPRA);
  const gruFeeCents = gruFeeCentsOf(AUTORIZACAO_COMPRA);
  if (!definition || gruFeeCents === undefined) {
    throw new Error("Catalogo inconsistente para a Autorizacao de Compra.");
  }

  // Enquanto a regra de disponibilidade nao liberar, o descritor fica bloqueado.
  const available = isProcessAvailable(AUTORIZACAO_COMPRA) as false;

  return {
    catalogCode: "AUTORIZACAO_COMPRA",
    name: definition.name,
    gruFeeCents,
    dependsOn: dependenciesOf(AUTORIZACAO_COMPRA),
    available,
    canCreate: false,
    service: SERVICE_META,
    // Reuso dos requisitos ATUAIS do dominio (5, futureStage:true). Os 12
    // detalhados da memoria sao etapa futura (PR separado) — nao expandidos aqui.
    requirements: documentRequirementsForProcess(AUTORIZACAO_COMPRA),
    pcePreparation: [PCE_ACESSORIO, PCE_ARMA_DE_FOGO],
  };
}
