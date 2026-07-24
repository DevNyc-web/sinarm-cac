/**
 * Resumo AUXILIAR de requisitos ATIVOS por tipo de processo (read-only).
 *
 * Este componente e apenas LEITURA/PREPARACAO. Nao executa automacao, nao altera
 * o checklist real (`AutomationReadinessPanel`/`deriveAutomationReadiness`), nao
 * bloqueia/desbloqueia processo, nao muda status, nao toca fila/gate de envio e
 * NAO libera criacao de novos fluxos. So a Guia de Trafego tem requisitos ativos
 * hoje; CR/Autorizacao/CRAF ficam vazios (etapa futura, nao criaveis).
 *
 * Primeiro consumidor real de `processReadinessRequirements` (docs/25). Recebe o
 * `process_types.code` persistido, reconcilia para o catalogo e lista so os
 * requisitos ATIVOS — nunca os de `futureStage: true`.
 */
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import {
  activeReadinessRequirementsForProcess,
  getCurrentPersistedProcessCatalogCode,
} from "@/server/automation/processReadinessRequirements";

// Pilulas NEUTRAS de proposito: nao usam vermelho/ambar/verde para NAO imitar os
// bloqueios/alertas do checklist oficial (`AutomationReadinessPanel`). Distincao
// so por peso (obrigatorio mais forte, opcional mais leve).
const REQUIRED_PILL =
  "inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800";
const OPTIONAL_PILL =
  "inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500";

export function ProcessRequirementsSummary({ processTypeCode }: { processTypeCode: string }) {
  const catalogCode = getCurrentPersistedProcessCatalogCode(processTypeCode);
  const requirements = activeReadinessRequirementsForProcess(catalogCode);

  return (
    <Card className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Requisitos do processo</p>
        <Badge>Resumo informativo</Badge>
      </div>

      <p className="mt-1 text-xs text-neutral-500">
        Lista informativa dos requisitos ativos deste tipo de processo. Não altera o status do
        processo, não substitui a avaliação de prontidão e não executa nenhuma ação.
      </p>

      {requirements.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {requirements.map((requirement) => (
            <li
              key={requirement.blocker.code}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span>{requirement.label}</span>
                <span className={requirement.required ? REQUIRED_PILL : OPTIONAL_PILL}>
                  {requirement.required ? "Obrigatório" : "Opcional"}
                </span>
              </div>
              {requirement.note ? (
                <p className="mt-1 text-[11px] text-neutral-500">{requirement.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Nenhum requisito ativo para este tipo de processo nesta etapa.
        </p>
      )}

      <Notice tone="neutral" className="mt-3">
        Resumo auxiliar de <strong>preparação</strong> — não substitui o gate{" "}
        <strong>Fila de automação</strong> nem marca o processo para a fila.{" "}
        <strong>Nenhum acesso ao Gov.br/SINARM é feito.</strong>
      </Notice>
    </Card>
  );
}
