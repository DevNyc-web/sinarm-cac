import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { hasPermission, requireAdminRole } from "@/server/auth/guards";
import { PERMISSION_LABELS, type Permission } from "@/server/auth/permissions";
import { ROLE_LABELS } from "@/server/auth/roles";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  INTERNAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  USER_FACING_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { getAdminProcessDetail, type AdminProcessDetail } from "@/server/services/getAdminProcessDetail";
import { reviewDocumentAction, toggleChecklistAction } from "./actions";

/** Permissoes relevantes para o detalhe do processo (docs/11 §3/§5.12). */
const DETAIL_PERMISSIONS: readonly Permission[] = [
  "process.pii.viewFull",
  "sinarm.execute",
  "review.checklist",
  "document.review",
  "gru.generate",
  "payment.pix.confirm",
  "payment.gru.register",
  "message.send",
];

function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatBRL(amountCents: number): string {
  return `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Detalhe admin do processo — Fases 3.5/3.6/4/5.
 * Os dados chegam JA REDIGIDOS por `getAdminProcessDetail` (need-to-know na
 * camada de servico — docs/11 §3/§19); a pagina so apresenta.
 */
export default async function AdminProcessoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const admin = await requireAdminRole();
  const { id } = await params;
  const { erro } = await searchParams;

  let detail: AdminProcessDetail | null = null;
  try {
    detail = await getAdminProcessDetail(admin, id);
  } catch {
    // Banco local fora do ar: tratar como nao encontrado.
  }
  if (!detail) notFound();

  const canReview = hasPermission(admin, "review.checklist");

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Detalhe do processo</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-1 font-mono text-sm text-neutral-500">{detail.code}</p>

      {erro ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="space-y-1 text-sm">
          <p className="font-medium">Resumo</p>
          <p className="text-neutral-600">{detail.processTypeName}</p>
          <p className="text-neutral-600">
            Status interno: {INTERNAL_STATUS_LABELS[detail.internalStatus]}
          </p>
          <p className="text-neutral-600">
            Status visivel: {USER_FACING_STATUS_LABELS[detail.userFacingStatus]}
          </p>
          <p className="text-neutral-600">
            Criado em {detail.createdAt.toLocaleDateString("pt-BR")}
          </p>
        </Card>

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Usuario (mock)</p>
          <p className="text-neutral-600">{detail.owner ? detail.owner.name : detail.ownerFallbackId}</p>
          {detail.owner ? <p className="text-neutral-600">{detail.owner.email}</p> : null}
          <p className="text-xs text-neutral-500">Usuario ficticio de desenvolvimento. Sem PII.</p>
        </Card>

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Destino / evento</p>
          {detail.destination ? (
            <>
              <p className="text-neutral-600">{detail.destination.eventName}</p>
              <p className="text-neutral-600">
                {detail.destination.street}, {detail.destination.number} —{" "}
                {detail.destination.city}/{detail.destination.uf}
              </p>
            </>
          ) : (
            <p className="text-neutral-500">Nao informado.</p>
          )}
        </Card>

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Arma/PCE (ficticia)</p>
          {detail.firearmRestricted ? (
            <p className="text-neutral-500">
              Acesso restrito — seu perfil ({ROLE_LABELS[admin.role]}) ve apenas o minimo
              necessario (docs/11 §3).
            </p>
          ) : detail.firearm ? (
            <p className="text-neutral-600">
              {detail.firearm.species} {detail.firearm.brand} {detail.firearm.model} —{" "}
              {detail.firearm.caliber} · qtd. {detail.firearm.quantity}
            </p>
          ) : (
            <p className="text-neutral-500">Nao informada.</p>
          )}
        </Card>

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Justificativa</p>
          <p className="text-neutral-600">{detail.justification}</p>
        </Card>

        <Card className="text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Pagamento Pix do cliente</p>
            <Badge>sandbox/dev</Badge>
          </div>
          {detail.payments.length === 0 ? (
            <p className="mt-2 text-neutral-500">Nenhuma cobranca gerada.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.payments.map((payment) => (
                <li key={payment.id} className="rounded-md border border-neutral-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-800">
                      {formatBRL(payment.amountCents)} · {payment.provider}
                    </p>
                    <Badge>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Criada em {formatDateTime(payment.createdAt)}
                    {payment.paidAt ? ` · paga em ${formatDateTime(payment.paidAt)}` : ""}
                    {payment.providerRefShort ? ` · ref ${payment.providerRefShort}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Cobrancas ficticias/sandbox — nenhum Pix real. Confirmacao de Pix e acao do
            Financeiro/Admin (docs/11 §3); nesta fase a confirmacao vem do webhook/simulacao dev.
          </p>
        </Card>

        <Card className="text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Documentos</p>
            <Badge>ficticios</Badge>
          </div>
          {detail.documents.length === 0 ? (
            <p className="mt-2 text-neutral-500">Nenhum documento enviado.</p>
          ) : detail.documentsRestricted ? (
            <ul className="mt-2 space-y-1">
              {detail.documents.map((doc) => (
                <li key={doc.id} className="text-neutral-600">
                  {DOCUMENT_TYPE_LABELS[doc.type]} —{" "}
                  <span className="font-medium">{DOCUMENT_STATUS_LABELS[doc.status]}</span>
                </li>
              ))}
              <li className="text-xs text-neutral-500">
                Metadados restritos — seu perfil ({ROLE_LABELS[admin.role]}) ve apenas o status
                (docs/11 §3).
              </li>
            </ul>
          ) : (
            <ul className="mt-2 space-y-3">
              {detail.documents.map((doc) => (
                <li key={doc.id} className="rounded-md border border-neutral-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-neutral-800">{doc.originalFileName}</p>
                    <Badge>{DOCUMENT_STATUS_LABELS[doc.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {DOCUMENT_TYPE_LABELS[doc.type]} · {doc.mimeType} · {doc.sizeKb} KB · sha256{" "}
                    {doc.sha256Short}…
                  </p>
                  {doc.rejectionReason ? (
                    <p className="mt-1 text-xs text-red-700">Motivo: {doc.rejectionReason}</p>
                  ) : null}
                  {doc.canBeReviewed ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={reviewDocumentAction}>
                        <input type="hidden" name="processId" value={detail.id} />
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="decision" value="APROVADO" />
                        <Button type="submit" className="px-3 py-1 text-xs">
                          Aprovar
                        </Button>
                      </form>
                      <form action={reviewDocumentAction} className="flex items-center gap-2">
                        <input type="hidden" name="processId" value={detail.id} />
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="decision" value="REJEITADO" />
                        <input
                          name="rejectionReason"
                          placeholder="Motivo (sem dados do doc)"
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                        />
                        <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                          Rejeitar
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-2 text-sm">
          <p className="font-medium">Suas permissoes neste processo</p>
          <ul className="space-y-1">
            {DETAIL_PERMISSIONS.map((permission) => {
              const allowed = hasPermission(admin, permission);
              return (
                <li key={permission} className="flex items-start gap-2">
                  <span className={allowed ? "text-emerald-600" : "text-neutral-400"}>
                    {allowed ? "✓" : "✕"}
                  </span>
                  <span className={allowed ? "text-neutral-800" : "text-neutral-400"}>
                    {PERMISSION_LABELS[permission]}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 text-sm">
        <p className="font-medium">Checklist de revisao (docs/11 §6 — versao desta fase)</p>
        <p className="mt-1 text-xs text-neutral-500">
          {canReview
            ? "Cada marcacao registra quem marcou, o perfil e a data/hora."
            : `Seu perfil (${ROLE_LABELS[admin.role]}) pode visualizar, mas nao marcar (docs/11 §3).`}
        </p>
        <ul className="mt-3 space-y-2">
          {detail.checklist.map((item) => (
            <li key={item.key} className="flex items-start gap-2">
              {canReview ? (
                <form action={toggleChecklistAction}>
                  <input type="hidden" name="processId" value={detail.id} />
                  <input type="hidden" name="key" value={item.key} />
                  <input type="hidden" name="nextChecked" value={item.checked ? "false" : "true"} />
                  <button
                    type="submit"
                    aria-label={item.checked ? `Desmarcar: ${item.label}` : `Marcar: ${item.label}`}
                    className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-xs ${
                      item.checked
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-neutral-400 bg-white text-transparent hover:border-neutral-600"
                    }`}
                  >
                    ✓
                  </button>
                </form>
              ) : (
                <input type="checkbox" checked={item.checked} disabled readOnly className="mt-0.5" />
              )}
              <div>
                <span className={item.checked ? "text-neutral-800" : "text-neutral-600"}>
                  {item.label}
                </span>
                {item.checked && item.checkedAt && item.checkedByLabel ? (
                  <p className="text-xs text-neutral-500">
                    Marcado por {item.checkedByLabel} em {formatDateTime(item.checkedAt)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 text-sm">
        <p className="font-medium">Historico do processo</p>
        <ul className="mt-3 space-y-2">
          {detail.timeline.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-400" />
              <div>
                <p className="text-neutral-800">{entry.title}</p>
                <p className="text-xs text-neutral-500">
                  {formatDateTime(entry.at)} · {entry.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6">
        <Link href="/admin/processos">
          <Button variant="secondary">Voltar a fila</Button>
        </Link>
      </div>
    </Container>
  );
}
