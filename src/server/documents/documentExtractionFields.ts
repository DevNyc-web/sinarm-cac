/**
 * Modulo de documentos — LEITURA SEGURA do JSON `document_extractions.fields`.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem OCR. Recebe o valor JSON ja
 * lido do banco e responde uma unica pergunta: "da para confiar nisto?".
 *
 * Existe porque `fields` e uma coluna `Json?` — o Postgres nao valida o formato.
 * Uma linha gravada por engine antiga, migration futura ou edicao manual pode
 * conter qualquer coisa, e o consumidor (a tela de conferencia, no PR #47C) nao
 * pode quebrar nem exibir lixo por causa disso.
 *
 * CONTRATO: nunca lanca. Entrada suspeita vira `null`, e `null` significa "use a
 * fonte anterior" — no #47C, o mock. Degradar para o comportamento de hoje e
 * sempre preferivel a mostrar menos campos do que a tela ja mostrava.
 */
import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "./documentExtractionStatus";
import { type MockExtractionField } from "./documentExtractionMock";

/**
 * Estados em que a tentativa TEM campos que valem a pena ler.
 *
 * PENDENTE/PROCESSANDO ainda nao gravaram nada; FALHOU gravou o motivo, nao os
 * campos. Ler `fields` nesses estados devolveria vazio ou o resto de uma
 * tentativa anterior — em ambos os casos, menos do que a tela ja mostra hoje.
 */
export const USABLE_EXTRACTION_STATES = ["EXTRAIDA", "PRECISA_REVISAO", "CONFIRMADA"] as const;

export type UsableExtractionState = (typeof USABLE_EXTRACTION_STATES)[number];

export function isUsableExtractionState(state: string): state is UsableExtractionState {
  return (USABLE_EXTRACTION_STATES as readonly string[]).includes(state);
}

function isConfidenceLevel(value: unknown): value is ConfidenceLevel {
  return typeof value === "string" && (CONFIDENCE_LEVELS as readonly string[]).includes(value);
}

/**
 * Um campo, ou `null` se qualquer parte dele nao bater com o contrato.
 *
 * COPIA campo a campo de proposito — nunca repassa o objeto vindo do banco. A
 * lista de chaves aqui e a unica coisa que sai deste modulo: se uma linha trouxer
 * `storageKey`, caminho de arquivo ou texto bruto de OCR pendurado no JSON, ele
 * morre nesta funcao em vez de vazar para a UI.
 */
function parseField(raw: unknown): MockExtractionField | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const { key, label, value, confidence } = raw as Record<string, unknown>;
  if (typeof key !== "string" || key === "") return null;
  if (typeof label !== "string" || label === "") return null;
  if (typeof value !== "string") return null;
  if (!isConfidenceLevel(confidence)) return null;

  return { key, label, value, confidence };
}

/**
 * Lista de campos, ou `null` quando o JSON nao e confiavel.
 *
 * TUDO OU NADA: um campo invalido descarta a lista inteira. Aproveitar os campos
 * bons pareceria tolerante, mas produziria uma conferencia com MENOS campos que a
 * de hoje, silenciosamente — a pessoa conferindo nao teria como saber que faltou
 * algo. Descartar tudo cai no mock, que a tela ja sabe exibir.
 *
 * Lista vazia tambem e `null`: "extraiu zero campos" nao e informacao melhor que
 * a fonte anterior.
 */
export function parseExtractionFields(raw: unknown): readonly MockExtractionField[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const fields: MockExtractionField[] = [];
  for (const item of raw) {
    const field = parseField(item);
    if (!field) return null;
    fields.push(field);
  }
  return fields;
}

/**
 * Motivos FECHADOS de descarte.
 *
 * Codigo curto, nunca texto livre e nunca trecho do documento — mesma regra de
 * `EXTRACTION_FAILURE_REASONS`. Existe para a observabilidade poder dizer POR QUE
 * uma extracao foi ignorada sem carregar nada do conteudo: o motivo e sobre a
 * FORMA do dado, jamais sobre o dado.
 */
export const EXTRACTION_REJECT_REASONS = [
  /** Tentativa em PENDENTE/PROCESSANDO/FALHOU: nao ha campos para ler. */
  "ESTADO_NAO_UTILIZAVEL",
  /** `fields` nao e um array — linha corrompida ou de formato antigo. */
  "JSON_INVALIDO",
  /** Array vazio: "extraiu zero campos" nao e melhor que a fonte anterior. */
  "LISTA_VAZIA",
  /** Algum campo nao bate com o contrato (tudo ou nada). */
  "CAMPO_INVALIDO",
] as const;

export type ExtractionRejectReason = (typeof EXTRACTION_REJECT_REASONS)[number];

export type ExtractionFieldsInspection =
  | { ok: true; fields: readonly MockExtractionField[] }
  | { ok: false; reason: ExtractionRejectReason };

/**
 * Decisao unica COM motivo: esta tentativa entrega campos utilizaveis?
 *
 * Junta as duas travas (estado utilizavel + JSON valido) para que nenhum chamador
 * possa lembrar de uma e esquecer da outra, e classifica o descarte para quem
 * precisa relatar — a prontidao da fila, que a partir do #47C-2 DECIDE com base
 * nestes campos e nao pode ignorar em silencio quando eles somem.
 *
 * O motivo descreve a forma do dado. Nenhum valor extraido sai daqui.
 */
export function inspectExtractionFields(
  state: string,
  rawFields: unknown,
): ExtractionFieldsInspection {
  if (!isUsableExtractionState(state)) {
    return { ok: false, reason: "ESTADO_NAO_UTILIZAVEL" };
  }
  if (!Array.isArray(rawFields)) return { ok: false, reason: "JSON_INVALIDO" };
  if (rawFields.length === 0) return { ok: false, reason: "LISTA_VAZIA" };

  const fields = parseExtractionFields(rawFields);
  if (!fields) return { ok: false, reason: "CAMPO_INVALIDO" };

  return { ok: true, fields };
}

/**
 * Mesma decisao, sem o motivo — `null` quando nao ha campos confiaveis.
 *
 * Wrapper fino sobre `inspectExtractionFields` de proposito: uma unica regra de
 * classificacao, para que o caminho do dono e o da fila nunca divirjam sobre o
 * que e utilizavel.
 */
export function usableExtractionFields(
  state: string,
  rawFields: unknown,
): readonly MockExtractionField[] | null {
  const inspection = inspectExtractionFields(state, rawFields);
  return inspection.ok ? inspection.fields : null;
}
