/**
 * Preview READ-ONLY da preparacao da Emissao de CRAF (admin).
 *
 * Consumidor do dominio inerte `getEmissaoCrafPreparation()`. Apenas APRESENTA
 * metadados (rotulos de requisito e de dados da autorizacao) — NUNCA valores nem
 * opcoes. NAO cria CRAF/processo, NAO tem form/input/select/action, NAO tem
 * botao/link de criar, NAO coleta dados, NAO executa automacao e NAO acessa
 * Gov.br/SINARM. A Emissao de CRAF segue `available:false`/`canCreate:false`.
 *
 * O PCE e apenas REFERENCIA/nota (reaproveitado da Autorizacao de Compra) — nao
 * remodela os campos de Arma de Fogo aqui.
 *
 * Modulo de UI puro: sem Prisma, sem I/O, sem rede, sem mutacao, sem PII real.
 */
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { formatBRL } from "@/server/processes/pricing";
import { getEmissaoCrafPreparation } from "@/server/processes/emissaoCrafPreparation";
import { type ProcessDocumentRequirement } from "@/server/processes/processDocumentRequirements";
import { type CrafFieldSpec } from "@/server/processes/emissaoCrafPreparation";

// Pilulas NEUTRAS (sem vermelho/ambar/verde) — nao imitam checklist oficial.
const REQUIRED_PILL =
  "inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800";
const OPTIONAL_PILL =
  "inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500";
// Chip NEUTRO de rotulo de campo — so o label, nunca valor/opcao/input.
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

/** Dados esperados da autorizacao — campos como CHIPS de rotulo (nao formulario). */
function AuthorizationDataBlock({ fields }: { fields: readonly CrafFieldSpec[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-neutral-700">Dados da autorização (etapa futura)</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {fields.map((f) => (
          <span key={f.key} className={FIELD_CHIP}>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EmissaoCrafPreparationPreview() {
  const prep = getEmissaoCrafPreparation();

  return (
    <Card className="mt-6 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-neutral-900">Emissão de CRAF — preparação</p>
        <Badge>Em preparação</Badge>
      </div>

      <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
        Prévia informativa. A Emissão de CRAF ainda não está disponível — nenhum registro pode ser
        aberto ou preenchido nesta etapa.
      </p>

      <p className="text-xs text-neutral-600">Taxa GRU prevista: {formatBRL(prep.gruFeeCents)}</p>

      <dl className="grid gap-1 text-xs text-neutral-600">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Dependência</dt>
          <dd className="text-right">Depende de Autorização de Compra deferida.</dd>
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
        Os dados da autorização são apenas estrutura futura de conferência. Este preview não lê,
        valida ou preenche dados reais.
      </p>

      <AuthorizationDataBlock fields={prep.authorizationData} />

      <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
        O PCE é reaproveitado da Autorização de Compra — não é recadastrado neste preview.
      </p>
      <p className="text-[11px] text-neutral-500">{prep.pceReference.note}</p>

      <Notice tone="neutral" className="mt-3">
        Prévia somente leitura — não cria CRAF, não coleta dados, não executa automação e não acessa
        Gov.br/SINARM.
      </Notice>
    </Card>
  );
}
