import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";

const BENEFITS = [
  {
    title: "Preparação e conferência",
    body: "Organizamos e conferimos os dados da sua Guia de Tráfego antes de qualquer envio, reduzindo erro e retrabalho.",
  },
  {
    title: "Você no controle do login",
    body: "Quando o processo exigir autenticação, o login é feito por você, na janela oficial. Nunca vemos sua senha.",
  },
  {
    title: "Acompanhamento transparente",
    body: "Você acompanha cada etapa pelo painel, com status em linguagem clara e suporte humano quando precisar.",
  },
];

const STEPS = [
  {
    title: "Você faz o pedido",
    body: "Escolhe o serviço, informa destino e dados básicos e anexa os documentos pedidos.",
  },
  {
    title: "Nossa equipe confere",
    body: "Uma pessoa revisa tudo e aponta ajustes antes de seguir. Nada é enviado sem conferência.",
  },
  {
    title: "Pagamento do serviço",
    body: "Você paga o serviço com segurança. A GRU (taxa do órgão) é parte à parte, do órgão competente.",
  },
  {
    title: "Acompanhamento e protocolo",
    body: "Acompanhe o andamento pelo painel. Quando aplicável, registramos o protocolo obtido no órgão.",
  },
];

export default function LandingPage() {
  return (
    <Container>
      {/* Hero */}
      <section className="py-6 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Serviço privado · sem vínculo com órgão público
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
          Assistência para a sua Guia de Tráfego, do começo ao acompanhamento
        </h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-600">
          Ajudamos você a preparar, conferir e acompanhar o processo de Guia de Tráfego (CAC).{" "}
          <strong className="text-neutral-800">
            Não somos órgão público e não garantimos aprovação
          </strong>{" "}
          — quem analisa e decide é o órgão competente.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/processos/novo" className="sm:w-auto">
            <Button className="w-full px-5 py-3 text-base sm:w-auto">Iniciar solicitação</Button>
          </Link>
          <Link href="/como-funciona" className="sm:w-auto">
            <Button variant="secondary" className="w-full px-5 py-3 text-base sm:w-auto">
              Como funciona
            </Button>
          </Link>
        </div>

        <ul className="mt-6 grid gap-2 text-sm text-neutral-600 sm:grid-cols-3">
          <li className="flex gap-2">
            <span aria-hidden>✓</span> Você confere os dados antes de qualquer envio
          </li>
          <li className="flex gap-2">
            <span aria-hidden>✓</span> Login oficial feito por você — nunca vemos sua senha
          </li>
          <li className="flex gap-2">
            <span aria-hidden>✓</span> Suporte humano em todas as etapas
          </li>
        </ul>
      </section>

      {/* Benefícios */}
      <section className="py-6">
        <h2 className="text-xl font-semibold">Por que usar</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <Card key={benefit.title}>
              <p className="font-medium text-neutral-900">{benefit.title}</p>
              <p className="mt-2 text-sm text-neutral-600">{benefit.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Etapas do processo */}
      <section className="py-6">
        <h2 className="text-xl font-semibold">Como funciona, em 4 passos</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="flex h-full gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-neutral-900">{step.title}</p>
                  <p className="mt-1 text-sm text-neutral-600">{step.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Avisos obrigatórios */}
      <section className="py-6">
        <Notice tone="warning" title="Importante antes de começar">
          Este é um <strong>serviço privado de apoio operacional</strong>. Não somos órgão
          público e <strong>não representamos Gov.br, Polícia Federal ou SINARM</strong>. A{" "}
          <strong>aprovação depende da análise do órgão competente</strong> — não prometemos
          resultado. Você confere todos os dados antes de qualquer envio.
        </Notice>
      </section>

      {/* CTA final */}
      <section className="py-6">
        <Card className="flex flex-col items-start gap-4 bg-neutral-50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Pronto para começar?</p>
            <p className="mt-1 text-sm text-neutral-600">
              Leva poucos minutos para criar seu pedido e salvar como rascunho.
            </p>
          </div>
          <Link href="/processos/novo" className="w-full sm:w-auto">
            <Button className="w-full px-5 py-3 text-base sm:w-auto">Iniciar solicitação</Button>
          </Link>
        </Card>
      </section>
    </Container>
  );
}
