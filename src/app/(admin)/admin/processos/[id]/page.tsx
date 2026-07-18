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
  NOTE_VISIBILITY_LABELS,
  OPERATIONAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PRIORITY_LABELS,
  USER_FACING_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import {
  READINESS_LABELS,
  SIGNAL_LABELS,
  SLA_HOURS,
  SLA_LABELS,
  type SlaStatus,
} from "@/server/processes/operationalSignals";
import { getAdminProcessDetail, type AdminProcessDetail } from "@/server/services/getAdminProcessDetail";
import { assignableMockUsers } from "@/server/services/updateProcessOperations";
import { MAX_NOTE_LENGTH } from "@/server/services/createProcessNote";
import {
  assignProcessAction,
  changeOperationalStatusAction,
  changePriorityAction,
  createNoteAction,
  reviewDocumentAction,
  toggleChecklistAction,
} from "./actions";

const controlClass =
  "mt-1 rounded-md border border-neutral-300 px-2 py-1 text-xs focus:border-neutral-500 focus:outline-none";

const SLA_CLASS: Record<SlaStatus, string> = {
  DENTRO_DO_PRAZO: "text-neutral-700",
  ATENCAO: "font-medium text-amber-700",
  ATRASADO: "font-medium text-red-700",
};

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
  const canOperate =
    hasPermission(admin, "process.assign") ||
    hasPermission(admin, "process.priority") ||
    hasPermission(admin, "process.operationalStatus");
  const canWriteInternalNote = hasPermission(admin, "note.internal");
  const canMessageUser = hasPermission(admin, "message.send");
  const assignees = assignableMockUsers();
  const revisionChecklist = detail.checklist.filter((item) => item.group === "REVISAO");
  const gruChecklist = detail.checklist.filter((item) => item.group === "GRU");

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
            Status operacional:{" "}
            <span className="font-medium text-neutral-900">
              {OPERATIONAL_STATUS_LABELS[detail.operationalStatus]}
            </span>
          </p>
          <p className="text-neutral-600">Prioridade: {PRIORITY_LABELS[detail.priority]}</p>
          <p className="text-neutral-600">
            Responsavel: {detail.assignedToLabel ?? "sem responsavel"}
          </p>
          <p className="text-xs text-neutral-500">
            Status visivel ao usuario: {USER_FACING_STATUS_LABELS[detail.userFacingStatus]} ·
            interno (docs/12 §6): {INTERNAL_STATUS_LABELS[detail.internalStatus]}
          </p>
          <p className="text-xs text-neutral-500">
            Criado em {detail.createdAt.toLocaleDateString("pt-BR")}
          </p>
        </Card>

        <Card className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Operacao</p>
            <Badge>dev</Badge>
          </div>
          {!canOperate ? (
            <p className="text-neutral-500">
              Seu perfil ({ROLE_LABELS[admin.role]}) acompanha a operacao, mas nao altera
              responsavel, prioridade ou status (docs/11 §3).
            </p>
          ) : (
            <>
              <form action={assignProcessAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="processId" value={detail.id} />
                <label className="block text-xs text-neutral-600">
                  Responsavel
                  <select
                    name="assigneeId"
                    defaultValue={detail.assignedToMockUserId ?? ""}
                    className={controlClass}
                  >
                    <option value="">Sem responsavel</option>
                    {assignees.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ({ROLE_LABELS[candidate.role]})
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                  Atribuir
                </Button>
              </form>

              <form action={changePriorityAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="processId" value={detail.id} />
                <label className="block text-xs text-neutral-600">
                  Prioridade
                  <select name="priority" defaultValue={detail.priority} className={controlClass}>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                  Salvar
                </Button>
              </form>

              <form
                action={changeOperationalStatusAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="processId" value={detail.id} />
                <label className="block text-xs text-neutral-600">
                  Status operacional
                  <select
                    name="operationalStatus"
                    defaultValue={detail.operationalStatus}
                    className={controlClass}
                  >
                    {Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                  Mover
                </Button>
              </form>
              <p className="text-xs text-neutral-500">
                &quot;Pronto para protocolo manual&quot; apenas sinaliza a fila: o protocolo no
                SINARM e feito por humano, fora do app. Nada aqui protocola.
              </p>
            </>
          )}
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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium">Prontidao operacional</p>
            <Badge>{READINESS_LABELS[detail.indicators.readinessLevel]}</Badge>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {detail.indicators.readinessMetCount} de {detail.indicators.readinessTotal} criterios.
            <strong> Isto nao protocola nada</strong> — o protocolo no SINARM e manual, feito por
            humano fora do app.
          </p>
          <ul className="mt-3 space-y-1">
            {detail.indicators.readinessCriteria.map((criterion) => (
              <li key={criterion.label} className="flex items-start gap-2">
                <span className={criterion.met ? "text-emerald-600" : "text-neutral-400"}>
                  {criterion.met ? "✓" : "✕"}
                </span>
                <span className={criterion.met ? "text-neutral-800" : "text-neutral-500"}>
                  {criterion.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="text-sm">
          <p className="font-medium">Sinalizadores</p>
          {detail.indicators.signals.length === 0 ? (
            <p className="mt-2 text-neutral-500">Nenhum sinalizador ativo.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {detail.indicators.signals.map((signal) => (
                <li key={signal} className="flex items-start gap-2 text-neutral-700">
                  <span className="text-amber-600">▲</span>
                  {SIGNAL_LABELS[signal]}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Derivados do estado atual (documento, pagamento, destino, checklists, bloqueio) — nao
            sao campos salvos, entao nunca ficam desatualizados.
          </p>
        </Card>

        <Card className="text-sm">
          <p className="font-medium">SLA interno (dev)</p>
          {detail.indicators.sla ? (
            <>
              <p className="mt-2">
                <span className={SLA_CLASS[detail.indicators.sla.status]}>
                  {SLA_LABELS[detail.indicators.sla.status]}
                </span>
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
                <li>Criado em {formatDateTime(detail.indicators.sla.createdAt)}</li>
                <li>Tempo desde a criacao: {detail.indicators.sla.hoursSinceCreated}h</li>
                <li>
                  Tempo desde o ultimo evento:{" "}
                  {detail.indicators.sla.hoursSinceLastEvent === null
                    ? "—"
                    : `${detail.indicators.sla.hoursSinceLastEvent}h`}
                </li>
                <li>Vencimento operacional: {formatDateTime(detail.indicators.sla.dueAt)}</li>
              </ul>
              <p className="mt-2 text-xs text-neutral-500">
                Prazo <strong>ficticio e interno</strong> ({SLA_HOURS}h) para organizar a fila em
                desenvolvimento. Nao e promessa ao usuario e nao aparece para ele.
              </p>
            </>
          ) : (
            <p className="mt-2 text-neutral-500">Processo encerrado — SLA nao se aplica.</p>
          )}
        </Card>

        <Card className="text-sm">
          <p className="font-medium">Pendencias por responsavel</p>
          {detail.indicators.pendings.length === 0 ? (
            <p className="mt-2 text-neutral-500">Nenhuma pendencia.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {detail.indicators.pendings.map((pending) => (
                <li key={pending.what} className="flex items-start justify-between gap-3">
                  <span className="text-neutral-700">{pending.what}</span>
                  <Badge>{ROLE_LABELS[pending.suggestedRole]}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Perfil sugerido conforme docs/11 §2/§3 — a segregacao de funcoes continua valendo.
          </p>
        </Card>

        <Card className="text-sm md:col-span-2">
          <p className="font-medium">Auditoria consolidada</p>
          <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-neutral-600 sm:grid-cols-2">
            <p>
              Ultima acao:{" "}
              <span className="text-neutral-900">{detail.audit.lastActionTitle ?? "—"}</span>
            </p>
            <p>
              Quando:{" "}
              {detail.audit.lastActionAt ? formatDateTime(detail.audit.lastActionAt) : "—"}
            </p>
            <p className="sm:col-span-2">
              Autor/perfil: {detail.audit.lastActorLabel ?? "—"}
            </p>
            <p>Entradas na trilha: {detail.audit.eventCount}</p>
            <p>Notas/mensagens: {detail.audit.noteCount}</p>
            <p>
              Checklist marcado: {detail.audit.checklistCheckedCount}/{detail.audit.checklistTotal}
            </p>
            <p>
              Pagamento atual:{" "}
              {detail.audit.currentPaymentStatus
                ? PAYMENT_STATUS_LABELS[detail.audit.currentPaymentStatus]
                : "—"}
            </p>
            <p>
              Documento atual:{" "}
              {detail.audit.currentDocumentStatus
                ? DOCUMENT_STATUS_LABELS[detail.audit.currentDocumentStatus]
                : "—"}
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4 text-sm">
        <p className="font-medium">Checklist de revisao (docs/11 §6)</p>
        <p className="mt-1 text-xs text-neutral-500">
          {canReview
            ? "Cada marcacao registra quem marcou, o perfil e a data/hora."
            : `Seu perfil (${ROLE_LABELS[admin.role]}) pode visualizar, mas nao marcar (docs/11 §3).`}
        </p>
        <ul className="mt-3 space-y-2">
          {revisionChecklist.map((item) => (
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
        <div className="flex items-center gap-2">
          <p className="font-medium">Checkpoint &quot;Dados da GRU&quot; (docs/11 §7)</p>
          <Badge>ficticio</Badge>
        </div>
        <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Conferencia ficticia.</strong> Esta tela nao acessa o SINARM, nao gera GRU e nao
          protocola nada. No fluxo real, este checkpoint antecede o ato irreversivel &quot;Gerar
          GRU e Salvar&quot; — que continua sendo feito por humano, fora do app.
        </p>
        <ul className="mt-3 space-y-2">
          {gruChecklist.map((item) => (
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
        <p className="font-medium">Notas e mensagens</p>
        <p className="mt-1 text-xs text-neutral-500">
          Nota interna: visivel so para a equipe. Mensagem: aparece para o usuario no processo
          dele. <strong>Nao escreva PII</strong> (CPF, RG, endereco, nº de serie) — docs/11 §19.
        </p>

        {canWriteInternalNote || canMessageUser ? (
          <form action={createNoteAction} className="mt-3 space-y-2">
            <input type="hidden" name="processId" value={detail.id} />
            <textarea
              name="body"
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="Escreva aqui (sem dados pessoais)…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select name="visibility" defaultValue="INTERNA" className={controlClass}>
                {canWriteInternalNote ? <option value="INTERNA">Nota interna</option> : null}
                {canMessageUser ? <option value="VISIVEL_USUARIO">Mensagem ao usuario</option> : null}
              </select>
              <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                Registrar
              </Button>
              {!canWriteInternalNote ? (
                <span className="text-xs text-neutral-500">
                  Seu perfil ({ROLE_LABELS[admin.role]}) envia apenas mensagem ao usuario.
                </span>
              ) : null}
            </div>
          </form>
        ) : null}

        {detail.notes.length === 0 ? (
          <p className="mt-3 text-neutral-500">Nenhuma nota ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded-md border border-neutral-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge>{NOTE_VISIBILITY_LABELS[note.visibility]}</Badge>
                  <span className="text-xs text-neutral-500">
                    {note.authorLabel} · {formatDateTime(note.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-neutral-700">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
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
