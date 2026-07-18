import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/server/auth/guards";
import {
  OPERATIONAL_STATUS_USER_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { listProcessesByUser } from "@/server/repositories/processRepository";

type ProcessRow = Awaited<ReturnType<typeof listProcessesByUser>>[number];

export default async function DashboardPage() {
  const user = await requireUser();

  // Banco local pode estar fora do ar em dev — degradar com aviso, sem quebrar.
  let processes: ProcessRow[] = [];
  let dbUnavailable = false;
  try {
    processes = await listProcessesByUser(user.id);
  } catch {
    dbUnavailable = true;
  }

  return (
    <Container>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus processos</h1>
        <Link href="/processos/novo">
          <Button>Novo processo</Button>
        </Link>
      </div>

      <Card className="mt-4">
        <p className="text-sm text-neutral-600">
          Conta: <span className="font-medium text-neutral-900">{user.name}</span> · {user.email}
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Acompanhe seus processos por aqui. A execução é feita por uma pessoa da nossa equipe —{" "}
          <strong>não garantimos aprovação</strong>.
        </p>
      </Card>

      <div className="mt-6">
        {dbUnavailable ? (
          <EmptyState
            title="Não foi possível carregar seus processos"
            description="Tente novamente em instantes. Se continuar assim, fale com o suporte."
          />
        ) : processes.length === 0 ? (
          <EmptyState
            title="Nenhum processo ainda"
            description="Comece criando uma Guia de Tráfego em “Novo processo”."
          />
        ) : (
          <ul className="space-y-3">
            {processes.map((process) => (
              <li key={process.id}>
                <Link href={`/processos/${process.id}`} className="block">
                  <Card className="flex items-center justify-between transition-colors hover:bg-neutral-50">
                    <div>
                      <p className="font-mono text-sm font-medium">{process.code}</p>
                      <p className="mt-1 text-sm text-neutral-600">
                        {process.processType.name}
                        {process.destination
                          ? ` · ${process.destination.eventName} — ${process.destination.city}/${process.destination.uf}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Criado em {process.createdAt.toLocaleDateString("pt-BR")}
                        {process.payments[0]
                          ? ` · Pagamento: ${PAYMENT_STATUS_LABELS[process.payments[0].status]}`
                          : ""}
                      </p>
                    </div>
                    <Badge>{OPERATIONAL_STATUS_USER_LABELS[process.operationalStatus]}</Badge>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
