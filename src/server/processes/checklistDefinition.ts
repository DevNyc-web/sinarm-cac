/**
 * Definicao do checklist de revisao admin — Fase 3.6.
 *
 * Subconjunto do docs/11 §6 aplicavel as fases atuais (sem Pix/GRU): valida os
 * dados ficticios do rascunho + documento ficticio (F4) e confirma
 * explicitamente o que NAO existe ainda. Itens de pagamento/protocolo entram
 * nas fases proprias.
 */

export const CHECKLIST_ITEMS = [
  { key: "destination_validated", label: "Dados do destino validados" },
  { key: "firearm_validated", label: "Arma/PCE ficticia validada" },
  { key: "justification_validated", label: "Justificativa validada" },
  { key: "document_validated", label: "Documento (ficticio) anexado e legivel" },
  { key: "no_pix_confirmed", label: "Confirmado: sem pagamento Pix nesta fase" },
  { key: "no_gru_confirmed", label: "Confirmado: sem GRU/protocolo nesta fase" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];

export const CHECKLIST_KEYS = CHECKLIST_ITEMS.map((item) => item.key) as readonly ChecklistKey[];

export function isChecklistKey(key: string): key is ChecklistKey {
  return (CHECKLIST_KEYS as readonly string[]).includes(key);
}

export function checklistLabel(key: ChecklistKey): string {
  const item = CHECKLIST_ITEMS.find((candidate) => candidate.key === key);
  return item ? item.label : key;
}
