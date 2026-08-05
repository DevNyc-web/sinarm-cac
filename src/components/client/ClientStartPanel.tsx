import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import {
  greetingFor,
  OFFICIAL_STEPS_NOTICE,
  ONBOARDING_STEPS,
  TRUST_NOTES,
  WELCOME_TITLE,
} from "@/server/support/clientOnboarding";
import {
  CLIENT_START_HINT,
  CLIENT_START_QUESTION,
  clientProcessChoices,
} from "@/server/support/clientProcessChoices";

/**
 * Painel de entrada da area logada (read-only).
 *
 * Duas densidades, para nao empurrar a lista de pedidos de quem ja usa o
 * produto:
 *  - `variant="full"` — cliente SEM pedido: a pergunta "Qual processo voce
 *    deseja realizar?" e a escolha de processo (docs/63 §3);
 *  - `variant="compact"` — cliente com pedidos: so o aviso oficial e a ajuda.
 *
 * A variante `full` traz o `<h1>` da pagina: para quem esta comecando, o titulo
 * da tela E a pergunta — por isso o dashboard nao renderiza "Meus processos"
 * nesse ramo (docs/63 §8.1.1). Continua um `<h1>` por pagina.
 *
 * Nao consulta banco, nao altera status e nao executa nada. Recebe o nome ja
 * resolvido pela pagina.
 */
export function ClientStartPanel({
  name,
  variant = "full",
}: {
  name: string;
  variant?: "full" | "compact";
}) {
  if (variant === "compact") {
    return (
      <section aria-labelledby="apoio-do-atendimento" className="mt-6 space-y-3">
        <h2 id="apoio-do-atendimento" className="sr-only">
          Apoio do atendimento
        </h2>
        <Notice tone="neutral">{OFFICIAL_STEPS_NOTICE}</Notice>
        <HelpCard />
      </section>
    );
  }

  return (
    <section aria-labelledby="escolha-de-processo">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {WELCOME_TITLE}
      </p>
      <p className="mt-1 text-sm text-neutral-600">{greetingFor(name)}</p>
      <h1 id="escolha-de-processo" className="mt-2 text-2xl font-semibold">
        {CLIENT_START_QUESTION}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">{CLIENT_START_HINT}</p>

      {/*
        CTA so existe onde ha rota: `href`/`cta` vem nulos para quem esta em
        preparacao (ver `clientProcessChoices`), entao nao ha como renderizar
        botao que nao leva a lugar nenhum (docs/63 §6.2).
      */}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {clientProcessChoices().map((choice) => (
          <li key={choice.code}>
            <Card
              className={`flex h-full flex-col ${
                choice.available ? "border-emerald-300" : "opacity-90"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-neutral-900">{choice.label}</p>
                {choice.statusLabel ? <Badge>{choice.statusLabel}</Badge> : null}
              </div>
              <p className="mt-2 flex-1 text-sm text-neutral-600">{choice.blurb}</p>
              {choice.href && choice.cta ? (
                <p className="mt-3">
                  <Link
                    href={choice.href}
                    className="text-sm font-medium text-neutral-900 underline underline-offset-2"
                  >
                    {choice.cta} <span aria-hidden>→</span>
                  </Link>
                </p>
              ) : (
                <p className="mt-3 text-xs text-neutral-500">{choice.note}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {/*
        Só os titulos dos passos: a jornada completa e a pagina de ajuda, e a
        tela de escolha nao pode virar leitura (docs/63 §4.9).
      */}
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Como funciona
      </h2>
      <ol className="mt-2 grid gap-1 text-sm text-neutral-600 sm:grid-cols-2">
        {ONBOARDING_STEPS.map((step) => (
          <li key={step.id}>{step.title}</li>
        ))}
      </ol>

      {/* Microcopy de confianca: e a defesa do cliente contra golpe em nosso nome. */}
      <ul className="mt-4 space-y-1 text-xs text-neutral-500">
        {TRUST_NOTES.map((note) => (
          <li key={note} className="flex gap-2">
            <span aria-hidden>·</span>
            {note}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-3">
        <Notice tone="neutral">{OFFICIAL_STEPS_NOTICE}</Notice>
        <HelpCard />
      </div>
    </section>
  );
}

/**
 * Card de ajuda — o mesmo nas duas densidades.
 *
 * Video primeiro (docs/63 §7.2): quem esta comecando assiste antes de ler. O
 * link de suporte fica por ultimo de proposito — ajuda nao e fila de
 * atendimento, e o humano continua sendo excecao (`docs/60 §10.3`).
 */
function HelpCard() {
  return (
    <Card className="bg-neutral-50">
      <p className="font-medium text-neutral-900">Precisa de ajuda?</p>
      <p className="mt-1 text-sm text-neutral-600">
        Vídeos curtos explicam cada etapa. Se preferir ler, a central de ajuda tem o mesmo
        conteúdo.
      </p>
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link
          href="/ajuda#videos"
          className="font-medium text-neutral-900 underline underline-offset-2"
        >
          Ver vídeos
        </Link>
        <Link
          href="/ajuda"
          className="font-medium text-neutral-900 underline underline-offset-2"
        >
          Central de ajuda
        </Link>
        <Link
          href="/ajuda#suporte"
          className="font-medium text-neutral-900 underline underline-offset-2"
        >
          Falar com suporte
        </Link>
      </p>
    </Card>
  );
}
