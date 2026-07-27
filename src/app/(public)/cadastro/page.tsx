import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PASSWORD_MIN_LENGTH } from "@/server/auth/password";
import { signUpAction } from "./actions";

export const metadata = { title: "Criar conta — Assistente CAC" };

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; nome?: string; email?: string }>;
}) {
  const { erro, nome, email } = await searchParams;

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="mt-2 text-xs text-neutral-500">
          Esta conta é do <strong>nosso serviço</strong> — não é o Gov.br. Quando o processo
          exigir autenticação no órgão, você fará isso na <strong>janela oficial</strong>, e nunca
          vemos sua senha de lá.
        </p>

        {erro ? (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {erro}
          </p>
        ) : null}

        <Card className="mt-4">
          <form action={signUpAction} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm text-neutral-600">
                Nome
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={nome ?? ""}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm text-neutral-600">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={email ?? ""}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-neutral-600">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={128}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Mínimo de {PASSWORD_MIN_LENGTH} caracteres. Use uma senha que você não usa em
                outro lugar.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Criar conta
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-sm text-neutral-600">
          Já tem conta?{" "}
          <a href="/login" className="font-medium text-neutral-900 underline">
            Entrar
          </a>
        </p>
      </div>
    </Container>
  );
}
