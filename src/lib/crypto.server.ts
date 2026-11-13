/**
 * Cifragem de segredos em repouso (auditoria de segurança 12/11, item 5).
 *
 * Segredos de integração (tokens Asaas/Stripe/PagBank/Telegram e chaves do
 * `hotspot_configs.config`) são cifrados com AES-256-GCM antes de ir ao
 * banco e decifrados só no uso server-side. A chave vive fora do código, na
 * variável de ambiente `APP_ENCRYPTION_KEY` (base64 de 32 bytes aleatórios
 * ou 64 caracteres hexadecimais):
 *
 *   openssl rand -base64 32
 *
 * Formato do valor cifrado: `enc:v1:` + base64url(iv || authTag || cifrado).
 * O prefixo com versão distingue o valor cifrado do texto claro e permite
 * rotação futura de algoritmo/chave sem migração de dados.
 *
 * Compatibilidade com os valores atuais: os tokens já salvos estão em texto
 * claro e CONTINUAM funcionando. `decryptSecret` devolve o valor como está
 * quando não há o marcador de cifragem, e a próxima escrita do segredo
 * (salvar a integração novamente) o re-cifra com a chave atual.
 *
 * Sem a chave configurada: `encryptSecret` FALHA de forma explícita (nunca
 * escreve segredo em claro em silêncio) e a leitura de valores antigos em
 * claro continua funcionando. Valores já cifrados sem a chave (ou com a
 * chave errada) não podem ser decifrados — `decryptSecret` lança
 * `SecretDecryptionError` e `maskStoredSecret` devolve `"****"`.
 *
 * Server-side only: este módulo importa `node:crypto` e NUNCA pode ser
 * importado por código client-side.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ENCRYPTION_KEY_ENV_VAR = "APP_ENCRYPTION_KEY";
export const ENCRYPTED_SECRET_PREFIX = "enc:v1:";

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      `A variável de ambiente ${ENCRYPTION_KEY_ENV_VAR} não está configurada. ` +
        `Gere uma chave com \`openssl rand -base64 32\` e configure-a no Vercel ` +
        `(Settings → Environment Variables) antes de salvar integrações.`,
    );
    this.name = "MissingEncryptionKeyError";
  }
}

export class InvalidEncryptionKeyError extends Error {
  constructor() {
    super(
      `A variável ${ENCRYPTION_KEY_ENV_VAR} não é uma chave válida. ` +
        `Use base64 de 32 bytes (ex.: \`openssl rand -base64 32\`) ou 64 caracteres hexadecimais.`,
    );
    this.name = "InvalidEncryptionKeyError";
  }
}

export class SecretDecryptionError extends Error {
  constructor() {
    super(
      "Não foi possível decifrar o segredo armazenado. " +
        "A chave de cifragem pode ter mudado ou o valor está corrompido — " +
        "salve a integração novamente com o segredo atual.",
    );
    this.name = "SecretDecryptionError";
  }
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV_VAR]?.trim();
  if (!raw) throw new MissingEncryptionKeyError();

  // base64 de 32 bytes (`openssl rand -base64 32` gera 44 caracteres).
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_BYTES && decoded.toString("base64").replace(/=+$/, "") === raw.replace(/=+$/, "")) {
      return decoded;
    }
  }

  // 64 caracteres hexadecimais.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  throw new InvalidEncryptionKeyError();
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_SECRET_PREFIX);
}

/**
 * Cifra um segredo para armazenamento. `null`/`undefined`/"" passam como
 * estão (não há segredo para cifrar). Lança `MissingEncryptionKeyError` ou
 * `InvalidEncryptionKeyError` quando a chave não está configurada — nunca
 * devolve o segredo em claro em silêncio.
 */
export function encryptSecret(value: string): string;
export function encryptSecret(value: null | undefined): null | undefined;
export function encryptSecret(value: string | null | undefined): string | null | undefined;
export function encryptSecret(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "") return value;
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
  return ENCRYPTED_SECRET_PREFIX + packed;
}

