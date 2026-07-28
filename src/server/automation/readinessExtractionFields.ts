/**
 * Campos extraidos para a PRONTIDAO (fila e gate do admin) — PR #47C-2.
 *
 * ── Por que existe, separado do loader do dono ───────────────────────────────
 * `loadOwnerExtractionFields` e owner-scoped: recebe documentos ja lidos sob
 * checagem de posse, e ha teste estatico proibindo caminho admin de importa-lo.
 * Aqui nao ha posse a ancorar — a fila e da equipe. O que autoriza a leitura e
 * outra coisa, e ela precisa estar escrita:
 *
 *   PERMISSAO GOVERNA DIVULGACAO, NAO COMPUTACAO.
 *
 * `process.pii.viewFull` protege PII que CHEGA a alguem: resposta, payload RSC,
 * log, trilha. Nao protege um calculo que consome o dado e devolve um veredito.
 * A prontidao le os campos para responder UMA pergunta — "ha sugestao de destino
 * aplicavel pendente?" — e o que sai e uma contagem de bloqueios. Nenhum valor
 * atravessa a fronteira do service.
 *
 * Duas consequencias que nao sao detalhe:
 *
 *   1. O RETORNO DESTA FUNCAO NAO PODE ENTRAR EM DTO, payload, log ou trilha.
 *      E insumo interno. `AutomationQueueRow` nao tem campo que o comporte, e ha
 *      teste travando as chaves desse tipo.
 *   2. A LEITURA NAO PODE SER CONDICIONADA A PERMISSAO. Se fosse, SUPORTE (que
 *      tem `pii.viewMinimal`) veria uma prontidao diferente de OPERADOR no mesmo
 *      processo — e prontidao e fato sobre o processo, nao sobre quem olha. Por
 *      isso esta funcao nao recebe actor nem role, e nao deve passar a receber.
 *
 * NAO faz OCR, NAO chama engine, NAO cria extracao, NAO grava nada, NAO acessa
 * rede e NAO conhece storage.
 */
import {
  inspectExtractionFields,
  type ExtractionRejectReason,
} from "@/server/documents/documentExtractionFields";
import {
  type ExtractionFieldsByDocument,
  type PersistedExtraction,
} from "@/server/documents";
import { sourceForEngine } from "@/server/extraction/reviewSource";
import { findLatestExtractionsWithFieldsForDocuments } from "@/server/repositories/documentExtractionRepository";
import { logger } from "@/lib/logger";

const EMPTY: ExtractionFieldsByDocument = new Map();

/**
 * Registra que uma extracao persistida foi DESCARTADA.
 *
 * Existe porque, a partir do #47C-2, o descarte deixa de ser cosmetico: a fila
 * decide com base nestes campos, e cair no mock em silencio significaria a
 * prontidao dizer "pronto" sobre dados que ninguem leu. Como o mock e
 * visualmente identico a uma extracao valida (espelhamento do #47B), ninguem
 * perceberia pela tela.
 *
 * SEM PII: so o codigo do motivo — que descreve a FORMA do dado — e o
 * `documentId`, um identificador opaco que ja circula em trilha e log. Nunca
 * `key`, `label`, `value`, `confidence`, texto de OCR ou `storageKey`.
 */
function logRejection(documentId: string, reasonCode: ExtractionRejectReason): void {
  logger.warn(
    { event: "extraction_fields_rejected", reasonCode, documentId },
    "extracao persistida descartada; prontidao caiu no mock",
  );
}

/**
 * Campos utilizaveis por `documentId`, para derivar prontidao.
 *
 * UMA query em lote para todos os documentos de todos os processos da fila —
 * chamar por processo geraria N+1 numa lista que cresce com o negocio.
 *
 * NUNCA LANCA: banco fora do ar devolve mapa vazio, e mapa vazio faz a prontidao
 * cair no mock, que e exatamente o comportamento de antes deste PR. A fila
 * continua respondendo em vez de quebrar.
 */
export async function loadReadinessExtractionFields(
  documentIds: readonly string[],
): Promise<ExtractionFieldsByDocument> {
  if (documentIds.length === 0) return EMPTY;

  try {
    const rows = await findLatestExtractionsWithFieldsForDocuments(documentIds);

    const byDocument = new Map<string, PersistedExtraction>();
    for (const row of rows) {
      const inspection = inspectExtractionFields(row.state, row.fields);
      if (inspection.ok) {
        byDocument.set(row.documentId, {
          fields: inspection.fields,
          source: sourceForEngine(row.engine),
        });
      } else {
        logRejection(row.documentId, inspection.reason);
      }
    }
    return byDocument;
  } catch {
    // Sem `error` no log: a exceção do Prisma pode carregar trecho da query, e a
    // query menciona os documentos do cliente. O evento acima ja cobre descarte
    // por conteudo; falha de banco e ruido de infraestrutura, nao de dado.
    return EMPTY;
  }
}
