import { type ChecklistGroup } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { type ChecklistKey } from "@/server/processes/checklistDefinition";

/**
 * Repositorio do checklist de revisao admin (docs/11 §6, versao dev/mock).
 * Itens sao criados sob demanda na primeira marcacao (upsert por processo+key).
 */

export function listChecklistItems(processId: string) {
  return getPrisma().processChecklistItem.findMany({
    where: { processId },
    orderBy: { createdAt: "asc" },
  });
}

export type SetChecklistItemData = {
  processId: string;
  key: ChecklistKey;
  group: ChecklistGroup;
  label: string;
  checked: boolean;
  /** Quem marcou/desmarcou (usuario mock + perfil) — docs/11 §18. */
  actorMockUserId: string;
  actorRole: string;
};

export function setChecklistItem(data: SetChecklistItemData) {
  const checkedFields = data.checked
    ? {
        checked: true,
        checkedByMockUserId: data.actorMockUserId,
        checkedByRole: data.actorRole,
        checkedAt: new Date(),
      }
    : {
        checked: false,
        checkedByMockUserId: null,
        checkedByRole: null,
        checkedAt: null,
      };

  return getPrisma().processChecklistItem.upsert({
    where: { processId_key: { processId: data.processId, key: data.key } },
    update: checkedFields,
    create: {
      processId: data.processId,
      key: data.key,
      group: data.group,
      label: data.label,
      ...checkedFields,
    },
  });
}
