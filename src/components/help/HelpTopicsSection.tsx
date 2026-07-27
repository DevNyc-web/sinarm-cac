import { Card } from "@/components/ui/Card";
import { HELP_TOPICS } from "@/server/support/helpTopics";

/**
 * Lista de topicos da central de ajuda (read-only).
 *
 * Cada topico ganha uma ancora estavel (`id`) para permitir link direto —
 * ex.: /ajuda#gov-br a partir do login/cadastro.
 */
export function HelpTopicsSection() {
  return (
    <section aria-labelledby="duvidas-frequentes" className="py-6">
      <h2 id="duvidas-frequentes" className="text-xl font-semibold">
        Dúvidas frequentes
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {HELP_TOPICS.map((topic) => (
          <div key={topic.id} id={topic.id} className="scroll-mt-20">
            <Card className="h-full">
              <h3 className="font-medium text-neutral-900">{topic.question}</h3>
              <p className="mt-2 text-sm text-neutral-600">{topic.summary}</p>

              {topic.steps ? (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
                  {topic.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}

              {topic.note ? (
                <p className="mt-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
                  {topic.note}
                </p>
              ) : null}
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}
