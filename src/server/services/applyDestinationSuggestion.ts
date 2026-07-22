/**
 * Caso de uso: APLICAR MANUALMENTE uma sugestao de preenchimento — so destino.
 *
 * Principios (docs/25):
 * - Nada acontece sem acao explicita do usuario, com confirmacao marcada.
 * - O valor aplicado e REGERADO NO SERVIDOR a partir dos documentos conferidos.
 *   O formulario informa QUAL sugestao, nunca QUAL VALOR — cliente nao e fonte.
 * - So campos de `Destination` (allowlist do dominio). Campos futuros
 *   (dados pessoais, origem, registro CAC) sao recusados.
 * - Sem OCR, sem IA, sem rede, sem envio a terceiros.
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import {
  buildExtractionReview,
  buildFieldSuggestions,
  checkSuggestionApplication,
} from "@/server/documents";
import { listDocumentsForOwner } from "@/server/repositories/processDocumentRepository";
import { recordOperationalEvent } from "@/server/repositories/processEventRepository";
import {
  findProcessByIdForUser,
  updateProcessDestination,
} from "@/server/repositories/processRepository";

export type ApplySuggestionResult =
  | { ok: true; target: string }
  | { ok: false; error: string };

export async function applyDestinationSuggestion(
  actor: AuthUser,
  processId: string,
  suggestionId: string,
  /** Marcacao explicita do usuario na tela — sem ela nada e aplicado. */
  confirmed: boolean,
): Promise<ApplySuggestionResult> {
  if (!confirmed) {
    return {
      ok: false,
      error: "Marque a confirmacao de que conferiu a informacao antes de aplicar.",
    };
  }
  if (!suggestionId) {
    return { ok: false, error: "Sugestao nao informada." };
  }

  try {
    // Dono do processo: o usuario so aplica no proprio processo.
    const process = await findProcessByIdForUser(processId, actor.id);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    // Fonte da verdade: documentos conferidos + destino atual, lidos agora.
    const documents = await listDocumentsForOwner(process.id);
    const reviews = buildExtractionReview(documents);
    const suggestions = buildFieldSuggestions(reviews, { destination: process.destination });

    const suggestion = suggestions.find((candidate) => candidate.id === suggestionId);
    const check = checkSuggestionApplication(suggestion);
    if (!check.ok) return { ok: false, error: check.message };

    await updateProcessDestination(process.id, check.patch);

    // Trilha append-only (docs/11 §18). Nao ha kind proprio para "sugestao
    // aplicada" no enum; usamos NOTA, o mais proximo, para nao exigir migration.
    // Valores de DESTINO (evento/cidade/UF) nao sao PII de pessoa e ja constam
    // no proprio processo — a trilha nao amplia o alcance do dado.
    await recordOperationalEvent({
      processId: process.id,
      kind: "NOTA",
      fromValue: check.previousValue,
      toValue: check.patch[Object.keys(check.patch)[0] as keyof typeof check.patch] ?? null,
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: `Sugestao aplicada manualmente em ${check.target} (conferida pelo usuario)`,
    });

    return { ok: true, target: check.target };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel aplicar a sugestao. Verifique o Postgres local (npm run db:push).",
    };
  }
}
