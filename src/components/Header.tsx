import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { signOutAction } from "@/app/(public)/login/actions";
import { getCurrentUser } from "@/server/auth/guards";
import { isInternalRole, ROLE_LABELS } from "@/server/auth/roles";

const navLinkClass =
  "rounded-md px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-neutral-200">
      <Container>
        <nav className="flex h-14 items-center justify-between gap-2">
          <Link href="/" className="font-semibold">
            Assistente CAC
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/como-funciona" className={navLinkClass}>
              Como funciona
            </Link>

            {user && !isInternalRole(user.role) ? (
              <Link href="/dashboard" className={navLinkClass}>
                Painel
              </Link>
            ) : null}
            {user && isInternalRole(user.role) ? (
              <Link href="/admin" className={navLinkClass}>
                Admin
              </Link>
            ) : null}

            {user ? (
              <>
                {/* Identidade verbosa some no mobile para nao apertar a barra. */}
                <span className="hidden text-sm text-neutral-500 sm:inline">
                  {user.name} · {ROLE_LABELS[user.role]}
                </span>
                <form action={signOutAction}>
                  <button type="submit" className={navLinkClass}>
                    Sair
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Entrar
              </Link>
            )}
          </div>
        </nav>
      </Container>
    </header>
  );
}
