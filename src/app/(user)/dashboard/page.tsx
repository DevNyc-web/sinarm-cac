import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DashboardPage() {
  return (
    <Container>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus processos</h1>
        <Link href="/processos/novo">
          <Button>Novo processo</Button>
        </Link>
      </div>
      <div className="mt-6">
        <EmptyState
          title="Nenhum processo ainda"
          description="Placeholder de dashboard (Fase 1). Dados reais chegam nas proximas fases."
        />
      </div>
    </Container>
  );
}
