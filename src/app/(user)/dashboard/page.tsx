import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/server/auth/guards";
import { ROLE_LABELS } from "@/server/auth/roles";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <Container>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus processos</h1>
        <Link href="/processos/novo">
          <Button>Novo processo</Button>
        </Link>
      </div>

      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-neutral-600">
            Sessao de: <span className="font-medium text-neutral-900">{user.name}</span> ·{" "}
            {user.email} · {ROLE_LABELS[user.role]}
          </p>
          <Badge>mock/dev</Badge>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Usuario ficticio de desenvolvimento (Fase 2). Sem conta real, sem CPF, sem PII.
        </p>
      </Card>

      <div className="mt-6">
        <EmptyState
          title="Nenhum processo ainda"
          description="Placeholder de dashboard. Processos reais chegam nas proximas fases."
        />
      </div>
    </Container>
  );
}
