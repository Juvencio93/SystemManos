import { describe, expect, it } from "vitest";
import { calculateStatusCounters, buildGroupedOrganizations, type OperationalOrganization } from "./operational.utils.server";
import type { OperationMetric } from "./operational.functions";

const operation = (overrides: Partial<OperationMetric>): OperationMetric => ({
  companyId: "company-1",
  companyName: "Empresa 1",
  companyTradeName: "Empresa 1",
  companyLegalName: null,
  branchId: null,
  branchName: "Matriz",
  branchTradeName: null,
  branchLegalName: null,
  status: "estavel",
  reason: "",
  operationAgeDays: 30,
  metrics: {
    connections7d: 3,
    connectionsPrev7d: 3,
    variation: 0,
    lastConnection: null,
    activeCampaigns: 0,
    isNew: false,
    phone: null,
  },
  ...overrides,
});

describe("operational analysis helpers", () => {
  it("counts every operational status, mapping stable to the green destaque card", () => {
    const counters = calculateStatusCounters([
      operation({ status: "estavel" }),
      operation({ status: "destaque" }),
      operation({ status: "atencao" }),
      operation({ status: "critico" }),
      operation({ status: "observacao" }),
    ]);

    expect(counters).toMatchObject({
      totalUnits: 5,
      destaque: 2,
      atencao: 1,
      critico: 1,
      observacao: 1,
      estavel: 1,
    });
  });

  it("groups a matrix and its branches under one organization", () => {
    const matrix = operation({ branchId: null, branchName: "Matriz" });
    const branch = operation({ branchId: "branch-1", branchName: "Filial 1" });
    const organizations = buildGroupedOrganizations([matrix, branch]);

    expect(organizations).toHaveLength(1);
    expect(organizations[0]).toMatchObject({
      companyId: "company-1",
      companyName: "Empresa 1",
      branches: [branch],
    } satisfies Partial<OperationalOrganization>);
    expect(organizations[0]?.matrix).toEqual(matrix);
  });
});

