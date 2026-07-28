/**
 * Fabrica do motor de extracao.
 *
 * SEM env nesta fase, de proposito. `getPaymentProvider()` le
 * `PAYMENT_PROVIDER` porque existem dois providers reais; `getStorageAdapter()`
 * nao le nada porque so ha uma implementacao. Extracao esta no segundo caso —
 * criar variavel de ambiente agora significaria uma chave que so aceita um
 * valor, e mexer em `env.ts`/`.env` sem ganho.
 *
 * Quando um OCR real entrar, a escolha vem para ca, como em `payments/index.ts`.
 */
import { type ExtractionEngine } from "./adapter";
import { mockExtractionEngine } from "./mockEngine";

export function getExtractionEngine(): ExtractionEngine {
  return mockExtractionEngine;
}
