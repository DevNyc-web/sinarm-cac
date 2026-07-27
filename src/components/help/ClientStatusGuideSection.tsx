import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  CLIENT_STATUS_GUIDE,
  CLIENT_STATUS_GUIDE_NOTE,
} from "@/server/support/clientStatusGuide";

/**
 * Glossario de status para o cliente (read-only).
 *
 * Apenas EXPLICACAO: nao le processo, nao consulta banco e nao reflete o enum
 * persistido — ver o cabecalho de `clientStatusGuide.ts`.
 */
export function ClientStatusGuideSection() {
  return (
    <section
      aria-labelledby="guia-de-status-titulo"
      className="scroll-mt-20 py-6"
      id="guia-de-status"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="guia-de-status-titulo" className="text-xl font-semibold">
          O que significa cada status
        </h2>
        <Badge>Guia informativo</Badge>
      </div>

      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{CLIENT_STATUS_GUIDE_NOTE}</p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {CLIENT_STATUS_GUIDE.map((status) => (
          <li key={status.code}>
            <Card className="h-full">
              <p className="font-medium text-neutral-900">{status.label}</p>
              <p className="mt-2 text-sm text-neutral-600">{status.description}</p>
              <p className="mt-2 text-xs text-neutral-500">
                <span className="font-medium text-neutral-600">O que você faz: </span>
                {status.whatYouDo}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
