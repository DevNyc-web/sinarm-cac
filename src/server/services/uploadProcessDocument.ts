/**
 * Caso de uso: upload FICTICIO/DEV de documento do processo — Fase 4,
 * estendido para aceitar o TIPO do documento (um anexo por documento esperado).
 *
 * Regras (docs/15 §3.2/§3.10, preliminares):
 * - APENAS arquivos ficticios — a UI avisa "Nao envie documento real".
 * - Bytes vao para o storage adapter (local/dev); banco guarda metadados + sha256.
 * - Sem OCR, sem leitura de conteudo, sem URL publica/assinada.
 * - Sem envio automatico a qualquer orgao ou servico externo.
 */
import { createHash, randomUUID } from "node:crypto";
import { type AuthUser } from "@/server/auth/mockUsers";
import { type DocumentKind, toPrismaDocumentType } from "@/server/documents";
import { isClosed } from "@/server/processes/operationalSignals";
import { createDocument } from "@/server/repositories/processDocumentRepository";
import { findProcessByIdForUser } from "@/server/repositories/processRepository";
import { getStorageAdapter } from "@/server/storage";
import { transitionInternalStatus } from "./transitionInternalStatus";

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024; // 2 MB (dev)

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type UploadDocumentResult = { ok: true } | { ok: false; error: string };

/** Nome seguro para compor a storage key (o original fica no banco). */
function sanitizeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  return base || "arquivo";
}

export async function uploadProcessDocument(
  actor: AuthUser,
  processId: string,
  file: File,
  /** Tipo do documento esperado. Default mantem o comportamento anterior. */
  kind: DocumentKind = "IDENTIFICACAO_PESSOAL",
): Promise<UploadDocumentResult> {
  if (!file || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo ficticio (PDF, JPG ou PNG)." };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Formato nao aceito. Use PDF, JPG ou PNG (ficticio)." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "Arquivo maior que 2 MB. Use um arquivo ficticio menor." };
  }

  try {
    // Dono do processo: usuario so anexa no proprio processo.
    const process = await findProcessByIdForUser(processId, actor.id);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    // docs/57 §3.2/§4.6 — processo fechado (cancelamento real OU tecnico/dev)
    // nao aceita mais envio, reenvio nem substituicao de documento. Reusa
    // `isClosed` (operationalSignals.ts, docs/52), mesma funcao do guard de
    // `confirmPixPayment`, em vez de reescrever a checagem aqui. Roda ANTES do
    // storage e do `createDocument`: nenhum byte e gravado, nenhuma linha e
    // criada, nenhum status se move.
    if (isClosed(process.operationalStatus, process.internalStatus)) {
      return { ok: false, error: "Nao e possivel enviar documento para um processo encerrado." };
    }

    const data = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(data).digest("hex");
    const storageKey = `processes/${process.id}/documents/${randomUUID()}-${sanitizeFileName(file.name)}`;

    await getStorageAdapter().put(storageKey, data, file.type);

    await createDocument({
      processId: process.id,
      type: toPrismaDocumentType(kind),
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: data.byteLength,
      sha256,
      storageKey,
      uploadedByMockUserId: actor.id,
    });

    // Avanca a fila apenas se ainda estava no inicio (nao regride status).
    //
    // Fase 5e (docs/47 §6.1, §9): via `transitionInternalStatus`, mesma porta
    // canonica de `confirmPixPayment`. `internalStatus` vai para o candidato
    // aprovado pela Fase 5d; `operationalStatus` continua indo para
    // `DOCUMENTO_ENVIADO`, passado em `alsoSet` — MESMO efeito final na fila,
    // no admin e no status visivel ao cliente. O helper nao deriva um a partir
    // do outro; quem decide os dois valores continua sendo este fluxo.
    if (process.operationalStatus === "RASCUNHO") {
      const transition = await transitionInternalStatus({
        processId: process.id,
        toStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE",
        alsoSet: { operationalStatus: "DOCUMENTO_ENVIADO" },
        actorMockUserId: actor.id,
        actorRole: actor.role,
        note: "Documento enviado pelo cliente, aguardando conferencia",
      });
      if (!transition.ok) return { ok: false, error: transition.error };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel salvar o documento. Verifique o Postgres local (npm run db:migrate).",
    };
  }
}
