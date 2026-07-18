import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { requireUser } from "@/server/auth/guards";
import { DEFAULT_JUSTIFICATION, UFS } from "@/server/processes/guiaTrafegoSchema";
import { MOCK_FIREARMS, mockFirearmLabel } from "@/server/processes/mockFirearms";
import { NovoProcessoForm } from "./NovoProcessoForm";

export default async function NovoProcessoPage() {
  const user = await requireUser();

  const firearmOptions = MOCK_FIREARMS.map((firearm) => ({
    id: firearm.id,
    label: mockFirearmLabel(firearm),
  }));

  return (
    <Container>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Nova Guia de Trafego</h1>
          <Badge>mock/dev</Badge>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Cadastro de rascunho (Fase 3) com dados ficticios. Sem PII, sem upload, sem pagamento,
          sem protocolo real.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Solicitante (ficticio): <span className="font-medium">{user.name}</span>
        </p>
        <NovoProcessoForm
          ufs={UFS}
          firearms={firearmOptions}
          defaultJustification={DEFAULT_JUSTIFICATION}
        />
      </div>
    </Container>
  );
}
