"use client";

/**
 * Fase 8A/8C — Laboratorio de Automacao Sintetica: pagina fake de Guia de Trafego.
 *
 * TUDO e sintetico e roda 100% no cliente (useState):
 * - NENHUMA chamada de rede (sem fetch, sem server action, sem Gov/SINARM).
 * - NENHUM upload real, NENHUM pagamento real, NENHUM protocolo real.
 * - Dados 100% ficticios; datas/numeros fixos e marcados como ficticios.
 *
 * Fase 8C adiciona MODOS DE SIMULACAO (cenarios de excecao) — sessao expirada,
 * campo invalido, arma ambigua, documento ausente, falha de GRU, instabilidade
 * fake, pausa para humano, retry e bloqueio operacional. Cada cenario FALHA COM
 * SEGURANCA: nunca gera sucesso fake quando o fluxo falhou (docs/26 §5/§8, docs/30).
 *
 * O objetivo e ser um ALVO ESTAVEL para a automacao determinista (Playwright),
 * por isso os `data-testid`.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

// ------------------------------------------------------------------ dados fake

const SOLICITANTE = {
  nome: "Cliente Fictício de Teste",
  cpf: "000.000.000-00",
  documento: "RG FICTÍCIO",
  status: "Cadastro fictício carregado",
} as const;

const SERVICO = {
  servico: "Emitir Guia de Tráfego Pessoa Física (CAC)",
  tipoTaxa: "Taxas Diversas",
  valorTaxa: "R$ 20,00",
  atividade: "Tiro Desportivo - Atirador Desportivo",
  finalidade: "Treinamento Tiro Desportivo",
  tipoPce: "Arma de Fogo",
} as const;

const DESTINO_PADRAO = {
  evento: "Clube de Tiro Fictício Alfa",
  uf: "SP",
  cidade: "Cidade Fictícia",
  logradouro: "Rua Sintética de Teste",
  numero: "100",
  complemento: "",
};

type Destino = typeof DESTINO_PADRAO;

type FakeWeapon = {
  id: string;
  sigma: string;
  especie: string;
  marca: string;
  modelo: string;
  calibre: string;
};

// Armas 100% ficticias — sem numero de serie real, sem SIGMA real (docs/27).
const WEAPONS: readonly FakeWeapon[] = [
  { id: "fict-001", sigma: "FICT-001", especie: "Pistola", marca: "Marca Teste", modelo: "Modelo Alfa", calibre: "9mm" },
  { id: "fict-002", sigma: "FICT-002", especie: "Carabina", marca: "Marca Teste", modelo: "Modelo Beta", calibre: ".22" },
  { id: "fict-003", sigma: "FICT-003", especie: "Revólver", marca: "Marca Teste", modelo: "Modelo Gama", calibre: ".38" },
];

const DOCUMENTO = {
  tipo: "Documento de Identificação Pessoal",
  status: "documento fictício carregado",
  arquivo: "documento-ficticio.pdf",
} as const;

const JUSTIFICATIVA_PADRAO = "Guia para treino";

const GRU = {
  contribuinte: "Cliente Fictício de Teste",
  cpf: "000.000.000-00",
  ugGestao: "167086/00001",
  favorecida: "Fundo do Exército",
  codigoRecolhimento: "11300-0",
  referencia: "REF-FICT-0001",
  vencimento: "31/12/2099 (fictícia)",
  valorPrincipal: "R$ 20,00",
  valorTotal: "R$ 20,00",
  instrucoes: "Recolhimento fictício para laboratório de Guia de Tráfego",
} as const;

const RESULTADO = {
  protocolo: "PROT-FICT-0001",
  gruReferencia: "REF-FICT-0001",
} as const;

// Mensagens dos cenarios de excecao (docs/30).
const MSG = {
  sessionExpired: "Sessão fictícia expirada. A automação foi pausada com segurança.",
  invalidField: "Campo obrigatório fictício ausente: informe Cidade e Número.",
  weaponAmbiguous: "A automação não conseguiu decidir com segurança. Confirme manualmente a arma/PCE.",
  missingDocument: "Documento fictício ausente. Não é seguro continuar.",
  gruFailure: "Falha fictícia ao gerar GRU. Nenhum protocolo foi criado.",
  instability: "Serviço externo fictício indisponível. Pagamentos/processos devem ser pausados.",
  instabilityStatus: "Bloqueado por instabilidade fictícia.",
  humanPause: "Intervenção humana necessária.",
  operationalBlock: "Laboratório bloqueado operacionalmente.",
  retry1: "Tentativa 1 falhou (fictícia).",
  retry2: "Tentativa 2 concluída (fictícia).",
} as const;

// ------------------------------------------------------------------ cenarios

const SCENARIOS = [
  { id: "normal", label: "Modo normal", testid: "scenario-normal" },
  { id: "session-expired", label: "Sessão expirada fake", testid: "scenario-session-expired" },
  { id: "invalid-field", label: "Campo obrigatório inválido", testid: "scenario-invalid-field" },
  { id: "weapon-ambiguous", label: "Arma ambígua", testid: "scenario-weapon-ambiguous" },
  { id: "missing-document", label: "Documento fictício ausente", testid: "scenario-missing-document" },
  { id: "gru-failure", label: "Falha ao gerar GRU fake", testid: "scenario-gru-failure" },
  { id: "external-instability", label: "Instabilidade fake do órgão", testid: "scenario-external-instability" },
  { id: "human-pause", label: "Pausa para humano", testid: "scenario-human-pause" },
  { id: "retry", label: "Retry permitido", testid: "scenario-retry" },
  { id: "operational-block", label: "Bloqueio operacional", testid: "scenario-operational-block" },
] as const;

type Scenario = (typeof SCENARIOS)[number]["id"];

function toScenario(raw: string | undefined): Scenario {
  return SCENARIOS.some((s) => s.id === raw) ? (raw as Scenario) : "normal";
}

function scenarioLabel(id: Scenario): string {
  return SCENARIOS.find((s) => s.id === id)?.label ?? "Modo normal";
}

function initialDestino(scenario: Scenario): Destino {
  // No cenario de campo invalido, a Cidade comeca vazia para o gate reprovar.
  return scenario === "invalid-field" ? { ...DESTINO_PADRAO, cidade: "" } : DESTINO_PADRAO;
}

// Estados de excecao renderizados como overlay (substituem a etapa atual).
type ExceptionKind = "session-expired" | "gru-failure" | "retry-failed" | "human-pause" | null;

// ------------------------------------------------------------------ etapas

const STEPS = [
  "aviso",
  "solicitante",
  "servico",
  "destino",
  "arma",
  "documento",
  "justificativa",
  "revisao",
  "gru",
  "sucesso",
] as const;

type Step = (typeof STEPS)[number];

const MILESTONES: { label: string; step: Step }[] = [
  { label: "Cadastro fictício carregado", step: "solicitante" },
  { label: "Serviço selecionado", step: "servico" },
  { label: "Destino preenchido", step: "destino" },
  { label: "Arma selecionada", step: "arma" },
  { label: "Documento fictício carregado", step: "documento" },
  { label: "Revisão confirmada", step: "revisao" },
  { label: "GRU fictícia gerada", step: "gru" },
  { label: "Laboratório concluído", step: "sucesso" },
];

// ------------------------------------------------------------------ helpers UI

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function LabInput({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-700">
        {label}
        {optional ? <span className="text-neutral-400"> (opcional)</span> : null}
      </span>
      <input
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// Marcador (invisivel) de "estado sem sucesso" — ancora positiva p/ os testes.
function NoSuccessMarker() {
  return (
    <p className="sr-only" data-testid="no-success-assertion-marker">
      Estado sintético sem sucesso: nenhum protocolo fictício foi gerado aqui.
    </p>
  );
}

function ExceptionBanner({ label }: { label: string }) {
  return (
    <div
      data-testid="exception-banner"
      className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800"
    >
      <strong>Cenário sintético de exceção:</strong> {label}. Ambiente fictício — nenhum sistema
      real, nenhum processo real.
    </div>
  );
}

// ------------------------------------------------------------------ componente

export function LabGuiaTrafego({ initialScenario }: { initialScenario?: string }) {
  const scenario0 = toScenario(initialScenario);

  const [scenario, setScenario] = useState<Scenario>(scenario0);
  const [step, setStep] = useState<Step>("aviso");
  const [destino, setDestino] = useState<Destino>(initialDestino(scenario0));
  const [weaponId, setWeaponId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState(JUSTIFICATIVA_PADRAO);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [exceptionKind, setExceptionKind] = useState<ExceptionKind>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [blockReason, setBlockReason] = useState("");

  const currentIndex = STEPS.indexOf(step);
  const selectedWeapon = WEAPONS.find((w) => w.id === weaponId) ?? null;

  function go(next: Step) {
    setStep(next);
  }

  function resetFor(s: Scenario) {
    setStep("aviso");
    setDestino(initialDestino(s));
    setWeaponId(null);
    setJustificativa(JUSTIFICATIVA_PADRAO);
    setReviewConfirmed(false);
    setExceptionKind(null);
    setFieldError(null);
    setRetryAttempt(0);
    setBlockReason("");
  }

  function reset() {
    resetFor(scenario);
  }

  function selectScenario(s: Scenario) {
    setScenario(s);
    resetFor(s);
  }

  function milestoneDone(milestoneStep: Step): boolean {
    const idx = STEPS.indexOf(milestoneStep);
    if (milestoneStep === "sucesso") return step === "sucesso";
    return currentIndex > idx && exceptionKind === null;
  }

  // ---- handlers com injecao de cenario --------------------------------------

  function startFlow() {
    if (scenario === "session-expired") {
      setExceptionKind("session-expired");
      return;
    }
    go("solicitante");
  }

  function destinoContinue() {
    if (scenario === "invalid-field" && (!destino.cidade.trim() || !destino.numero.trim())) {
      setFieldError(MSG.invalidField);
      return;
    }
    setFieldError(null);
    go("arma");
  }

  function continueToGru() {
    if (scenario === "human-pause") {
      setExceptionKind("human-pause");
      return;
    }
    go("gru");
  }

  function generateGru() {
    if (scenario === "gru-failure") {
      setExceptionKind("gru-failure");
      return;
    }
    if (scenario === "retry" && retryAttempt < 1) {
      setRetryAttempt(1);
      setExceptionKind("retry-failed");
      return;
    }
    go("sucesso");
  }

  function doRetry() {
    // Retry seguro e EXPLICITO: so aqui a segunda tentativa conclui.
    setRetryAttempt(2);
    setExceptionKind(null);
    go("sucesso");
  }

  // ---- render das excecoes em overlay ---------------------------------------

  function renderException() {
    const label = scenarioLabel(scenario);
    if (exceptionKind === "session-expired") {
      return (
        <Card>
          <ExceptionBanner label={label} />
          <h2 className="mt-3 text-lg font-semibold">Sessão fictícia expirada</h2>
          <p data-testid="exception-message" className="mt-2 text-sm text-neutral-700">
            {MSG.sessionExpired}
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Não é possível continuar para a GRU. A automação parou com segurança — nenhum protocolo
            fictício foi criado.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={reset}>Reiniciar laboratório</Button>
            <Button variant="secondary" onClick={() => selectScenario("normal")}>
              Solicitar nova autorização fictícia
            </Button>
          </div>
          <NoSuccessMarker />
        </Card>
      );
    }
    if (exceptionKind === "gru-failure") {
      return (
        <Card>
          <ExceptionBanner label={label} />
          <h2 className="mt-3 text-lg font-semibold">Falha fictícia ao gerar GRU</h2>
          <p data-testid="exception-message" className="mt-2 text-sm text-neutral-700">
            {MSG.gruFailure}
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Nenhum protocolo fictício foi criado. Você pode tentar novamente com segurança.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              data-testid="retry-button"
              onClick={() => {
                setExceptionKind(null);
                go("gru");
              }}
            >
              Tentar gerar GRU novamente (retry seguro)
            </Button>
            <Button variant="secondary" onClick={reset}>
              Reiniciar laboratório
            </Button>
          </div>
          <NoSuccessMarker />
        </Card>
      );
    }
    if (exceptionKind === "retry-failed") {
      return (
        <Card>
          <ExceptionBanner label={label} />
          <h2 className="mt-3 text-lg font-semibold">Retry fictício</h2>
          <p data-testid="exception-message" className="mt-2 text-sm text-neutral-700">
            {MSG.retry1}
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-neutral-700">
            <li>{MSG.retry1}</li>
          </ul>
          <p className="mt-2 text-sm text-neutral-600">
            O sucesso só aparece após uma nova tentativa <strong>explícita</strong> — nada é
            reprocessado de forma invisível.
          </p>
          <div className="mt-5">
            <Button data-testid="retry-button" onClick={doRetry}>
              Tentar novamente (Tentativa 2)
            </Button>
          </div>
          <NoSuccessMarker />
        </Card>
      );
    }
    if (exceptionKind === "human-pause") {
      return (
        <Card>
          <ExceptionBanner label={label} />
          <h2 data-testid="human-review-required" className="mt-3 text-lg font-semibold">
            Intervenção humana necessária
          </h2>
          <p data-testid="exception-message" className="mt-2 text-sm text-neutral-700">
            {MSG.humanPause}
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            O fluxo pausou <strong>antes</strong> do ato sensível. Nada avança automaticamente — um
            operador precisa decidir.
          </p>
          <div className="mt-5">
            <Button variant="secondary" onClick={reset}>
              Reiniciar laboratório
            </Button>
          </div>
          <NoSuccessMarker />
        </Card>
      );
    }
    return null;
  }

  // ---- render dos bloqueios "desde o inicio" --------------------------------

  function renderInstabilityBlock() {
    return (
      <Card>
        <ExceptionBanner label={scenarioLabel(scenario)} />
        <h2 className="mt-3 text-lg font-semibold">Instabilidade fictícia do órgão</h2>
        <p data-testid="exception-message" className="mt-2 text-sm text-neutral-700">
          {MSG.instability}
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          <strong>Status operacional:</strong> {MSG.instabilityStatus}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          O fluxo normal não pode ser iniciado enquanto o serviço fictício estiver indisponível.
        </p>
        <div className="mt-5">
          <Button variant="secondary" onClick={() => selectScenario("normal")}>
            Voltar ao modo normal
          </Button>
        </div>
        <NoSuccessMarker />
      </Card>
    );
  }

  function renderOperationalBlock() {
    return (
      <Card>
        <ExceptionBanner label={scenarioLabel(scenario)} />
        <h2 className="mt-3 text-lg font-semibold">Bloqueio operacional fictício</h2>
        <p data-testid="operational-block-message" className="mt-2 text-sm text-neutral-700">
          {MSG.operationalBlock}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Não é seguro prosseguir. Registre um motivo fictício para o bloqueio.
        </p>
        <div className="mt-4 max-w-md">
          <LabInput label="Motivo fictício do bloqueio" value={blockReason} onChange={setBlockReason} />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Enquanto houver bloqueio operacional, o laboratório não gera sucesso.
        </p>
        <div className="mt-5">
          <Button variant="secondary" onClick={() => selectScenario("normal")}>
            Voltar ao modo normal
          </Button>
        </div>
        <NoSuccessMarker />
      </Card>
    );
  }

  // ---- render principal -----------------------------------------------------

  const blockedFromStart = scenario === "external-instability" || scenario === "operational-block";

  return (
    <Container>
      {/* Marcador permanente de ambiente sintetico — visivel em toda etapa. */}
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <strong>Laboratório sintético (Fase 8A/8C).</strong> Ambiente fictício de teste. Isto{" "}
        <strong>não é o Gov.br</strong> e <strong>não é o SINARM</strong>. Nenhum sistema real é
        acessado, nenhum dado real é usado e nada é protocolado. Serve apenas para preparar a
        automação futura.
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Laboratório — Guia de Tráfego (sintético)</h1>
        <Badge>fictício</Badge>
        <Badge>modo: {scenarioLabel(scenario)}</Badge>
      </div>

      {/* Seletor de cenarios — SOMENTE nesta rota fake. */}
      <div
        data-testid="scenario-selector"
        className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3"
      >
        <p className="text-xs font-medium text-neutral-600">
          Modo de simulação (somente laboratório sintético)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCENARIOS.map((s) => {
            const active = scenario === s.id;
            return (
              <button
                key={s.id}
                data-testid={s.testid}
                onClick={() => selectScenario(s.id)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* -------------------------------------------------- coluna principal */}
        <div>
          {blockedFromStart ? (
            scenario === "external-instability" ? (
              renderInstabilityBlock()
            ) : (
              renderOperationalBlock()
            )
          ) : exceptionKind ? (
            renderException()
          ) : (
            <>
              {step === "aviso" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Aviso do laboratório</h2>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    <li>Este é um <strong>ambiente sintético/fictício</strong>.</li>
                    <li><strong>Não é o Gov.br.</strong></li>
                    <li><strong>Não é o SINARM.</strong></li>
                    <li><strong>Não acessa nenhum sistema real</strong> (nenhuma chamada externa).</li>
                    <li><strong>Não usa dados reais</strong> — tudo abaixo é fictício.</li>
                    <li>Serve apenas para <strong>testar a automação futura</strong> em ambiente controlado.</li>
                  </ul>
                  <div className="mt-5">
                    <Button data-testid="lab-start" onClick={startFlow}>
                      Iniciar simulação fictícia
                    </Button>
                  </div>
                </Card>
              ) : null}

              {step === "solicitante" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Dados do solicitante (fictício)</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Nome" value={SOLICITANTE.nome} />
                    <Field label="CPF (fictício)" value={SOLICITANTE.cpf} />
                    <Field label="Documento" value={SOLICITANTE.documento} />
                    <Field label="Status" value={SOLICITANTE.status} />
                  </div>
                  <div className="mt-5">
                    <Button onClick={() => go("servico")}>Continuar</Button>
                  </div>
                </Card>
              ) : null}

              {step === "servico" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Seleção de serviço (fictício)</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Serviço" value={SERVICO.servico} />
                    <Field label="Tipo de taxa" value={SERVICO.tipoTaxa} />
                    <Field label="Valor da taxa (fictício)" value={SERVICO.valorTaxa} />
                    <Field label="Atividade" value={SERVICO.atividade} />
                    <Field label="Finalidade" value={SERVICO.finalidade} />
                    <Field label="Tipo de PCE" value={SERVICO.tipoPce} />
                  </div>
                  <div className="mt-5">
                    <Button data-testid="service-select" onClick={() => go("destino")}>
                      Confirmar serviço
                    </Button>
                  </div>
                </Card>
              ) : null}

              {step === "destino" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Destino (fictício)</h2>
                  <div data-testid="destination-form" className="mt-4 grid gap-4 sm:grid-cols-2">
                    <LabInput
                      label="Nome do evento/clube"
                      value={destino.evento}
                      onChange={(v) => setDestino({ ...destino, evento: v })}
                    />
                    <LabInput label="UF" value={destino.uf} onChange={(v) => setDestino({ ...destino, uf: v })} />
                    <LabInput
                      label="Cidade"
                      value={destino.cidade}
                      onChange={(v) => setDestino({ ...destino, cidade: v })}
                    />
                    <LabInput
                      label="Logradouro"
                      value={destino.logradouro}
                      onChange={(v) => setDestino({ ...destino, logradouro: v })}
                    />
                    <LabInput
                      label="Número"
                      value={destino.numero}
                      onChange={(v) => setDestino({ ...destino, numero: v })}
                    />
                    <LabInput
                      label="Complemento"
                      optional
                      value={destino.complemento}
                      onChange={(v) => setDestino({ ...destino, complemento: v })}
                    />
                  </div>
                  {fieldError ? (
                    <div className="mt-4">
                      <p
                        data-testid="exception-message"
                        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                      >
                        {fieldError}
                      </p>
                      <NoSuccessMarker />
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <Button onClick={destinoContinue}>Continuar</Button>
                  </div>
                </Card>
              ) : null}

              {step === "arma" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Arma/PCE (fictícia)</h2>
                  {scenario === "weapon-ambiguous" ? (
                    <div className="mt-2">
                      <p
                        data-testid="human-review-required"
                        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                      >
                        <span data-testid="exception-message">{MSG.weaponAmbiguous}</span>
                      </p>
                      <NoSuccessMarker />
                    </div>
                  ) : (
                    <p className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
                      Em produção, a seleção de arma/PCE exigirá confirmação explícita do usuário.
                    </p>
                  )}
                  <div className="mt-4 overflow-x-auto">
                    <table data-testid="weapon-table" className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                          <th className="py-2 pr-3 font-medium">SIGMA (fictício)</th>
                          <th className="py-2 pr-3 font-medium">Espécie</th>
                          <th className="py-2 pr-3 font-medium">Marca</th>
                          <th className="py-2 pr-3 font-medium">Modelo</th>
                          <th className="py-2 pr-3 font-medium">Calibre</th>
                          <th className="py-2 font-medium">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {WEAPONS.map((w) => {
                          const selected = weaponId === w.id;
                          return (
                            <tr key={w.id} className="border-b border-neutral-100">
                              <td className="py-2 pr-3">{w.sigma}</td>
                              <td className="py-2 pr-3">{w.especie}</td>
                              <td className="py-2 pr-3">{w.marca}</td>
                              <td className="py-2 pr-3">{w.modelo}</td>
                              <td className="py-2 pr-3">{w.calibre}</td>
                              <td className="py-2">
                                <Button
                                  data-testid={`weapon-select-${w.id}`}
                                  variant={selected ? "primary" : "secondary"}
                                  onClick={() => setWeaponId(w.id)}
                                >
                                  {selected ? "Selecionada" : "Selecionar"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5">
                    <Button disabled={!weaponId} onClick={() => go("documento")}>
                      Continuar
                    </Button>
                  </div>
                </Card>
              ) : null}

              {step === "documento" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Documento (fictício)</h2>
                  {scenario === "missing-document" ? (
                    <>
                      <p data-testid="fake-document-status" className="mt-4 text-sm font-medium text-neutral-900">
                        Documento fictício ausente.
                      </p>
                      <p
                        data-testid="exception-message"
                        className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                      >
                        {MSG.missingDocument}
                      </p>
                      <div className="mt-5">
                        <Button disabled>Continuar</Button>
                      </div>
                      <NoSuccessMarker />
                    </>
                  ) : (
                    <>
                      <div data-testid="fake-document-status" className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="Tipo" value={DOCUMENTO.tipo} />
                        <Field label="Status" value={DOCUMENTO.status} />
                        <Field label="Arquivo (fictício)" value={DOCUMENTO.arquivo} />
                      </div>
                      <p className="mt-3 text-xs text-neutral-500">
                        Nenhum upload real acontece nesta fase — apenas a simulação do anexo.
                      </p>
                      <div className="mt-5">
                        <Button onClick={() => go("justificativa")}>Continuar</Button>
                      </div>
                    </>
                  )}
                </Card>
              ) : null}

              {step === "justificativa" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Observações / justificativa (fictícia)</h2>
                  <div className="mt-4">
                    <LabInput label="Justificativa" value={justificativa} onChange={setJustificativa} />
                  </div>
                  <div className="mt-5">
                    <Button onClick={() => go("revisao")}>Continuar</Button>
                  </div>
                </Card>
              ) : null}

              {step === "revisao" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Revisão antes da GRU (fictícia)</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Solicitante" value={SOLICITANTE.nome} />
                    <Field label="CPF (fictício)" value={SOLICITANTE.cpf} />
                    <Field label="Serviço" value={SERVICO.servico} />
                    <Field label="Finalidade" value={SERVICO.finalidade} />
                    <Field
                      label="Destino"
                      value={`${destino.evento} — ${destino.logradouro}, ${destino.numero}${
                        destino.complemento ? ` (${destino.complemento})` : ""
                      }, ${destino.cidade}/${destino.uf}`}
                    />
                    <Field
                      label="Arma selecionada"
                      value={
                        selectedWeapon
                          ? `${selectedWeapon.especie} ${selectedWeapon.marca} ${selectedWeapon.modelo} — ${selectedWeapon.calibre} (${selectedWeapon.sigma})`
                          : "—"
                      }
                    />
                    <Field label="Documento" value={`${DOCUMENTO.tipo} · ${DOCUMENTO.arquivo}`} />
                    <Field label="Justificativa" value={justificativa} />
                    <Field label="Valor da taxa (fictício)" value={SERVICO.valorTaxa} />
                  </div>

                  <label className="mt-5 flex items-start gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      data-testid="review-confirm-checkbox"
                      className="mt-0.5"
                      checked={reviewConfirmed}
                      onChange={(e) => setReviewConfirmed(e.target.checked)}
                    />
                    <span>
                      Confirmo que revisei os dados fictícios deste laboratório e autorizo continuar
                      para a simulação da GRU.
                    </span>
                  </label>

                  <div className="mt-5">
                    <Button
                      data-testid="continue-to-gru"
                      disabled={!reviewConfirmed}
                      onClick={continueToGru}
                    >
                      Continuar para a GRU fictícia
                    </Button>
                  </div>
                </Card>
              ) : null}

              {step === "gru" ? (
                <Card>
                  <h2 className="text-lg font-semibold">Dados da GRU (fictícia)</h2>
                  <div data-testid="fake-gru-screen" className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Nome do contribuinte" value={GRU.contribuinte} />
                    <Field label="CPF/CNPJ (fictício)" value={GRU.cpf} />
                    <Field label="UG/Gestão" value={GRU.ugGestao} />
                    <Field label="Nome Unidade Favorecida" value={GRU.favorecida} />
                    <Field label="Código Recolhimento" value={GRU.codigoRecolhimento} />
                    <Field label="Número Referência" value={GRU.referencia} />
                    <Field label="Data Vencimento (fictícia)" value={GRU.vencimento} />
                    <Field label="Valor Principal (fictício)" value={GRU.valorPrincipal} />
                    <Field label="Valor Total (fictício)" value={GRU.valorTotal} />
                    <Field label="Instruções" value={GRU.instrucoes} />
                  </div>
                  <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Esta GRU é fictícia. Não pague. Não possui validade.
                  </p>
                  <div className="mt-5">
                    <Button data-testid="generate-fake-gru" onClick={generateGru}>
                      Gerar GRU fictícia e salvar laboratório
                    </Button>
                  </div>
                </Card>
              ) : null}

              {step === "sucesso" ? (
                <Card>
                  <div data-testid="fake-success">
                    <h2 className="text-lg font-semibold">Laboratório concluído (fictício)</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="Protocolo fictício" value={RESULTADO.protocolo} />
                      <Field label="GRU fictícia" value={RESULTADO.gruReferencia} />
                      <Field label="Status" value="Laboratório concluído" />
                    </div>
                    {scenario === "retry" ? (
                      <ul className="mt-4 list-disc pl-5 text-sm text-neutral-700">
                        <li>{MSG.retry1}</li>
                        <li>{MSG.retry2}</li>
                      </ul>
                    ) : null}
                    <p className="sr-only" data-testid="fake-protocol-number">
                      {RESULTADO.protocolo}
                    </p>
                    <p className="sr-only" data-testid="fake-gru-reference">
                      {RESULTADO.gruReferencia}
                    </p>
                    <p className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                      Este resultado é sintético. Nenhum processo real foi protocolado.
                    </p>
                  </div>
                  <div className="mt-5">
                    <Button variant="secondary" onClick={reset}>
                      Reiniciar laboratório
                    </Button>
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>

        {/* -------------------------------------------------- log visual lateral */}
        <aside>
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900">Etapas do laboratório</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {MILESTONES.map((m) => {
                const done = milestoneDone(m.step);
                const active = step === m.step && exceptionKind === null && !blockedFromStart;
                return (
                  <li key={m.step} className="flex items-start gap-2">
                    <span className={done ? "text-emerald-600" : active ? "text-neutral-900" : "text-neutral-300"}>
                      {done ? "✓" : "○"}
                    </span>
                    <span className={done ? "text-neutral-800" : active ? "text-neutral-900" : "text-neutral-400"}>
                      {m.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs text-neutral-400">
              Ambiente sintético. Não oficial. Não acessa sistema real.
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
