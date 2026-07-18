import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/server/auth/guards";
import { MOCK_USERS } from "@/server/auth/mockUsers";
import { ROLE_LABELS } from "@/server/auth/roles";
import { signInMockAction, signOutAction } from "./actions";

const MOTIVOS: Record<string, string> = {
  sessao: "Entre com um perfil ficticio para acessar esta area.",
  perfil: "Seu perfil ficticio nao tem acesso a area administrativa.",
  permissao: "Seu perfil ficticio nao tem a permissao necessaria.",
  invalido: "Perfil mock/dev invalido.",
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <Badge>mock/dev</Badge>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Autenticacao de desenvolvimento (Fase 2). Escolha um perfil ficticio. Sem senha, sem MFA,
          sem provedor real e sem dados reais — o provedor definitivo entra antes de producao.
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
          <p className="text-sm font-medium">Perfis ficticios</p>
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
