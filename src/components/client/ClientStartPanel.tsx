import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import {
  greetingFor,
  OFFICIAL_STEPS_NOTICE,
  ONBOARDING_STEPS,
  TRUST_NOTES,
  WELCOME_TITLE,
} from "@/server/support/clientOnboarding";

/**
 * Painel de entrada da area logada (read-only).
 *
 * Duas densidades, para nao empurrar a lista de pedidos de quem ja usa o
 * produto:
 *  - `variant="full"` — cliente sem pedido: boas-vindas + passos + ajuda;
 *  - `variant="compact"` — cliente com pedidos: so o aviso oficial e a ajuda.
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
    <section aria-labelledby="primeiros-passos" className="mt-6">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {WELCOME_TITLE}
        </p>
        <p className="mt-1 text-lg font-semibold">{greetingFor(name)}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Sua conta é do nosso sistema e reúne tudo em um lugar só: pedidos, documentos,
          pagamentos e o status de cada etapa.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-neutral-500">
          {TRUST_NOTES.map((note) => (
            <li key={note} className="flex gap-2">
              <span aria-hidden>·</span>
              {note}
            </li>
          ))}
        </ul>
      </Card>

      <h2 id="primeiros-passos" className="mt-6 text-xl font-semibold">
        Primeiros passos
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {ONBOARDING_STEPS.map((step) => (
          <li key={step.id}>
            <Card className="flex h-full flex-col">
              <p className="font-medium text-neutral-900">{step.title}</p>
              <p className="mt-2 flex-1 text-sm text-neutral-600">{step.body}</p>
              {step.href && step.action ? (
                <p className="mt-3">
                  <Link
                    href={step.href}
                    className="text-sm font-medium text-neutral-900 underline underline-offset-2"
                  >
                    {step.action} <span aria-hidden>→</span>
                  </Link>
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-3">
        <Notice tone="neutral">{OFFICIAL_STEPS_NOTICE}</Notice>
        <HelpCard />
      </div>
    </section>
  );
}

/** Card de ajuda — o mesmo nas duas densidades. */
function HelpCard() {
  return (
    <Card className="bg-neutral-50">
      <p className="font-medium text-neutral-900">Precisa de ajuda?</p>
      <p className="mt-1 text-sm text-neutral-600">
        A central de ajuda explica cada etapa em linguagem simples, e você pode falar com uma
        pessoa da nossa equipe quando precisar.
      </p>
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
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
