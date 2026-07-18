import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/server/auth/guards";
import {
  INTERNAL_STATUS_LABELS,
  USER_FACING_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { findProcessByIdForUser } from "@/server/repositories/processRepository";

/** Tela de revisao do processo pelo usuario — Fase 3.5 (docs/14 F3: "reve o resumo"). */
export default async function ProcessoRevisaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  let process: Awaited<ReturnType<typeof findProcessByIdForUser>> = null;
  try {
    process = await findProcessByIdForUser(id, user.id);
  } catch {
    // Banco local fora do ar: tratar como nao encontrado, com aviso generico.
  }
  if (!process) notFound();

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

        <div className="mt-4 space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>Este rascunho ainda nao foi protocolado.</p>
          <p>Ainda nao ha upload, pagamento, GRU ou SINARM nesta fase.</p>
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
