/**
 * Catalogo MOCK de armas/PCE — Fase 3.
 *
 * Simula o "acervo" que, no fluxo real, e lido do SINARM/CAC (docs/10 §4).
 * TODOS os dados sao FICTICIOS: marcas/modelos inventados, sem numero de serie,
 * sem numero SIGMA, sem lote (campos sensiveis ficam fora ate a decisao de
 * criptografia 3.10 — docs/15).
 *
 * Este arquivo e descartado quando a leitura real do acervo entrar (pos-MVP).
 */

export type MockFirearm = {
  id: string;
  /// Codigo PCE ficticio, so para a UI parecer com o fluxo real.
  pceCode: string;
  species: string;
  brand: string;
  model: string;
  caliber: string;
  quantity: number;
};

export const MOCK_FIREARMS: readonly MockFirearm[] = [
  {
    id: "mock-pce-001",
    pceCode: "PCE-DEMO-001",
    species: "Pistola",
    brand: "Marca Exemplo",
    model: "Modelo Alfa",
    caliber: "9mm (ficticio)",
    quantity: 1,
  },
  {
    id: "mock-pce-002",
    pceCode: "PCE-DEMO-002",
    species: "Revolver",
    brand: "Marca Exemplo",
    model: "Modelo Beta",
    caliber: ".38 (ficticio)",
    quantity: 1,
  },
  {
    id: "mock-pce-003",
    pceCode: "PCE-DEMO-003",
    species: "Espingarda",
    brand: "Marca Demo",
    model: "Modelo Gama",
    caliber: "12 (ficticio)",
    quantity: 1,
  },
];

export function findMockFirearm(id: string): MockFirearm | null {
  return MOCK_FIREARMS.find((firearm) => firearm.id === id) ?? null;
}

export function mockFirearmLabel(firearm: MockFirearm): string {
  return `${firearm.species} ${firearm.brand} ${firearm.model} — ${firearm.caliber} (${firearm.pceCode})`;
}
