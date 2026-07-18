import { ComoFuncionaBlock, LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Consentimento — Assistente CAC" };

export default function ConsentimentoPage() {
  return (
    <LegalPage
      title="Consentimento"
      summary="O que você autoriza ao nos contratar — e o que continua sendo só seu."
    >
      <ComoFuncionaBlock />

      <h2 className="pt-2 text-base font-medium text-neutral-900">Ao contratar, você concorda que</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Tratamos seus dados</strong> exclusivamente para preparar, executar e acompanhar
          o processo contratado.
        </li>
        <li>
          Uma <strong>pessoa da nossa equipe</strong> conduzirá as etapas no sistema oficial —{" "}
          <strong>o aplicativo não faz isso sozinho</strong>.
        </li>
        <li>
          <strong>Você</strong> fará o login no Gov.br <strong>na janela oficial</strong>, quando
          necessário. <strong>Nunca vemos, pedimos ou guardamos sua senha.</strong>
        </li>
        <li>
          Depois que você autoriza no Gov.br, o tratamento dentro do sistema do órgão é
          responsabilidade dele; registramos apenas <strong>o fato</strong> da autorização.
        </li>
        <li>
          Você leu a <strong>política de reembolso</strong> e sabe que{" "}
          <strong>não garantimos aprovação</strong>.
        </li>
      </ul>

      <h2 className="pt-2 text-base font-medium text-neutral-900">O que você NÃO autoriza</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Compartilhamento dos seus dados com terceiros sem necessidade do processo.</li>
        <li>Uso dos seus dados para finalidade diferente da contratada.</li>
        <li>Guarda da sua senha ou de credenciais de sistemas oficiais.</li>
      </ul>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Revogação</h2>
      <p>
        Você pode revogar o consentimento a qualquer momento. A revogação interrompe o
        processamento daqui para frente; atos já praticados no órgão não podem ser desfeitos por
        nós. Consulte <strong>Reembolso</strong> para os efeitos financeiros.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Ambiente atual</h2>
      <p>
        Em <strong>desenvolvimento</strong>, com dados fictícios. Nenhum consentimento real é
        coletado nesta etapa — o fluxo formal de aceite entra antes do primeiro atendimento real.
      </p>
    </LegalPage>
  );
}
