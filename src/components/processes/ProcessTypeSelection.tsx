import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { formatBRL } from "@/server/processes/pricing";
import { getProcessDefinition } from "@/server/processes/processCatalog";
import {
  IN_PREPARATION_MESSAGE,
  PROCESS_AVAILABILITY_LABELS,
  launchProcessEntries,
} from "@/server/processes/processAvailability";

/**
 * Selecao dos PROCESSOS DE LANCAMENTO na entrada de novo processo.
 *
 * Lista os 4 processos a partir do CATALOGO (ordem logica). So a Guia de Trafego
 * esta disponivel; CR, Autorizacao de Compra e CRAF aparecem "em preparacao".
 * Esta tela apenas apresenta — NAO executa automacao, NAO cria os demais fluxos,
 * NAO acessa Gov.br/SINARM. O botao de criar processo vive no formulario da Guia
 * (abaixo), portanto so existe para a Guia de Trafego.
 */
export function ProcessTypeSelection() {
  const entries = launchProcessEntries();

  return (
    <section aria-label="Processos do lançamento">
      <p className="text-sm text-neutral-600">
        Estamos começando pela Guia de Tráfego e preparando os demais processos do lançamento.
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Os processos seguem a ordem lógica: CR → Autorização de Compra → CRAF → Guia de Tráfego.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => {
          const { definition, available, logicalOrderPosition } = entry;
          const deps = definition.dependsOn.map(
            (code) => getProcessDefinition(code)?.name ?? code,
          );
          return (
            <Card
              key={definition.code}
              className={`space-y-2 text-sm ${available ? "border-emerald-300" : "opacity-90"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-neutral-900">{definition.name}</p>
                <Badge>{PROCESS_AVAILABILITY_LABELS[entry.availability]}</Badge>
              </div>

              <dl className="grid gap-1 text-xs text-neutral-600">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Taxa GRU</dt>
                  <dd>{formatBRL(definition.gruFeeCents)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Ordem lógica</dt>
                  <dd>Passo {logicalOrderPosition} de {entries.length}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Depende de</dt>
                  <dd className="text-right">
                    {deps.length > 0 ? deps.join(", ") : "nenhum processo anterior"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Cadastro inicial</dt>
                  <dd>{definition.requiresInitialRegistration ? "exigido" : "não exigido"}</dd>
                </div>
              </dl>

              {available ? (
                <p className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
                  Disponível agora — preencha os dados abaixo para começar.
                </p>
              ) : (
                <p className="rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600">
                  {IN_PREPARATION_MESSAGE}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Notice tone="neutral" className="mt-3">
        A disponibilidade nesta tela não executa nenhuma automação.
      </Notice>
    </section>
  );
}
