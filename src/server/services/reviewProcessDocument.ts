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
import { transitionInternalStatus } from "./transitionInternalStatus";

export type ReviewDecision = "APROVADO" | "REJEITADO";

export type ReviewDocumentResult = { ok: true } | { ok: false; error: string };

export async function reviewProcessDocument(
  actor: AuthUser,
  documentId: string,
  decision: ReviewDecision,
  rejectionReason?: string,
): Promise<ReviewDocumentResult> {
  // `?? ""` e nao `?.trim()`: o motivo passa a ser usado em DOIS lugares (o
  // documento e a nota do evento), e um `string` sem `undefined` evita repetir
  // o trim — a guarda logo abaixo garante que ele nao esta vazio na rejeicao.
  const motivo = rejectionReason?.trim() ?? "";
  if (decision === "REJEITADO" && !motivo) {
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
      rejectionReason: motivo,
    });

    // Reflete a decisao na fila, sem regredir quem ja passou do pagamento.
    //
    // Os DOIS lados passam pela porta canonica `transitionInternalStatus`,
    // mesma de `confirmPixPayment`/`uploadProcessDocument`. `internalStatus`
    // vai para o estado canonico e `operationalStatus` continua indo para o
    // mesmo valor de sempre, passado em `alsoSet` — MESMO efeito final na fila,
    // no admin e no status visivel ao cliente; so a porta mudou.
    //
    // Aprovacao: Fase 5f (docs/47 §6.2, §9), candidato aprovado pela 5d.
    // Rejeicao: Fase 5f completa (docs/48), com `BLOQUEADO_OPERACIONAL` —
    // categoria NOVA para bloqueio decidido por HUMANO. Continua PROIBIDO usar
    // `BLOQUEADO_INSTABILIDADE` ou qualquer `EXCECAO_*` aqui (docs/46 §3.4):
    // aqueles afirmam causa apurada pela AUTOMACAO, que ninguem verificou.
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
      const transition = await transitionInternalStatus({
        processId: document.processId,
        toStatus: "BLOQUEADO_OPERACIONAL",
        // `userFacingStatus` vai junto porque o caminho legado ja o escrevia na
        // MESMA `update` — omitir aqui mudaria o que o cliente ve, e este PR nao
        // muda efeito, so a porta.
        alsoSet: {
          operationalStatus: "BLOQUEADO",
          userFacingStatus: "PRECISAMOS_DE_UM_AJUSTE",
        },
        actorMockUserId: actor.id,
        actorRole: actor.role,
        // O motivo entra na trilha do PROCESSO, nao so no documento: era
        // justamente o buraco de auditoria do docs/48 §8 — a rejeicao mudava o
        // status sem registrar evento nenhum. Texto do operador embutido na
        // nota segue o padrao ja existente em `manualExecution`; o formulario
        // ja exige motivo curto SEM PII do documento, e o mesmo texto ja e
        // exibido ao cliente via `rejectionReason`. Nenhuma sanitizacao nova
        // e inventada aqui.
        note: `Documento rejeitado pela equipe: ${motivo}`,
      });
      if (!transition.ok) return { ok: false, error: transition.error };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel revisar. Verifique o Postgres local (npm run db:migrate).",
    };
  }
}
