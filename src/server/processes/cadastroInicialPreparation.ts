/**
 * PREPARACAO (inerte) do Cadastro Inicial — descritor de dominio PURO.
 *
 * Cadastro Inicial e a etapa PRE-CONDICAO da cadeia CAC (vem antes da Concessao
 * de CR). NAO e um processo do catalogo de lancamento (`processCatalog` so tem os
 * 4 processos), entao este descritor e AUTOCONTIDO, derivado da especificacao de
 * produto (memoria cac-cadastro-inicial).
 *
 * Este modulo apenas DESCREVE os grupos/campos que um formulario FUTURO coletaria
 * — rotulos e fonte esperada de cada campo, NUNCA valores. NAO contem PII real,
 * NAO valida documento, NAO preenche nada, NAO persiste, NAO cria UI/form/action.
 * `available:false`/`canCreate:false` e todos os campos `futureStage:true` — nada
 * aqui libera o Cadastro Inicial nem a Concessao de CR.
 *
 * A foto no Gov.br entra SO como pre-condicao: nenhuma credencial e lida ou
 * armazenada por este produto.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React. Inerte ate ser ligado.
 */

/** Origem esperada de cada campo (de onde o valor VIRIA num fluxo futuro). */
export type CadastroInicialFieldSource =
  | "PRECONDICAO_GOVBR"
  | "DOCUMENTO_IDENTIDADE"
  | "COMPROVANTE_RESIDENCIA"
  | "INFORMADO_PELO_SOLICITANTE"
  | "CONSULTA_FUTURA";

/** Especificacao de UM campo (metadado — nunca carrega valor). */
export interface CadastroInicialFieldSpec {
  key: string;
  label: string;
  source: CadastroInicialFieldSource;
  required: boolean;
  /** Sempre `true` neste estagio: campo preparado, jamais ativo. */
  futureStage: true;
  note?: string;
}

/** Grupo de campos do Cadastro Inicial. `optional` so no 2o endereco de acervo. */
export interface CadastroInicialGroup {
  key: string;
  title: string;
  optional: boolean;
  fields: readonly CadastroInicialFieldSpec[];
}

/** Descritor read-only da preparacao do Cadastro Inicial (nada executavel). */
export interface CadastroInicialPreparation {
  code: "CADASTRO_INICIAL";
  name: "Cadastro Inicial";
  stage: "PREPARACAO";
  available: false;
  canCreate: false;
  groups: readonly CadastroInicialGroup[];
}

/** Atalho para declarar um campo preparado (futureStage sempre `true`). */
function field(
  key: string,
  label: string,
  source: CadastroInicialFieldSource,
  required: boolean,
  note?: string,
): CadastroInicialFieldSpec {
  return { key, label, source, required, futureStage: true, ...(note ? { note } : {}) };
}

const PRECONDICAO_GOVBR: CadastroInicialGroup = {
  key: "precondicao_govbr",
  title: "Pré-condição Gov.br",
  optional: false,
  fields: [
    field(
      "foto_govbr",
      "Foto cadastrada no Gov.br",
      "PRECONDICAO_GOVBR",
      true,
      "Apenas pré-condição: nenhuma credencial é lida ou armazenada por este produto.",
    ),
  ],
};

const IDENTIDADE: CadastroInicialGroup = {
  key: "identidade",
  title: "Identidade",
  optional: false,
  fields: [
    field("rg_numero", "Número do RG", "DOCUMENTO_IDENTIDADE", true),
    field("rg_data_expedicao", "Data de expedição", "DOCUMENTO_IDENTIDADE", true),
    field("rg_orgao_emissor", "Órgão emissor", "DOCUMENTO_IDENTIDADE", true),
    field("rg_uf_emissao", "UF de emissão", "DOCUMENTO_IDENTIDADE", true),
    field("data_nascimento", "Data de nascimento", "DOCUMENTO_IDENTIDADE", true),
    field("pais", "País", "DOCUMENTO_IDENTIDADE", true),
    field("uf_nascimento", "UF de nascimento", "DOCUMENTO_IDENTIDADE", true),
    field("cidade_nascimento", "Cidade/local de nascimento", "DOCUMENTO_IDENTIDADE", true),
    field("nome_mae", "Nome da mãe", "DOCUMENTO_IDENTIDADE", true),
    field("nome_pai", "Nome do pai", "DOCUMENTO_IDENTIDADE", true),
  ],
};

