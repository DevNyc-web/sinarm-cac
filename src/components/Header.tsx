import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function Header() {
  return (
    <header className="border-b border-neutral-200">
      <Container>
        <nav className="flex h-14 items-center justify-between">
          <Link href="/" className="font-semibold">
            Plataforma CAC
          </Link>
          <div className="flex gap-4 text-sm text-neutral-600">
            <Link href="/dashboard" className="hover:text-neutral-900">
              Painel
            </Link>
            <Link href="/admin" className="hover:text-neutral-900">
              Admin
            </Link>
            <Link href="/login" className="hover:text-neutral-900">
              Entrar
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}
