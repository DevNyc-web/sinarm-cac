/**
 * Definicao dos checklists admin — Fases 3.6 / 6.
 *
 * Dois grupos (docs/11 §6 e §7):
 * - REVISAO: conferencia geral do rascunho ficticio.
 * - GRU: checkpoint "Dados da GRU" — FICTICIO nesta fase. Nao acessa SINARM,
 *   nao gera GRU, nao protocola: apenas registra a conferencia humana que, no
 *   fluxo real, antecede o ato irreversivel (docs/11 §7, docs/10 §13).
 */
import { type ChecklistGroup } from "@prisma/client";

export const CHECKLIST_ITEMS = [
  // --- Grupo REVISAO (docs/11 §6) ---
  { key: "destination_validated", group: "REVISAO", label: "Dados do destino validados" },
  { key: "firearm_validated", group: "REVISAO", label: "Arma/PCE ficticia validada" },
  { key: "justification_validated", group: "REVISAO", label: "Justificativa validada" },
  { key: "document_validated", group: "REVISAO", label: "Documento (ficticio) anexado e legivel" },
  { key: "no_pix_confirmed", group: "REVISAO", label: "Confirmado: sem pagamento Pix nesta fase" },
  { key: "no_gru_confirmed", group: "REVISAO", label: "Confirmado: sem GRU/protocolo nesta fase" },

  // --- Grupo GRU (docs/11 §7) — conferencia ficticia, sem SINARM ---
  { key: "gru_service_correct", group: "GRU", label: "Servico correto: Emitir Guia de Trafego PF (CAC)" },
  { key: "gru_amount_expected", group: "GRU", label: "Valor da GRU esperado conferido (R$ 20,00)" },
  { key: "gru_contributor_checked", group: "GRU", label: "Contribuinte/dados ficticios conferidos" },
  { key: "gru_destination_checked", group: "GRU", label: "Destino conferido" },
  { key: "gru_firearm_checked", group: "GRU", label: "Arma/PCE ficticia conferida" },
  { key: "gru_document_approved", group: "GRU", label: "Documento aprovado" },
  { key: "gru_payment_confirmed", group: "GRU", label: "Pagamento confirmado (sandbox/dev)" },
  { key: "gru_internal_review", group: "GRU", label: "Autorizacao/revisao interna registrada" },

  // --- Grupo POS_PROTOCOLO (docs/21 §12) — conferencia do registro manual ---
  { key: "post_protocol_registered", group: "POS_PROTOCOLO", label: "Protocolo registrado (ficticio/dev)" },
  { key: "post_gru_registered", group: "POS_PROTOCOLO", label: "GRU registrada (ficticia/dev)" },
  { key: "post_gru_data_checked", group: "POS_PROTOCOLO", label: "Dados da GRU conferidos" },
  { key: "post_awaiting_company_payment", group: "POS_PROTOCOLO", label: "Aguardando pagamento da GRU pela empresa" },
  { key: "post_company_payment_registered", group: "POS_PROTOCOLO", label: "Pagamento da GRU registrado manualmente" },
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

export function checklistGroup(key: ChecklistKey): ChecklistGroup {
  const item = CHECKLIST_ITEMS.find((candidate) => candidate.key === key);
  return (item?.group ?? "REVISAO") as ChecklistGroup;
}

export function checklistItemsByGroup(group: ChecklistGroup) {
  return CHECKLIST_ITEMS.filter((item) => item.group === group);
}
