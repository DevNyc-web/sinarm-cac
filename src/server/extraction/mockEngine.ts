/**
 * Engine de extracao MOCK — unica implementacao desta fase.
 *
 * NAO le o arquivo, NAO faz OCR, NAO usa IA, NAO chama rede e NAO recebe bytes.
 * Devolve os MESMOS campos que `mockFieldsFor()` — a funcao pura que a UI ja usa
 * hoje via `buildExtractionReview`.
 *
 * Esse espelhamento e o ponto central do PR #47B: com ele, o PR #47C pode trocar
 * a fonte (mock em memoria -> linha persistida) e provar, por teste, que a saida
 * e identica. Sem isso, a troca mudaria em silencio o que o motor de decisao
 * conclui e o que `applyDestinationSuggestion` grava no processo.
 *
 * Deterministica: mesma entrada, mesma saida, sempre. Nao ha relogio, aleatorio
 * nem I/O no caminho.
 */
import { mockFieldsFor } from "@/server/documents/documentExtractionMock";
import {
  aggregateConfidence,
  type ExtractionEngine,
  type ExtractionInput,
  type ExtractionResult,
} from "./adapter";

export const MOCK_ENGINE_NAME = "mock";

/**
 * Versao da engine. Fixa e explicita: `document_extractions.engine_version`
 * existe para permitir comparar motores quando um OCR real entrar, entao o mock
 * precisa de um valor estavel que identifique "nao houve leitura".
 */
export const MOCK_ENGINE_VERSION = "0.1.0-mock";

export const mockExtractionEngine: ExtractionEngine = {
  name: MOCK_ENGINE_NAME,
  version: MOCK_ENGINE_VERSION,

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    // `input.bytes` e IGNORADO de proposito — ver o cabecalho.
    const fields = mockFieldsFor(input.kind).map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
      confidence: field.confidence,
    }));

    // Tipo de documento sem campos previstos nao e falha: e ausencia de contrato.
    // Devolver `ok: true` com lista vazia mantem a saida igual a do mock atual.
    return { ok: true, fields, confidence: aggregateConfidence(fields) };
  },
};
