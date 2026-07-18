import { z } from "zod";

/**
 * Validacao de ambiente por schema Zod (docs/13 §16, docs/16 §6).
 * Validacao LAZY: a checagem roda na primeira chamada de getEnv() em runtime,
 * falhando o "boot" da primeira requisicao se faltar env obrigatoria — sem
 * quebrar o `next build` (que nao chama getEnv()).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL e obrigatoria"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  // Fase 5 — Pix sandbox/dev (docs/15 §3.4). "fake" nao exige credencial;
  // "mercadopago" usa SANDBOX e exige o access token de TESTE via env.
  PAYMENT_PROVIDER: z.enum(["fake", "mercadopago"]).default("fake"),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuracao de ambiente invalida: ${issues}`);
  }

  cached = parsed.data;
  return cached;
}
