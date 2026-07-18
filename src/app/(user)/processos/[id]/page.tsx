import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/server/auth/guards";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  INTERNAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  USER_FACING_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { listPaymentsForProcess } from "@/server/repositories/paymentRepository";
import { listDocumentsForProcess } from "@/server/repositories/processDocumentRepository";
import { findProcessByIdForUser } from "@/server/repositories/processRepository";
import {
  createPixPaymentAction,
  simulatePaymentApprovedAction,
  uploadDocumentAction,
} from "./actions";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Tela de revisao do processo pelo usuario — Fases 3.5/4. */
export default async function ProcessoRevisaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; pago?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { erro, ok, pago } = await searchParams;

  let process: Awaited<ReturnType<typeof findProcessByIdForUser>> = null;
  let documents: Awaited<ReturnType<typeof listDocumentsForProcess>> = [];
  let payments: Awaited<ReturnType<typeof listPaymentsForProcess>> = [];
  try {
    process = await findProcessByIdForUser(id, user.id);
    if (process) {
      [documents, payments] = await Promise.all([
        listDocumentsForProcess(process.id),
        listPaymentsForProcess(process.id),
      ]);
    }
  } catch {
    // Banco local fora do ar: tratar como nao encontrado, com aviso generico.
  }
  if (!process) notFound();

  const activePayment = payments.find((payment) => payment.status === "AGUARDANDO_PAGAMENTO");
  const paidPayment = payments.find((payment) => payment.status === "PAGO");
  const canCreateCharge =
    !activePayment &&
    !paidPayment &&
    (process.internalStatus === "RASCUNHO" || process.internalStatus === "AGUARDANDO_PAGAMENTO");

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Revisao do processo</h1>
          <Badge>mock/dev</Badge>
        </div>
        <p className="mt-1 font-mono text-sm text-neutral-500">{process.code}</p>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Status</p>
          <p className="text-neutral-600">
            {USER_FACING_STATUS_LABELS[process.userFacingStatus]}{" "}
            <span className="text-neutral-400">
              (interno: {INTERNAL_STATUS_LABELS[process.internalStatus]})
            </span>
          </p>
          <p className="text-neutral-600">{process.processType.name}</p>
        </Card>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Destino / evento</p>
          {process.destination ? (
            <>
              <p className="text-neutral-600">{process.destination.eventName}</p>
              <p className="text-neutral-600">
                {process.destination.street}, {process.destination.number} —{" "}
                {process.destination.city}/{process.destination.uf}
              </p>
            </>
          ) : (
            <p className="text-neutral-500">Nao informado.</p>
          )}
        </Card>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Arma/PCE (ficticia)</p>
          {process.firearm ? (
            <p className="text-neutral-600">
              {process.firearm.species} {process.firearm.brand} {process.firearm.model} —{" "}
              {process.firearm.caliber} · qtd. {process.firearm.quantity}
            </p>
          ) : (
            <p className="text-neutral-500">Nao informada.</p>
          )}
        </Card>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Justificativa</p>
          <p className="text-neutral-600">{process.justification}</p>
        </Card>

        <Card className="mt-4 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Documento de Identificacao</p>
            <Badge>ficticio</Badge>
          </div>
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Ambiente de desenvolvimento. <strong>Nao envie documento real</strong> — nada de RG,
            CPF, CNH ou foto de documento verdadeiro. Use um PDF/JPG/PNG ficticio (max. 2 MB). O
            arquivo fica apenas no storage local/dev e pode ser apagado livremente.
          </p>

          {erro ? (
            <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {erro}
            </p>
          ) : null}
          {ok ? (
            <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Arquivo ficticio enviado. Status: Enviado — aguardando revisao (mock/dev).
            </p>
          ) : null}

          {documents.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="rounded-md border border-neutral-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-neutral-800">{doc.originalFileName}</p>
                    <Badge>{DOCUMENT_STATUS_LABELS[doc.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {DOCUMENT_TYPE_LABELS[doc.type]} · {doc.mimeType} · {formatSize(doc.sizeBytes)}{" "}
                    · sha256 {doc.sha256.slice(0, 12)}…
                  </p>
                  {doc.status === "REJEITADO" && doc.rejectionReason ? (
                    <p className="mt-1 text-xs text-red-700">Motivo: {doc.rejectionReason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-neutral-500">Nenhum arquivo enviado ainda.</p>
          )}

          <form action={uploadDocumentAction} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="processId" value={process.id} />
            <input
              type="file"
              name="file"
              accept="application/pdf,image/jpeg,image/png"
              className="text-xs text-neutral-600 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-neutral-50"
            />
            <Button type="submit" variant="secondary">
              Enviar arquivo ficticio
            </Button>
          </form>
        </Card>

        <Card className="mt-4 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Pagamento do servico</p>
            <Badge>sandbox/dev</Badge>
          </div>
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Pagamento ficticio/sandbox. Nao pague Pix real.</strong> O codigo gerado nao e
            pagavel; valor ficticio de R$ 100,00. Nenhuma cobranca real existe nesta fase.
          </p>

          {pago ? (
            <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Pagamento simulado confirmado. Processo em fila (mock/dev).
            </p>
          ) : null}

          {payments.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {payments.map((payment) => (
                <li key={payment.id} className="rounded-md border border-neutral-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-800">
                      R$ {(payment.amountCents / 100).toFixed(2).replace(".", ",")} ·{" "}
                      {payment.provider}
                    </p>
                    <Badge>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                  </div>
                  {payment.status === "AGUARDANDO_PAGAMENTO" && payment.pixCopyPaste ? (
                    <>
                      <p className="mt-2 text-xs text-neutral-500">
                        Pix copia e cola (FICTICIO — nao pagavel):
                      </p>
                      <p className="mt-1 break-all rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700">
                        {payment.pixCopyPaste}
                      </p>
                      {payment.expiresAt ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          Expira em {payment.expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      ) : null}
                      <form action={simulatePaymentApprovedAction} className="mt-2">
                        <input type="hidden" name="processId" value={process.id} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                          Simular pagamento aprovado (dev)
                        </Button>
                      </form>
                    </>
                  ) : null}
                  {payment.status === "PAGO" && payment.paidAt ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Confirmado em {payment.paidAt.toLocaleDateString("pt-BR")}{" "}
                      {payment.paidAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-neutral-500">Nenhuma cobranca gerada ainda.</p>
          )}

          {canCreateCharge ? (
            <form action={createPixPaymentAction} className="mt-3">
              <input type="hidden" name="processId" value={process.id} />
              <Button type="submit">Gerar cobranca Pix (sandbox/dev)</Button>
            </form>
          ) : null}
        </Card>

        <div className="mt-4 space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>Este rascunho ainda nao foi protocolado.</p>
          <p>
            Nao ha GRU nem SINARM nesta fase; upload e pagamento sao apenas ficticios/sandbox
            (dev).
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Link href="/dashboard">
            <Button variant="secondary">Voltar aos meus processos</Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
