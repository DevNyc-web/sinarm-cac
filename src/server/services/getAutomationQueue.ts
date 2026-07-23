/**
 * Fila de automacao — VIEW MODEL (checklist pre-execucao no admin).
 *
 * Le o estado que ja existe, deriva a prontidao com o dominio JA MERGEADO
 * (`deriveAutomationReadiness`) e classifica cada processo numa categoria
 * (`classifyReadiness`). NAO reimplementa regra de checklist, NAO executa nada,
 * NAO muda status, NAO acessa Gov.br/SINARM.
 *
 * Need-to-know: o repositorio ja restringe o `select`; aqui reduzimos ainda mais
 * para um DTO de exibicao — codigo, dono, categoria, bloqueio principal e
 * contagem. Nenhum campo sensivel (arquivo, sha256, storageKey, serial) sai.
 */
import { findMockUser } from "@/server/auth/mockUsers";
import {
  deriveAutomationReadiness,
  type AutomationReadinessStatus,
} from "@/server/automation/automationReadiness";
import {
  classifyReadiness,
  type AutomationQueueCategory,
} from "@/server/automation/automationQueue";
import {
  buildExtractionReview,
  buildFieldSuggestions,
  type IntakeDocument,
  type ReviewDocument,
} from "@/server/documents";
import { listAutomationQueue } from "@/server/repositories/processRepository";

export type AutomationQueueRow = {
  id: string;
  code: string;
  ownerLabel: string;
  category: AutomationQueueCategory;
  status: AutomationReadinessStatus;
  ready: boolean;
  /** Rotulo do bloqueio principal; `null` quando pronto. */
  mainBlockerLabel: string | null;
  blockerCount: number;
};

export async function getAutomationQueue(): Promise<AutomationQueueRow[]> {
  const rows = await listAutomationQueue();

  return rows.map((row) => {
    // Documentos para derivar estado por requisito. `rejectionReason` nao e
    // buscado (need-to-know) e nao afeta a prontidao — so o status importa.
    const documents: IntakeDocument[] = row.documents.map((doc) => ({
      type: doc.type,
      status: doc.status,
      createdAt: doc.createdAt,
      rejectionReason: null,
    }));

    // Sugestoes regeradas no servidor, como na tela do usuario. Os campos
    // id/originalFileName nao influenciam a aplicabilidade — placeholders.
    const reviewDocuments: ReviewDocument[] = row.documents.map((doc, index) => ({
      id: `doc-${index}`,
      originalFileName: "",
      type: doc.type,
      status: doc.status,
      createdAt: doc.createdAt,
      rejectionReason: null,
    }));
    const suggestions = buildFieldSuggestions(buildExtractionReview(reviewDocuments), {
      destination: row.destination,
    });

    // Pagamento: PAGO se houver qualquer pagamento pago; senao o mais recente.
    const paymentStatus = row.payments.some((payment) => payment.status === "PAGO")
      ? "PAGO"
      : (row.payments[0]?.status ?? null);

    const readiness = deriveAutomationReadiness({
      processTypeCode: row.processType.code,
      destination: row.destination,
      hasFirearmPce: row.firearm !== null,
      documents,
      suggestions,
      paymentStatus,
    });

    const classification = classifyReadiness(readiness);
    const owner = findMockUser(row.userId);

    return {
      id: row.id,
      code: row.code,
      ownerLabel: owner ? owner.name : row.userId,
      category: classification.category,
      status: classification.status,
      ready: classification.ready,
      mainBlockerLabel: classification.mainBlocker?.label ?? null,
      blockerCount: classification.blockerCount,
    };
  });
}
