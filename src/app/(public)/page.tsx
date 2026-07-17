import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <Container>
      <section className="max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Servico privado · marca neutra
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Assistencia para sua Guia de Trafego</h1>
        <p className="mt-4 text-neutral-600">
          Ajudamos voce a preparar e acompanhar o processo de Guia de Trafego no SINARM/CAC. Nao
          somos orgao publico e nao prometemos aprovacao.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/processos/novo">
            <Button>Comecar</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Entrar</Button>
          </Link>
        </div>
        <p className="mt-8 text-xs text-neutral-400">Esqueleto — Fase 1. Sem dados reais.</p>
      </section>
    </Container>
  );
}
