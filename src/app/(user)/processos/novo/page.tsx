import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NovoProcessoPage() {
  return (
    <Container>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Nova Guia de Trafego</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Placeholder de formulario (Fase 1). Nenhum dado e salvo. Sem PII, sem upload, sem
          pagamento.
        </p>
        <Card className="mt-4 space-y-4">
          <label className="block text-sm">
            Nome do evento / clube
            <input
              disabled
              placeholder="Ex.: Clube de Tiro Exemplo"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              UF
              <input
                disabled
                placeholder="SP"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
              />
            </label>
            <label className="block text-sm">
              Cidade
              <input
                disabled
                placeholder="Cidade Exemplo"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
              />
            </label>
          </div>
          <label className="block text-sm">
            Justificativa
            <textarea
              disabled
              rows={3}
              placeholder="Guia para treino"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
            />
          </label>
          <Button type="button" disabled>
            Salvar (indisponivel na Fase 1)
          </Button>
        </Card>
      </div>
    </Container>
  );
}
