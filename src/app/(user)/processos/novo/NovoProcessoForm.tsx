"use client";

/**
 * Formulario de novo processo Guia de Trafego — Fase 3 (client component).
 * Apenas apresentacao + estado do form; validacao real e Zod no servidor.
 */
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createDraftAction, type NovoProcessoFormState } from "./actions";

type FirearmOption = { id: string; label: string };

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function NovoProcessoForm({
  ufs,
  firearms,
  defaultJustification,
}: {
  ufs: readonly string[];
  firearms: readonly FirearmOption[];
  defaultJustification: string;
}) {
  const [state, formAction, pending] = useActionState<NovoProcessoFormState, FormData>(
    createDraftAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction}>
      <Card className="mt-4 space-y-4">
        {state.formError ? (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.formError}
          </p>
        ) : null}

        <label className="block text-sm">
          Nome do evento / clube
          <input
            name="eventName"
            defaultValue={values.eventName ?? ""}
            placeholder="Ex.: Clube de Tiro Exemplo"
            className={inputClass}
          />
          <FieldError message={errors.eventName} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            UF
            <select name="uf" defaultValue={values.uf ?? ""} className={inputClass}>
              <option value="">Selecione…</option>
              {ufs.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <FieldError message={errors.uf} />
          </label>
          <label className="block text-sm">
            Cidade
            <input
              name="city"
              defaultValue={values.city ?? ""}
              placeholder="Cidade Exemplo"
              className={inputClass}
            />
            <FieldError message={errors.city} />
          </label>
        </div>

        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <label className="block text-sm">
            Logradouro
            <input
              name="street"
              defaultValue={values.street ?? ""}
              placeholder="Rua Exemplo"
              className={inputClass}
            />
            <FieldError message={errors.street} />
          </label>
          <label className="block text-sm">
            Numero
            <input
              name="number"
              defaultValue={values.number ?? ""}
              placeholder="100"
              className={inputClass}
            />
            <FieldError message={errors.number} />
          </label>
        </div>

        <label className="block text-sm">
          Arma/PCE (catalogo ficticio)
          <select name="firearmId" defaultValue={values.firearmId ?? ""} className={inputClass}>
            <option value="">Selecione…</option>
            {firearms.map((firearm) => (
              <option key={firearm.id} value={firearm.id}>
                {firearm.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.firearmId} />
          <p className="mt-1 text-xs text-neutral-500">
            Dados 100% ficticios (mock/dev). O acervo real do SINARM nao e acessado.
          </p>
        </label>

        <label className="block text-sm">
          Justificativa
          <textarea
            name="justification"
            rows={3}
            defaultValue={values.justification ?? defaultJustification}
            className={inputClass}
          />
          <FieldError message={errors.justification} />
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar rascunho"}
        </Button>
      </Card>
    </form>
  );
}
