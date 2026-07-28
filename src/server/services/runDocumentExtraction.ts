/**
 * Caso de uso: EXECUTAR uma tentativa de extracao (PR #47B).
 *
 * NUNCA pode ser chamado do caminho de render: extracao e assincrona por
 * natureza e travaria a pagina. Nesta fase so roda em teste; o worker do PR #47D
 * sera o chamador de producao. Ha teste estatico proibindo que qualquer arquivo
 * de `src/app` ou `src/components` importe este modulo.
 *
 * NAO le bytes do storage: a engine desta fase e a mock, que nao os usa. Quando
 * um OCR real entrar, a leitura do arquivo entra AQUI — nao no request.
 *
 * NAO devolve `fields`: quem executa nao precisa receber PII de volta.
 */
import { fromPrismaDocumentType } from "@/server/documents/documentTypes";
import { getExtractionEngine } from "@/server/extraction/getExtractionEngine";
import {
  claimPendingExtraction,
  findLatestExtractionForDocument,
  updateExtractionState,
  type ExtractionRow,
} from "@/server/repositories/documentExtractionRepository";
import { findDocumentById } from "@/server/repositories/processDocumentRepository";

/**
 * Resultado da execucao.
 *
 * `claimed: false` NAO e erro: com dois workers, o perdedor perde o tempo todo,
 * por desenho. Se isso voltasse como `ok: false`, o worker do #47D nao teria como
 * distinguir "esta tentativa nao era minha" de "o banco caiu" — e ou alertaria em
 * falso, ou silenciaria falha de verdade. O discriminante separa as duas.
 */
export type RunExtractionResult =
  | { ok: true; claimed: true; extraction: ExtractionRow }
  | { ok: true; claimed: false }
  | { ok: false; error: string };

/**
 * Executa a tentativa VIVA do documento.
 *
 * Recebe `documentId` (nao `extractionId`) porque o chamador natural — worker ou
 * acao administrativa — raciocina por documento; a tentativa corrente e sempre a
 * mais recente.
 */
export async function runDocumentExtraction(documentId: string): Promise<RunExtractionResult> {
  try {
    const document = await findDocumentById(documentId);
    if (!document) return { ok: false, error: "Documento nao encontrado." };

    const latest = await findLatestExtractionForDocument(documentId);
    if (!latest) return { ok: false, error: "Nenhuma extracao aberta para este documento." };

    // CLAIM ATOMICO antes de qualquer trabalho. Tambem cobre o caso de a
    // tentativa nao estar PENDENTE (ja processando, ou terminal): o `where` do
    // claim nao a encontra e devolvemos `claimed: false` sem tocar na engine.
    //
    // PROCESSANDO antes de chamar a engine: se o processo morrer no meio, a
    // linha denuncia que houve tentativa, em vez de parecer que nunca comecou.
    const claimed = await claimPendingExtraction(latest.id);
    if (!claimed) return { ok: true, claimed: false };

    const engine = getExtractionEngine();
    const result = await engine.extract({
      documentId,
      kind: fromPrismaDocumentType(document.type),
      mimeType: document.mimeType,
      // Sem `bytes`: a engine mock nao le arquivo.
    });

    if (!result.ok) {
      const extraction = await updateExtractionState(latest.id, {
        state: "FALHOU",
        // Codigo fechado — o tipo garante que nao entra texto livre aqui.
        failureReason: result.failureReason,
      });
      return { ok: true, claimed: true, extraction };
    }

    const extraction = await updateExtractionState(latest.id, {
      state: "EXTRAIDA",
      fields: result.fields,
      confidence: result.confidence,
      extractedAt: new Date(),
    });

    return { ok: true, claimed: true, extraction };
  } catch {
    return {
      ok: false,
      // `db:migrate`, NAO `db:push` — mesmo motivo do `requestDocumentExtraction`:
      // `db push` pode remover o indice unico parcial que garante uma unica
      // tentativa ativa, e e justamente ele que sustenta o claim deste service.
      error: "Nao foi possivel executar a extracao. Verifique o Postgres local (npm run db:migrate).",
    };
  }
}
