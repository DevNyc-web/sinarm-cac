/**
 * Fundacao do modulo de documentos — CONTRATO de extracao futura.
 *
 * PREPARACAO apenas: NAO ha OCR, NAO ha IA, NAO ha leitura de arquivo real, NAO ha
 * rede. Define os tipos/estados e um EXEMPLO ficticio para a UI de conferencia. A
 * extracao automatica continua DESABILITADA — os dados devem ser conferidos por uma
 * pessoa antes de qualquer uso, e nada e enviado automaticamente.
 */

/** Estados do ciclo de extracao (dominio). */
export const EXTRACTION_STATES = [
  "NAO_INICIADA",
  "PENDENTE",
  "EXTRAIDA",
  "PRECISA_REVISAO",
  "CONFIRMADA",
  "FALHOU",
] as const;

export type ExtractionState = (typeof EXTRACTION_STATES)[number];

export const EXTRACTION_STATE_LABELS: Record<ExtractionState, string> = {
  NAO_INICIADA: "Não iniciada",
  PENDENTE: "Pendente",
  EXTRAIDA: "Extraída (a conferir)",
  PRECISA_REVISAO: "Precisa de revisão",
  CONFIRMADA: "Confirmada",
  FALHOU: "Falhou",
};

/** Campos que poderao ser extraidos no futuro (contrato). */
export const EXTRACTABLE_FIELDS = [
  "nome",
  "cpf",
  "rg",
  "endereco",
  "validade",
  "numeroRegistroCR",
  "dadosDocumento",
  "dadosArmaPce",
] as const;

export type ExtractableFieldKey = (typeof EXTRACTABLE_FIELDS)[number];

export const EXTRACTABLE_FIELD_LABELS: Record<ExtractableFieldKey, string> = {
  nome: "Nome",
  cpf: "CPF",
  rg: "RG",
  endereco: "Endereço",
  validade: "Validade",
  numeroRegistroCR: "Número de registro / CR",
  dadosDocumento: "Dados do documento",
  dadosArmaPce: "Dados de arma/PCE",
};

export type FieldConferenceStatus = "pendente_conferencia" | "confirmado";

export interface ExtractedField {
  key: ExtractableFieldKey;
  label: string;
  /** `null` = ainda nao extraido (extracao desabilitada). */
  value: string | null;
  /** 0..1; `null` quando nao extraido. */
  confidence: number | null;
  status: FieldConferenceStatus;
}

export interface DocumentExtractionResult {
  status: ExtractionState;
  fields: ExtractedField[];
  note: string;
}

export const EXTRACTION_DISABLED_NOTE =
  "Extração automática ainda não habilitada. Os dados devem ser conferidos antes de qualquer uso. Nada é enviado automaticamente.";

/**
 * Contrato vazio/honesto: NADA foi extraido (estado real de hoje).
 * Nao depende de OCR, arquivo, IA ou rede.
 */
export function emptyExtraction(): DocumentExtractionResult {
  return { status: "NAO_INICIADA", fields: [], note: EXTRACTION_DISABLED_NOTE };
}

/**
 * Exemplo FICTICIO apenas para ilustrar a UI de conferencia. Os valores sao
 * placeholders obvios (nao sao PII, nao vieram de arquivo real). Serve so para
 * mostrar o contrato/tela — a extracao continua desabilitada.
 */
export function demoExtractionExample(): DocumentExtractionResult {
  const fields: ExtractedField[] = [
    { key: "nome", label: EXTRACTABLE_FIELD_LABELS.nome, value: "MARIA DE EXEMPLO (fictício)", confidence: 0.97, status: "pendente_conferencia" },
    { key: "cpf", label: EXTRACTABLE_FIELD_LABELS.cpf, value: "000.000.000-00 (exemplo)", confidence: 0.9, status: "pendente_conferencia" },
    { key: "rg", label: EXTRACTABLE_FIELD_LABELS.rg, value: "00.000.000-0 (exemplo)", confidence: 0.82, status: "pendente_conferencia" },
    { key: "validade", label: EXTRACTABLE_FIELD_LABELS.validade, value: "01/01/2030 (exemplo)", confidence: 0.75, status: "pendente_conferencia" },
  ];
  return { status: "PRECISA_REVISAO", fields, note: EXTRACTION_DISABLED_NOTE };
}
