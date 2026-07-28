/**
 * Fundacao do modulo de documentos — CONTRATO de extracao futura.
 *
 * PREPARACAO apenas: NAO ha OCR, NAO ha IA, NAO ha leitura de arquivo real, NAO ha
 * rede. Define os tipos/estados e um EXEMPLO ficticio para a UI de conferencia. A
 * extracao automatica continua DESABILITADA — os dados devem ser conferidos por uma
 * pessoa antes de qualquer uso, e nada e enviado automaticamente.
 */

/**
 * Estados PERSISTIDOS de uma tentativa de extracao.
 *
 * Paridade 1:1 com o enum Prisma `ExtractionState` — travada por teste, pelo
 * mesmo motivo de `Role`: o banco recusar estado invalido so vale se os dois
 * lados nao divergirem.
 */
export const EXTRACTION_STATES = [
  "PENDENTE",
  "PROCESSANDO",
  "EXTRAIDA",
  "PRECISA_REVISAO",
  "CONFIRMADA",
  "FALHOU",
] as const;

export type ExtractionState = (typeof EXTRACTION_STATES)[number];

export const EXTRACTION_STATE_LABELS: Record<ExtractionState, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  EXTRAIDA: "Extraída (a conferir)",
  PRECISA_REVISAO: "Precisa de revisão",
  CONFIRMADA: "Confirmada",
  FALHOU: "Falhou",
};

/**
 * Marcador de DOMINIO para "nenhuma tentativa existe" — NAO persistido.
 *
 * Com a tabela `document_extractions`, a ausencia de tentativa e representada
 * pela AUSENCIA DE LINHA, nao por um estado gravado. Este valor existe apenas
 * para a camada em memoria (`emptyExtraction`) ter o que devolver quando nao ha
 * nada a relatar, sem inventar um estado que o banco aceitaria.
 */
export const NO_EXTRACTION_STATE = "NAO_INICIADA" as const;

export type NoExtractionState = typeof NO_EXTRACTION_STATE;

export const NO_EXTRACTION_STATE_LABEL = "Não iniciada";

/** Estado persistido OU a ausencia de tentativa. */
export type ExtractionStateOrAbsent = ExtractionState | NoExtractionState;

/** Rotulo de qualquer um dos dois. */
export function extractionStateLabel(state: ExtractionStateOrAbsent): string {
  return state === NO_EXTRACTION_STATE
    ? NO_EXTRACTION_STATE_LABEL
    : EXTRACTION_STATE_LABELS[state];
}

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
  /** Pode ser a ausencia de tentativa — ver `NO_EXTRACTION_STATE`. */
  status: ExtractionStateOrAbsent;
  fields: ExtractedField[];
  note: string;
}

/**
 * Codigos de falha. Curtos e fechados de proposito: `failure_reason` NUNCA pode
 * carregar texto bruto de OCR, trecho do documento, senha, token, cookie ou OTP.
 */
export const EXTRACTION_FAILURE_REASONS = [
  "ARQUIVO_ILEGIVEL",
  "FORMATO_NAO_SUPORTADO",
  "TIMEOUT",
  "ENGINE_INDISPONIVEL",
  "ERRO_INTERNO",
] as const;

export type ExtractionFailureReason = (typeof EXTRACTION_FAILURE_REASONS)[number];

export function isExtractionFailureReason(value: string): value is ExtractionFailureReason {
  return (EXTRACTION_FAILURE_REASONS as readonly string[]).includes(value);
}

export const EXTRACTION_DISABLED_NOTE =
  "Extração automática ainda não habilitada. Os dados devem ser conferidos antes de qualquer uso. Nada é enviado automaticamente.";

/**
 * Contrato vazio/honesto: NADA foi extraido (estado real de hoje).
 * Nao depende de OCR, arquivo, IA ou rede.
 */
export function emptyExtraction(): DocumentExtractionResult {
  return { status: NO_EXTRACTION_STATE, fields: [], note: EXTRACTION_DISABLED_NOTE };
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
