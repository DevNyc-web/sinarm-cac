/**
 * Hash de senha DO PRODUTO — scrypt do `node:crypto`, sem dependencia externa.
 *
 * ATENCAO AO CONTEXTO DESTE REPOSITORIO: a senha tratada aqui e a do NOSSO app.
 * Credencial de Gov.br/SINARM continua ABSOLUTAMENTE proibida de ser recebida,
 * transmitida ou armazenada (docs/00 §8). Nenhuma funcao deste modulo deve ser
 * reaproveitada para credencial de orgao oficial.
 *
 * Por que scrypt e nao argon2id: o alvo de deploy ainda nao foi decidido, e
 * dependencia nativa antes disso e risco sem informacao. scrypt e memory-hard,
 * aceito pela OWASP, e vem no runtime. O formato abaixo GUARDA O ALGORITMO, entao
 * migrar para argon2id depois e reidratacao preguiçosa no login — sem migration e
 * sem resetar a senha de ninguem.
 *
 * Formato: `scrypt$N$r$p$saltB64url$hashB64url`
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Custo atual. Sobe com o tempo; hashes antigos continuam validos (§`needsRehash`). */
export const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, keyLen: 32, saltBytes: 16 } as const;

/**
 * `128 * N * r` = 32 MiB, que e EXATAMENTE o `maxmem` padrao do Node — no limite,
 * o scrypt falha. Declarar o dobro evita depender do default.
 */
const MAXMEM = 64 * 1024 * 1024;

const ALGORITHM = "scrypt";
const FIELD_SEPARATOR = "$";

/** Limite defensivo: senha gigante e trabalho de CPU de graca para um atacante. */
export const PASSWORD_MAX_LENGTH = 128;
/** Minimo por COMPRIMENTO, sem regra de composicao (NIST 800-63B). */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Tamanhos MINIMOS aceitos ao interpretar um hash armazenado.
 *
 * Sem este piso, um hash de 1 byte era aceito pelo parser — e `verifyPassword`
 * derivava 1 byte e comparava, casando com senha arbitraria em ~1/256. Explorar
 * exigia escrita no banco, mas restauracao truncada ou gravacao parcial chegariam
 * ao mesmo estado. Achado da revisao adversarial do PR de auth real.
 */
const MIN_STORED_HASH_BYTES = 32;
const MIN_STORED_SALT_BYTES = 8;

/**
 * `true` quando a senha e so espaco em branco.
 *
 * Nao aplicamos `trim` na senha antes do hash — isso alteraria silenciosamente a
 * senha escolhida por quem usa espaco de proposito. O que se recusa e a senha que
 * NAO TEM nada alem de espaco.
 */
export function isBlankPassword(plain: string): boolean {
  return typeof plain !== "string" || plain.trim().length === 0;
}

function toB64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/**
 * Alvo FALSO usado quando nao ha hash para conferir (e-mail inexistente ou usuario
 * sem senha). Existe para que o tempo de resposta seja o mesmo do caminho real —
 * sem isso, medir a latencia revela quais e-mails existem.
 *
 * Nao e segredo e nunca confere com senha alguma: sao bytes fixos.
 */
const DUMMY_TARGET: ParsedHash = {
  N: SCRYPT_PARAMS.N,
  r: SCRYPT_PARAMS.r,
  p: SCRYPT_PARAMS.p,
  salt: Buffer.alloc(SCRYPT_PARAMS.saltBytes, 0x5a),
  hash: Buffer.alloc(SCRYPT_PARAMS.keyLen, 0xa5),
};

/** Interpreta o hash armazenado. NUNCA lanca: entrada corrompida vira `null`. */
export function parsePasswordHash(stored: string): ParsedHash | null {
  if (typeof stored !== "string") return null;
  const parts = stored.split(FIELD_SEPARATOR);
  if (parts.length !== 6) return null;
  const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  if (algorithm !== ALGORITHM) return null;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  const positiveInteger = (value: number) => Number.isInteger(value) && value > 0;
  if (!positiveInteger(N) || !positiveInteger(r) || !positiveInteger(p)) return null;
  // Teto de custo: hash adulterado com N gigante viraria negacao de servico.
  if (N > 1_048_576 || r > 32 || p > 16) return null;

  try {
    const salt = Buffer.from(rawSalt ?? "", "base64url");
    const hash = Buffer.from(rawHash ?? "", "base64url");
    // Piso de tamanho: hash curto reduz o espaco de busca a ponto de qualquer
    // senha casar por sorte (ver MIN_STORED_HASH_BYTES).
    if (salt.length < MIN_STORED_SALT_BYTES) return null;
    if (hash.length < MIN_STORED_HASH_BYTES) return null;
    return { N, r, p, salt, hash };
  } catch {
    return null;
  }
}

/** Gera o hash versionado de uma senha em claro. */
export async function hashPassword(plain: string): Promise<string> {
  if (isBlankPassword(plain)) {
    // Cobre "" e tambem "     ": senha que so tem espaco nao e senha.
    throw new Error("Senha vazia nao pode ser transformada em hash.");
  }
  if (plain.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Senha acima de ${PASSWORD_MAX_LENGTH} caracteres.`);
  }

  const salt = randomBytes(SCRYPT_PARAMS.saltBytes);
  const derived = await scrypt(plain, salt, SCRYPT_PARAMS.keyLen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: MAXMEM,
  });

  return [
    ALGORITHM,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    toB64Url(salt),
    toB64Url(derived),
  ].join(FIELD_SEPARATOR);
}

/**
 * Confere a senha. `false` para hash ausente, corrompido ou divergente — nunca
 * lanca, porque um throw aqui viraria erro 500 distinguivel de "senha errada".
 *
 * SEMPRE executa um scrypt, inclusive quando nao ha hash: o custo de tempo tem de
 * ser o mesmo com e sem usuario.
 */
export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  const parsed = stored === null ? null : parsePasswordHash(stored);
  const target = parsed ?? DUMMY_TARGET;

  // Senha absurda: ainda assim gasta o tempo do alvo falso, sem derivar nada.
  const candidate =
    typeof plain === "string" && plain.length > 0 && plain.length <= PASSWORD_MAX_LENGTH
      ? plain
      : "";

  let derived: Buffer;
  try {
    derived = await scrypt(candidate, target.salt, target.hash.length, {
      N: target.N,
      r: target.r,
      p: target.p,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }

  const matches = derived.length === target.hash.length && timingSafeEqual(derived, target.hash);
  // Se nao havia hash valido, o resultado e descartado: o trabalho existiu so
  // para igualar o tempo.
  return parsed !== null && matches && candidate.length > 0;
}

/**
 * `true` quando o hash foi gerado com parametros mais fracos que os atuais — ou
 * com outro algoritmo. O login usa isto para regravar o hash de forma
 * transparente, que e o caminho de migracao para argon2id no futuro.
 */
export function needsRehash(stored: string): boolean {
  const parsed = parsePasswordHash(stored);
  if (!parsed) return true;
  return (
    parsed.N < SCRYPT_PARAMS.N ||
    parsed.r < SCRYPT_PARAMS.r ||
    parsed.p < SCRYPT_PARAMS.p ||
    parsed.hash.length < SCRYPT_PARAMS.keyLen
  );
}
