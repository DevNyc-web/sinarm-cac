/**
 * Modulo de documentos — CAMPOS por tipo e valores MOCK/DEV de demonstracao.
 *
 * ATENCAO (docs/15 §3.2): nada aqui le arquivo, faz OCR, chama IA ou acessa rede.
 * Os valores sao PLACEHOLDERS FIXOS e obviamente ficticios, escolhidos para nao
 * parecerem dado real: o objetivo e mostrar o FORMATO da tela de conferencia,
 * nunca simular uma leitura que nao aconteceu.
 *
 * Detalha por tipo de documento o contrato generico de
 * `documentExtractionTypes.ts` (EXTRACTABLE_FIELDS), que continua valendo para o
 * pipeline futuro.
 */
import type { ConfidenceLevel } from "./documentExtractionStatus";
import type { DocumentKind } from "./documentTypes";

/** Campo esperado de um tipo de documento, com o valor de demonstracao. */
export interface MockExtractionField {
  key: string;
  label: string;
  /** Valor FICTICIO de demonstracao — sempre marcado como exemplo. */
  value: string;
  confidence: ConfidenceLevel;
}

/**
 * Campos por tipo de documento. Os valores trazem "(exemplo)"/"(fictício)" no
 * proprio texto para que nenhuma tela possa exibi-los como se fossem reais.
 */
const FIELDS_BY_KIND: Record<DocumentKind, readonly MockExtractionField[]> = {
  IDENTIFICACAO_PESSOAL: [
    { key: "nome", label: "Nome", value: "MARIA DE EXEMPLO (fictício)", confidence: "ALTA" },
    { key: "cpf", label: "CPF", value: "000.000.000-00 (exemplo)", confidence: "MEDIA" },
    { key: "rg", label: "RG", value: "00.000.000-0 (exemplo)", confidence: "MEDIA" },
    {
      key: "dataNascimento",
      label: "Data de nascimento",
      value: "01/01/1990 (exemplo)",
      confidence: "BAIXA",
    },
  ],
  CR_REGISTRO_CAC: [
    {
      key: "numeroRegistro",
      label: "Número do registro",
      value: "CR-000000 (exemplo)",
      confidence: "ALTA",
    },
    { key: "validade", label: "Validade", value: "01/01/2030 (exemplo)", confidence: "MEDIA" },
    {
      key: "categoriaAtividade",
      label: "Categoria / atividade",
      value: "Atirador desportivo (exemplo)",
      confidence: "BAIXA",
    },
  ],
  COMPROVANTE_ORIGEM_ENDERECO: [
    { key: "uf", label: "UF", value: "XX (exemplo)", confidence: "ALTA" },
    { key: "cidade", label: "Cidade", value: "Cidade Exemplo", confidence: "ALTA" },
    {
      key: "logradouro",
      label: "Logradouro",
      value: "Rua de Exemplo (fictício)",
      confidence: "MEDIA",
    },
    { key: "numero", label: "Número", value: "000 (exemplo)", confidence: "MEDIA" },
  ],
  DECLARACAO_DESTINO_EVENTO: [
    {
      key: "nomeLocalEvento",
      label: "Nome do local / evento",
      value: "Clube de Exemplo (fictício)",
      confidence: "ALTA",
    },
    { key: "uf", label: "UF", value: "XX (exemplo)", confidence: "ALTA" },
    { key: "cidade", label: "Cidade", value: "Cidade Exemplo", confidence: "MEDIA" },
    {
      key: "logradouro",
      label: "Logradouro",
      value: "Avenida de Exemplo (fictício)",
      confidence: "MEDIA",
    },
    { key: "numero", label: "Número", value: "000 (exemplo)", confidence: "BAIXA" },
  ],
  COMPLEMENTAR: [
    {
      key: "descricao",
      label: "Descrição",
      value: "Documento complementar de exemplo",
      confidence: "MEDIA",
    },
    {
      key: "observacoes",
      label: "Observações",
      value: "Sem observações (exemplo)",
      confidence: "BAIXA",
    },
  ],
};

/** Campos de demonstracao esperados para um tipo de documento. */
export function mockFieldsFor(kind: DocumentKind): readonly MockExtractionField[] {
  return FIELDS_BY_KIND[kind] ?? [];
}

/**
 * Todo valor de demonstracao se identifica como exemplo/ficticio no texto.
 * Usado pelos testes como trava contra alguem colar dado com cara de real.
 */
export function isObviouslyFictitious(value: string): boolean {
  return /exemplo|fict[íi]cio/i.test(value);
}
