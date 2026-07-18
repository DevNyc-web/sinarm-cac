import { Container } from "@/components/ui/Container";
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
        <h1 className="text-2xl font-semibold">Nova Guia de Tráfego</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Preencha os dados do seu pedido. Nada é enviado ao órgão nesta etapa — a execução é
          feita depois, por uma pessoa da nossa equipe.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Solicitante: <span className="font-medium">{user.name}</span>
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
