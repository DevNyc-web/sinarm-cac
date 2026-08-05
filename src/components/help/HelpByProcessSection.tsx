import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { clientProcessChoices } from "@/server/support/clientProcessChoices";

/**
 * Ajuda por PROCESSO (read-only) — conecta a central de ajuda ao que o cliente
 * veio fazer (docs/61 §4.E, item E.4).
 *
 * Le as MESMAS opcoes da tela de entrada (`clientProcessChoices`), entao ajuda e
 * produto nao podem divergir: processo liberado ou em preparacao muda nos dois
 * lugares de uma vez, sem lista propria aqui.
 *
 * CTA falso continua impossivel: `href`/`cta` so existem para processo criavel
 * hoje (docs/63 §6.2). Em preparacao aparece com selo, sem link.
 *
 * Nao consulta banco, nao executa nada e nao acessa Gov.br/SINARM/PF.
 */
export function HelpByProcessSection() {
  return (
    <section aria-labelledby="ajuda-por-processo" className="scroll-mt-20 py-6" id="processos">
      <h2 id="ajuda-por-processo" className="text-xl font-semibold">
        Ajuda por processo
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        O que dá para fazer pelo sistema hoje, e o que ainda estamos preparando.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {clientProcessChoices().map((choice) => (
          <li key={choice.code}>
            <Card className="flex h-full flex-col text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-neutral-900">{choice.label}</p>
                {choice.statusLabel ? <Badge>{choice.statusLabel}</Badge> : null}
              </div>
              <p className="mt-2 flex-1 text-neutral-600">{choice.blurb}</p>
              {choice.href && choice.cta ? (
                <p className="mt-3">
                  <Link
                    href={choice.href}
                    className="font-medium text-neutral-900 underline underline-offset-2"
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
    </section>
  );
}
