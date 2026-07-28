import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { DocumentChecklistView } from "@/components/documents/DocumentChecklistView";
import { requireUser } from "@/server/auth/guards";

/**
 * `/dashboard/documentos` — checklist da Guia de Trafego, somente leitura.
 *
 * Area logada (`requireUser`), mas sem consulta ao banco: a pagina existe para
 * quem AINDA nao tem pedido, entao nao depende de nenhum registro. O envio e a
 * conferencia continuam no fluxo do pedido.
 */
export default async function DashboardDocumentosPage() {
  await requireUser();

  return (
    <Container>
      <div>
        <h1 className="text-2xl font-semibold">Documentos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          O que costuma ser necessário para preparar sua Guia de Tráfego.
        </p>
      </div>

      <DocumentChecklistView />

      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="font-medium underline">
          <span aria-hidden>←</span> Voltar para meus processos
        </Link>
      </p>
    </Container>
  );
}
