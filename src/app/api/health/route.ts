import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";

// Handler dinamico: nunca prerenderizado no build (nao consulta o banco em build).
export const dynamic = "force-dynamic";

/**
 * Healthcheck (docs/16 §1/§13). Responde OK sempre; a checagem do banco degrada
 * com elegancia (reporta "unavailable" em vez de 500) para o esqueleto rodar
 * mesmo sem um Postgres local ativo.
 */
export async function GET() {
  let db: "connected" | "unavailable" = "unavailable";
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    db = "connected";
  } catch {
    db = "unavailable";
  }

  return NextResponse.json({
    status: "ok",
    db,
    timestamp: new Date().toISOString(),
  });
}
