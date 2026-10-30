import { describe, expect, it } from "vitest";
import {
  MFA_VERIFY_MAX_FAILURES_PER_EMAIL_IP,
  MFA_VERIFY_MAX_FAILURES_PER_IP,
  decideMfaStep,
  shouldBlockMfaVerify,
} from "./mfa";

describe("decideMfaStep", () => {
  it("não-ADM nunca passa pelo 2FA", () => {
    expect(decideMfaStep({ isAdm: false, verifiedTotpCount: 0 })).toBe("none");
    expect(decideMfaStep({ isAdm: false, verifiedTotpCount: 2 })).toBe("none");
  });

  it("ADM com fator verificado vai para a verificação", () => {
    expect(decideMfaStep({ isAdm: true, verifiedTotpCount: 1 })).toBe("verify");
    expect(decideMfaStep({ isAdm: true, verifiedTotpCount: 3 })).toBe("verify");
  });

  it("ADM sem fator verificado cai no enrollment obrigatório", () => {
    expect(decideMfaStep({ isAdm: true, verifiedTotpCount: 0 })).toBe("enroll");
  });
});

describe("shouldBlockMfaVerify", () => {
  it("libera abaixo dos limites", () => {
    expect(shouldBlockMfaVerify({ emailIpFailures: 9, ipFailures: 19, ip: "1.2.3.4" })).toBe(false);
  });

  it("bloqueia no limite por e-mail+IP", () => {
    expect(
      shouldBlockMfaVerify({
        emailIpFailures: MFA_VERIFY_MAX_FAILURES_PER_EMAIL_IP,
        ipFailures: 0,
        ip: "1.2.3.4",
      }),
    ).toBe(true);
  });

  it("bloqueia no limite por IP", () => {
    expect(
      shouldBlockMfaVerify({
        emailIpFailures: 0,
        ipFailures: MFA_VERIFY_MAX_FAILURES_PER_IP,
        ip: "1.2.3.4",
      }),
    ).toBe(true);
  });

  it("ignora a contagem por IP quando o IP é desconhecido", () => {
    expect(
      shouldBlockMfaVerify({
        emailIpFailures: 0,
        ipFailures: MFA_VERIFY_MAX_FAILURES_PER_IP,
        ip: "",
      }),
    ).toBe(false);
  });
});
