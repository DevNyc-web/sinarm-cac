/**
 * Definicao do checklist de revisao admin — Fase 3.6.
 *
 * Subconjunto do docs/11 §6 aplicavel a esta fase (sem upload/Pix/GRU): valida
 * os dados ficticios do rascunho e confirma explicitamente o que NAO existe
 * ainda. Itens de pagamento/documento/protocolo entram nas fases proprias.
 */

export const CHECKLIST_ITEMS = [
  { key: "destination_validated", label: "Dados do destino validados" },
  { key: "firearm_validated", label: "Arma/PCE ficticia validada" },
  { key: "justification_validated", label: "Justificativa validada" },
  { key: "no_upload_confirmed", label: "Confirmado: sem upload de documento nesta fase" },
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
