"use client";

/**
 * Fase 8A — Laboratorio de Automacao Sintetica: pagina fake de Guia de Trafego.
 *
 * TUDO e sintetico e roda 100% no cliente (useState):
 * - NENHUMA chamada de rede (sem fetch, sem server action, sem Gov/SINARM).
 * - NENHUM upload real, NENHUM pagamento real, NENHUM protocolo real.
 * - Dados 100% ficticios; datas/numeros fixos e marcados como ficticios.
 *
 * O objetivo e ser um ALVO ESTAVEL para a automacao determinista futura
 * (Playwright/Puppeteer na Fase 8B) — por isso os `data-testid` do docs/26/27.
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

// Marcos do "log visual" (docs/27 §12) — cada um associado a etapa que o conclui.
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

// ------------------------------------------------------------------ componente

export function LabGuiaTrafego() {
  const [step, setStep] = useState<Step>("aviso");
  const [destino, setDestino] = useState<Destino>(DESTINO_PADRAO);
  const [weaponId, setWeaponId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState(JUSTIFICATIVA_PADRAO);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const currentIndex = STEPS.indexOf(step);
  const selectedWeapon = WEAPONS.find((w) => w.id === weaponId) ?? null;

  function go(next: Step) {
    setStep(next);
  }

  function reset() {
    setStep("aviso");
    setDestino(DESTINO_PADRAO);
    setWeaponId(null);
    setJustificativa(JUSTIFICATIVA_PADRAO);
    setReviewConfirmed(false);
  }

  function milestoneDone(milestoneStep: Step): boolean {
    const idx = STEPS.indexOf(milestoneStep);
    if (milestoneStep === "sucesso") return step === "sucesso";
    return currentIndex > idx;
  }

  return (
    <Container>
      {/* Marcador permanente de ambiente sintetico — visivel em toda etapa. */}
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <strong>Laboratório sintético (Fase 8A).</strong> Ambiente fictício de teste. Isto{" "}
        <strong>não é o Gov.br</strong> e <strong>não é o SINARM</strong>. Nenhum sistema real é
        acessado, nenhum dado real é usado e nada é protocolado. Serve apenas para preparar a
        automação futura.
      </div>

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Laboratório — Guia de Tráfego (sintético)</h1>
        <Badge>fictício</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* -------------------------------------------------- coluna principal */}
        <div>
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
                <Button data-testid="lab-start" onClick={() => go("solicitante")}>
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
              <div className="mt-5">
                <Button onClick={() => go("arma")}>Continuar</Button>
              </div>
            </Card>
          ) : null}

          {step === "arma" ? (
            <Card>
              <h2 className="text-lg font-semibold">Arma/PCE (fictícia)</h2>
              <p className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
                Em produção, a seleção de arma/PCE exigirá confirmação explícita do usuário.
              </p>
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
                  Confirmo que revisei os dados fictícios deste laboratório e autorizo continuar para
                  a simulação da GRU.
                </span>
              </label>

              <div className="mt-5">
                <Button
                  data-testid="continue-to-gru"
                  disabled={!reviewConfirmed}
                  onClick={() => go("gru")}
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
                <Button data-testid="generate-fake-gru" onClick={() => go("sucesso")}>
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
        </div>

        {/* -------------------------------------------------- log visual lateral */}
        <aside>
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900">Etapas do laboratório</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {MILESTONES.map((m) => {
                const done = milestoneDone(m.step);
                const active = step === m.step;
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
