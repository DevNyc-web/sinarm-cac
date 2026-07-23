/**
 * Catalogo dos PROCESSOS DE LANCAMENTO (dominio puro).
 *
 * Descreve os 4 processos que o produto atendera no lancamento: taxas de GRU,
 * dependencia logica (o que o cliente precisa ter feito antes), ordem de
 * facilidade de automacao e requisitos documentais por processo.
 *
 * ESCOPO desta etapa (docs/25): apenas DOMINIO/CATALOGO. Nada aqui executa
 * automacao, acessa Gov.br/SINARM, faz OCR/IA, chama rede ou grava no banco.
 * Nao ha mudanca de schema — o `ProcessType` persistido (prisma) continua como
 * esta; hoje so a Guia de Trafego tem tipo semeado
 * (`GUIA_TRAFEGO_PF_CAC` — ver `documentRequirements.ts`). Este catalogo e a
 * fonte de verdade de PRODUTO e sera reconciliado com a persistencia quando o
 * schema/seed evoluir, em etapa futura e aprovada.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */

/** Codigos dos processos de lancamento (dominio de produto — nao e o code do banco). */
export const LAUNCH_PROCESS_CODES = [
  "CONCESSAO_CR",
  "AUTORIZACAO_COMPRA",
  "EMISSAO_CRAF",
  "GUIA_TRAFEGO",
] as const;

export type LaunchProcessCode = (typeof LAUNCH_PROCESS_CODES)[number];

/**
 * Requisito documental de um processo.
 *
 * IMPORTANTE (variacao por UF/superintendencia): o CONJUNTO de requisitos pode
 * EVOLUIR por estado/superintendencia no futuro — tipicamente um documento
 * ADICIONAL que o sistema tera de anexar/gerar, NAO um campo novo. Nao ha regra
 * por UF nesta etapa; o catalogo apenas deixa esse ponto de evolucao explicito
 * (ver `UF_VARIATION_NOTE`).
 */
export interface LaunchProcessDefinition {
  code: LaunchProcessCode;
  name: string;
  /** Taxa da GRU (orgao), em centavos. Ficticio/dev — nao cobra nada real. */
  gruFeeCents: number;
  /**
   * Exige o CADASTRO INICIAL do solicitante. Normalmente feito uma unica vez,
   * no primeiro processo da pessoa (a Concessao de CR).
   */
  requiresInitialRegistration: boolean;
  /** Processos que precisam existir ANTES deste (dependencia direta). */
  dependsOn: readonly LaunchProcessCode[];
  /** Documentos ENVIADOS pelo solicitante (upload). */
  applicantDocuments: readonly string[];
  /** Documentos que o SISTEMA podera gerar/anexar (etapa futura). */
  systemGeneratedDocuments: readonly string[];
  /** Requisitos principais (dados/etapas) do processo, alem dos documentos. */
  keyRequirements: readonly string[];
}

/**
 * Ponto de evolucao futuro: requisitos documentais podem variar por
 * UF/superintendencia (documento adicional a anexar/gerar), sem mudar campo do
 * sistema. NAO implementado nesta etapa.
 */
export const UF_VARIATION_NOTE =
  "Requisitos podem ser evoluídos por UF/superintendência no futuro (documento adicional a anexar/gerar), sem alterar campos do sistema.";

const CONCESSAO_CR: LaunchProcessDefinition = {
  code: "CONCESSAO_CR",
  name: "Concessão de CR",
  gruFeeCents: 10_000,
  requiresInitialRegistration: true,
  dependsOn: [],
  applicantDocuments: [
    "RG",
    "Comprovante de residência atual",
    "Prova de ocupação",
    "Antecedente Estadual — Execuções Criminais",
    "Antecedente Estadual — Ações Criminais",
    "Antecedente Polícia Civil",
    "Laudo de tiro válido",
    "Laudo psicológico válido",
    "Carta de Filiação",
    "Carta de Idoneidade",
    "Declaração de Segurança de Acervo",
    "Declaração de Comprometimento ao Clube",
  ],
  systemGeneratedDocuments: [
    "Antecedente eleitoral",
    "Antecedente distribuição do STJ",
    "Antecedente militar",
    "Antecedente militar estadual",
    "Antecedente federal",
  ],
  keyRequirements: ["Cadastro inicial do solicitante (feito uma única vez)"],
};

const AUTORIZACAO_COMPRA: LaunchProcessDefinition = {
  code: "AUTORIZACAO_COMPRA",
  name: "Autorização de Compra",
  gruFeeCents: 2_500,
  // Nao exige cadastro inicial DESDE QUE o CR/cadastro ja exista (via CONCESSAO_CR).
  requiresInitialRegistration: false,
  dependsOn: ["CONCESSAO_CR"],
  applicantDocuments: [],
  systemGeneratedDocuments: [],
  keyRequirements: [
    "Escolha de atividade",
    "Requisitos de capacidade técnica/habitualidade",
    "Identificação do PCE",
    "Dados do fornecedor/CNPJ",
  ],
};

