import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  groupByCategory,
  type AutomationQueueCategory,
} from "@/server/automation/automationQueue";
import { type AutomationQueueRow } from "@/server/services/getAutomationQueue";

/** Cor do rotulo por categoria — pronto se destaca; bloqueados em tons quentes. */
const CATEGORY_TONE: Record<AutomationQueueCategory, string> = {
  PRONTO_PARA_AUTOMACAO: "text-emerald-700",
  NAO_PRONTO_DESTINO: "text-amber-700",
  NAO_PRONTO_PCE: "text-amber-700",
  NAO_PRONTO_DOCUMENTOS: "text-amber-700",
  NAO_PRONTO_SUGESTOES: "text-amber-700",
  NAO_PRONTO_PAGAMENTO: "text-amber-700",
  BLOQUEADO_OUTROS: "text-red-700",
};

/**
 * Painel "Fila de automacao" — organiza processos por prontidao do checklist.
 * So EXIBE: nao executa automacao, nao muda status, nao acessa Gov.br/SINARM.
 */
export function AutomationQueuePanel({ rows }: { rows: readonly AutomationQueueRow[] }) {
  const groups = groupByCategory(rows);

  return (
    <div className="space-y-4">
      <Notice tone="neutral">
        Esta fila <strong>não executa nenhuma automação automaticamente</strong>. Ela apenas organiza
        os processos conforme os bloqueios do checklist pré-execução.{" "}
        <strong>Nenhum acesso ao Gov.br/SINARM é feito nesta etapa.</strong>
      </Notice>

      {rows.length === 0 ? (
        <EmptyState
          title="Fila vazia"
          description="Nenhum processo ainda. Crie um em /processos/novo com o usuario ficticio."
        />
      ) : (
        groups.map((group) => (
          <Card key={group.category} className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
              <p className={`text-sm font-semibold ${CATEGORY_TONE[group.category]}`}>
                {group.label}
              </p>
              <Badge>{group.rows.length}</Badge>
            </div>

            {group.rows.length === 0 ? (
              <p className="px-4 py-3 text-xs text-neutral-400">Nenhum processo nesta categoria.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">
                        {row.ready ? "● " : ""}
                        {row.code}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {row.ownerLabel}
                        {row.ready ? (
                          <span className="text-emerald-700"> · pronto para automação</span>
                        ) : (
                          <span>
                            {" · "}
                            {row.mainBlockerLabel ?? "bloqueado"}
                            {row.blockerCount > 1 ? ` (+${row.blockerCount - 1})` : ""}
                          </span>
                        )}
                        {row.submitted ? (
                          <span className="text-sky-700"> · enviado para a fila</span>
                        ) : null}
                      </p>
                    </div>
                    <Link
                      href={`/admin/processos/${row.id}`}
                      className="flex-none text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      Abrir processo
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
