import { describe, expect, it } from "vitest";
import {
  extractClientIp,
  LOGIN_MAX_FAILURES_PER_EMAIL_IP,
  LOGIN_MAX_FAILURES_PER_IP,
  shouldBlockLogin,
} from "./login-rate-limit";

describe("extractClientIp", () => {
  it("usa a ÚLTIMA entrada do X-Forwarded-For (a do proxy de borda, não forjável)", () => {
    const h = new Headers({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.4",
    });
    expect(extractClientIp(h)).toBe("150.172.238.4");
  });

  it("com entrada única, usa ela mesma", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(extractClientIp(h)).toBe("203.0.113.7");
  });

  it("cai para X-Real-IP quando não há X-Forwarded-For", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.9" });
    expect(extractClientIp(h)).toBe("198.51.100.9");
  });

  it("cai para CF-Connecting-IP como último recurso", () => {
    const h = new Headers({ "cf-connecting-ip": "192.0.2.44" });
    expect(extractClientIp(h)).toBe("192.0.2.44");
  });

  it('retorna "" sem cabeçalhos de IP', () => {
    expect(extractClientIp(new Headers())).toBe("");
  });
});

describe("shouldBlockLogin", () => {
  it("libera abaixo dos limites", () => {
    expect(
      shouldBlockLogin({
        emailIpFailures: LOGIN_MAX_FAILURES_PER_EMAIL_IP - 1,
        ipFailures: LOGIN_MAX_FAILURES_PER_IP - 1,
        ip: "203.0.113.7",
      }),
    ).toBe(false);
  });

  it("bloqueia no limite por e-mail+IP", () => {
    expect(
      shouldBlockLogin({
        emailIpFailures: LOGIN_MAX_FAILURES_PER_EMAIL_IP,
        ipFailures: 0,
        ip: "203.0.113.7",
      }),
    ).toBe(true);
  });

  it("bloqueia no limite por IP (qualquer e-mail)", () => {
    expect(
      shouldBlockLogin({
        emailIpFailures: 0,
        ipFailures: LOGIN_MAX_FAILURES_PER_IP,
        ip: "203.0.113.7",
      }),
    ).toBe(true);
  });

  it("ignora o limite por IP quando o IP é desconhecido", () => {
    expect(shouldBlockLogin({ emailIpFailures: 0, ipFailures: 9999, ip: "" })).toBe(false);
  });
});
