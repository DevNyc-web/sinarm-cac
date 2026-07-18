import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { hasPermission, requireAdminRole } from "@/server/auth/guards";
import { findMockUser } from "@/server/auth/mockUsers";
import { PERMISSION_LABELS, type Permission } from "@/server/auth/permissions";
import { ROLE_LABELS, type Role } from "@/server/auth/roles";
import { CHECKLIST_ITEMS } from "@/server/processes/checklistDefinition";
import {
  INTERNAL_STATUS_LABELS,
  USER_FACING_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { listChecklistItems } from "@/server/repositories/checklistRepository";
import { listStatusEvents } from "@/server/repositories/processEventRepository";
import { findProcessByIdForAdmin } from "@/server/repositories/processRepository";
import { toggleChecklistAction } from "./actions";

/** Permissoes relevantes para o detalhe do processo (docs/11 §3/§5.12). */
const DETAIL_PERMISSIONS: readonly Permission[] = [
  "process.pii.viewFull",
  "sinarm.execute",
  "review.checklist",
  "gru.generate",
  "payment.pix.confirm",
  "payment.gru.register",
  "message.send",
];

type TimelineEntry = {
  id: string;
  at: Date;
  title: string;
  detail: string;
};

function actorLabel(mockUserId: string, role: string): string {
  const mockUser = findMockUser(mockUserId);
  const roleLabel = ROLE_LABELS[role as Role] ?? role;
  return `${mockUser ? mockUser.name : mockUserId} (${roleLabel})`;
}

function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Detalhe admin do processo — Fases 3.5/3.6 (docs/11 §5, versao minima). */
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

  let process: Awaited<ReturnType<typeof findProcessByIdForAdmin>> = null;
  let statusEvents: Awaited<ReturnType<typeof listStatusEvents>> = [];
  let checklistRows: Awaited<ReturnType<typeof listChecklistItems>> = [];
  try {
    process = await findProcessByIdForAdmin(id);
    if (process) {
      [statusEvents, checklistRows] = await Promise.all([
        listStatusEvents(process.id),
        listChecklistItems(process.id),
      ]);
    }
  } catch {
    // Banco local fora do ar: tratar como nao encontrado.
  }
  if (!process) notFound();

  const owner = findMockUser(process.userId);
  const canViewFull = hasPermission(admin, "process.pii.viewFull");
  const canReview = hasPermission(admin, "review.checklist");

  // Checklist: definicao fixa + estado persistido (itens nascem na 1a marcacao).
  const checklist = CHECKLIST_ITEMS.map((definition) => ({
    ...definition,
    row: checklistRows.find((row) => row.key === definition.key) ?? null,
  }));

  // Linha do tempo: criacao + eventos de status + marcacoes de checklist.
  const timeline: TimelineEntry[] = [];
  const hasCreationEvent = statusEvents.some((event) => event.fromStatus === null);
  if (!hasCreationEvent) {
    // Rascunhos criados antes da Fase 3.6 nao tem evento de criacao persistido.
    timeline.push({
      id: `creation-${process.id}`,
      at: process.createdAt,
      title: "Rascunho criado",
      detail: owner ? `por ${owner.name} (Usuario)` : `por ${process.userId}`,
    });
  }
  for (const event of statusEvents) {
    timeline.push({
      id: event.id,
      at: event.createdAt,
      title:
        event.fromStatus === null
          ? `Rascunho criado — status ${INTERNAL_STATUS_LABELS[event.toStatus]}`
          : `Status: ${INTERNAL_STATUS_LABELS[event.fromStatus]} → ${INTERNAL_STATUS_LABELS[event.toStatus]}`,
      detail: `por ${actorLabel(event.actorMockUserId, event.actorRole)}${event.note ? ` · ${event.note}` : ""}`,
    });
  }
  for (const item of checklist) {
    if (item.row?.checked && item.row.checkedAt && item.row.checkedByMockUserId) {
      timeline.push({
        id: `check-${item.row.id}`,
        at: item.row.checkedAt,
        title: `Checklist: ${item.label}`,
        detail: `marcado por ${actorLabel(item.row.checkedByMockUserId, item.row.checkedByRole ?? "?")}`,
      });
    }
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Detalhe do processo</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-1 font-mono text-sm text-neutral-500">{process.code}</p>

      {erro ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="space-y-1 text-sm">
          <p className="font-medium">Resumo</p>
          <p className="text-neutral-600">{process.processType.name}</p>
          <p className="text-neutral-600">
            Status interno: {INTERNAL_STATUS_LABELS[process.internalStatus]}
          </p>
          <p className="text-neutral-600">
            Status visivel: {USER_FACING_STATUS_LABELS[process.userFacingStatus]}
          </p>
          <p className="text-neutral-600">
            Criado em {process.createdAt.toLocaleDateString("pt-BR")}
          </p>
        </Card>

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Usuario (mock)</p>
          <p className="text-neutral-600">{owner ? owner.name : process.userId}</p>
          {owner ? <p className="text-neutral-600">{owner.email}</p> : null}
          <p className="text-xs text-neutral-500">Usuario ficticio de desenvolvimento. Sem PII.</p>
        </Card>

        <Card className="space-y-1 text-sm">
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

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Arma/PCE (ficticia)</p>
          {!canViewFull ? (
            <p className="text-neutral-500">
              Acesso restrito — seu perfil ({ROLE_LABELS[admin.role]}) ve apenas o minimo
              necessario (docs/11 §3).
            </p>
          ) : process.firearm ? (
            <p className="text-neutral-600">
              {process.firearm.species} {process.firearm.brand} {process.firearm.model} —{" "}
              {process.firearm.caliber} · qtd. {process.firearm.quantity}
            </p>
          ) : (
            <p className="text-neutral-500">Nao informada.</p>
          )}
        </Card>

        <Card className="space-y-1 text-sm">
          <p className="font-medium">Justificativa</p>
          <p className="text-neutral-600">{process.justification}</p>
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
          {checklist.map((item) => {
            const checked = item.row?.checked ?? false;
            return (
              <li key={item.key} className="flex items-start gap-2">
                {canReview ? (
                  <form action={toggleChecklistAction}>
                    <input type="hidden" name="processId" value={process.id} />
                    <input type="hidden" name="key" value={item.key} />
                    <input type="hidden" name="nextChecked" value={checked ? "false" : "true"} />
                    <button
                      type="submit"
                      aria-label={checked ? `Desmarcar: ${item.label}` : `Marcar: ${item.label}`}
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-xs ${
                        checked
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-neutral-400 bg-white text-transparent hover:border-neutral-600"
                      }`}
                    >
                      ✓
                    </button>
                  </form>
                ) : (
                  <input type="checkbox" checked={checked} disabled readOnly className="mt-0.5" />
                )}
                <div>
                  <span className={checked ? "text-neutral-800" : "text-neutral-600"}>
                    {item.label}
                  </span>
                  {item.row?.checked && item.row.checkedAt && item.row.checkedByMockUserId ? (
                    <p className="text-xs text-neutral-500">
                      Marcado por {actorLabel(item.row.checkedByMockUserId, item.row.checkedByRole ?? "?")}{" "}
                      em {formatDateTime(item.row.checkedAt)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4 text-sm">
        <p className="font-medium">Historico do processo</p>
        <ul className="mt-3 space-y-2">
          {timeline.map((entry) => (
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
