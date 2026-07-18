import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { hasPermission, permissionsOf, requireAdminRole } from "@/server/auth/guards";
import { PERMISSIONS, PERMISSION_LABELS } from "@/server/auth/permissions";
import { ROLE_LABELS } from "@/server/auth/roles";

export default async function AdminPage() {
  // Qualquer perfil interno acessa a fila (docs/11 §3); as ACOES e que sao
  // filtradas por permissao.
  const user = await requireAdminRole();
  const granted = permissionsOf(user);

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Painel — Fila de processos</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        RBAC estrutural (Fase 2). Perfis e permissoes seguem docs/11 §2/§3. Sem dados reais, sem
        auth real, sem MFA.
      </p>

      <Card className="mt-4">
        <p className="text-sm text-neutral-600">
          Perfil interno: <span className="font-medium text-neutral-900">{ROLE_LABELS[user.role]}</span>{" "}
          · {user.name} · {user.email}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {granted.length} de {PERMISSIONS.length} permissoes concedidas.
        </p>

        <ul className="mt-4 space-y-1 text-sm">
          {PERMISSIONS.map((permission) => {
            const allowed = hasPermission(user, permission);
            return (
              <li key={permission} className="flex items-start gap-2">
                <span className={allowed ? "text-emerald-600" : "text-neutral-400"}>
                  {allowed ? "✓" : "✕"}
                </span>
                <span className={allowed ? "text-neutral-800" : "text-neutral-400 line-through"}>
                  {PERMISSION_LABELS[permission]}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="mt-6">
        <Link href="/admin/processos">
          <Button>Abrir fila de processos</Button>
        </Link>
      </div>
    </Container>
  );
}
