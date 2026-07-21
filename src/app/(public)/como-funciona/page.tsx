import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";

export const metadata: Metadata = {
  title: "Como funciona — Assistente CAC",
  description:
    "Entenda as etapas do serviço: envio de documentos, conferência, pagamento, acompanhamento, protocolo e suporte humano.",
};

const STEPS = [
  {
    title: "1. Envio de documentos",
    body: "Você cria o pedido, informa os dados da Guia de Tráfego e anexa os documentos solicitados. É rápido e pode ser salvo como rascunho para continuar depois.",
  },
  {
    title: "2. Conferência",
    body: "Uma pessoa da nossa equipe revisa os dados e os documentos, aponta ajustes e confirma se está tudo certo. Nada segue sem essa conferência.",
  },
  {
    title: "3. Pagamento",
    body: "Você paga o serviço com segurança. A GRU é a taxa do órgão competente — parte à parte da nossa cobrança, e nunca uma taxa nossa disfarçada.",
  },
  {
    title: "4. Acompanhamento",
    body: "Acompanhe cada etapa pelo painel, com status em linguagem clara. Você sabe onde o processo está e qual é o próximo passo.",
  },
  {
    title: "5. Protocolo (quando aplicável)",
    body: "Quando o processo chega ao órgão, registramos o protocolo obtido. Protocolado não significa aprovado — a decisão é sempre do órgão competente.",
  },
  {
    title: "6. Suporte humano",
    body: "Em qualquer etapa você fala com uma pessoa da equipe. Sem robô no lugar de gente quando o assunto é importante.",
  },
];

export default function ComoFuncionaPage() {
  return (
    <Container>
      <section className="py-6 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Passo a passo
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Como funciona</h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-600">
          Um serviço privado de apoio operacional para a sua Guia de Tráfego. Veja as etapas, do
          envio dos documentos ao acompanhamento.
        </p>
      </section>

      <section className="pb-6">
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.title}>
              <Card className="h-full">
                <p className="font-medium text-neutral-900">{step.title}</p>
                <p className="mt-2 text-sm text-neutral-600">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="pb-6">
        <Notice tone="warning" title="O que este serviço não é">
          Não somos órgão público e <strong>não representamos Gov.br, Polícia Federal ou
          SINARM</strong>. O sistema <strong>não acessa Gov.br/SINARM automaticamente</strong>:
          quando há login no órgão, <strong>você</strong> o faz na janela oficial e nunca vemos
          sua senha. <strong>A aprovação depende da análise do órgão competente.</strong>
        </Notice>
      </section>

      <section className="pb-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/processos/novo" className="w-full sm:w-auto">
            <Button className="w-full px-5 py-3 text-base sm:w-auto">Iniciar solicitação</Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full px-5 py-3 text-base sm:w-auto">
              Voltar ao início
            </Button>
          </Link>
        </div>
      </section>
    </Container>
  );
}
