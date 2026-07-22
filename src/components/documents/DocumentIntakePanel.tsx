import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { DocumentExtractionReviewPanel } from "./DocumentExtractionReviewPanel";
import {
  DOCUMENT_STATE_LABELS,
  REQUIREMENT_TIER_LABELS,
  guiaTrafegoRequirements,
  resolveRequirementState,
  type DocumentKind,
  type DocumentState,
  type ReviewDocument,
} from "@/server/documents";

/** Cores por estado — pendente/aprovado/rejeitado precisam ser distinguiveis. */
const STATE_TONE: Record<DocumentState, string> = {
  PENDENTE: "border-neutral-200",
  ENVIADO: "border-sky-300 bg-sky-50/40",
  EM_ANALISE: "border-sky-300 bg-sky-50/40",
  APROVADO: "border-emerald-300 bg-emerald-50/40",
  REJEITADO: "border-red-300 bg-red-50/40",
  SUBSTITUIR: "border-neutral-200",
  DISPENSADO: "border-neutral-200",
};

/**
 * Painel de INTAKE de documentos (dev/demonstracao).
 * Cada documento esperado tem seu proprio anexar/substituir, enviando o TIPO
 * junto. NAO faz OCR/IA, NAO acessa Gov.br/SINARM, NAO envia nada para fora.
 */
export function DocumentIntakePanel({
  processId,
  documents,
  uploadAction,
  sentKind,
  error,
}: {
  processId: string;
  documents: readonly ReviewDocument[];
  uploadAction: (formData: FormData) => void | Promise<void>;
  /** Tipo confirmado no ultimo envio (querystring `?ok=`), para feedback no card. */
  sentKind?: DocumentKind;
  error?: string;
}) {
  const requirements = guiaTrafegoRequirements();

  return (
    <>
      <Card className="mt-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Documentos esperados</p>
          <Badge>Guia de Tráfego</Badge>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Visão geral do que pode ser pedido. Nem todos são obrigatórios — a equipe confere e
          orienta durante a análise.
        </p>

        {error ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        ) : null}

        <ul className="mt-3 space-y-2">
          {requirements.map((req) => {
            const { state, rejection, pending } = resolveRequirementState(req.kind, documents);
            return (
              <li key={req.kind} className={`rounded-md border px-3 py-2 ${STATE_TONE[state]}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-800">{req.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{req.help}</p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <span className="text-xs text-neutral-500">
                      {REQUIREMENT_TIER_LABELS[req.tier]}
                    </span>
                    <Badge>{DOCUMENT_STATE_LABELS[state]}</Badge>
                  </div>
                </div>
                {rejection ? (
                  <p className="mt-1 text-xs text-red-700">Motivo: {rejection}</p>
                ) : null}
                {sentKind === req.kind ? (
                  <p className="mt-2 text-xs text-emerald-800">
                    Arquivo recebido. Aguardando conferência da nossa equipe.
                  </p>
                ) : null}

                <form
                  action={uploadAction}
                  className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-200/70 pt-2"
                >
                  <input type="hidden" name="processId" value={processId} />
                  <input type="hidden" name="documentKind" value={req.kind} />
                  <input
                    type="file"
                    name="file"
                    accept="application/pdf,image/jpeg,image/png"
                    aria-label={`Arquivo fictício para ${req.title}`}
                    className="min-w-0 flex-1 text-xs text-neutral-600 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-neutral-50"
                  />
                  <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                    {pending ? "Anexar documento" : "Substituir"}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>

        {requirements.some((req) => req.kind === "COMPLEMENTAR") ? (
          <p className="mt-3 text-xs text-neutral-500">
            Documentos <strong>complementares</strong> são gravados com o tipo genérico
            &ldquo;Complementar / outro&rdquo;: se você anexar mais de um, o card mostra o estado do
            mais recente. Todos continuam visíveis na lista de arquivos enviados abaixo.
          </p>
        ) : null}

        <Notice tone="warning" className="mt-3">
          Anexo em <strong>ambiente de desenvolvimento/demonstração</strong>: não envie documentos
          reais. A conferência é feita por uma pessoa da equipe.
        </Notice>
      </Card>

      <DocumentExtractionReviewPanel documents={documents} />
    </>
  );
}
