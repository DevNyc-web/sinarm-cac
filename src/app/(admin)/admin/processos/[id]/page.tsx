import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { hasPermission, requireAdminRole } from "@/server/auth/guards";
import { findMockUser } from "@/server/auth/mockUsers";
import { PERMISSION_LABELS, type Permission } from "@/server/auth/permissions";
import { ROLE_LABELS } from "@/server/auth/roles";
import {
  INTERNAL_STATUS_LABELS,
  USER_FACING_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { findProcessByIdForAdmin } from "@/server/repositories/processRepository";

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

/** Checklist de revisao (docs/11 §6) — VISUAL, nao interativo nesta fase. */
const REVIEW_CHECKLIST: readonly string[] = [
  "Pre-requisitos do usuario confirmados (Gov.br ativo; CR/arma)",
  "Pagamento Pix do cliente confirmado",
  "Consentimentos/LGPD registrados",
  "Servico correto: Emitir Guia de Trafego Pessoa Fisica (CAC)",
  "Documento de Identificacao Pessoal anexado e legivel",
  "Destino completo e coerente",
  "Arma/PCE selecionada do acervo e a certa",
  "Justificativa preenchida",
];

/** Detalhe admin do processo — Fase 3.5 (docs/11 §5, versao minima). */
export default async function AdminProcessoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminRole();
  const { id } = await params;

  let process: Awaited<ReturnType<typeof findProcessByIdForAdmin>> = null;
  try {
    process = await findProcessByIdForAdmin(id);
  } catch {
    // Banco local fora do ar: tratar como nao encontrado.
  }
  if (!process) notFound();

  const owner = findMockUser(process.userId);
  const canViewFull = hasPermission(admin, "process.pii.viewFull");

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Detalhe do processo</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-1 font-mono text-sm text-neutral-500">{process.code}</p>

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
        <p className="font-medium">Checklist de revisao (docs/11 §6)</p>
        <p className="mt-1 text-xs text-neutral-500">
          Visual apenas — marcacao interativa e registro (quem/quando) chegam em fase posterior.
          Itens de pagamento/documento dependem de fases ainda nao implementadas.
        </p>
        <ul className="mt-3 space-y-1.5">
          {REVIEW_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2 text-neutral-600">
              <input type="checkbox" disabled className="mt-0.5" />
              <span>{item}</span>
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
