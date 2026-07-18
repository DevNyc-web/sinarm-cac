import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/server/auth/guards";
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Rascunho salvo</h1>
          <Badge>mock/dev</Badge>
        </div>

        {process ? (
          <Card className="mt-4 space-y-2 text-sm">
            <p>
              Codigo do rascunho:{" "}
              <span className="font-mono font-medium text-neutral-900">{process.code}</span>
            </p>
            <p className="text-neutral-600">
              Status: {process.internalStatus} · {process.processType.name}
            </p>
            {process.destination ? (
              <p className="text-neutral-600">
                Destino: {process.destination.eventName} — {process.destination.city}/
                {process.destination.uf}
              </p>
            ) : null}
            {process.firearm ? (
              <p className="text-neutral-600">
                Arma/PCE (ficticia): {process.firearm.species} {process.firearm.brand}{" "}
                {process.firearm.model} — {process.firearm.caliber}
              </p>
            ) : null}
            <p className="pt-2 text-xs text-neutral-500">
              Isto NAO e um protocolo. E um rascunho de desenvolvimento com dados ficticios. As
              proximas etapas (documento, pagamento, protocolo) chegam nas fases seguintes.
            </p>
          </Card>
        ) : (
          <Card className="mt-4">
            <p className="text-sm text-neutral-600">Rascunho nao encontrado.</p>
          </Card>
        )}

        <div className="mt-6 flex gap-3">
          <Link href="/dashboard">
            <Button>Ir para meus processos</Button>
          </Link>
          <Link href="/processos/novo">
            <Button variant="secondary">Criar outro rascunho</Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
