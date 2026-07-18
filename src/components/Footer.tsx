import Link from "next/link";
import { Container } from "@/components/ui/Container";

/**
 * Avisos obrigatorios em TODAS as telas (docs/24 §14).
 * Repetir aqui e proposital: o usuario forma expectativa em qualquer pagina,
 * nao so na landing.
 */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-neutral-200 py-6">
      <Container>
        <div className="space-y-2 text-xs text-neutral-500">
          <p>
            <strong className="text-neutral-700">Serviço privado de assistência.</strong> Não somos
            órgão público e não temos vínculo com Gov.br, Polícia Federal ou Exército.
          </p>
          <p>
            <strong className="text-neutral-700">Não garantimos aprovação</strong> — a análise e a
            decisão são do órgão competente. A execução é{" "}
            <strong className="text-neutral-700">assistida por um operador humano</strong>: o
            sistema não acessa Gov.br/SINARM automaticamente e o login é feito por você, na janela
            oficial.
          </p>
          <p>
            A <strong className="text-neutral-700">GRU é uma taxa do órgão competente</strong>,
            separada do nosso serviço.
          </p>
          <nav className="flex flex-wrap gap-3 pt-1">
            <Link href="/termos" className="underline-offset-2 hover:text-neutral-800 hover:underline">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="underline-offset-2 hover:text-neutral-800 hover:underline">
              Privacidade
            </Link>
            <Link href="/reembolso" className="underline-offset-2 hover:text-neutral-800 hover:underline">
              Reembolso
            </Link>
            <Link href="/consentimento" className="underline-offset-2 hover:text-neutral-800 hover:underline">
              Consentimento
            </Link>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
