import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AutomationQueuePanel } from "@/components/automation/AutomationQueuePanel";
import { requireAdminRole } from "@/server/auth/guards";
import { ROLE_LABELS } from "@/server/auth/roles";
import { getAutomationQueue, type AutomationQueueRow } from "@/server/services/getAutomationQueue";

/**
 * Fila de automacao — organiza processos por prontidao do checklist pre-execucao.
 * Todos os perfis internos veem a fila (docs/11 §3). Nada e executado aqui: a
 * automacao real e etapa futura (docs/25) e nao ha acesso a Gov.br/SINARM.
 */
export default async function AdminAutomacaoPage() {
  const admin = await requireAdminRole();

  let rows: AutomationQueueRow[] = [];
  let dbUnavailable = false;
  try {
    rows = await getAutomationQueue();
  } catch {
    dbUnavailable = true;
  }

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Fila de automação</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Organização interna por prontidão. Perfil: {ROLE_LABELS[admin.role]}. A automação é uma
        etapa futura — esta fila apenas diagnostica, não protocola nem opera nenhum sistema.
      </p>

      <div className="mt-6">
        {dbUnavailable ? (
          <EmptyState
            title="Não foi possível carregar a fila"
            description="Tente novamente em instantes. Se continuar assim, avise o time técnico."
          />
        ) : (
          <AutomationQueuePanel rows={rows} />
        )}
      </div>

      <div className="mt-6">
        <Link href="/admin/processos">
          <Button variant="secondary">Ir para a fila de processos</Button>
        </Link>
      </div>
    </Container>
  );
}
