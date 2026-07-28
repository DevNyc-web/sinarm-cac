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
 * `true` para violacao de unique — inclusive a do indice parcial
 * `document_extractions_one_active_per_document`.
 *
 * Checagem ESTRUTURAL, nao `instanceof PrismaClientKnownRequestError`, de
 * proposito: `instanceof` falharia contra o fake dos testes, e ai o caminho de
 * recuperacao de corrida — justamente o que precisa de cobertura — so existiria
 * em producao, sem nunca ter sido exercitado.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
  );
}

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

    try {
      const extraction = await createPendingExtractionForDocument({
        documentId,
        engine: MOCK_ENGINE_NAME,
        engineVersion: MOCK_ENGINE_VERSION,
      });
      return { ok: true, extraction, reused: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // CORRIDA ESPERADA, nao falha: entre o `findLatest` acima e este INSERT,
      // outro chamador abriu a tentativa e o indice parcial recusou a segunda.
      // A constraint funcionando e o resultado desejado — devolver 500 aqui
      // transformaria o mecanismo de protecao em erro para o usuario.
      const concorrente = await findLatestExtractionForDocument(documentId);
      if (concorrente && ACTIVE_EXTRACTION_STATES.includes(concorrente.state)) {
        return { ok: true, extraction: concorrente, reused: true };
      }

      // Colidiu e nao ha ativa: a vencedora ja terminou entre o INSERT e esta
      // releitura. Nao inventamos uma tentativa — quem chamou pede de novo.
      return {
        ok: false,
        error: "Outra extracao para este documento acabou de ser concluida. Tente novamente.",
      };
    }
  } catch {
    return {
      ok: false,
      // `db:migrate`, NAO `db:push`: esta tabela tem um indice unico parcial em
      // SQL cru (ver `20260729000000_extraction_single_active`), e `db push`
      // sincroniza o banco com o schema — que nao o declara. Mandar rodar
      // `db push` aqui seria instruir a apagar a protecao que este service usa.
      error: "Nao foi possivel abrir a extracao. Verifique o Postgres local (npm run db:migrate).",
    };
  }
}
