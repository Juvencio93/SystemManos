import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decryptConfigSecrets,
  decryptSecret,
  encryptConfigSecrets,
  encryptSecret,
  InvalidEncryptionKeyError,
  isEncryptedSecret,
  maskStoredSecret,
  MissingEncryptionKeyError,
  SecretDecryptionError,
  storedSecretMatches,
} from "./crypto.server";

// Chave de TESTE gerada para esta suíte (nunca usada fora dos testes).
const TEST_KEY_BASE64 = Buffer.from("teste-cifragem-segredos-01234567").toString("base64");
const OTHER_KEY_BASE64 = Buffer.from("outra-chave-de-teste-0123456789a").toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("crypto.server — cifragem de segredos em repouso", () => {
  it("roundtrip: cifrar e decifrar devolve o segredo original", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const encrypted = encryptSecret("asaas-token-de-teste-123456");
    expect(encrypted).not.toBe("asaas-token-de-teste-123456");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted?.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("asaas-token-de-teste-123456");
  });

  it("cada cifragem usa um IV aleatório (mesmo segredo, cifrados diferentes)", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const first = encryptSecret("mesmo-segredo");
    const second = encryptSecret("mesmo-segredo");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("mesmo-segredo");
    expect(decryptSecret(second)).toBe("mesmo-segredo");
  });

  it("texto claro sem marcador passa como está (compatibilidade com valores atuais)", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    expect(decryptSecret("token-legado-em-claro")).toBe("token-legado-em-claro");
    expect(isEncryptedSecret("token-legado-em-claro")).toBe(false);
  });

  it("chave errada falha ao decifrar", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const encrypted = encryptSecret("segredo-importante");
    vi.stubEnv("APP_ENCRYPTION_KEY", OTHER_KEY_BASE64);
    expect(() => decryptSecret(encrypted)).toThrow(SecretDecryptionError);
  });

  it("valor cifrado adulterado falha ao decifrar", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const encrypted = encryptSecret("segredo-importante") as string;
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(tampered)).toThrow(SecretDecryptionError);
  });

  it("sem a chave, cifrar falha de forma explícita e nunca escreve em claro", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("segredo-importante")).toThrow(MissingEncryptionKeyError);
  });

  it("sem a chave, a leitura de valores antigos em claro continua funcionando", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    expect(decryptSecret("token-legado-em-claro")).toBe("token-legado-em-claro");
    expect(maskStoredSecret("token-legado-em-claro")).toBe("token-****laro");
  });

  it("chave inválida (nem base64 de 32 bytes nem hex de 64) falha ao cifrar", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "curta-demais");
    expect(() => encryptSecret("segredo")).toThrow(InvalidEncryptionKeyError);
  });

  it("aceita chave em hexadecimal (64 caracteres)", () => {
    const hexKey = Buffer.from("teste-cifragem-segredos-01234567").toString("hex");
    vi.stubEnv("APP_ENCRYPTION_KEY", hexKey);
    expect(decryptSecret(encryptSecret("segredo-hex"))).toBe("segredo-hex");
  });

  it("null, undefined e string vazia passam como estão", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    expect(encryptSecret(null)).toBe(null);
    expect(encryptSecret(undefined)).toBe(undefined);
    expect(encryptSecret("")).toBe("");
    expect(decryptSecret(null)).toBe(null);
    expect(decryptSecret(undefined)).toBe(undefined);
    expect(decryptSecret("")).toBe("");
  });

  it("mascaramento: cifra e depois mascara igual ao texto claro", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const plaintext = "asaas-token-de-teste-123456";
    expect(maskStoredSecret(plaintext)).toBe("asaas-****3456");
    expect(maskStoredSecret(encryptSecret(plaintext))).toBe("asaas-****3456");
    expect(maskStoredSecret(null)).toBe(null);
  });

  it("mascaramento de valor cifrado sem a chave não expõe fragmento do cifrado", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const encrypted = encryptSecret("segredo-importante");
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    expect(maskStoredSecret(encrypted)).toBe("****");
  });

  it("comparação de segredo armazenado: cifrado, em claro e divergente", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    expect(storedSecretMatches(encryptSecret("webhook-token-abc"), "webhook-token-abc")).toBe(true);
    expect(storedSecretMatches("webhook-token-abc", "webhook-token-abc")).toBe(true);
    expect(storedSecretMatches(encryptSecret("webhook-token-abc"), "outro-token")).toBe(false);
    expect(storedSecretMatches("webhook-token-abc", "outro-token")).toBe(false);
    expect(storedSecretMatches(null, "webhook-token-abc")).toBe(false);
    expect(storedSecretMatches(encryptSecret("webhook-token-abc"), null)).toBe(false);
  });

  it("comparação falha (não vaza) quando a chave está ausente", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const encrypted = encryptSecret("webhook-token-abc");
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    expect(storedSecretMatches(encrypted, "webhook-token-abc")).toBe(false);
  });

  it("hotspot config: cifra só as chaves de segredo e o resto passa intacto", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const config = {
      ssid: "ManosTech",
      radius_secret: "segredo-radius",
      nested: { api_token: "token-aninhado", timeout: 30 },
    };
    const encrypted = encryptConfigSecrets(config) as Record<string, any>;
    expect(encrypted["ssid"]).toBe("ManosTech");
    expect(encrypted["nested"].timeout).toBe(30);
    expect(isEncryptedSecret(encrypted["radius_secret"])).toBe(true);
    expect(isEncryptedSecret(encrypted["nested"].api_token)).toBe(true);
    expect(decryptConfigSecrets(encrypted)).toEqual(config);
  });

  it("hotspot config: valores legados em claro passam como estão na decifragem", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", TEST_KEY_BASE64);
    const config = { ssid: "ManosTech", radius_secret: "segredo-legado" };
    expect(decryptConfigSecrets(config)).toEqual(config);
  });
});
