import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { type AutomationReadiness } from "@/server/automation/automationReadiness";

/**
 * Painel "Checklist pre-execucao" (motor de prontidao para automacao).
 *
 * So EXIBE a avaliacao derivada — nao dispara nenhuma acao, nao muda status, nao
 * acessa Gov.br/SINARM. A automacao real e uma etapa futura (docs/25); aqui o
 * usuario/operador apenas ve o que ainda impede o inicio.
 */
export function AutomationReadinessPanel({ readiness }: { readiness: AutomationReadiness }) {
  const ready = readiness.status === "PRONTO_PARA_AUTOMACAO";

  return (
    <Card className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Checklist pré-execução</p>
        <Badge>{readiness.label}</Badge>
      </div>

      <div
        className={`mt-2 rounded-md border px-3 py-2 text-xs ${
          ready
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {ready ? (
          <p>
            <strong>Pronto para automação.</strong> Nenhum bloqueio pendente — a automação futura
            poderá iniciar após confirmação humana.
          </p>
        ) : (
          <p>
            <strong>Não pronto para automação.</strong> Resolva os bloqueios abaixo para liberar o
            início da automação futura.
          </p>
        )}
      </div>

      {readiness.blockers.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-700">
            Bloqueios ({readiness.blockers.length})
          </p>
          <ul className="mt-1 space-y-1">
            {readiness.blockers.map((item) => (
              <li
                key={item.code}
                className="flex gap-2 rounded-md border border-red-200 bg-red-50/60 px-3 py-1.5 text-xs text-red-800"
              >
                <span aria-hidden>✕</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.warnings.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-700">
            Alertas ({readiness.warnings.length})
          </p>
          <ul className="mt-1 space-y-1">
            {readiness.warnings.map((item) => (
              <li
                key={item.code}
                className="flex gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-900"
              >
                <span aria-hidden>!</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.completed.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-700">
            Concluídos ({readiness.completed.length})
          </p>
          <ul className="mt-1 space-y-1">
            {readiness.completed.map((item) => (
              <li
                key={item.code}
                className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs text-emerald-800"
              >
                <span aria-hidden>✓</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Notice tone="neutral" className="mt-3">
        Esta avaliação <strong>não executa nenhuma ação automaticamente</strong>. A automação só
        poderá iniciar quando os bloqueios forem resolvidos.{" "}
        <strong>Nenhum acesso ao Gov.br/SINARM é feito nesta etapa.</strong>
      </Notice>
    </Card>
  );
}
