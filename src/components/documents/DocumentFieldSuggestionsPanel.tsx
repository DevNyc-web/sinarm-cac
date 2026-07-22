import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  CONFIDENCE_LABELS,
  DOCUMENT_KIND_LABELS,
  SUGGESTION_SOURCE_LABELS,
  SUGGESTION_STATUS_LABELS,
  buildFieldSuggestions,
  groupSuggestionsByArea,
  isNoOpSuggestion,
  isSuggestionApplicable,
  type DocumentReview,
  type ProcessCurrentValues,
} from "@/server/documents";

/**
 * Painel de SUGESTOES de preenchimento (dev/demonstracao).
 *
 * Mostra o que PODERIA ser preenchido a partir da conferencia. NADA e aplicado:
 * o botao de aplicar e inerte e cada sugestao diz por que. Sem OCR, sem IA, sem
 * rede — os valores vem da conferencia de demonstracao.
 */
export function DocumentFieldSuggestionsPanel({
  processId,
  reviews,
  current = {},
  applyAction,
  appliedTarget,
}: {
  processId: string;
  reviews: readonly DocumentReview[];
  current?: ProcessCurrentValues;
  /** Ausente => painel so exibe; nenhuma aplicacao e oferecida. */
  applyAction?: (formData: FormData) => void | Promise<void>;
  /** Campo aplicado no ultimo POST (querystring `?aplicado=`). */
  appliedTarget?: string;
}) {
  const suggestions = buildFieldSuggestions(reviews, current);
  const groups = groupSuggestionsByArea(suggestions);

  return (
    <Card className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Sugestões para preenchimento</p>
        <Badge>demonstração</Badge>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        <strong>Nada é aplicado automaticamente.</strong> São propostas a partir da conferência —{" "}
        <strong>você precisa conferir antes de aplicar</strong>. A aplicação altera apenas os dados
        deste processo.
      </p>

      {appliedTarget ? (
        <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Sugestão aplicada em <span className="font-mono">{appliedTarget}</span>. O valor anterior
          ficou registrado no histórico do processo.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="mt-3 rounded-md border border-neutral-200 px-3 py-2 text-neutral-500">
          Nenhuma sugestão disponível ainda. Envie e confira documentos para visualizar sugestões.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((group) => (
            <section key={group.area} className="rounded-md border border-neutral-200 px-3 py-2">
              <p className="font-medium text-neutral-800">{group.label}</p>

              <ul className="mt-2 space-y-2">
                {group.suggestions.map((suggestion) => (
                  <li key={suggestion.id} className="rounded-md bg-neutral-50 px-3 py-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-neutral-800">{suggestion.label}</p>
                        <p className="mt-0.5 font-mono text-xs text-neutral-500">
                          {suggestion.targetField}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        <span className="text-xs text-neutral-500">
                          {CONFIDENCE_LABELS[suggestion.confidence]}
                        </span>
                        <Badge>{SUGGESTION_STATUS_LABELS[suggestion.status]}</Badge>
                      </div>
                    </div>

                    <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-neutral-500">Valor atual</dt>
                        <dd className="truncate text-neutral-700">
                          {suggestion.currentValue ?? (
                            <span className="text-neutral-400">
                              {suggestion.status === "CAMPO_FUTURO"
                                ? "Não disponível nesta etapa"
                                : "Não preenchido"}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-neutral-500">Valor sugerido</dt>
                        <dd className="truncate text-neutral-800">{suggestion.suggestedValue}</dd>
                      </div>
                    </dl>

                    <p className="mt-1 text-xs text-neutral-500">
                      Origem: {SUGGESTION_SOURCE_LABELS[suggestion.source]} —{" "}
                      {DOCUMENT_KIND_LABELS[suggestion.sourceDocumentType]}
                    </p>

                    {isNoOpSuggestion(suggestion) ? (
                      <p className="mt-2 text-xs text-neutral-500">
                        <strong>Sem alteração necessária</strong> — o valor sugerido é igual ao
                        atual.
                      </p>
                    ) : applyAction && isSuggestionApplicable(suggestion) ? (
                      <form
                        action={applyAction}
                        className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-2"
                      >
                        <input type="hidden" name="processId" value={processId} />
                        {/* Só o ID da sugestão trafega: o valor é regerado no servidor. */}
                        <input type="hidden" name="suggestionId" value={suggestion.id} />
                        <label className="flex items-center gap-2 text-xs text-neutral-700">
                          <input
                            type="checkbox"
                            name="confirmacao"
                            className="h-3.5 w-3.5 rounded border-neutral-300"
                          />
                          Conferi esta informação e quero aplicar no processo
                        </label>
                        <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                          Aplicar sugestão
                        </Button>
                      </form>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          aria-disabled="true"
                          className="inline-flex cursor-not-allowed items-center rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-400"
                        >
                          {suggestion.status === "CAMPO_FUTURO"
                            ? "Campo ainda não existe nesta etapa"
                            : "Aplicar sugestão (indisponível)"}
                        </span>
                        <span className="text-xs text-neutral-500">{suggestion.reason}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Notice tone="info" className="mt-3">
        <strong>Preenchimento assistido ainda não habilitado.</strong> Os valores vêm da conferência
        de demonstração — não há OCR nem IA. Nenhuma sugestão altera seu processo, e{" "}
        <strong>nada é enviado automaticamente</strong>.
      </Notice>
    </Card>
  );
}
