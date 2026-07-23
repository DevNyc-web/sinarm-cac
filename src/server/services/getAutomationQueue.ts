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
import { snapshotFromRow } from "@/server/automation/automationReadinessInput";
import { wasSubmittedToAutomationQueue } from "@/server/automation/automationQueueSubmission";
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
  /** Ja liberado para a fila de automacao futura (marcador na trilha). */
  submitted: boolean;
};

export async function getAutomationQueue(): Promise<AutomationQueueRow[]> {
  const rows = await listAutomationQueue();

  return rows.map((row) => {
    // Snapshot montado pelo mesmo adaptador do gate — regras so em
    // deriveAutomationReadiness (nada de checklist reimplementado aqui).
    const readiness = deriveAutomationReadiness(snapshotFromRow(row));

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
      submitted: wasSubmittedToAutomationQueue(row.statusEvents),
    };
  });
}
