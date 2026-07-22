/**
 * Modulo de documentos — VALIDACAO da aplicacao manual de uma sugestao.
 *
 * Camada PURA: decide se uma sugestao PODE ser aplicada e monta o patch. Nao
 * grava, nao le banco, nao chama rede/OCR/IA. Quem grava e o service.
 *
 * ESCOPO DELIBERADAMENTE ESTREITO (Fase de aplicacao manual): so campos de
 * DESTINO, os unicos que existem no modelo (`Destination`). Dados pessoais,
 * endereco de origem e registro CAC continuam bloqueados — nao ha coluna e nao
 * inventamos uma.
 */
import type { DocumentFieldSuggestion, ProcessFieldTarget } from "./documentFieldSuggestions";

/** Campos que a aplicacao manual aceita. Allowlist — nunca derivar do cliente. */
export const APPLICABLE_TARGETS = [
  "destination.name",
  "destination.uf",
  "destination.city",
  "destination.street",
  "destination.number",
] as const;

export type ApplicableTarget = (typeof APPLICABLE_TARGETS)[number];

export function isApplicableTarget(target: string): target is ApplicableTarget {
  return (APPLICABLE_TARGETS as readonly string[]).includes(target);
}

/** Colunas de `Destination` que o patch pode tocar. */
export type DestinationPatch = Partial<
  Record<"eventName" | "uf" | "city" | "street" | "number", string>
>;

const COLUMN_BY_TARGET: Record<ApplicableTarget, keyof DestinationPatch> = {
  "destination.name": "eventName",
  "destination.uf": "uf",
  "destination.city": "city",
  "destination.street": "street",
  "destination.number": "number",
};

/** Motivos de recusa — viram mensagem amigavel na tela. */
export const APPLY_REJECTIONS = [
  "NAO_ENCONTRADA",
  "CAMPO_FUTURO",
  "FORA_DA_ALLOWLIST",
  "NAO_CONFIRMADA",
  "VALOR_VAZIO",
  "SEM_ALTERACAO",
] as const;

export type ApplyRejection = (typeof APPLY_REJECTIONS)[number];

export const APPLY_REJECTION_MESSAGES: Record<ApplyRejection, string> = {
  NAO_ENCONTRADA: "Sugestão não encontrada para este processo.",
  CAMPO_FUTURO: "Este campo ainda não existe no processo e não pode ser aplicado.",
  FORA_DA_ALLOWLIST: "Este campo não pode ser aplicado nesta etapa.",
  NAO_CONFIRMADA: "A sugestão precisa vir de um documento conferido pela equipe.",
  VALOR_VAZIO: "A sugestão não tem valor para aplicar.",
  SEM_ALTERACAO: "O valor sugerido é igual ao atual — nada a alterar.",
};

export type ApplyCheck =
  | { ok: true; target: ApplicableTarget; patch: DestinationPatch; previousValue: string | null }
  | { ok: false; reason: ApplyRejection; message: string };

function reject(reason: ApplyRejection): ApplyCheck {
  return { ok: false, reason, message: APPLY_REJECTION_MESSAGES[reason] };
}

/**
 * `true` quando o valor sugerido ja e o valor atual — a UI mostra
 * "Sem alteração necessária" e nao oferece o botao.
 */
export function isNoOpSuggestion(suggestion: DocumentFieldSuggestion): boolean {
  return suggestion.currentValue !== null && suggestion.currentValue === suggestion.suggestedValue;
}

/** `true` se a sugestao pode virar botao de aplicar na tela. */
export function isSuggestionApplicable(suggestion: DocumentFieldSuggestion): boolean {
  return checkSuggestionApplication(suggestion).ok;
}

/**
 * Decide se a sugestao pode ser aplicada e monta o patch.
 *
 * Rejeita, nesta ordem: campo fora da allowlist (inclui todo CAMPO_FUTURO),
 * sugestao que nao esta PRONTA_PARA_REVISAO, valor vazio e valor igual ao atual.
 * O valor aplicado vem SEMPRE da sugestao regerada no servidor — nunca do
 * formulario.
 */
export function checkSuggestionApplication(
  suggestion: DocumentFieldSuggestion | undefined,
): ApplyCheck {
  if (!suggestion) return reject("NAO_ENCONTRADA");

  // Campo futuro nunca e aplicavel; a allowlist ja exclui, mas a checagem
  // explicita deixa o motivo certo na tela.
  if (suggestion.status === "CAMPO_FUTURO") return reject("CAMPO_FUTURO");
  if (!isApplicableTarget(suggestion.targetField)) return reject("FORA_DA_ALLOWLIST");
  if (suggestion.status !== "PRONTA_PARA_REVISAO") return reject("NAO_CONFIRMADA");

  // Invariantes do dominio: nada se aplica sozinho, nem sem uma pessoa.
  if (suggestion.canApplyAutomatically !== false) return reject("FORA_DA_ALLOWLIST");
  if (suggestion.requiresHumanConfirmation !== true) return reject("NAO_CONFIRMADA");

  const value = suggestion.suggestedValue.trim();
  if (!value) return reject("VALOR_VAZIO");
  if (isNoOpSuggestion(suggestion)) return reject("SEM_ALTERACAO");

  return {
    ok: true,
    target: suggestion.targetField,
    patch: { [COLUMN_BY_TARGET[suggestion.targetField]]: value },
    previousValue: suggestion.currentValue,
  };
}

/** Rotulo curto do campo para a trilha do processo (sem PII de pessoa). */
export function targetLabelForHistory(target: ProcessFieldTarget): string {
  return target;
}
