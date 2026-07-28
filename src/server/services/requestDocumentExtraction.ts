/**
 * Caso de uso: ABRIR uma tentativa de extracao para um documento (PR #47B).
 *
 * NAO executa nada — so registra a intencao. Quem executa e
 * `runDocumentExtraction`. Separar os dois e o que permite, no futuro, um worker
 * consumir as tentativas PENDENTE sem que o caminho de request precise mudar.
 *
 * NAO le bytes, NAO chama storage, NAO chama a engine, NAO devolve PII.
 */

import { type ExtractionState } from "@prisma/client";
import {
  MOCK_ENGINE_NAME,
  MOCK_ENGINE_VERSION,
} from "@/server/extraction/mockEngine";
import {
  createPendingExtractionForDocument,
  findLatestExtractionForDocument,
  type ExtractionRow,
} from "@/server/repositories/documentExtractionRepository";
import { findDocumentById } from "@/server/repositories/processDocumentRepository";

/**
 * Estados em que uma tentativa ainda esta VIVA.
 *
 * Enquanto houver uma destas, pedir de novo devolve a mesma linha — e o que
 * impede uma rajada de cliques (ou de mensagens de fila) virar dezenas de
 * tentativas simultaneas do mesmo documento.
 */
export const ACTIVE_EXTRACTION_STATES: readonly ExtractionState[] = ["PENDENTE", "PROCESSANDO"];

/**
 * Estados TERMINAIS. Depois de qualquer um deles, pedir de novo e reprocessar:
 * cria linha NOVA, preservando a anterior (o historico 1:N existe para isso).
 */
export const TERMINAL_EXTRACTION_STATES: readonly ExtractionState[] = [
  "EXTRAIDA",
  "PRECISA_REVISAO",
  "CONFIRMADA",
  "FALHOU",
];

export type RequestExtractionResult =
  | { ok: true; extraction: ExtractionRow; reused: boolean }
  | { ok: false; error: string };

/**
 * Abre (ou reusa) a tentativa corrente do documento.
 *
 * SEM parametro `actor` de proposito: nao ha coluna `requestedBy` em
 * `document_extractions`, entao recebe-lo seria carregar um argumento que o
 * service ignora — e o lint reclama, com razao. A autorizacao vive no chamador
 * (acao administrativa hoje, worker no #47D), mesmo criterio de
 * `reviewProcessDocument`, cujo RBAC fica na server action. Quando houver coluna
 * de autoria ou evento de auditoria, o parametro entra junto com o uso.
 */
export async function requestDocumentExtraction(
  documentId: string,
): Promise<RequestExtractionResult> {
  try {
    const document = await findDocumentById(documentId);
    if (!document) return { ok: false, error: "Documento nao encontrado." };

    // Idempotencia: tentativa viva vence: devolve a mesma, sem criar outra.
    const latest = await findLatestExtractionForDocument(documentId);
    if (latest && ACTIVE_EXTRACTION_STATES.includes(latest.state)) {
      return { ok: true, extraction: latest, reused: true };
    }

    const extraction = await createPendingExtractionForDocument({
      documentId,
      engine: MOCK_ENGINE_NAME,
      engineVersion: MOCK_ENGINE_VERSION,
    });

    return { ok: true, extraction, reused: false };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel abrir a extracao. Verifique o Postgres local (npm run db:push).",
    };
  }
}
