/**
 * Fundacao do modulo de documentos — ponto unico de importacao (dominio).
 *
 * Camada de dominio PURA (tipos/status/requisitos/contrato de extracao). Sem OCR,
 * sem IA, sem rede, sem acesso a Gov.br/SINARM. A persistencia continua usando o
 * schema Prisma existente (ProcessDocument) sem alteracao.
 */
export * from "./documentTypes";
export * from "./documentStatus";
export * from "./documentRequirements";
export * from "./documentIntake";
export * from "./documentExtractionTypes";
