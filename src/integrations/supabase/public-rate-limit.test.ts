import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PASSWORD_RESET_RATE_LIMIT_BUCKET,
  PRE_SALE_RATE_LIMIT_BUCKET,
  PUBLIC_RATE_LIMIT_EXCEEDED_MESSAGE,
  PUBLIC_RATE_LIMIT_PER_IP,
  PUBLIC_RATE_WINDOW_SECONDS,
  publicRateLimitBucket,
} from "./public-rate-limit";

const passwordResetSource = readFileSync(
  resolve(process.cwd(), "src/lib/password-reset.functions.ts"),
  "utf8",
);
const preSalesSource = readFileSync(
  resolve(process.cwd(), "src/lib/pre-sales.functions.ts"),
  "utf8",
);

/** Recorta o corpo de um handler exportado (até o próximo `export const`). */
function handlerBody(source: string, exportName: string): string {
  const start = source.indexOf(`export const ${exportName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("export const ", start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

describe("public-rate-limit (constantes)", () => {
  it("usa o mesmo padrão do portal: 10 tentativas por IP por minuto", () => {
    expect(PUBLIC_RATE_LIMIT_PER_IP).toBe(10);
    expect(PUBLIC_RATE_WINDOW_SECONDS).toBe(60);
  });

  it("monta o balde como `<prefixo>:<ip>`", () => {
    expect(publicRateLimitBucket(PASSWORD_RESET_RATE_LIMIT_BUCKET, "203.0.113.7")).toBe(
      "password_reset:203.0.113.7",
    );
    expect(publicRateLimitBucket(PRE_SALE_RATE_LIMIT_BUCKET, "198.51.100.9")).toBe(
      "pre_sale:198.51.100.9",
    );
  });

  it("separa os baldes de reset e de pré-venda", () => {
    expect(PASSWORD_RESET_RATE_LIMIT_BUCKET).not.toBe(PRE_SALE_RATE_LIMIT_BUCKET);
  });

  it("mensagem de bloqueio é amigável em pt-BR, sem detalhe técnico", () => {
    expect(PUBLIC_RATE_LIMIT_EXCEEDED_MESSAGE).toContain("Aguarde um minuto");
    for (const termo of ["rpc", "429", "rate", "limit", "sql", "banco", "erro"]) {
      expect(PUBLIC_RATE_LIMIT_EXCEEDED_MESSAGE.toLowerCase()).not.toContain(termo);
    }
  });
});

describe("public-rate-limit (fiação nos handlers)", () => {
  it("requestPasswordReset consome o limitador do portal antes de ler o perfil", () => {
    const body = handlerBody(passwordResetSource, "requestPasswordReset");
    expect(body).toContain("consume_portal_checkin_rate_limit");
    expect(body).toContain("PASSWORD_RESET_RATE_LIMIT_BUCKET");
    expect(body).toContain("PUBLIC_RATE_LIMIT_PER_IP");
    expect(body).toContain("PUBLIC_RATE_WINDOW_SECONDS");
    expect(body.indexOf("consume_portal_checkin_rate_limit")).toBeLessThan(
      body.indexOf('.from("profiles")'),
    );
  });

  it.each(["submitPreSale", "savePreSalePartial", "completePreSale"])(
    "%s checa o rate limit antes de tocar no banco",
    (exportName) => {
      const body = handlerBody(preSalesSource, exportName);
      expect(body).toContain("checkPreSaleRateLimit(adminDb)");
      expect(body.indexOf("checkPreSaleRateLimit(adminDb)")).toBeLessThan(
        body.indexOf('.from("pre_sales")'),
      );
    },
  );

  it("a pré-venda usa um único balde compartilhado nos três submits", () => {
    expect(preSalesSource).toContain("PRE_SALE_RATE_LIMIT_BUCKET");
    expect(preSalesSource.match(/checkPreSaleRateLimit\(adminDb\)/g)).toHaveLength(3);
  });
});
