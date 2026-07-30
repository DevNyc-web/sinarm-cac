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
import { transitionInternalStatus } from "./transitionInternalStatus";

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
    //
    // Fase 5f, lado aprovacao (docs/47 §6.2, §9): via `transitionInternalStatus`,
    // mesma porta canonica de `confirmPixPayment`/`uploadProcessDocument`.
    // `internalStatus` vai para o candidato aprovado pela Fase 5d;
    // `operationalStatus` continua indo para `DOCUMENTO_APROVADO`, passado em
    // `alsoSet` — MESMO efeito final na fila, no admin e no status visivel ao
    // cliente. O lado REJEITADO fica de fora de proposito: `BLOQUEADO` exige
    // decisao propria antes de ganhar porta canonica (docs/47 §6.5) — mapear
    // para um InternalStatus de excecao automatica sem essa decisao e
    // PROIBIDO (docs/46 §3.4).
    if (decision === "APROVADO" && document.process.operationalStatus === "DOCUMENTO_ENVIADO") {
      const transition = await transitionInternalStatus({
        processId: document.processId,
        toStatus: "DOCUMENTO_VALIDADO",
        alsoSet: { operationalStatus: "DOCUMENTO_APROVADO" },
        actorMockUserId: actor.id,
        actorRole: actor.role,
        note: "Documento aprovado pela equipe",
      });
      if (!transition.ok) return { ok: false, error: transition.error };
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
      error: "Nao foi possivel revisar. Verifique o Postgres local (npm run db:migrate).",
    };
  }
}
