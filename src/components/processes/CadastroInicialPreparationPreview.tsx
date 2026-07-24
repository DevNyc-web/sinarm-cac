/**
 * Preview READ-ONLY da preparacao do Cadastro Inicial (admin).
 *
 * Primeiro consumidor do dominio inerte `getCadastroInicialPreparation()`. Apenas
 * APRESENTA os grupos/campos previstos como METADADO (label + fonte esperada) —
 * NUNCA valores. NAO coleta dados, NAO cria cadastro/processo, NAO tem form/input/
 * action, NAO tem botao/link de criar, NAO executa automacao e NAO acessa Gov.br/
 * SINARM. A foto no Gov.br e so pre-condicao: nenhuma credencial e lida/armazenada.
 *
 * Modulo de UI puro: sem Prisma, sem I/O, sem rede, sem mutacao, sem PII real.
 */
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import {
  getCadastroInicialPreparation,
  type CadastroInicialFieldSource,
  type CadastroInicialGroup,
} from "@/server/processes/cadastroInicialPreparation";

// Pilulas NEUTRAS (sem vermelho/ambar/verde) — nao imitam checklist oficial.
const REQUIRED_PILL =
  "inline-flex rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-800";
const OPTIONAL_PILL =
  "inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500";

/** Rotulo amigavel da fonte esperada de cada campo (nunca um valor). */
const SOURCE_LABELS: Record<CadastroInicialFieldSource, string> = {
  PRECONDICAO_GOVBR: "pré-condição Gov.br",
  DOCUMENTO_IDENTIDADE: "lido do documento de identidade",
  COMPROVANTE_RESIDENCIA: "lido do comprovante de residência",
  INFORMADO_PELO_SOLICITANTE: "informado pelo solicitante",
  CONSULTA_FUTURA: "consulta futura",
};

function GroupBlock({ group }: { group: CadastroInicialGroup }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-neutral-700">
        {group.title}
        {group.optional ? " (opcional)" : ""}
      </p>
      <ul className="mt-1 space-y-1">
        {group.fields.map((f) => (
          <li
            key={`${group.key}-${f.key}`}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span>{f.label}</span>
              <span className={f.required ? REQUIRED_PILL : OPTIONAL_PILL}>
                {f.required ? "Obrigatório" : "Opcional"}
              </span>
              <span className="text-[11px] text-neutral-500">{SOURCE_LABELS[f.source]}</span>
            </div>
            {f.note ? <p className="mt-1 text-[11px] text-neutral-500">{f.note}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CadastroInicialPreparationPreview() {
  const prep = getCadastroInicialPreparation();

  return (
    <Card className="mt-6 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-neutral-900">Cadastro Inicial — preparação</p>
        <Badge>Em preparação</Badge>
      </div>

      <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
        Prévia informativa. O Cadastro Inicial ainda não está disponível — nenhum cadastro pode ser
        aberto ou preenchido nesta etapa.
      </p>

      <dl className="grid gap-1 text-xs text-neutral-600">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Disponível</dt>
          <dd>{prep.available ? "Sim" : "Não"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Pode ser criado agora</dt>
          <dd>{prep.canCreate ? "Sim" : "Não"}</dd>
        </div>
      </dl>

      {prep.groups.map((group) => (
        <GroupBlock key={group.key} group={group} />
      ))}

      <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
        A foto no Gov.br é apenas pré-condição — nenhuma credencial é lida ou armazenada.
      </p>

      <Notice tone="neutral" className="mt-1">
        Prévia somente leitura — não coleta dados, não cria cadastro, não executa automação e não
        acessa Gov.br/SINARM.
      </Notice>
    </Card>
  );
}
