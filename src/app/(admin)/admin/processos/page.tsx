import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdminRole } from "@/server/auth/guards";
import { findMockUser } from "@/server/auth/mockUsers";
import { ROLE_LABELS } from "@/server/auth/roles";
import { INTERNAL_STATUS_LABELS } from "@/server/processes/statusLabels";
import { listProcessesForAdmin } from "@/server/repositories/processRepository";

type ProcessRow = Awaited<ReturnType<typeof listProcessesForAdmin>>[number];

/** Fila admin basica de processos — Fase 3.5 (docs/11 §4, versao minima). */
export default async function AdminProcessosPage() {
  // Todos os perfis internos veem a fila (docs/11 §3: "Ver fila de processos").
  const admin = await requireAdminRole();

  let processes: ProcessRow[] = [];
  let dbUnavailable = false;
  try {
    processes = await listProcessesForAdmin();
  } catch {
    dbUnavailable = true;
  }

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Fila de processos</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Rascunhos ficticios (Fase 3.5). Perfil: {ROLE_LABELS[admin.role]}. Sem dados reais; sem
        acoes de protocolo/pagamento nesta fase.
      </p>

      <div className="mt-6">
        {dbUnavailable ? (
          <EmptyState
            title="Banco local indisponivel"
            description="Configure o Postgres local (.env + npm run db:push && npm run seed) para ver a fila."
          />
        ) : processes.length === 0 ? (
          <EmptyState
            title="Fila vazia"
            description="Nenhum rascunho ainda. Crie um em /processos/novo com o usuario ficticio."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                  <th className="px-4 py-3">Processo</th>
                  <th className="px-4 py-3">Usuario (mock)</th>
                  <th className="px-4 py-3">Status interno</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => {
                  const owner = findMockUser(process.userId);
                  return (
                    <tr key={process.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-mono font-medium">{process.code}</p>
                        <p className="text-xs text-neutral-500">
                          {process.destination
                            ? `${process.destination.eventName} — ${process.destination.city}/${process.destination.uf}`
                            : "Sem destino"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {owner ? owner.name : process.userId}
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{INTERNAL_STATUS_LABELS[process.internalStatus]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {process.createdAt.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/processos/${process.id}`}
                          className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                        >
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </Container>
  );
}
