/**
 * Classificacao da ORIGEM de uma extracao persistida (PR #47C-3).
 *
 * Mora na camada de extracao porque e ela que sabe QUAL motor e qual: o dominio
 * (`documentExtractionStatus`) define o vocabulario `ReviewSource`, mas nao pode
 * importar `mockEngine` — `mockEngine` ja importa `documents`, e o caminho de
 * volta fecharia um ciclo.
 *
 * Regra unica, num lugar so: os dois loaders (dono e prontidao) chamam esta
 * funcao em vez de comparar o nome da engine cada um por conta propria. Duas
 * comparacoes iguais hoje viram duas regras diferentes amanha, e a divergencia
 * apareceria como uma frase errada na tela do cliente.
 *
 * NAO instancia engine, NAO chama `getExtractionEngine`, NAO executa extracao:
 * le um nome ja gravado na linha e devolve um rotulo de dominio.
 */
import { type PersistedExtraction } from "@/server/documents";
import { MOCK_ENGINE_NAME } from "./mockEngine";

/**
 * Origem de uma linha persistida, a partir do `engine` gravado nela.
 *
 * Qualquer motor que NAO seja o mock e tratado como leitura real. O default e
 * deliberadamente o lado mais forte: se um motor novo entrar e ninguem lembrar
 * de atualizar esta funcao, a tela dira "lido automaticamente, confira" — que e
 * verdade e pede conferencia humana. O erro inverso (chamar leitura real de
 * demonstracao) faria o usuario ignorar dado que veio do documento dele.
 */
export function sourceForEngine(engine: string): PersistedExtraction["source"] {
  return engine === MOCK_ENGINE_NAME ? "PERSISTED_MOCK_ENGINE" : "PERSISTED_REAL_ENGINE";
}
