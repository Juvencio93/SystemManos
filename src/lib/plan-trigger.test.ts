import { describe, expect, it } from "vitest";
import {
  MAX_FREE_ACTIVE_COMPANIES,
  MAX_FREE_EGRESS_BYTES_PER_MONTH,
  MAX_FREE_STORAGE_BYTES,
  buildPlanTriggerStatus,
  formatPlanBytes,
} from "./plan-trigger";

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

describe("formatPlanBytes", () => {
  it("formata GB com 1 casa em pt-BR", () => {
    expect(formatPlanBytes(3.5 * GB)).toBe("3,5 GB");
    expect(formatPlanBytes(MAX_FREE_EGRESS_BYTES_PER_MONTH)).toBe("3,5 GB");
  });

  it("formata MB e KB como a quota por empresa", () => {
    expect(formatPlanBytes(700 * MB)).toBe("700,0 MB");
    expect(formatPlanBytes(850 * 1024)).toBe("850 KB");
  });
});

describe("buildPlanTriggerStatus", () => {
  const base = { totalStorageBytes: 126 * MB, activeCompanies: 3 };

  it("tudo dentro do limite: sem gatilho", () => {
    const status = buildPlanTriggerStatus(base);
    expect(status.storage.state).toBe("ok");
    expect(status.companies.state).toBe("ok");
    expect(status.anyTriggered).toBe(false);
    expect(status.storage.hint).toBe("Faltam 574,0 MB para o gatilho.");
    expect(status.companies.hint).toBe("Faltam 37 para o gatilho.");
  });

  it("a partir de 80% do teto fica perto", () => {
    const status = buildPlanTriggerStatus({
      totalStorageBytes: 560 * MB,
      activeCompanies: 32,
    });
    expect(status.storage.state).toBe("near");
    expect(status.companies.state).toBe("near");
    expect(status.anyTriggered).toBe(false);
  });

  it("abaixo de 80% fica dentro do limite", () => {
    const status = buildPlanTriggerStatus({
      totalStorageBytes: 559 * MB,
      activeCompanies: 31,
    });
    expect(status.storage.state).toBe("ok");
    expect(status.companies.state).toBe("ok");
  });

  it("exatamente no teto ainda é só perto — o gatilho é maior que", () => {
    const status = buildPlanTriggerStatus({
      totalStorageBytes: MAX_FREE_STORAGE_BYTES,
      activeCompanies: MAX_FREE_ACTIVE_COMPANIES,
    });
    expect(status.storage.state).toBe("near");
    expect(status.companies.state).toBe("near");
    expect(status.anyTriggered).toBe(false);
  });

  it("acima do teto dispara o gatilho", () => {
    const status = buildPlanTriggerStatus({
      totalStorageBytes: MAX_FREE_STORAGE_BYTES + 1,
      activeCompanies: MAX_FREE_ACTIVE_COMPANIES + 1,
    });
    expect(status.storage.state).toBe("triggered");
    expect(status.companies.state).toBe("triggered");
    expect(status.anyTriggered).toBe(true);
    expect(status.storage.hint).toBe("Acima do gatilho — hora de migrar para o Pro.");
  });

  it("sem medição fica sem medição — nunca passa falsa segurança", () => {
    const status = buildPlanTriggerStatus({
      totalStorageBytes: null,
      activeCompanies: null,
    });
    expect(status.storage.state).toBe("unknown");
    expect(status.storage.valueText).toBeNull();
    expect(status.storage.percent).toBeNull();
    expect(status.companies.state).toBe("unknown");
    expect(status.anyTriggered).toBe(false);
  });

  it("egress é sempre manual — nenhum número inventado", () => {
    const status = buildPlanTriggerStatus(base);
    expect(status.egress.state).toBe("manual");
    expect(status.egress.valueText).toBeNull();
    expect(status.egress.percent).toBeNull();
    expect(status.egress.limitText).toBe("3,5 GB");
    expect(status.egress.hint).toContain("página de Uso do Supabase");
  });
});
