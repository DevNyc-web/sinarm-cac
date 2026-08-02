/**
 * Caso de uso: REABRIR a conferencia documental — docs/50 §5.
 *
 * POR QUE ESTE SERVICE EXISTE: o dropdown manual movia so o PROCESSO. O
 * documento tem status proprio, e `reviewProcessDocument` recusa revisar de
 * novo um documento ja `APROVADO`/`REJEITADO` — entao "voltar para conferencia"
 * pelo dropdown deixava o processo dizendo "aguardando conferencia" com
 * ninguem conseguindo conferir (o beco sem saida do docs/50 §3, fechado pelo
 * PR #86). Esta acao e a saida: move os DOIS lados de uma vez.
 *
 * NAO E "mover status": e DESFAZER uma decisao humana. Por isso exige motivo,
 * permissao propria (`document.review.reopen`, exigida pela server action) e
 * registra evento tipado com o motivo na trilha.
 *
 * ORDEM (documento primeiro, depois porta canonica): mesmo padrao ja usado por
 * `reviewProcessDocument`. NAO e atomico entre as duas tabelas — limite
 * herdado e assumido. Se a transicao falhar depois do documento voltar, sobra
 * documento REVISAVEL com processo nao movido: estado recuperavel, e o oposto
 * exato do beco sem saida que esta acao existe para evitar. A ordem inversa
 * recriaria o beco.
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import {
  findDocumentById,
  reopenDocumentForReview,
} from "@/server/repositories/processDocumentRepository";
import { transitionInternalStatus } from "./transitionInternalStatus";

export type ReopenDocumentReviewResult = { ok: true } | { ok: false; error: string };

export async function reopenDocumentReview(
  actor: AuthUser,
  documentId: string,
  reason?: string,
): Promise<ReopenDocumentReviewResult> {
  // Mesmo contrato de motivo da rejeicao (`reviewProcessDocument`): curto e SEM
  // reproduzir PII do documento. O formulario pede isso ao operador.
  const motivo = reason?.trim() ?? "";
  if (!motivo) {
    return { ok: false, error: "Informe o motivo da reabertura (sem dados do documento)." };
  }

  try {
    const document = await findDocumentById(documentId);
    if (!document) return { ok: false, error: "Documento nao encontrado." };

    // So faz sentido desfazer o que foi feito: documento nao revisado ja esta
    // conferivel, e "reabrir" nele nao teria nada para desfazer.
    if (document.status !== "APROVADO" && document.status !== "REJEITADO") {
      return { ok: false, error: "Documento ainda nao foi revisado — nao ha conferencia a reabrir." };
    }

    // Mesma guarda do lado rejeicao de `reviewProcessDocument`: processo
    // cancelado nao volta para a fila por efeito colateral de documento.
    if (document.process.operationalStatus === "CANCELADO_DEV") {
      return { ok: false, error: "Processo cancelado — reabrir conferencia nao se aplica." };
    }

    await reopenDocumentForReview(documentId);

    // `alsoSet` sem `userFacingStatus` DE PROPOSITO: `uploadProcessDocument`
    // tambem so escreve `operationalStatus` ao produzir DOCUMENTO_ENVIADO.
    // Reaberto e recem-enviado ficam indistinguiveis para o cliente, que e o
    // efeito desejado — e evita inventar uma visao que o fluxo natural nao cria.
    const transition = await transitionInternalStatus({
      processId: document.processId,
      toStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE",
      alsoSet: { operationalStatus: "DOCUMENTO_ENVIADO" },
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: `Conferencia documental reaberta: ${motivo}`,
    });
    if (!transition.ok) return { ok: false, error: transition.error };

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel reabrir a conferencia. Verifique o Postgres local.",
    };
  }
}
