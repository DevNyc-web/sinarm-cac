import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientStartPanel } from "@/components/client/ClientStartPanel";
import { clientProcessName } from "@/server/support/clientProcessChoices";
import { requireUser } from "@/server/auth/guards";
import { clientVisibleStatusLabel, PAYMENT_STATUS_LABELS } from "@/server/processes/statusLabels";
import { listProcessesByUser } from "@/server/repositories/processRepository";

type ProcessRow = Awaited<ReturnType<typeof listProcessesByUser>>[number];

export default async function DashboardPage() {
  const user = await requireUser();

  // Banco local pode estar fora do ar em dev — degradar com aviso, sem quebrar.
  let processes: ProcessRow[] = [];
  let dbUnavailable = false;
  try {
    processes = await listProcessesByUser(user.id);
  } catch {
    dbUnavailable = true;
  }

  // Banco fora do ar NAO conta como "sem pedidos": mostrar a jornada de quem
  // esta comecando esconderia que a lista falhou em carregar.
  const semPedidos = !dbUnavailable && processes.length === 0;

  /*
    Checklist fora do pedido: o painel de documentos do processo so aparece em
    /processos/[id], entao quem ainda nao abriu pedido nao teria como saber o que
    precisa reunir.

    Declarado uma vez e posicionado nos dois ramos abaixo pelo mesmo criterio do
    ClientStartPanel: orientacao ANTES da lista para quem esta comecando, DEPOIS
    dela para quem ja tem pedidos — a lista e o conteudo principal de quem volta.
  */
  const documentosCard = (
    <Card className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">Documentos</p>
          <p className="mt-1 text-sm text-neutral-600">
            Veja o checklist do que normalmente precisamos conferir para preparar sua Guia de
            Tráfego.
          </p>
        </div>
        <Link href="/dashboard/documentos" className="flex-none">
          <Button variant="secondary" className="w-full sm:w-auto">
            Ver checklist
          </Button>
        </Link>
      </div>
    </Card>
  );

  return (
    <Container>
      {/*
        Quem ainda nao tem processo abre na PERGUNTA, nao em "Meus processos"
        (docs/63 §3): o `ClientStartPanel` traz o `<h1>` e o CTA do processo
        criavel, entao o cabecalho da lista — titulo e botao — sairia duplicado
        e roubaria o topo da escolha. Quem ja tem processo continua com a lista
        como conteudo principal.
      */}
      {semPedidos ? (
        <ClientStartPanel name={user.name} />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Meus processos</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Acompanhe o andamento e continue de onde parou.
            </p>
          </div>
          <Link href="/processos/novo" className="w-full sm:w-auto">
            <Button className="w-full px-5 py-3 text-base sm:w-auto sm:py-2 sm:text-sm">
              Nova solicitação
            </Button>
          </Link>
        </div>
      )}

      <Card className="mt-4">
        <p className="text-sm text-neutral-600">
          Conta: <span className="font-medium text-neutral-900">{user.name}</span> · {user.email}
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          A execução é feita por uma pessoa da nossa equipe —{" "}
          <strong>não garantimos aprovação</strong>. Você confere os dados antes de qualquer envio.
        </p>
      </Card>

      {/* Antes da lista so para quem ainda nao tem pedido — ver `documentosCard`. */}
      {semPedidos ? documentosCard : null}

      <div className="mt-6">
        {/*
          Sem processo, "Meus processos" existe como informacao SECUNDARIA
          (docs/63 §8.1.3) — um `<h2>` depois da escolha, nunca o titulo da
          pagina. Com `dbUnavailable` o `<h1>` acima ja diz "Meus processos".
        */}
        {semPedidos ? (
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Meus processos
          </h2>
        ) : null}

        {dbUnavailable ? (
          <EmptyState
            title="Não foi possível carregar seus processos"
            description="Tente novamente em instantes. Se continuar assim, fale com o suporte."
          />
        ) : processes.length === 0 ? (
          /*
            A copy antiga mandava usar “Nova solicitação” — botao que este ramo
            deixou de renderizar. Agora so informa; comecar e a escolha acima.
          */
          <EmptyState
            title="Você ainda não tem processos"
            description="Quando você começar um processo, ele aparece aqui para acompanhamento."
          />
        ) : (
          <ul className="space-y-3">
            {processes.map((process) => (
              <li key={process.id}>
                <Link href={`/processos/${process.id}`} className="block">
                  <Card className="flex flex-col gap-3 transition-colors hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-medium">{process.code}</p>
                        {/*
                          MESMA funcao do detalhe (`clientVisibleStatusLabel`).
                          Antes esta lista lia so `operationalStatus`, entao um
                          processo com execucao manual em andamento aparecia como
                          "Pagamento confirmado — em fila" aqui e "Em execucao" no
                          detalhe — duas respostas para a mesma pergunta.

                          Excecao: cancelamento real (docs/58 §6). O detalhe ja
                          mostra "Processo cancelado" lendo `internalStatus`
                          direto; esta lista ainda lia so `clientVisibleStatusLabel`
                          (que NAO cobre `CANCELADO_OPERACIONAL` — docs/45), entao
                          continuava com o rotulo antigo. Mesmo badge, sem
                          segundo badge ao lado.
                        */}
                        <Badge>
                          {process.internalStatus === "CANCELADO_OPERACIONAL"
                            ? "Processo cancelado"
                            : clientVisibleStatusLabel(process)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-neutral-600">
                        {/*
                          Nome do CLIENTE, nao o do registro operacional: o
                          `ProcessType.name` semeado e "Guia de Trafego (Pessoa
                          Fisica - CAC)" (docs/61 §4.C).
                        */}
                        {clientProcessName(process.processType.code, process.processType.name)}
                        {process.destination
                          ? ` · ${process.destination.eventName} — ${process.destination.city}/${process.destination.uf}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Criado em {process.createdAt.toLocaleDateString("pt-BR")}
                        {process.payments[0]
                          ? ` · Pagamento: ${PAYMENT_STATUS_LABELS[process.payments[0].status]}`
                          : ""}
                      </p>
                    </div>
                    <span className="flex-none text-sm font-medium text-neutral-900">
                      Continuar <span aria-hidden>→</span>
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {semPedidos ? null : documentosCard}

      {semPedidos ? null : <ClientStartPanel name={user.name} variant="compact" />}
    </Container>
  );
}
