import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
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
        <h1 className="text-2xl font-semibold">Nova solicitação</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Preencha os dados do seu pedido. Nada é enviado ao órgão nesta etapa — a execução é
          feita depois, por uma pessoa da nossa equipe.
        </p>

        {/* Serviço escolhido + finalidade (contexto, leitura) */}
        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Serviço</Badge>
            <p className="font-medium text-neutral-900">Guia de Tráfego (CAC)</p>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">Finalidade</dt>
              <dd className="text-neutral-800">Treinamento de tiro desportivo</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Solicitante</dt>
              <dd className="text-neutral-800">{user.name}</dd>
            </div>
          </dl>
        </Card>

        {/* Passo 1 — dados do pedido */}
        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          1. Dados do pedido
        </h2>
        <NovoProcessoForm
          ufs={UFS}
          firearms={firearmOptions}
          defaultJustification={DEFAULT_JUSTIFICATION}
        />

        {/* Passo 2 — documentos (área visual dev/fake) */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          2. Documentos
        </h2>
        <Card className="mt-4">
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center">
            <p className="text-sm font-medium text-neutral-800">
              Anexe seus documentos após salvar o rascunho
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Área de upload em modo demonstração. Salve o rascunho acima para liberar o envio de
              documentos na página do processo.
            </p>
            <span className="mt-3 inline-flex cursor-not-allowed items-center rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-400">
              Selecionar arquivos (indisponível na demonstração)
            </span>
          </div>
        </Card>

        <Notice tone="warning" className="mt-6">
          Ambiente de demonstração: <strong>não envie documentos ou dados pessoais reais</strong>.
          Você confere tudo antes de qualquer envio, e a <strong>aprovação depende do órgão
          competente</strong>.
        </Notice>
      </div>
    </Container>
  );
}
