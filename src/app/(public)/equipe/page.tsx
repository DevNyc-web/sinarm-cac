import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { getCurrentUser } from "@/server/auth/guards";
import { isMockAuthForDisplay } from "@/server/auth/config";
import { MOCK_USERS } from "@/server/auth/mockUsers";
import { isInternalRole, ROLE_LABELS } from "@/server/auth/roles";
import { signInMockAction, signInWithPasswordAction, signOutAction } from "../login/actions";

/**
 * Entrada da EQUIPE INTERNA (docs/61 §4.D, docs/64 §6.1).
 *
 * Existe para separar a EXPERIENCIA de entrada, nao o mecanismo: reusa a mesma
 * Server Action de `/login` (`signInWithPasswordAction`), a mesma sessao e a
 * mesma politica de `authenticate.ts`. Duplicar o caminho de auth criaria dois
 * lugares para corrigir a mesma falha.
 *
 * O QUE ESTA PAGINA **NAO** FAZ: nao concede acesso. Quem entra por aqui com
 * perfil de cliente cai em `/dashboard` como sempre (`destinationFor`), e
 * `/admin` continua barrado por `requireAdminRole`. A separacao e de UX; a
 * autorizacao segue server-side (docs/68 §3.1).
 *
 * Sem cadastro: conta interna nao se cria sozinha (docs/64 §6.3, RBAC interno).
 */
export const metadata: Metadata = {
  title: "Acesso da equipe — Assistente CAC",
  description: "Entrada da equipe interna.",
  // Porta de servico: nao deve ser indexada nem sugerida a cliente.
  robots: { index: false, follow: false },
};

const MOTIVOS: Record<string, string> = {
  sessao: "Entre para acessar esta área.",
  perfil: "Seu perfil não tem acesso à área administrativa.",
  permissao: "Seu perfil não tem a permissão necessária para esta ação.",
  invalido: "Perfil inválido.",
  modo: "Esta forma de entrada não está disponível.",
};

/** Perfis internos do atalho de desenvolvimento — o cliente fica em `/login`. */
const INTERNAL_MOCK_USERS = MOCK_USERS.filter((mockUser) => isInternalRole(mockUser.role));

export default async function EquipeLoginPage({
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
        <h1 className="text-2xl font-semibold">Acesso da equipe</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Entrada da equipe interna. O que você vê depois de entrar depende das permissões do
          seu perfil.
        </p>

        <Notice tone="neutral" className="mt-4">
          Contas internas são criadas pela administração — <strong>não há cadastro aqui</strong>.
        </Notice>

        {aviso ? (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {aviso}
          </p>
        ) : null}

        {user ? (
          <Card className="mt-4">
            <p className="text-sm text-neutral-600">
              Sessão ativa: <span className="font-medium text-neutral-900">{user.name}</span> (
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
            {/* Devolve o erro nesta tela, nao na do cliente (allowlist na action). */}
            <input type="hidden" name="origem" value="equipe" />
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
              Entrar
            </Button>
          </form>
        </Card>

        {modoMock ? (
          <Card className="mt-4">
            <p className="text-sm font-medium">Perfis internos de demonstração</p>
            <p className="mt-1 text-xs text-neutral-500">
              Atalho de <strong>desenvolvimento</strong>, sem senha. Não existe em produção.
            </p>
            <div className="mt-3 space-y-2">
              {INTERNAL_MOCK_USERS.map((mockUser) => (
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

        <p className="mt-6 text-center text-sm text-neutral-500">
          Você é cliente?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline underline-offset-2">
            Entrar na sua conta
          </Link>
        </p>
      </div>
    </Container>
  );
}
