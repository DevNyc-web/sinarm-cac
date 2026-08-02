/**
 * Caso de uso: REGISTRAR aprovacao documental feita FORA do fluxo normal —
 * docs/50 §6.
 *
 * POR QUE ESTE SERVICE EXISTE: o dropdown manual/admin permite escolher
 * `operationalStatus = DOCUMENTO_APROVADO` diretamente. Isso move so o
 * PROCESSO — o documento continua no status anterior, sem revisor, sem data,
 * sem motivo. A fila passa a dizer "aprovado" para uma conferencia que
 * ninguem assinou (docs/50 §3, paragrafo final).
 *
 * NAO E "forcar aprovacao administrativa" como atalho de rotina: e assumir um
 * revisor REAL que so nao passou pelo formulario de revisao (conferencia feita
 * por outro canal). Por isso exige motivo, permissao propria
 * (`document.review.approveOutOfFlow`, exigida pela server action) e registra
 * evento tipado com o motivo na trilha.
 *
 * ORDEM (documento primeiro, depois porta canonica): mesmo padrao de
 * `reopenDocumentReview`. NAO e atomico entre as duas tabelas. Se a transicao
 * do processo falhar depois do documento ser marcado `APROVADO`, o documento
 * fica com revisor registrado e o processo nao avancou — divergencia
 * detectavel e corrigivel. A ordem inversa deixaria o processo dizendo
 * "aprovado" com o documento ainda sem revisor: exatamente o estado que esta
 * acao existe para eliminar.
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import {
  findDocumentById,
  updateDocumentReview,
} from "@/server/repositories/processDocumentRepository";
import { transitionInternalStatus } from "./transitionInternalStatus";

export type ApproveDocumentOutOfFlowResult = { ok: true } | { ok: false; error: string };

export async function approveDocumentOutOfFlow(
  actor: AuthUser,
  documentId: string,
  reason?: string,
): Promise<ApproveDocumentOutOfFlowResult> {
  // Mesmo contrato de motivo de `reopenDocumentReview`/rejeicao: curto e SEM
  // reproduzir PII do documento.
  const motivo = reason?.trim() ?? "";
  if (!motivo) {
    return {
      ok: false,
      error: "Informe onde a conferencia aconteceu (sem dados do documento).",
    };
  }

  try {
    const document = await findDocumentById(documentId);
    if (!document) return { ok: false, error: "Documento nao encontrado." };

    // Mesma guarda de `reviewProcessDocument`: nao sobrescreve revisao ja
    // feita (docs/50 §6 — "outra acao, nao esta").
    if (document.status === "APROVADO" || document.status === "REJEITADO") {
      return { ok: false, error: "Documento ja revisado." };
    }

    // Mesma guarda do lado rejeicao/reabertura: processo cancelado nao avanca
    // por efeito colateral de documento.
    if (document.process.operationalStatus === "CANCELADO_DEV") {
      return { ok: false, error: "Processo cancelado — aprovacao fora do fluxo nao se aplica." };
    }

    await updateDocumentReview({
      documentId,
      status: "APROVADO",
      reviewedByMockUserId: actor.id,
      reviewedByRole: actor.role,
    });

    const transition = await transitionInternalStatus({
      processId: document.processId,
      toStatus: "DOCUMENTO_VALIDADO",
      alsoSet: { operationalStatus: "DOCUMENTO_APROVADO" },
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: `Aprovacao documental fora do fluxo: ${motivo}`,
    });
    if (!transition.ok) return { ok: false, error: transition.error };

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel registrar a aprovacao. Verifique o Postgres local.",
    };
  }
}
