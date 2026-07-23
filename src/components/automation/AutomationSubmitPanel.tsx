import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  AUTOMATION_READINESS_LABELS,
  type AutomationReadinessStatus,
} from "@/server/automation/automationReadiness";

/**
 * Gate interno "Enviar para fila de automacao".
 *
 * So EXIBE o controle: o envio real e um ato do servidor, atras de permissao e
 * de re-derivacao da prontidao. NAO executa automacao, NAO acessa Gov.br/SINARM,
 * NAO protocola. O botao so aparece quando o checklist esta PRONTO.
 */
export function AutomationSubmitPanel({
  processId,
  status,
  alreadySubmitted,
  canSubmit,
  roleLabel,
  submitAction,
}: {
  processId: string;
  status: AutomationReadinessStatus;
  alreadySubmitted: boolean;
  canSubmit: boolean;
  roleLabel: string;
  submitAction: (formData: FormData) => void | Promise<void>;
}) {
  const ready = status === "PRONTO_PARA_AUTOMACAO";

  return (
    <Card className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Fila de automação</p>
        <Badge>{alreadySubmitted ? "Enviado" : AUTOMATION_READINESS_LABELS[status]}</Badge>
      </div>

      <div className="mt-2 space-y-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
        <p>Esta ação não executa automação imediatamente.</p>
        <p>Nenhum acesso ao Gov.br/SINARM será feito agora.</p>
        <p>O processo apenas será marcado internamente para automação futura.</p>
      </div>

      {alreadySubmitted ? (
        <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <strong>Processo já enviado para a fila de automação futura.</strong> Nenhuma automação foi
          executada — o registro está no histórico do processo.
        </p>
      ) : !ready ? (
        <p className="mt-3 text-neutral-500">
          Disponível apenas quando o checklist pré-execução estiver{" "}
          <strong>Pronto para automação</strong>. Resolva os bloqueios acima primeiro.
        </p>
      ) : !canSubmit ? (
        <p className="mt-3 text-neutral-500">
          Seu perfil ({roleLabel}) acompanha, mas não pode enviar para a fila de automação
          (docs/11 §3).
        </p>
      ) : (
        <form action={submitAction} className="mt-3 space-y-2">
          <input type="hidden" name="processId" value={processId} />
          <label className="flex items-start gap-2 text-xs text-neutral-700">
            <input type="checkbox" name="confirmacao" className="mt-0.5" />
            <span>
              Confirmo que quero <strong>marcar este processo para a fila de automação futura</strong>.
              Entendo que <strong>nenhuma automação é executada agora</strong> e que{" "}
              <strong>nenhum acesso ao Gov.br/SINARM é feito nesta etapa</strong>.
            </span>
          </label>
          <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
            Enviar para fila de automação
          </Button>
        </form>
      )}

      <Notice tone="neutral" className="mt-3">
        A automação real é uma etapa futura (docs/25). Este gate apenas <strong>libera
        internamente</strong> um processo já aprovado no checklist — não protocola, não gera GRU e
        não opera nenhum sistema.
      </Notice>
    </Card>
  );
}
