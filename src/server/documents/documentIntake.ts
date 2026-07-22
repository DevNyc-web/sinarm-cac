/**
 * Modulo de documentos — derivacao do ESTADO de cada documento esperado.
 *
 * Cruza os requisitos (documentRequirements) com o que existe no banco
 * (ProcessDocument) e diz, por tipo, se esta pendente ou qual o status do
 * arquivo mais recente. Funcao PURA: sem banco, sem rede, sem OCR/IA.
 */
import type {
  DocumentStatus as PrismaDocumentStatus,
  DocumentType as PrismaDocumentType,
} from "@prisma/client";
import { fromPrismaDocumentStatus, type DocumentState } from "./documentStatus";
import { toPrismaDocumentType, type DocumentKind } from "./documentTypes";

/** Subconjunto do documento persistido necessario para derivar o estado. */
export interface IntakeDocument {
  type: PrismaDocumentType;
  status: PrismaDocumentStatus;
  createdAt: Date;
  rejectionReason: string | null;
}

export interface RequirementState {
  state: DocumentState;
  /** Motivo da rejeicao (curto, SEM PII) — so quando o estado e REJEITADO. */
  rejection: string | null;
  /** `true` quando ainda nao ha arquivo para este tipo (botao "Anexar"). */
  pending: boolean;
}

/**
 * Estado do requisito `kind`. Sem documento => PENDENTE.
 * Havendo mais de um arquivo do mesmo tipo (reenvio/substituicao), vale o mais
 * recente — o historico completo continua visivel na lista de enviados.
 */
export function resolveRequirementState(
  kind: DocumentKind,
  documents: readonly IntakeDocument[],
): RequirementState {
  const prismaType = toPrismaDocumentType(kind);
  const match = documents
    .filter((doc) => doc.type === prismaType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (!match) return { state: "PENDENTE", rejection: null, pending: true };

  const state = fromPrismaDocumentStatus(match.status);
  return {
    state,
    rejection: state === "REJEITADO" ? match.rejectionReason : null,
    pending: false,
  };
}
