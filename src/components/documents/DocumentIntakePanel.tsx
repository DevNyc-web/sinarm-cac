import type { DocumentStatus as PrismaDocumentStatus, DocumentType as PrismaDocumentType } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import {
  DOCUMENT_STATE_LABELS,
  REQUIREMENT_TIER_LABELS,
  demoExtractionExample,
  fromPrismaDocumentStatus,
  guiaTrafegoRequirements,
  toPrismaDocumentType,
  type DocumentKind,
} from "@/server/documents";

type DocInput = {
  type: PrismaDocumentType;
  status: PrismaDocumentStatus;
  rejectionReason: string | null;
};

/** Estado derivado de um requisito: PENDENTE se nao ha documento correspondente. */
function statusForKind(kind: DocumentKind, documents: readonly DocInput[]) {
  const prismaType = toPrismaDocumentType(kind);
  // So a identificacao tem tipo persistivel proprio; "OUTRO" e ambiguo, entao
  // nao atribuimos um doc OUTRO a um requisito especifico (fundacao honesta).
  const match =
    kind === "IDENTIFICACAO_PESSOAL"
      ? documents.find((doc) => doc.type === prismaType)
      : undefined;
  if (!match) return { label: DOCUMENT_STATE_LABELS.PENDENTE, rejection: null as string | null };
  return {
    label: DOCUMENT_STATE_LABELS[fromPrismaDocumentStatus(match.status)],
    rejection: match.status === "REJEITADO" ? match.rejectionReason : null,
  };
}

/**
 * Painel de INTAKE de documentos (fundacao — dev/demonstracao).
 * Mostra os documentos esperados com status e a conferencia de extracao futura.
 * NAO envia arquivo, NAO faz OCR/IA, NAO acessa Gov.br/SINARM. O envio real
 * (dev/ficticio) continua no card de "Documento de identificacao" abaixo.
 */
export function DocumentIntakePanel({ documents }: { documents: readonly DocInput[] }) {
  const requirements = guiaTrafegoRequirements();
  const extraction = demoExtractionExample();

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

        <ul className="mt-3 space-y-2">
          {requirements.map((req) => {
            const { label, rejection } = statusForKind(req.kind, documents);
            return (
              <li key={req.kind} className="rounded-md border border-neutral-200 px-3 py-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-800">{req.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{req.help}</p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <span className="text-xs text-neutral-500">
                      {REQUIREMENT_TIER_LABELS[req.tier]}
                    </span>
                    <Badge>{label}</Badge>
                  </div>
                </div>
                {rejection ? (
                  <p className="mt-1 text-xs text-red-700">Motivo: {rejection}</p>
                ) : null}
                <p className="mt-2 text-xs text-neutral-400">
                  Anexar / substituir — use o envio de demonstração abaixo.
                </p>
              </li>
            );
          })}
        </ul>

        <Notice tone="warning" className="mt-3">
          Anexo em <strong>ambiente de desenvolvimento/demonstração</strong>: não envie documentos
          reais. A conferência é feita por uma pessoa da equipe.
        </Notice>
      </Card>

      <Card className="mt-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Dados identificados automaticamente</p>
          <Badge>demonstração</Badge>
        </div>

        <ul className="mt-3 space-y-2">
          {extraction.fields.map((field) => (
            <li
              key={field.key}
              className="flex flex-col gap-1 rounded-md border border-neutral-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">{field.label}</p>
                <p className="truncate text-neutral-800">{field.value ?? "—"}</p>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className="text-xs text-neutral-500">
                  {field.confidence !== null ? `${Math.round(field.confidence * 100)}% ` : ""}
                  confiança
                </span>
                <Badge>Pendente de conferência</Badge>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex cursor-not-allowed items-center rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-400">
            Confirmar dados (indisponível na demonstração)
          </span>
        </div>

        <Notice tone="info" className="mt-3">
          <strong>Extração automática ainda não habilitada.</strong> Os dados devem ser conferidos
          antes de qualquer uso, e <strong>nada é enviado automaticamente</strong>.
        </Notice>
      </Card>
    </>
  );
}
