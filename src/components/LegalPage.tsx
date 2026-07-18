import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";

/**
 * Moldura das paginas informativas (termos, privacidade, reembolso,
 * consentimento) — docs/24 §14/§16.
 *
 * IMPORTANTE: os textos sao **rascunhos operacionais**. Descrevem como o
 * servico funciona hoje, mas **nao substituem documento juridico** e precisam
 * de **revisao de advogado antes de producao** (docs/24 §17).
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <Container>
      <article className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{summary}</p>

        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Rascunho operacional — pendente de revisão jurídica.</strong> Este texto explica
          como o serviço funciona hoje, mas ainda <strong>não</strong> é o documento legal
          definitivo. Ele será revisado por advogado antes de qualquer atendimento real.
        </p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-neutral-700">{children}</div>

        <div className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <p>
            <strong>Serviço privado.</strong> Não somos órgão público e não temos vínculo com
            Gov.br, Polícia Federal ou Exército. <strong>Não garantimos aprovação</strong> — a
            análise e a decisão são do órgão competente.
          </p>
          <p className="mt-2 flex flex-wrap gap-3">
            <Link href="/termos" className="underline-offset-2 hover:underline">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="underline-offset-2 hover:underline">
              Privacidade
            </Link>
            <Link href="/reembolso" className="underline-offset-2 hover:underline">
              Reembolso
            </Link>
            <Link href="/consentimento" className="underline-offset-2 hover:underline">
              Consentimento
            </Link>
          </p>
        </div>
      </article>
    </Container>
  );
}

/** Bloco reutilizado: o que o app faz e o que ele nao faz (docs/24 §14). */
export function ComoFuncionaBlock() {
  return (
    <Card className="space-y-2 text-sm">
      <p className="font-medium text-neutral-900">Como o serviço funciona</p>
      <ul className="list-disc space-y-1 pl-5 text-neutral-700">
        <li>
          <strong>Somos uma plataforma privada</strong> de assistência. Não somos órgão oficial.
        </li>
        <li>
          <strong>Não garantimos aprovação.</strong> Quem analisa e decide é o órgão competente.
        </li>
        <li>
          A execução no sistema oficial é <strong>assistida por uma pessoa da nossa equipe</strong>.
        </li>
        <li>
          <strong>O sistema não acessa Gov.br nem o SINARM/CAC automaticamente.</strong> Quando é
          necessário, <strong>você</strong> faz o login na janela oficial — e{" "}
          <strong>nunca vemos sua senha</strong>.
        </li>
        <li>
          A <strong>GRU é uma taxa do órgão competente</strong>, separada do nosso serviço.
        </li>
      </ul>
    </Card>
  );
}
