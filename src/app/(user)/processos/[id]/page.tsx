import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DocumentIntakePanel } from "@/components/documents/DocumentIntakePanel";
import { requireUser } from "@/server/auth/guards";
import { isDocumentKind } from "@/server/documents";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  MANUAL_EXECUTION_USER_LABELS,
  OPERATIONAL_STATUS_USER_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import {
  formatBRL,
  GRU_ESTIMATED_CENTS,
  SERVICE_FEE_CENTS,
  SERVICE_TOTAL_CENTS,
} from "@/server/processes/pricing";
import { listNotesForProcess } from "@/server/repositories/processNoteRepository";
import { listPaymentsForProcess } from "@/server/repositories/paymentRepository";
import { listDocumentsForOwner } from "@/server/repositories/processDocumentRepository";
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
  // `?ok=` carrega o tipo enviado, para o feedback aparecer no card certo.
  const sentKind = isDocumentKind(ok) ? ok : undefined;

  let process: Awaited<ReturnType<typeof findProcessByIdForUser>> = null;
  let documents: Awaited<ReturnType<typeof listDocumentsForOwner>> = [];
  let payments: Awaited<ReturnType<typeof listPaymentsForProcess>> = [];
  let messages: Awaited<ReturnType<typeof listNotesForProcess>> = [];
  try {
    process = await findProcessByIdForUser(id, user.id);
    if (process) {
      [documents, payments, messages] = await Promise.all([
        listDocumentsForOwner(process.id),
        listPaymentsForProcess(process.id),
        // Need-to-know: o dono le APENAS mensagens marcadas como visiveis.
        listNotesForProcess(process.id, true),
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
        <h1 className="text-2xl font-semibold">Seu processo</h1>
        <p className="mt-1 font-mono text-sm text-neutral-500">{process.code}</p>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Status</p>
          <p className="text-neutral-800">
            {/* Depois que a execucao manual comeca, ela e a visao mais atual. */}
            {process.manualExecutionStatus === "EXECUCAO_MANUAL_NAO_INICIADA"
              ? OPERATIONAL_STATUS_USER_LABELS[process.operationalStatus]
              : MANUAL_EXECUTION_USER_LABELS[process.manualExecutionStatus]}
          </p>
          <p className="text-neutral-600">{process.processType.name}</p>
          <p className="text-xs text-neutral-500">
            A execução é feita por uma <strong>pessoa da nossa equipe</strong> na janela oficial —
            este aplicativo <strong>não opera os sistemas do órgão</strong>.
          </p>
          {process.manualExecutionStatus === "PROTOCOLO_MANUAL_REGISTRADO" ||
          process.manualExecutionStatus === "GRU_MANUAL_REGISTRADA" ||
          process.manualExecutionStatus === "AGUARDANDO_PAGAMENTO_GRU_EMPRESA" ||
          process.manualExecutionStatus === "GRU_PAGA_MANUALMENTE_DEV" ? (
            <p className="mt-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              <strong>Protocolo registrado não significa aprovação.</strong> A análise e a decisão
              dependem do órgão competente — <strong>não garantimos deferimento</strong>.
            </p>
          ) : null}
        </Card>

        {messages.length > 0 ? (
          <Card className="mt-4 text-sm">
            <p className="font-medium">Mensagens da equipe</p>
            <ul className="mt-3 space-y-2">
              {messages.map((message) => (
                <li key={message.id} className="rounded-md border border-neutral-200 px-3 py-2">
                  <p className="text-xs text-neutral-500">
                    {message.createdAt.toLocaleDateString("pt-BR")}{" "}
                    {message.createdAt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700">{message.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

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
            <p className="text-neutral-500">Não informado.</p>
          )}
        </Card>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Arma/PCE indicada</p>
          {process.firearm ? (
            <p className="text-neutral-600">
              {process.firearm.species} {process.firearm.brand} {process.firearm.model} —{" "}
              {process.firearm.caliber} · qtd. {process.firearm.quantity}
            </p>
          ) : (
            <p className="text-neutral-500">Não informada.</p>
          )}
        </Card>

        <Card className="mt-4 space-y-1 text-sm">
          <p className="font-medium">Justificativa</p>
          <p className="text-neutral-600">{process.justification}</p>
        </Card>

        <DocumentIntakePanel
          processId={process.id}
          documents={documents}
          uploadAction={uploadDocumentAction}
          sentKind={sentKind}
          error={erro}
        />

        <Card className="mt-4 text-sm">
          <p className="font-medium">Arquivos enviados</p>
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Ambiente de demonstração: não envie documento real</strong> — nada de RG, CPF,
            CNH ou foto de documento verdadeiro. Envie um PDF/JPG/PNG de teste (até 2 MB). O envio
            definitivo só será aberto em ambiente de produção seguro.
          </p>

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
            <p className="mt-3 text-neutral-500">
              Nenhum arquivo enviado ainda. Use o botão de cada documento esperado acima.
            </p>
          )}
        </Card>

        <Card className="mt-4 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Pagamento do serviço</p>
          </div>
          <div className="mt-2 rounded-md border border-neutral-200 px-3 py-2 text-xs text-neutral-700">
            <p className="font-medium text-neutral-900">
              {formatBRL(SERVICE_TOTAL_CENTS)} — serviço de assistência
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>· Assistência (nosso trabalho): {formatBRL(SERVICE_FEE_CENTS)}</li>
              <li>
                · GRU — <strong>taxa do órgão competente</strong>: {formatBRL(GRU_ESTIMATED_CENTS)}
              </li>
            </ul>
            <p className="mt-1">
              O Pix é do <strong>nosso serviço</strong> e <strong>não é a GRU</strong>. Você{" "}
              <strong>não precisa</strong> pagar a GRU por fora: nós recolhemos por você. Este
              pagamento <strong>não garante aprovação</strong> — veja a{" "}
              <Link href="/reembolso" className="underline underline-offset-2">
                política de reembolso
              </Link>{" "}
              e os{" "}
              <Link href="/termos" className="underline underline-offset-2">
                termos
              </Link>
              .
            </p>
          </div>
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Ambiente de demonstração: não pague nada.</strong> O código gerado{" "}
            <strong>não é pagável</strong> e nenhuma cobrança real existe aqui.
          </p>

          {pago ? (
            <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Pagamento confirmado. Seu processo entrou na fila de operação.
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
                          Simular pagamento aprovado (demonstração)
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
              <Button type="submit">Gerar cobrança Pix</Button>
            </form>
          ) : null}
        </Card>

        <div className="mt-4 space-y-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <p>
            <strong>Não garantimos aprovação.</strong> Quem analisa e decide é o órgão competente.
          </p>
          <p className="text-xs">
            Dúvidas sobre valores e devolução: veja{" "}
            <Link href="/reembolso" className="underline underline-offset-2">
              reembolso
            </Link>
            ,{" "}
            <Link href="/termos" className="underline underline-offset-2">
              termos
            </Link>{" "}
            e{" "}
            <Link href="/privacidade" className="underline underline-offset-2">
              privacidade
            </Link>
            .
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
