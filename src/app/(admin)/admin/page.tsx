import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminPage() {
  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Painel — Fila de processos</h1>
        <Badge>Fase 1</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Placeholder de painel admin. RBAC, detalhe do processo e checklists chegam nas Fases 2, 6 e
        7.
      </p>
      <div className="mt-6">
        <EmptyState title="Fila vazia" description="Sem processos (esqueleto). Nenhum dado real." />
      </div>
    </Container>
  );
}
