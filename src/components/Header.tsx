import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { signOutAction } from "@/app/(public)/login/actions";
import { getCurrentUser } from "@/server/auth/guards";
import { isInternalRole, ROLE_LABELS } from "@/server/auth/roles";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-neutral-200">
      <Container>
        <nav className="flex h-14 items-center justify-between">
          <Link href="/" className="font-semibold">
            Plataforma CAC
          </Link>
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            {user && !isInternalRole(user.role) ? (
              <Link href="/dashboard" className="hover:text-neutral-900">
                Painel
              </Link>
            ) : null}
            {user && isInternalRole(user.role) ? (
              <Link href="/admin" className="hover:text-neutral-900">
                Admin
              </Link>
            ) : null}
            {user ? (
              <>
                <span className="text-neutral-500">
                  {user.name} · {ROLE_LABELS[user.role]}
                </span>
                <form action={signOutAction}>
                  <button type="submit" className="hover:text-neutral-900">
                    Sair
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="hover:text-neutral-900">
                Entrar
              </Link>
            )}
          </div>
        </nav>
      </Container>
    </header>
  );
}
