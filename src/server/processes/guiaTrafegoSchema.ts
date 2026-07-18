/**
 * Validacao Zod do formulario de novo processo Guia de Trafego — Fase 3.
 * Campos conforme docs/10 §4 e docs/14 (Fase 3). SEM PII: destino e dados de
 * local/evento; a arma vem do catalogo MOCK (nunca digitada livre).
 */
import { z } from "zod";
import { MOCK_FIREARMS } from "./mockFirearms";

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const DEFAULT_JUSTIFICATION = "Guia para treino";

const mockFirearmIds = MOCK_FIREARMS.map((firearm) => firearm.id) as [string, ...string[]];

export const guiaTrafegoDraftSchema = z.object({
  eventName: z
    .string()
    .trim()
    .min(3, "Informe o nome do evento/clube (minimo 3 caracteres).")
    .max(120, "Nome do evento/clube muito longo (maximo 120)."),
  uf: z.enum(UFS, { message: "Selecione uma UF valida." }),
  city: z
    .string()
    .trim()
    .min(2, "Informe a cidade.")
    .max(80, "Cidade muito longa (maximo 80)."),
  street: z
    .string()
    .trim()
    .min(3, "Informe o logradouro.")
    .max(120, "Logradouro muito longo (maximo 120)."),
  number: z
    .string()
    .trim()
    .min(1, "Informe o numero.")
    .max(10, "Numero muito longo (maximo 10)."),
  firearmId: z.enum(mockFirearmIds, {
    message: "Selecione uma arma/PCE do catalogo ficticio.",
  }),
  justification: z
    .string()
    .trim()
    .min(3, "Informe a justificativa.")
    .max(300, "Justificativa muito longa (maximo 300).")
    .default(DEFAULT_JUSTIFICATION),
});

export type GuiaTrafegoDraftInput = z.infer<typeof guiaTrafegoDraftSchema>;

/** Campos do formulario — usado para tipar erros por campo na UI. */
export type GuiaTrafegoField = keyof GuiaTrafegoDraftInput;
