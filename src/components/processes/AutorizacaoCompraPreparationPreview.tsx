/**
 * Preview READ-ONLY da preparacao da Autorizacao de Compra (admin).
 *
 * Consumidor do dominio inerte `getAutorizacaoCompraPreparation()`. Apenas
 * APRESENTA metadados (rotulos de requisito e de campos de PCE) — NUNCA valores
 * nem opcoes. NAO cria autorizacao/processo, NAO tem form/input/select/action,
 * NAO tem botao/link de criar, NAO coleta dados, NAO executa automacao e NAO
 * acessa Gov.br/SINARM. A Autorizacao segue `available:false`/`canCreate:false`.
 *
 * Os 5 requisitos vem REUSADOS do dominio (etapa futura). Os 12 detalhados sao
 * decisao futura (PR separado) — nao expandidos aqui.
 *
 * Modulo de UI puro: sem Prisma, sem I/O, sem rede, sem mutacao, sem PII real.
 */
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { formatBRL } from "@/server/processes/pricing";
import { getAutorizacaoCompraPreparation } from "@/server/processes/autorizacaoCompraPreparation";
import { type ProcessDocumentRequirement } from "@/server/processes/processDocumentRequirements";
import { type PcePathSpec } from "@/server/processes/autorizacaoCompraPreparation";

// Pilulas NEUTRAS (sem vermelho/ambar/verde) — nao imitam checklist oficial.
const REQUIRED_PILL =
  "inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800";
const OPTIONAL_PILL =
  "inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500";
// Chip NEUTRO de rotulo de campo de PCE — so o label, nunca valor/opcao/input.
const FIELD_CHIP =
  "inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600";

/** Lista dos 5 requisitos atuais (etapa futura) — so label + obrigatorio/opcional. */
function RequirementList({
  requirements,
}: {
  requirements: readonly ProcessDocumentRequirement[];
}) {
  if (requirements.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-neutral-700">
        Requisitos (etapa futura) ({requirements.length})
      </p>
      <ul className="mt-1 space-y-1">
        {requirements.map((requirement) => (
          <li
            key={requirement.label}
            className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
          >
            <span>{requirement.label}</span>
            <span className={requirement.required ? REQUIRED_PILL : OPTIONAL_PILL}>
              {requirement.required ? "Obrigatório" : "Opcional"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bloco de um caminho de PCE — campos como CHIPS de rotulo (nao formulario). */
function PceBlock({ path }: { path: PcePathSpec }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-neutral-700">
        {path.title} ({path.fields.length} campos)
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {path.fields.map((f) => (
          <span key={f.key} className={FIELD_CHIP}>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AutorizacaoCompraPreparationPreview() {
  const prep = getAutorizacaoCompraPreparation();

  return (
    <Card className="mt-6 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-neutral-900">Autorização de Compra — preparação</p>
        <Badge>Em preparação</Badge>
      </div>

      <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
        Prévia informativa. A Autorização de Compra ainda não está disponível — nenhuma solicitação
        pode ser aberta ou preenchida nesta etapa.
      </p>

      <p className="text-xs text-neutral-600">Taxa GRU prevista: {formatBRL(prep.gruFeeCents)}</p>

      <dl className="grid gap-1 text-xs text-neutral-600">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Dependência</dt>
          <dd className="text-right">Depende de Concessão de CR deferida.</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Serviço</dt>
          <dd className="text-right">{prep.service.service}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Atividade padrão</dt>
          <dd className="text-right">{prep.service.defaultActivity}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Tipo de PCE padrão</dt>
          <dd className="text-right">{prep.service.defaultPceType}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Disponível</dt>
          <dd>{prep.available ? "Sim" : "Não"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Pode ser criado agora</dt>
          <dd>{prep.canCreate ? "Sim" : "Não"}</dd>
        </div>
      </dl>

      <RequirementList requirements={prep.requirements} />

      <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
        Os dados de PCE abaixo são apenas estrutura futura de conferência. Este preview não coleta
        dados, não valida contrato e não lista opções oficiais.
      </p>

      {prep.pcePreparation.map((path) => (
        <PceBlock key={path.key} path={path} />
      ))}

      <Notice tone="neutral" className="mt-3">
        Prévia somente leitura — não cria autorização, não coleta dados, não executa automação e não
        acessa Gov.br/SINARM.
      </Notice>
    </Card>
  );
}
