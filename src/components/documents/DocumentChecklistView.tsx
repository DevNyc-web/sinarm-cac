import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import {
  DOCUMENT_STATE_LABELS,
  PERSISTED_DOCUMENT_STATES,
  REQUIREMENT_TIER_LABELS,
  guiaTrafegoRequirements,
} from "@/server/documents";
import {
  CHECKLIST_INTRO,
  CHECKLIST_SECURITY_NOTES,
  CHECKLIST_STATE_LEGEND_INTRO,
  CHECKLIST_TITLE,
  CHECKLIST_UPLOAD_NOTICE,
} from "@/server/support/documentChecklistNotices";

/**
 * Checklist da Guia de Trafego — visao SOMENTE LEITURA.
 *
 * Existe para o cliente ver o que sera pedido ANTES de abrir um pedido: o
 * `DocumentIntakePanel` so aparece dentro de `/processos/[id]`, ou seja, exige
 * um pedido ja criado. Aqui nao ha formulario, anexo nem acao — a lista vem de
 * `guiaTrafegoRequirements()` e os rotulos de estado de `documentStatus`, sem
 * fonte paralela.
 *
 * NAO faz upload, NAO toca storage, NAO le banco, NAO acessa Gov.br/SINARM.
 */
export function DocumentChecklistView() {
  const requirements = guiaTrafegoRequirements();

  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium">{CHECKLIST_TITLE}</h2>
          <Badge>Guia de Tráfego</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{CHECKLIST_INTRO}</p>

        <ul className="mt-4 space-y-2">
          {requirements.map((req) => (
            <li key={req.kind} className="rounded-md border border-neutral-200 px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-800">{req.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{req.help}</p>
                </div>
                <span className="flex-none text-xs text-neutral-500">
                  {REQUIREMENT_TIER_LABELS[req.tier]}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <Notice tone="info" className="mt-4">
          {CHECKLIST_UPLOAD_NOTICE}{" "}
          <Link href="/processos/novo" className="font-medium underline">
            Abrir um pedido
          </Link>
        </Notice>
      </Card>

      <Card className="mt-4">
        <p className="text-sm font-medium">Estados do documento</p>
        <p className="mt-1 text-xs text-neutral-500">{CHECKLIST_STATE_LEGEND_INTRO}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PERSISTED_DOCUMENT_STATES.map((state) => (
            <li key={state}>
              <Badge>{DOCUMENT_STATE_LABELS[state]}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Notice tone="warning" className="mt-4" title="Segurança">
        <ul className="list-disc space-y-1 pl-4">
          {CHECKLIST_SECURITY_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Notice>

      <p className="mt-4 text-xs text-neutral-500">
        Dúvidas sobre o que enviar?{" "}
        <Link href="/ajuda" className="font-medium underline">
          Central de ajuda
        </Link>
      </p>
    </>
  );
}
