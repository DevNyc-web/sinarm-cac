/**
 * Leitura dos campos extraidos PARA O DONO do processo (PR #47C-0).
 *
 * INERTE nesta fase: nenhum consumidor chama esta funcao ainda. Ela existe para
 * que o PR #47C — a troca atomica da fonte de `buildExtractionReview` — seja um
 * commit pequeno e revisavel, com a infraestrutura de leitura ja aprovada.
 *
 * ── Por que "Owner" no nome ──────────────────────────────────────────────────
 * `document_extractions.fields` e PII: e o que foi lido do documento do cliente.
 * O criterio de acesso deste projeto tem DOIS caminhos legitimos, nao um:
 *
 *   1. POSSE — o dono do processo ve os proprios dados. E o que
 *      `listDocumentsForOwner` ja faz hoje ao devolver `DOCUMENT_SENSITIVE_SELECT`
 *      (nome original do arquivo, sha256) sem exigir permissao nenhuma.
 *   2. PERMISSAO — `process.pii.viewFull` protege PII de TERCEIROS, ou seja, a
 *      equipe (ADMIN/OPERADOR/FINANCEIRO) lendo o processo de outra pessoa.
 *
 * Esta funcao serve o caminho 1 e SOMENTE ele. A assinatura recebe os documentos
 * JA LIDOS — nao ids soltos — porque a unica forma de te-los e ter passado por
 * `listDocumentsForOwner(process.id)`, que so roda depois de
 * `findProcessByIdForUser(processId, actor.id)` confirmar a posse. A checagem de
 * dono, portanto, ja aconteceu rio acima; pedir ids permitiria montar a lista do
 * nada e furar essa cadeia.
 *
 * PROIBIDO em caminho de equipe: uma tela de admin que precise destes campos tem
 * de checar `process.pii.viewFull` explicitamente e usar o repositorio direto —
 * ha teste estatico garantindo que `src/app/(admin)` e os services de admin nao
 * importam este modulo.
 *
 * NAO conhece storage: nao ha `storageKey` nem caminho de arquivo aqui. NAO faz
 * OCR, NAO chama engine, NAO cria extracao, NAO grava nada — so le.
 */
import { usableExtractionFields } from "@/server/documents/documentExtractionFields";
import {
  type ExtractionFieldsByDocument,
  type PersistedExtraction,
} from "@/server/documents";
import { sourceForEngine } from "@/server/extraction/reviewSource";
import { findLatestExtractionsWithFieldsForDocuments } from "@/server/repositories/documentExtractionRepository";

/** Extracoes utilizaveis por `documentId`. Documento AUSENTE => sem extracao confiavel. */
export type OwnerExtractionFields = ExtractionFieldsByDocument;

/**
 * Identificacao minima do documento ja lido sob checagem de posse.
 *
 * So `id` de proposito: aceitar a linha inteira convidaria a passar `storageKey`
 * ou metadado sensivel por aqui sem necessidade.
 */
export type OwnedDocumentRef = { id: string };

const EMPTY: OwnerExtractionFields = new Map();

/**
 * Mapa dos campos extraidos dos documentos do dono.
 *
 * NUNCA LANCA. Banco fora do ar, JSON corrompido ou estado nao utilizavel
 * resultam em documento ausente do mapa — e ausencia significa, para o chamador
 * do #47C, "continue usando a fonte de hoje". A tela degrada para o comportamento
 * atual em vez de quebrar, mesmo criterio do `catch` que a propria pagina do
 * processo ja usa quando o Postgres local nao responde.
 */
export async function loadOwnerExtractionFields(
  documents: readonly OwnedDocumentRef[],
): Promise<OwnerExtractionFields> {
  if (documents.length === 0) return EMPTY;

  try {
    const rows = await findLatestExtractionsWithFieldsForDocuments(
      documents.map((document) => document.id),
    );

    const byDocument = new Map<string, PersistedExtraction>();
    for (const row of rows) {
      const fields = usableExtractionFields(row.state, row.fields);
      // Sem campos confiaveis => fica FORA do mapa. Gravar uma lista vazia diria
      // "extraiu nada", que o chamador nao tem como distinguir de "nao ha linha".
      if (fields) {
        byDocument.set(row.documentId, { fields, source: sourceForEngine(row.engine) });
      }
    }
    return byDocument;
  } catch {
    return EMPTY;
  }
}