const EMISSAO_CRAF: LaunchProcessDefinition = {
  code: "EMISSAO_CRAF",
  name: "Emissão de CRAF",
  gruFeeCents: 8_800,
  requiresInitialRegistration: false,
  dependsOn: ["AUTORIZACAO_COMPRA"],
  applicantDocuments: [],
  systemGeneratedDocuments: [],
  keyRequirements: [
    "Serviço: registrar arma",
    "Dados da autorização",
    "Nota fiscal de aquisição",
    "PCE cadastrado",
  ],
};

const GUIA_TRAFEGO: LaunchProcessDefinition = {
  code: "GUIA_TRAFEGO",
  name: "Guia de Tráfego",
  gruFeeCents: 2_000,
  requiresInitialRegistration: false,
  dependsOn: ["EMISSAO_CRAF"],
  applicantDocuments: [],
  systemGeneratedDocuments: [],
  keyRequirements: ["Endereço de origem", "Endereço de destino", "Identificação da arma"],
};

/** Definicoes indexadas por codigo — fonte de verdade do catalogo. */
const DEFINITIONS: Record<LaunchProcessCode, LaunchProcessDefinition> = {
  CONCESSAO_CR,
  AUTORIZACAO_COMPRA,
  EMISSAO_CRAF,
  GUIA_TRAFEGO,
};

/**
 * ORDEM LOGICA / dependencia do cliente: o que precisa ser feito antes.
 * Concessao de CR -> Autorizacao de Compra -> CRAF -> Guia de Trafego.
 */
export const LOGICAL_ORDER: readonly LaunchProcessCode[] = [
  "CONCESSAO_CR",
  "AUTORIZACAO_COMPRA",
  "EMISSAO_CRAF",
  "GUIA_TRAFEGO",
];

/**
 * ORDEM DE FACILIDADE de automacao (mais facil primeiro):
 * Guia de Trafego -> CRAF -> CR -> Autorizacao de Compra.
 */
export const EASE_ORDER: readonly LaunchProcessCode[] = [
  "GUIA_TRAFEGO",
  "EMISSAO_CRAF",
  "CONCESSAO_CR",
  "AUTORIZACAO_COMPRA",
];

/** `true` se o valor e um codigo de processo de lancamento valido. */
export function isLaunchProcessCode(value: unknown): value is LaunchProcessCode {
  return typeof value === "string" && (LAUNCH_PROCESS_CODES as readonly string[]).includes(value);
}

/** Definicao do processo, ou `undefined` para codigo desconhecido (erro controlado). */
export function getProcessDefinition(code: string): LaunchProcessDefinition | undefined {
  return isLaunchProcessCode(code) ? DEFINITIONS[code] : undefined;
}

/** Processos na ORDEM LOGICA (dependencia do cliente). */
export function listProcessesInLogicalOrder(): LaunchProcessDefinition[] {
  return LOGICAL_ORDER.map((code) => DEFINITIONS[code]);
}

/** Processos na ORDEM DE FACILIDADE de automacao. */
export function listProcessesByEase(): LaunchProcessDefinition[] {
  return EASE_ORDER.map((code) => DEFINITIONS[code]);
}

/** Dependencias DIRETAS do processo (vazio para o desconhecido). */
export function dependenciesOf(code: string): readonly LaunchProcessCode[] {
  return getProcessDefinition(code)?.dependsOn ?? [];
}

/**
 * Cadeia COMPLETA de pre-requisitos, do mais distante ao mais proximo.
 * Ex.: GUIA_TRAFEGO -> [CONCESSAO_CR, AUTORIZACAO_COMPRA, EMISSAO_CRAF].
 * A cadeia atual e linear; a implementacao suporta multiplas dependencias.
 */
export function prerequisiteChainOf(code: string): LaunchProcessCode[] {
  const chain: LaunchProcessCode[] = [];
  const visit = (current: string) => {
    for (const dependency of dependenciesOf(current)) {
      visit(dependency);
      if (!chain.includes(dependency)) chain.push(dependency);
    }
  };
  visit(code);
  return chain;
}

/** Taxa da GRU (centavos) do processo, ou `undefined` para o desconhecido. */
export function gruFeeCentsOf(code: string): number | undefined {
  return getProcessDefinition(code)?.gruFeeCents;
}

/** Documentos enviados pelo solicitante (vazio para o desconhecido). */
export function applicantDocumentsOf(code: string): readonly string[] {
  return getProcessDefinition(code)?.applicantDocuments ?? [];
}

/** Documentos geraveis pelo sistema (vazio para o desconhecido). */
export function systemGeneratedDocumentsOf(code: string): readonly string[] {
  return getProcessDefinition(code)?.systemGeneratedDocuments ?? [];
}
