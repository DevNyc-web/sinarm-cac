import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/server/auth/guards";
import { OPERATIONAL_STATUS_USER_LABELS } from "@/server/processes/statusLabels";
import { findProcessByCodeForUser } from "@/server/repositories/processRepository";

export default async function SucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await requireUser();
  const { code } = await searchParams;

  const process = code ? await findProcessByCodeForUser(code, user.id) : null;

  return (
    <Container>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Rascunho salvo</h1>

        {process ? (
          <Card className="mt-4 space-y-2 text-sm">
            <p>
              Código do rascunho:{" "}
              <span className="font-mono font-medium text-neutral-900">{process.code}</span>
            </p>
            <p className="text-neutral-600">
              Status: {OPERATIONAL_STATUS_USER_LABELS[process.operationalStatus]} ·{" "}
              {process.processType.name}
            </p>
            {process.destination ? (
              <p className="text-neutral-600">
                Destino: {process.destination.eventName} — {process.destination.city}/
                {process.destination.uf}
              </p>
            ) : null}
            {process.firearm ? (
              <p className="text-neutral-600">
                Arma/PCE indicada: {process.firearm.species} {process.firearm.brand}{" "}
                {process.firearm.model} — {process.firearm.caliber}
              </p>
            ) : null}
            <p className="pt-2 text-xs text-neutral-500">
              <strong>Isto não é um protocolo.</strong> É apenas o rascunho do seu pedido. As
              próximas etapas (documento, pagamento e execução) ficam disponíveis conforme o
              processo avança.
            </p>
          </Card>
        ) : (
          <Card className="mt-4">
            <p className="text-sm text-neutral-600">Rascunho não encontrado.</p>
          </Card>
        )}

        <div className="mt-6 flex gap-3">
          {process ? (
            <Link href={`/processos/${process.id}`}>
              <Button>Revisar processo</Button>
            </Link>
          ) : null}
          <Link href="/dashboard">
            <Button variant="secondary">Meus processos</Button>
          </Link>
          <Link href="/processos/novo">
            <Button variant="secondary">Criar outro rascunho</Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
