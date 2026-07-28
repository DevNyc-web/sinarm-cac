import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { buildDocumentFileHeaders, decideDocumentAccess } from "@/server/documents/documentAccess";
import { findDocumentById } from "@/server/repositories/processDocumentRepository";
import { getStorageAdapter } from "@/server/storage";

// Le sessao/banco/storage por requisicao — nunca prerenderizado no build.
export const dynamic = "force-dynamic";

/**
 * Arquivo de um documento do processo.
 *
 * Existe para a conferencia humana ser executavel: ate aqui os bytes entravam no
 * storage e nao tinham caminho de volta, entao o operador aprovava/rejeitava sem
 * ver o documento.
 *
 * RESPOSTAS: 401 sem sessao; 404 para inexistente E para nao autorizado — o
 * mesmo corpo generico nos dois casos, para a rota nao virar oraculo de
 * existencia de documento. O storage so e tocado DEPOIS da autorizacao.
 *
 * Nao expoe `storageKey` nem caminho local em resposta alguma.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "nao autenticado" }, { status: 401 });
  }

  const notFound = NextResponse.json({ error: "documento nao encontrado" }, { status: 404 });
  const { documentId } = await params;

  try {
    const document = await findDocumentById(documentId);
    if (!document) return notFound;

    const decision = decideDocumentAccess({
      actorId: user.id,
      actorRole: user.role,
      ownerUserId: document.process.userId,
    });
    // Sem permissao: mesma resposta de inexistente, para nao vazar existencia.
    if (!decision.allowed) return notFound;

    const bytes = await getStorageAdapter().get(document.storageKey);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: buildDocumentFileHeaders({
        mimeType: document.mimeType,
        originalFileName: document.originalFileName,
        byteLength: bytes.byteLength,
      }),
    });
  } catch {
    // Banco fora do ar ou chave ausente no storage: erro generico, sem detalhe
    // interno (caminho, chave, stack) na resposta.
    return NextResponse.json({ error: "documento indisponivel" }, { status: 404 });
  }
}
