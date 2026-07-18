import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdminRole } from "@/server/auth/guards";
import { ROLE_LABELS } from "@/server/auth/roles";
import {
  DOCUMENT_STATUS_LABELS,
  OPERATIONAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/server/processes/statusLabels";
import { getAdminQueue, type AdminQueueRow } from "@/server/services/getAdminQueue";
import { isOperationalStatus } from "@/server/services/updateProcessOperations";

const selectClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none";

/** Fila admin com filtros — Fase 6 (docs/11 §4). */
export default async function AdminProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    pagamento?: string;
    documento?: string;
    codigo?: string;
    ordem?: string;
  }>;
}) {
  // Todos os perfis internos veem a fila (docs/11 §3: "Ver fila de processos").
  const admin = await requireAdminRole();
  const params = await searchParams;

  const statusFilter =
    params.status && isOperationalStatus(params.status) ? params.status : undefined;
  const paymentFilter =
    params.pagamento && params.pagamento in PAYMENT_STATUS_LABELS
      ? (params.pagamento as keyof typeof PAYMENT_STATUS_LABELS)
      : undefined;
  const documentFilter =
    params.documento && params.documento in DOCUMENT_STATUS_LABELS
      ? (params.documento as keyof typeof DOCUMENT_STATUS_LABELS)
      : undefined;
  const codeFilter = params.codigo?.trim() || undefined;
  const sort = params.ordem === "oldest" ? "oldest" : "recent";

  let rows: AdminQueueRow[] = [];
  let dbUnavailable = false;
  try {
    rows = await getAdminQueue({
      operationalStatus: statusFilter,
      paymentStatus: paymentFilter,
      documentStatus: documentFilter,
      code: codeFilter,
      sort,
    });
  } catch {
    dbUnavailable = true;
  }

  const hasFilters = Boolean(statusFilter || paymentFilter || documentFilter || codeFilter);

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Fila de processos</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Operação assistida com dados fictícios. Perfil: {ROLE_LABELS[admin.role]}. Nada é
        protocolado por aqui — o protocolo no SINARM é manual e externo ao app.
      </p>

      <Card className="mt-4">
        <form method="get" className="grid gap-3 md:grid-cols-5">
          <label className="block text-xs font-medium text-neutral-600">
            Codigo
            <input
              name="codigo"
              defaultValue={codeFilter ?? ""}
              placeholder="GT-DEV-"
              className={selectClass}
            />
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            Status operacional
            <select name="status" defaultValue={statusFilter ?? ""} className={selectClass}>
              <option value="">Todos</option>
              {Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            Pagamento
            <select name="pagamento" defaultValue={paymentFilter ?? ""} className={selectClass}>
              <option value="">Todos</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            Documento
            <select name="documento" defaultValue={documentFilter ?? ""} className={selectClass}>
              <option value="">Todos</option>
              {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-neutral-600">
            Ordem
            <select name="ordem" defaultValue={sort} className={selectClass}>
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-5">
            <Button type="submit" className="px-3 py-1.5 text-xs">
              Filtrar
            </Button>
            {hasFilters ? (
              <Link href="/admin/processos">
                <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs">
                  Limpar filtros
                </Button>
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="mt-6">
        {dbUnavailable ? (
          <EmptyState
            title="Banco local indisponivel"
            description="Configure o Postgres local (.env + npm run db:push && npm run seed) para ver a fila."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nenhum processo com esses filtros" : "Fila vazia"}
            description={
              hasFilters
                ? "Ajuste ou limpe os filtros para ver mais processos."
                : "Nenhum rascunho ainda. Crie um em /processos/novo com o usuario ficticio."
            }
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                  <th className="px-4 py-3">Processo</th>
                  <th className="px-4 py-3">Status operacional</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Responsavel</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Criado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-neutral-100 last:border-0 ${
                      row.highlighted ? "bg-emerald-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium">
                        {row.highlighted ? "● " : ""}
                        {row.code}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {row.ownerLabel}
                        {row.destinationLabel ? ` · ${row.destinationLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{OPERATIONAL_STATUS_LABELS[row.operationalStatus]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.priority === "URGENTE" || row.priority === "ALTA"
                            ? "font-medium text-amber-700"
                            : "text-neutral-600"
                        }
                      >
                        {PRIORITY_LABELS[row.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.assignedToLabel ?? <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.paymentStatus ? PAYMENT_STATUS_LABELS[row.paymentStatus] : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.documentStatus ? DOCUMENT_STATUS_LABELS[row.documentStatus] : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.createdAt.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/processos/${row.id}`}
                        className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        ● destaque: pagamento confirmado (sandbox) aguardando operação. Prioridades Alta/Urgente
        aparecem realçadas.
      </p>
    </Container>
  );
}
