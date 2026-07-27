import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PASSWORD_MIN_LENGTH } from "@/server/auth/password";
import { signUpAction } from "./actions";

export const metadata: Metadata = {
  title: "Criar conta — Assistente CAC",
  description:
    "Crie sua conta no nosso sistema para acompanhar pedidos, documentos, pagamentos e status em um lugar só.",
};

/** O que a conta do NOSSO sistema serve para fazer (docs/24 §14 — sem juridiques). */
const O_QUE_A_CONTA_FAZ = [
  "Acompanhar seus pedidos do começo ao fim",
  "Enviar e reenviar documentos com a conferência da nossa equipe",
  "Ver os pagamentos do serviço e o que já foi confirmado",
  "Saber o status de cada etapa e o que fazer no próximo passo",
];

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; nome?: string; email?: string }>;
}) {
  const { erro, nome, email } = await searchParams;

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Criar sua conta</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Uma conta do <strong>nosso sistema</strong>, para você acompanhar tudo em um lugar só:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-neutral-600">
          {O_QUE_A_CONTA_FAZ.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden>✓</span>
              {item}
            </li>
          ))}
        </ul>

        <Notice tone="info" className="mt-4">
          Esta conta <strong>não é o Gov.br</strong>, e a senha que você criar aqui é só nossa.{" "}
          <strong>Nunca pedimos sua senha, código ou token do Gov.br dentro deste site.</strong>{" "}
          Quando uma etapa exigir login no órgão, você faz isso na janela oficial.{" "}
          <Link href="/ajuda#gov-br" className="font-medium underline underline-offset-2">
            Entenda quando isso acontece
          </Link>
          .
        </Notice>

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
            <Button type="submit" className="w-full py-2.5 text-base">
              Criar minha conta
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-sm text-neutral-600">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline underline-offset-2">
            Entrar na minha conta
          </Link>
        </p>

        <p className="mt-2 text-sm text-neutral-600">
          Primeira vez por aqui?{" "}
          <Link
            href="/ajuda#criar-conta"
            className="font-medium text-neutral-900 underline underline-offset-2"
          >
            Veja o passo a passo na ajuda
          </Link>
        </p>
      </div>
    </Container>
  );
}
