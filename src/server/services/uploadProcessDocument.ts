/**
 * Caso de uso: upload FICTICIO/DEV do Documento de Identificacao — Fase 4.
 *
 * Regras (docs/15 §3.2/§3.10, preliminares):
 * - APENAS arquivos ficticios — a UI avisa "Nao envie documento real".
 * - Bytes vao para o storage adapter (local/dev); banco guarda metadados + sha256.
 * - Sem OCR, sem leitura de conteudo, sem URL publica/assinada.
 */
import { createHash, randomUUID } from "node:crypto";
import { type AuthUser } from "@/server/auth/mockUsers";
import { createDocument } from "@/server/repositories/processDocumentRepository";
import {
  findProcessByIdForUser,
  updateProcessOperations,
} from "@/server/repositories/processRepository";
import { getStorageAdapter } from "@/server/storage";

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

    const data = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(data).digest("hex");
    const storageKey = `processes/${process.id}/documents/${randomUUID()}-${sanitizeFileName(file.name)}`;

    await getStorageAdapter().put(storageKey, data, file.type);

    await createDocument({
      processId: process.id,
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: data.byteLength,
      sha256,
      storageKey,
      uploadedByMockUserId: actor.id,
    });

    // Avanca a fila apenas se ainda estava no inicio (nao regride status).
    if (process.operationalStatus === "RASCUNHO") {
      await updateProcessOperations(process.id, { operationalStatus: "DOCUMENTO_ENVIADO" });
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel salvar o documento. Verifique o Postgres local (npm run db:push).",
    };
  }
}