const ELEITORAL_PROFISSIONAL: CadastroInicialGroup = {
  key: "eleitoral_profissional",
  title: "Eleitoral/profissional",
  optional: false,
  fields: [
    field("titulo_eleitor", "Número do título de eleitor", "INFORMADO_PELO_SOLICITANTE", true),
    field("profissao", "Profissão", "INFORMADO_PELO_SOLICITANTE", true),
    field(
      "outra_profissao",
      "Outra profissão",
      "INFORMADO_PELO_SOLICITANTE",
      false,
      "Quando a profissão não existir na lista do sistema.",
    ),
  ],
};

const ENDERECO_RESIDENCIAL: CadastroInicialGroup = {
  key: "endereco_residencial",
  title: "Endereço residencial",
  optional: false,
  fields: [
    field("cep", "CEP", "COMPROVANTE_RESIDENCIA", true),
    field("logradouro", "Logradouro", "COMPROVANTE_RESIDENCIA", true),
    field("uf", "UF", "COMPROVANTE_RESIDENCIA", true),
    field("cidade", "Cidade", "COMPROVANTE_RESIDENCIA", true),
    field("bairro", "Bairro", "COMPROVANTE_RESIDENCIA", true),
    field("numero", "Número", "COMPROVANTE_RESIDENCIA", true),
    field("complemento", "Complemento", "INFORMADO_PELO_SOLICITANTE", false),
    field("latitude", "Latitude", "CONSULTA_FUTURA", false),
    field("longitude", "Longitude", "CONSULTA_FUTURA", false),
  ],
};

const SEGUNDO_ENDERECO_ACERVO: CadastroInicialGroup = {
  key: "segundo_endereco_acervo",
  title: "Segundo endereço de acervo",
  optional: true,
  fields: [
    field(
      "comprovante_segundo_endereco",
      "Comprovante do segundo endereço",
      "COMPROVANTE_RESIDENCIA",
      true,
    ),
    field("cep", "CEP", "COMPROVANTE_RESIDENCIA", true),
    field("logradouro", "Endereço/logradouro", "COMPROVANTE_RESIDENCIA", true),
    field("uf", "UF", "COMPROVANTE_RESIDENCIA", true),
    field("cidade", "Cidade", "COMPROVANTE_RESIDENCIA", true),
    field("bairro", "Bairro", "COMPROVANTE_RESIDENCIA", true),
    field("numero", "Número", "COMPROVANTE_RESIDENCIA", true),
    field("complemento", "Complemento", "INFORMADO_PELO_SOLICITANTE", false),
    field("latitude", "Latitude", "CONSULTA_FUTURA", false),
    field("longitude", "Longitude", "CONSULTA_FUTURA", false),
  ],
};

const TERMO_ACEITE: CadastroInicialGroup = {
  key: "termo_aceite",
  title: "Termo/aceite",
  optional: false,
  fields: [
    field(
      "aceite_termo_responsabilidade",
      "Aceite de termo de responsabilidade",
      "INFORMADO_PELO_SOLICITANTE",
      true,
      "Finalização: aceite após o preenchimento.",
    ),
  ],
};

const GROUPS: readonly CadastroInicialGroup[] = [
  PRECONDICAO_GOVBR,
  IDENTIDADE,
  ELEITORAL_PROFISSIONAL,
  ENDERECO_RESIDENCIAL,
  SEGUNDO_ENDERECO_ACERVO,
  TERMO_ACEITE,
];

/**
 * Descritor de preparacao do Cadastro Inicial. So especificacao de produto —
 * `available`/`canCreate` sao `false` fixos (nada aqui libera o fluxo real).
 */
export function getCadastroInicialPreparation(): CadastroInicialPreparation {
  return {
    code: "CADASTRO_INICIAL",
    name: "Cadastro Inicial",
    stage: "PREPARACAO",
    available: false,
    canCreate: false,
    groups: GROUPS,
  };
}
