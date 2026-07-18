import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/server/auth/guards";
import { MOCK_USERS } from "@/server/auth/mockUsers";
import { ROLE_LABELS } from "@/server/auth/roles";
import { signInMockAction, signOutAction } from "./actions";

const MOTIVOS: Record<string, string> = {
  sessao: "Entre para acessar esta área.",
  perfil: "Seu perfil não tem acesso à área administrativa.",
  permissao: "Seu perfil não tem a permissão necessária para esta ação.",
  invalido: "Perfil inválido.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const aviso = motivo ? MOTIVOS[motivo] : undefined;
  const user = await getCurrentUser();

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Escolha um perfil para navegar pela demonstração. O acesso com conta própria (e
          verificação em duas etapas para a equipe) entra antes do atendimento real.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Este login <strong>não é o Gov.br</strong>. Quando o processo exigir autenticação no
          órgão, você fará isso na <strong>janela oficial</strong> — e nunca vemos sua senha.
        </p>

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
          <p className="text-sm font-medium">Perfis de demonstração</p>
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
      </div>
    </Container>
  );
}
