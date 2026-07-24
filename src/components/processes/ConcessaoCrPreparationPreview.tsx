/**
 * Preview READ-ONLY da preparacao da Concessao de CR (admin).
 *
 * Primeiro consumidor do dominio inerte `getConcessaoCrPreparation()`. Apenas
 * APRESENTA a preparacao — NAO cria processo, NAO abre fluxo, NAO tem form/action,
 * NAO tem botao/link de criar, NAO executa automacao e NAO acessa Gov.br/SINARM.
 * A Concessao de CR segue `available:false`/`canCreate:false` (nada aqui libera).
 *
 * Modulo de UI puro: sem Prisma, sem I/O, sem rede, sem mutacao.
 */
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { formatBRL } from "@/server/processes/pricing";
import { getConcessaoCrPreparation } from "@/server/processes/concessaoCrPreparation";
import { type ProcessDocumentRequirement } from "@/server/processes/processDocumentRequirements";

// Pilulas NEUTRAS (sem vermelho/ambar/verde) — nao imitam o checklist oficial.
const REQUIRED_PILL =
  "inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800";
const OPTIONAL_PILL =
  "inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500";

function RequirementList({
  title,
  requirements,
}: {
  title: string;
  requirements: readonly ProcessDocumentRequirement[];
}) {
  if (requirements.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-neutral-700">
        {title} ({requirements.length})
      </p>
      <ul className="mt-1 space-y-1">
        {requirements.map((requirement) => (
          <li
            key={requirement.label}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span>{requirement.label}</span>
              <span className={requirement.required ? REQUIRED_PILL : OPTIONAL_PILL}>
                {requirement.required ? "Obrigatório" : "Opcional"}
              </span>
            </div>
            {requirement.note ? (
              <p className="mt-1 text-[11px] text-neutral-500">{requirement.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConcessaoCrPreparationPreview() {
  const prep = getConcessaoCrPreparation();

  return (
    <Card className="mt-6 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-neutral-900">Concessão de CR — preparação</p>
        <Badge>Em preparação</Badge>
      </div>

      <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
        Prévia informativa. A Concessão de CR ainda não está disponível para criação — nenhum
        processo de CR pode ser aberto nesta etapa.
      </p>

      <p className="text-xs text-neutral-600">Taxa GRU prevista: {formatBRL(prep.gruFeeCents)}</p>

      <dl className="grid gap-1 text-xs text-neutral-600">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Pré-requisito</dt>
          <dd className="text-right">Cadastro Inicial do solicitante</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Disponível para criação</dt>
          <dd>{prep.available ? "Sim" : "Não"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Pode ser criado agora</dt>
          <dd>{prep.canCreate ? "Sim" : "Não"}</dd>
        </div>
      </dl>

      <RequirementList
        title="Documentos do solicitante (etapa futura)"
        requirements={prep.applicantRequirements}
      />
      <RequirementList
        title="Documentos geráveis pelo sistema (etapa futura)"
        requirements={prep.systemGeneratedRequirements}
      />

      <Notice tone="neutral" className="mt-3">
        Prévia somente leitura — não cria processo, não executa automação e não acessa Gov.br/SINARM.
      </Notice>
    </Card>
  );
}
