import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requireAdminRole } from "@/server/auth/guards";
import { formatBRL } from "@/server/processes/pricing";
import {
  UF_VARIATION_NOTE,
  getProcessDefinition,
  listProcessesInLogicalOrder,
} from "@/server/processes/processCatalog";

/**
 * "Processos do lancamento" — visao informativa (read-only) do catalogo de
 * produto. Nao executa nada, nao acessa Gov.br/SINARM, nao cria processo: so
 * apresenta os 4 tipos, taxas, dependencia e requisitos documentais.
 */
export default async function ProcessosLancamentoPage() {
  const admin = await requireAdminRole();
  const processes = listProcessesInLogicalOrder();

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Processos do lançamento</h1>
        <Badge>catálogo</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Referência de produto (dev). Ordem lógica de dependência do cliente. Nada é executado aqui —
        sem acesso ao Gov.br/SINARM, sem automação.
      </p>

      <div className="mt-6 space-y-4">
        {processes.map((process, index) => {
          const deps = process.dependsOn.map((code) => getProcessDefinition(code)?.name ?? code);
          return (
            <Card key={process.code} className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {index + 1}. {process.name}
                </p>
                <div className="flex items-center gap-2">
                  <Badge>GRU {formatBRL(process.gruFeeCents)}</Badge>
                  {process.requiresInitialRegistration ? <Badge>cadastro inicial</Badge> : null}
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Depende de: {deps.length > 0 ? deps.join(", ") : "nenhum processo anterior"}
              </p>

              {process.keyRequirements.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-neutral-700">Requisitos principais</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-neutral-600">
                    {process.keyRequirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {process.applicantDocuments.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-neutral-700">
                    Documentos enviados pelo solicitante ({process.applicantDocuments.length})
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-neutral-600">
                    {process.applicantDocuments.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {process.systemGeneratedDocuments.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-neutral-700">
                    Documentos geráveis pelo sistema ({process.systemGeneratedDocuments.length})
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-neutral-600">
                    {process.systemGeneratedDocuments.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="mt-4 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
        {UF_VARIATION_NOTE}
      </p>

      <div className="mt-6">
        <Link href="/admin">
          <Button variant="secondary">Voltar ao painel</Button>
        </Link>
      </div>

      <p className="mt-3 text-xs text-neutral-400">Perfil: {admin.role}.</p>
    </Container>
  );
}
