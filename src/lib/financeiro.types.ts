import type { Database } from "@/integrations/supabase/types";

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Charge = Database["public"]["Tables"]["company_charges"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type Branch = Database["public"]["Tables"]["branches"]["Row"];

export interface ChargeWithDetails extends Charge {
  companies: Company | null;
  derivedStatus: "pago" | "atrasado" | "pendente";
  days_overdue: number;
  invoice_url: string | null;
}

export interface ChargeWithCompany extends Charge {
  companies: Company | null;
}

export interface ExpenseWithDetails extends Expense {
  companies: Company | null;
  branches: Branch | null;
}

export interface FinanceiroStats {
  asaasEnabled: boolean;
  faturamento: number;
  receitaAcumulada: number;
  cobrancasPagasHistorico: ChargeWithCompany[];
  investimentoTotal: number;
  lucroReal: number;
  investimentoPeriodo: number;
  aReceber: number;
  aReceberList: ChargeWithDetails[];
  emAtraso: number;
  emAtrasoList: ChargeWithDetails[];
  mrr: number;
  activeClientsCount: number;
  allCompanies: Company[];
  expenses: ExpenseWithDetails[];
  rawCharges: ChargeWithDetails[];
  investimentoTotalEmpresas: number;
  statsByCompany: {
    companyId: string;
    name: string;
    recebido: number;
    investimento: number;
    mrr: number;
  }[];
  resellerCredits: {
    totalReceived: number;
    receivedInPeriod: number;
    creditsSold: number;
    buyerCount: number;
    averageTicket: number;
    latestConfirmedAt: string | null;
    orders: {
      id: string;
      resellerId: string;
      resellerName: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
      confirmedAt: string;
      asaasPaymentId: string | null;
    }[];
  };
}
