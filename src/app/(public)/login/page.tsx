import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { getCurrentUser } from "@/server/auth/guards";
import { isMockAuthForDisplay } from "@/server/auth/config";
import { MOCK_USERS } from "@/server/auth/mockUsers";
import { ROLE_LABELS } from "@/server/auth/roles";
import { signInMockAction, signInWithPasswordAction, signOutAction } from "./actions";

const MOTIVOS: Record<string, string> = {
  sessao: "Entre para acessar esta área.",
  perfil: "Seu perfil não tem acesso à área administrativa.",
  permissao: "Seu perfil não tem a permissão necessária para esta ação.",
  invalido: "Perfil inválido.",
  modo: "Esta forma de entrada não está disponível.",
};

export const metadata: Metadata = {
  title: "Entrar — Assistente CAC",
  description:
    "Entre na sua conta do nosso sistema para acompanhar pedidos, documentos, pagamentos e status.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; erro?: string; email?: string }>;
}) {
  const { motivo, erro, email } = await searchParams;
  const aviso = erro ?? (motivo ? MOTIVOS[motivo] : undefined);
  const user = await getCurrentUser();
  const modoMock = isMockAuthForDisplay();

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Entrar na sua conta</h1>
        <p className="mt-2 text-sm text-neutral-600">
          É aqui que você acompanha seus pedidos, envia documentos, confere pagamentos e vê o
          status de cada etapa.
        </p>

        <Notice tone="info" className="mt-4">
          Esta conta é do <strong>nosso sistema</strong> — <strong>não é o Gov.br</strong>.{" "}
          <strong>Nunca pedimos sua senha, código ou token do Gov.br dentro deste site.</strong>{" "}
          Quando uma etapa exigir login no órgão, você faz isso na janela oficial.{" "}
          <Link href="/ajuda#gov-br" className="font-medium underline underline-offset-2">
            Entenda quando isso acontece
          </Link>
          .
        </Notice>

        {aviso ? (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {aviso}
          </p>
        ) : null}

        {user ? (
          <Card className="mt-4">
            <p className="text-sm text-neutral-600">
              Sessao ativa: <span className="font-medium text-neutral-900">{user.name}</span> (
              {ROLE_LABELS[user.role]})
            </p>
            <form action={signOutAction} className="mt-3">
              <Button type="submit" variant="secondary">
                Sair
              </Button>
            </form>
          </Card>
        ) : null}

        <Card className="mt-4">
          <p className="text-sm font-medium">Entrar com e-mail e senha</p>
          <form action={signInWithPasswordAction} className="mt-3 space-y-3">
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
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" className="w-full py-2.5 text-base">
              Entrar na minha conta
            </Button>
          </form>
        </Card>

        <Card className="mt-4 bg-neutral-50">
          <p className="text-sm font-medium text-neutral-900">Ainda não tem conta?</p>
          <p className="mt-1 text-sm text-neutral-600">
            Criar leva poucos minutos e você já passa a acompanhar tudo pelo painel.
          </p>
          <Link href="/cadastro" className="mt-3 inline-block w-full">
            <Button variant="secondary" className="w-full py-2.5 text-base">
              Criar minha conta
            </Button>
          </Link>
        </Card>

        {modoMock ? (
          <Card className="mt-4">
            <p className="text-sm font-medium">Perfis de demonstração</p>
            <p className="mt-1 text-xs text-neutral-500">
              Atalho de <strong>desenvolvimento</strong>, sem senha. Não existe em produção.
            </p>
            <div className="mt-3 space-y-2">
              {MOCK_USERS.map((mockUser) => (
                <form key={mockUser.id} action={signInMockAction}>
                  <input type="hidden" name="userId" value={mockUser.id} />
                  <Button type="submit" variant="secondary" className="w-full justify-between">
                    <span>{mockUser.name}</span>
                    <span className="text-neutral-500">{ROLE_LABELS[mockUser.role]}</span>
                  </Button>
                </form>
              ))}
            </div>
          </Card>
        ) : null}

        <p className="mt-6 text-center text-sm text-neutral-600">
          Com dúvida em alguma etapa?{" "}
          <Link href="/ajuda" className="font-medium text-neutral-900 underline underline-offset-2">
            Ver a central de ajuda
          </Link>
        </p>
      </div>
    </Container>
  );
}
