import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requirePermission } from "@/server/auth/guards";
import { ROLE_LABELS } from "@/server/auth/roles";
import { formatBRL } from "@/server/processes/pricing";
import { INTERNAL_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/server/processes/statusLabels";
import { getAdminQueue } from "@/server/services/getAdminQueue";

/**
 * Relatorio financeiro dedicado — docs/59 (decisao) + atualizacao de
 * 2026-08-04 (permissao final).
 *
 * A ROTA e protegida pela permissao, nao so a acao (mesmo criterio de
 * `admin/extracao/page.tsx`): sem isso, um perfil sem `audit.view.financial`
 * veria a tela e so descobriria a recusa ao tentar algo — aqui nao ha nem
 * o que tentar, e read-only, mas o gate fica na rota mesmo assim.
 *
 * `audit.view.financial` — NAO `queue.view` (fila/filtro simples do
 * docs/55, mais amplo) e NAO `refund.approve` (permissao de AGIR, reservada
 * para a futura acao de aprovar/registrar reembolso — docs/59 atualizacao).
 *
 * Reusa `getAdminQueue({ needsFinanceReview: true })` — MESMO filtro/
 * derivacao da fila (`deriveNeedsFinanceReview`), nenhuma regra nova,
 * nenhuma query separada para decidir quem entra na lista.
 *
 * Escopo desta fase (docs/59 §6 PR 1): sem data de cancelamento (exige
 * query propria sobre `ProcessStatusEvent`, nao implementada aqui — docs/59
 * §2/§3.14), sem motivo interno, sem export CSV, sem acao de reembolso/
 * `registerRefund`/PSP/`PaymentStatus`. Cliente nunca acessa esta rota.
 */
export default async function AdminFinanceiroPage() {
  const admin = await requirePermission("audit.view.financial");

  let rows: Awaited<ReturnType<typeof getAdminQueue>> = [];
  let dbUnavailable = false;
  try {
    rows = await getAdminQueue({ needsFinanceReview: true });
  } catch {
    dbUnavailable = true;
  }

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Revisão financeira</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Relatório interno — processos cancelados com pagamento confirmado, pendentes de análise
        financeira manual. Perfil: {ROLE_LABELS[admin.role]}. Leitura apenas: nenhuma ação de
        reembolso ou estorno é feita por aqui (docs/54).
      </p>

      <div className="mt-6">
        {dbUnavailable ? (
          <EmptyState
            title="Não foi possível carregar o relatório"
            description="Tente novamente em instantes. Se continuar assim, avise o time técnico."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhum caso pendente"
            description="Nenhum processo cancelado com pagamento confirmado aguardando revisão financeira."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                  <th className="px-4 py-3">Processo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Status interno</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Valor pago</th>
                  <th className="px-4 py-3">Data de pagamento</th>
                  <th className="px-4 py-3">Revisão financeira</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-mono font-medium">{row.code}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.ownerLabel}</td>
                    <td className="px-4 py-3">
                      <Badge>{INTERNAL_STATUS_LABELS.CANCELADO_OPERACIONAL}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.paymentStatus ? PAYMENT_STATUS_LABELS[row.paymentStatus] : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.paymentAmountCents !== null ? formatBRL(row.paymentAmountCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.paymentPaidAt ? row.paymentPaidAt.toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.needsFinanceReview ? (
                        <span className="text-xs font-medium text-red-700">Necessária</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
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
        Sem reembolso automático, sem estorno — revisão financeira continua manual (docs/54).
      </p>
    </Container>
  );
}
