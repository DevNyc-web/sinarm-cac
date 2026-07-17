import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <Container>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Placeholder — a autenticacao sera implementada na Fase 2. Nada e enviado.
        </p>
        <Card className="mt-4">
          <form className="space-y-3">
            <label className="block text-sm">
              E-mail
              <input
                type="email"
                disabled
                placeholder="voce@exemplo.com"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
              />
            </label>
            <Button type="button" disabled className="w-full">
              Entrar (indisponivel na Fase 1)
            </Button>
          </form>
        </Card>
      </div>
    </Container>
  );
}
