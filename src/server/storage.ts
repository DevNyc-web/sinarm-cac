/**
 * Storage adapter do app — Fase 4 dev/ficticio (docs/04 §9, docs/15 §3.2).
 *
 * ARQUITETURA: o dominio so conhece a interface `StorageAdapter`. Trocar o
 * filesystem local por S3/MinIO no futuro = nova implementacao registrada em
 * `getStorageAdapter()`, sem reescrever services/repositorios.
 *
 * Nesta fase existe APENAS o `FileSystemStorage` (local/dev):
 *  - grava os bytes em `storage-local/` (git-ignored — nunca versionado);
 *  - sem URL publica/assinada, sem rede, sem nuvem, sem credencial;
 *  - o banco guarda so metadados + sha256; os bytes ficticios ficam aqui.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Contrato minimo do storage (docs/04 §9: `put/get/exists`). */
export interface StorageAdapter {
  /** Grava os bytes na chave informada (cria diretorios intermediarios). */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Le os bytes de volta (usado por download/expurgo — nunca pela UI). */
  get(key: string): Promise<Buffer>;
  /** Indica se a chave ja existe no storage. */
  exists(key: string): Promise<boolean>;
}

/** Raiz do storage local de desenvolvimento (relativa ao cwd do processo). */
const LOCAL_ROOT = path.resolve(process.cwd(), "storage-local");

/**
 * Resolve a chave para um caminho absoluto DENTRO de `storage-local/`,
 * rejeitando path traversal (`..`) que escaparia da raiz.
 */
function resolveKeyPath(key: string): string {
  const target = path.resolve(LOCAL_ROOT, key);
  const rel = path.relative(LOCAL_ROOT, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Storage key invalida (fora da raiz local).");
  }
  return target;
}

/** Implementacao local (filesystem) — unica disponivel na fase atual. */
class FileSystemStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<void> {
    const target = resolveKeyPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(resolveKeyPath(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(resolveKeyPath(key));
      return true;
    } catch {
      return false;
    }
  }
}

const localStorage: StorageAdapter = new FileSystemStorage();

/**
 * Fabrica do storage adapter. Trocar por S3/MinIO no futuro = escolher aqui
 * via env, como em `getPaymentProvider()`. Hoje so existe o local/dev.
 */
export function getStorageAdapter(): StorageAdapter {
  return localStorage;
}
