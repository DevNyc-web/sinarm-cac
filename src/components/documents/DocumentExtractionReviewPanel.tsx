import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import {
  CONFIDENCE_LABELS,
  DOCUMENT_KIND_LABELS,
  REVIEW_STATUS_HELP,
  REVIEW_STATUS_LABELS,
  buildExtractionReview,
  type ReviewDocument,
} from "@/server/documents";

/**
 * Painel de CONFERENCIA dos dados de cada documento (mock/dev).
 *
 * Os valores exibidos sao de DEMONSTRACAO e nao vieram do arquivo enviado: nao
 * ha OCR, nao ha IA, nao ha rede. Nada e gravado e nada e enviado — o botao de
 * confirmar fica desabilitado porque a persistencia da conferencia ainda nao
 * existe (seria mentira oferece-lo funcionando).
 */
export function DocumentExtractionReviewPanel({
  documents,
}: {
  documents: readonly ReviewDocument[];
}) {
  const reviews = buildExtractionReview(documents);

  return (
    <Card className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Conferência dos dados do documento</p>
        <Badge>demonstração</Badge>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Os valores abaixo são <strong>exemplos de demonstração</strong>, não foram lidos do seu
        arquivo. Servem para mostrar como será a conferência.
      </p>

      {reviews.length === 0 ? (
        <p className="mt-3 rounded-md border border-neutral-200 px-3 py-2 text-neutral-500">
          Nenhum documento anexado ainda. A conferência aparece aqui depois que você anexar um
          arquivo.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {reviews.map((review) => (
            <section
              key={review.documentId}
              className="rounded-md border border-neutral-200 px-3 py-2"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-800">
                    {DOCUMENT_KIND_LABELS[review.kind]}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {review.originalFileName}
                  </p>
                </div>
                <Badge>{REVIEW_STATUS_LABELS[review.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-500">{REVIEW_STATUS_HELP[review.status]}</p>

              <ul className="mt-2 space-y-1">
                {review.fields.map((field) => (
                  <li
                    key={field.key}
                    className="flex flex-col gap-1 rounded-md bg-neutral-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-500">{field.label}</p>
                      <p className="truncate text-neutral-800">{field.value}</p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <span className="text-xs text-neutral-500">
                        {CONFIDENCE_LABELS[field.confidence]}
                      </span>
                      <Badge>Pendente de conferência</Badge>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  aria-disabled="true"
                  className="inline-flex cursor-not-allowed items-center rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-400"
                >
                  Confirmar dados deste documento
                </span>
                <span className="text-xs text-neutral-500">
                  Indisponível: a persistência da conferência será criada em etapa futura.
                </span>
              </div>
            </section>
          ))}
        </div>
      )}

      <Notice tone="info" className="mt-3">
        <strong>Extração automática ainda é demonstração.</strong> Nenhum arquivo foi lido: não há
        OCR nem IA. Os dados <strong>precisam ser conferidos por uma pessoa</strong> antes de
        qualquer uso, e <strong>nada é enviado automaticamente</strong>.
      </Notice>
    </Card>
  );
}
