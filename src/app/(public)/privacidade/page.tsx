import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacidade — Assistente CAC" };

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Privacidade e proteção de dados"
      summary="Que dados tratamos, para quê, por quanto tempo e o que nunca guardamos."
    >
      <h2 className="text-base font-medium text-neutral-900">Dados que tratamos</h2>
      <p>
        Apenas o necessário para preparar e acompanhar o processo: dados de contato, informações do
        destino (evento/clube), identificação do acervo indicado e o documento de identificação que
        você enviar. <strong>Minimização é regra</strong>: o que não for necessário, não pedimos.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">O que NUNCA guardamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Sua senha do Gov.br</strong> — nunca pedimos, nunca recebemos, nunca armazenamos.
          Se alguém pedir sua senha em nome desta plataforma, <strong>não é a gente</strong>.
        </li>
        <li>Token ou sessão de sistemas oficiais.</li>
        <li>Dados que não tenham finalidade no processo.</li>
      </ul>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Quem acessa</h2>
      <p>
        Apenas a equipe interna, conforme a função de cada perfil e o princípio da{" "}
        <strong>necessidade de conhecer</strong>. Todo acesso e cada ação relevante ficam
        registrados em trilha auditável (quem, qual perfil, quando).
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Após a autorização no órgão</h2>
      <p>
        Quando você autoriza o acesso na janela oficial, o tratamento dos dados dentro do sistema do
        órgão passa a ser de responsabilidade dele. Do nosso lado, registramos apenas{" "}
        <strong>o fato</strong> de que a autorização ocorreu.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Retenção</h2>
      <p>
        A proposta é manter o documento apenas pelo tempo necessário à execução e conferência —{" "}
        <strong>conclusão do processo + 30 dias</strong> — e depois apagar o arquivo, preservando
        apenas registros mínimos (status, protocolo e o necessário por obrigação legal/fiscal).{" "}
        <strong>Prazo final pendente de definição jurídica.</strong>
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão dos seus dados, e pedir informação sobre
        como são tratados. O canal de atendimento será publicado antes do início do serviço real.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Ambiente atual</h2>
      <p>
        Estamos em <strong>desenvolvimento</strong>, com dados fictícios.{" "}
        <strong>Não envie documento real</strong> nem dados pessoais verdadeiros nesta etapa.
      </p>
    </LegalPage>
  );
}
