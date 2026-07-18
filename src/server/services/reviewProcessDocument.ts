/**
 * Caso de uso: revisar documento FICTICIO — Fase 4 (docs/11 §14, versao dev).
 *
 * A permissao ("document.review" — so ADMIN/OPERADOR) e exigida pelo guard na
 * server action. Rejeicao exige motivo curto, SEM reproduzir PII do documento.
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import {
  findDocumentById,
  updateDocumentReview,
} from "@/server/repositories/processDocumentRepository";
import { updateProcessOperations } from "@/server/repositories/processRepository";

export type ReviewDecision = "APROVADO" | "REJEITADO";

export type ReviewDocumentResult = { ok: true } | { ok: false; error: string };

export async function reviewProcessDocument(
  actor: AuthUser,
  documentId: string,
  decision: ReviewDecision,
  rejectionReason?: string,
): Promise<ReviewDocumentResult> {
  if (decision === "REJEITADO" && !rejectionReason?.trim()) {
    return { ok: false, error: "Informe o motivo da rejeicao (sem dados do documento)." };
  }

  try {
    const document = await findDocumentById(documentId);
    if (!document) return { ok: false, error: "Documento nao encontrado." };
    if (document.status === "APROVADO" || document.status === "REJEITADO") {
      return { ok: false, error: "Documento ja revisado." };
    }

    await updateDocumentReview({
      documentId,
      status: decision,
      reviewedByMockUserId: actor.id,
      reviewedByRole: actor.role,
      rejectionReason: rejectionReason?.trim(),
    });

    // Reflete a decisao na fila, sem regredir quem ja passou do pagamento.
    if (decision === "APROVADO" && document.process.operationalStatus === "DOCUMENTO_ENVIADO") {
      await updateProcessOperations(document.processId, {
        operationalStatus: "DOCUMENTO_APROVADO",
      });
    }
    if (decision === "REJEITADO" && document.process.operationalStatus !== "CANCELADO_DEV") {
      await updateProcessOperations(document.processId, {
        operationalStatus: "BLOQUEADO",
        userFacingStatus: "PRECISAMOS_DE_UM_AJUSTE",
      });
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel revisar. Verifique o Postgres local (npm run db:push).",
    };
  }
}
