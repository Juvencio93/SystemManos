import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_FAILED_MESSAGE,
  TURNSTILE_REQUIRED_MESSAGE,
  assertTurnstileToken,
  verifyTurnstileToken,
} from "./turnstile.server";

function fetchJson(data: unknown) {
  return vi.fn(async () => ({ json: async () => data }));
}

describe("turnstile.server", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ignora a verificação (fail-open) sem TURNSTILE_SECRET_KEY e não chama a Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = fetchJson({ success: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyTurnstileToken("qualquer-token");

    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifica o token na API da Cloudflare com secret + response", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "segredo-de-teste");
    const fetchMock = fetchJson({ success: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyTurnstileToken("token-do-widget", "203.0.113.10");

    expect(result).toEqual({ ok: true, skipped: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("secret")).toBe("segredo-de-teste");
    expect(body.get("response")).toBe("token-do-widget");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  it("recusa com mensagem amigável quando o token está ausente", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "segredo-de-teste");
    vi.stubGlobal("fetch", fetchJson({ success: true }));

    await expect(assertTurnstileToken(undefined)).rejects.toThrow(TURNSTILE_REQUIRED_MESSAGE);
    await expect(assertTurnstileToken("")).rejects.toThrow(TURNSTILE_REQUIRED_MESSAGE);
  });

  it("recusa com mensagem amigável quando a Cloudflare rejeita o token", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "segredo-de-teste");
    vi.stubGlobal("fetch", fetchJson({ success: false, "error-codes": ["timeout-or-duplicate"] }));

    await expect(assertTurnstileToken("token-reutilizado")).rejects.toThrow(
      TURNSTILE_FAILED_MESSAGE,
    );
  });

  it("segue (fail-open) quando a API da Cloudflare não responde", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "segredo-de-teste");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("rede fora");
    }));

    const result = await verifyTurnstileToken("token-do-widget");

    expect(result).toEqual({ ok: true, skipped: true });
  });
});