/**
 * Decifra um valor armazenado. Valores sem o marcador de cifragem são
 * legados em texto claro e voltam como estão (leitura tolerante). Valores
 * cifrados com chave ausente, errada ou corrompidos lançam
 * `SecretDecryptionError`.
 */
export function decryptSecret(value: string): string;
export function decryptSecret(value: null | undefined): null | undefined;
export function decryptSecret(value: string | null | undefined): string | null | undefined;
export function decryptSecret(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "") return value;
  if (!isEncryptedSecret(value)) return value;
  const key = resolveEncryptionKey();
  let packed: Buffer;
  try {
    packed = Buffer.from(value.slice(ENCRYPTED_SECRET_PREFIX.length), "base64url");
  } catch {
    throw new SecretDecryptionError();
  }
  if (packed.length <= IV_BYTES + AUTH_TAG_BYTES) throw new SecretDecryptionError();
  const iv = packed.subarray(0, IV_BYTES);
  const authTag = packed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + AUTH_TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretDecryptionError();
  }
}

/**
 * Mascara um segredo armazenado para exibição (mesmo formato do
 * `maskSecret` que já existia nas funções de integração: início + `****` +
 * fim). Valores cifrados são decifrados antes de mascarar; se a decifragem
 * falhar, devolve `"****"` sem expor nenhum fragmento do valor cifrado.
 */
export function maskStoredSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  let plaintext = value;
  if (isEncryptedSecret(value)) {
    try {
      plaintext = decryptSecret(value) as string;
    } catch {
      return "****";
    }
  }
  if (plaintext.length <= 10) return `${plaintext.slice(0, 2)}****${plaintext.slice(-2)}`;
  return `${plaintext.slice(0, 6)}****${plaintext.slice(-4)}`;
}

/**
 * Compara um segredo armazenado (cifrado ou em claro) com um candidato em
 * claro, em tempo constante sobre o hash dos dois lados. Usado para validar
 * tokens de webhook, que não podem ser comparados com `.eq()` no banco
 * depois de cifrados.
 */
export function storedSecretMatches(
  stored: string | null | undefined,
  candidate: string | null | undefined,
): boolean {
  if (!stored || !candidate) return false;
  let plaintext: string;
  try {
    plaintext = decryptSecret(stored) as string;
  } catch {
    return false;
  }
  const left = createHash("sha256").update(plaintext).digest();
  const right = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(left, right);
}

/**
 * Chaves do `hotspot_configs.config` (jsonb) cujo valor é segredo e deve ser
 * cifrado em repouso. Qualquer outra chave passa intacta. A lista é
 * conservadora de propósito: uma chave nova de segredo precisa ser
 * adicionada aqui (e documentada) antes de ser gravada no `config`.
 */
export const HOTSPOT_CONFIG_SECRET_KEYS = [
  "password",
  "admin_password",
  "hotspot_password",
  "secret",
  "radius_secret",
  "api_key",
  "api_token",
  "token",
  "access_token",
  "webhook_secret",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapConfigSecrets(
  value: unknown,
  map: (stored: string) => string | null | undefined,
): unknown {
  if (Array.isArray(value)) return value.map((item) => mapConfigSecrets(item, map));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      (HOTSPOT_CONFIG_SECRET_KEYS as readonly string[]).includes(key) &&
      typeof entry === "string"
    ) {
      out[key] = map(entry);
    } else {
      out[key] = mapConfigSecrets(entry, map);
    }
  }
  return out;
}

/** Cifra os segredos conhecidos dentro de um `hotspot_configs.config`. */
export function encryptConfigSecrets(config: unknown): unknown {
  return mapConfigSecrets(config, (stored) => encryptSecret(stored));
}

/** Decifra os segredos conhecidos dentro de um `hotspot_configs.config`. */
export function decryptConfigSecrets(config: unknown): unknown {
  return mapConfigSecrets(config, (stored) => decryptSecret(stored));
}
