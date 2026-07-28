import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import {
  CONFIDENCE_LABELS,
  DOCUMENT_KIND_LABELS,
  REVIEW_SOURCE_BADGES,
  REVIEW_SOURCE_HELP,
  REVIEW_STATUS_HELP,
  REVIEW_STATUS_LABELS,
  aggregateReviewSource,
  sourceReadTheFile,
  type AggregateSource,
  type DocumentReview,
} from "@/server/documents";

/**
 * Painel de CONFERENCIA dos dados de cada documento.
 *
 * O que a tela diz sobre TER LIDO ou nao o arquivo do cliente acompanha a ORIGEM
 * de cada documento (`review.source`), nunca um texto fixo. Antes do #47C-3 esta
 * pagina afirmava "nao foram lidos do seu arquivo" em qualquer caso — verdade
 * enquanto so existia a engine mock, e mentira no dia em que um motor real
 * gravasse campos. As duas inversoes sao inaceitaveis: dizer que lemos quando e
 * demonstracao, e dizer que nao lemos quando lemos.
 *
 * Nada e gravado e nada e enviado — o botao de confirmar fica desabilitado
 * porque a persistencia da conferencia ainda nao existe (seria mentira
 * oferece-lo funcionando).
 */

/** Subtitulo do painel — so afirma algo global quando TODOS compartilham a origem. */
const PANEL_INTRO: Record<Exclude<AggregateSource, null>, string> = {
  MOCK_FALLBACK:
    "Os valores abaixo são exemplos de demonstração e não foram lidos do seu arquivo. Servem para mostrar como será a conferência.",
  PERSISTED_MOCK_ENGINE:
    "Os valores abaixo vêm de uma extração simulada (ambiente de desenvolvimento). Seu arquivo não foi lido por OCR ou IA.",
  PERSISTED_REAL_ENGINE:
    "Os valores abaixo foram lidos automaticamente do seu arquivo e precisam ser conferidos por uma pessoa antes de qualquer uso.",
  MISTA:
    "A origem dos valores varia por documento — veja o rótulo de cada um. Todos precisam ser conferidos por uma pessoa antes de qualquer uso.",
};

export function DocumentExtractionReviewPanel({
  reviews,
}: {
  reviews: readonly DocumentReview[];
}) {
  const aggregate = aggregateReviewSource(reviews);
  // A decisao de AFIRMAR leitura passa por `sourceReadTheFile`, nunca por
  // comparacao literal aqui. Com uma comparacao, uma origem nova (outro motor
  // real no #47D) cairia no `else` — que e o texto de demonstracao — e a tela
  // negaria uma leitura que aconteceu. A regra vive num lugar so.
  const leuOArquivo =
    aggregate !== null && aggregate !== "MISTA" && sourceReadTheFile(aggregate);

  return (
    <Card className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Conferência dos dados do documento</p>
        {aggregate && aggregate !== "MISTA" ? (
          <Badge>{REVIEW_SOURCE_BADGES[aggregate]}</Badge>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {aggregate
          ? PANEL_INTRO[aggregate]
          : "A conferência aparece aqui depois que você anexar um arquivo."}
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
                <div className="flex flex-none items-center gap-2">
                  <Badge>{REVIEW_SOURCE_BADGES[review.source]}</Badge>
                  <Badge>{REVIEW_STATUS_LABELS[review.status]}</Badge>
                </div>
              </div>
              {/* Origem e status sao coisas diferentes: uma diz de onde o dado
                  veio, a outra em que ponto da conferencia ele esta. */}
              <p className="mt-1 text-xs text-neutral-500">{REVIEW_SOURCE_HELP[review.source]}</p>
              <p className="text-xs text-neutral-500">{REVIEW_STATUS_HELP[review.status]}</p>

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
        {leuOArquivo ? (
          <>
            <strong>Os valores foram lidos automaticamente do seu arquivo.</strong> Eles{" "}
            <strong>precisam ser conferidos por uma pessoa</strong> antes de qualquer uso, e{" "}
            <strong>nada é enviado automaticamente</strong>.
          </>
        ) : aggregate === "MISTA" ? (
          <>
            <strong>A origem dos valores varia por documento.</strong> Veja o rótulo de cada um.
            Todos <strong>precisam ser conferidos por uma pessoa</strong> antes de qualquer uso, e{" "}
            <strong>nada é enviado automaticamente</strong>.
          </>
        ) : aggregate === "PERSISTED_MOCK_ENGINE" ? (
          <>
            <strong>Extração registrada em modo simulado.</strong> Nenhum arquivo foi lido: não há
            OCR nem IA. Os dados <strong>precisam ser conferidos por uma pessoa</strong> antes de
            qualquer uso, e <strong>nada é enviado automaticamente</strong>.
          </>
        ) : (
          <>
            <strong>Extração automática ainda é demonstração.</strong> Nenhum arquivo foi lido: não
            há OCR nem IA. Os dados <strong>precisam ser conferidos por uma pessoa</strong> antes de
            qualquer uso, e <strong>nada é enviado automaticamente</strong>.
          </>
        )}
      </Notice>
    </Card>
  );
}
