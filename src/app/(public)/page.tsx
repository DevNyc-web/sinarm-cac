import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <Container>
      <section className="max-w-2xl">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Serviço privado · sem vínculo com órgão público
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Assistência para sua Guia de Tráfego</h1>
        <p className="mt-4 text-neutral-600">
          Ajudamos você a preparar, conferir e acompanhar o processo de Guia de Tráfego.{" "}
          <strong>Não somos órgão público e não garantimos aprovação</strong> — quem analisa e
          decide é o órgão competente.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-neutral-600">
          <li>
            · A execução é <strong>assistida por uma pessoa da nossa equipe</strong> — o sistema não
            acessa Gov.br/SINARM automaticamente.
          </li>
          <li>
            · Quando for preciso autenticar, <strong>você</strong> faz o login na janela oficial.{" "}
            <strong>Nunca vemos sua senha.</strong>
          </li>
          <li>
            · O valor do serviço já inclui a <strong>GRU, que é taxa do órgão</strong> — e não uma
            cobrança nossa.
          </li>
        </ul>

        <div className="mt-6 flex gap-3">
          <Link href="/login">
            <Button>Começar</Button>
          </Link>
          <Link href="/termos">
            <Button variant="secondary">Como funciona</Button>
          </Link>
        </div>
      </section>
    </Container>
  );
}
