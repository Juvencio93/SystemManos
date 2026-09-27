import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign, CreditCard, Wallet, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { getCompanyDisplayName } from "@/lib/name-utils";

import type {
  FinanceiroStats,
  Company,
  ChargeWithCompany,
  ExpenseWithDetails,
} from "@/lib/financeiro.types";

interface IndicatorsModalsProps {
  activeModal: string | null;
  onClose: () => void;
  stats: FinanceiroStats | undefined;
}

export function IndicatorsModals({ activeModal, onClose, stats }: IndicatorsModalsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const brl = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // MRR Details
  const activeCompanies = useMemo(() => {
    return (stats?.allCompanies || [])
      .filter((c: Company) => c.subscription_status === "ativa")
      .filter((c: Company) =>
        getCompanyDisplayName(c).toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a: Company, b: Company) =>
        getCompanyDisplayName(a).localeCompare(getCompanyDisplayName(b)),
      );
  }, [stats?.allCompanies, searchTerm]);

  // Receita Acumulada Details (Fonte Única: cobrancasPagasHistorico)
  const paidCharges = useMemo(() => {
    return (stats?.cobrancasPagasHistorico || []).filter((c: ChargeWithCompany) =>
      getCompanyDisplayName(c.companies).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [stats?.cobrancasPagasHistorico, searchTerm]);

  // Investimento Total Details
  const expenses = useMemo(() => {
    return (stats?.expenses || [])
      .filter((e: ExpenseWithDetails) => {
        const name = getCompanyDisplayName(e.companies) || e.description || "";
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort(
        (a: ExpenseWithDetails, b: ExpenseWithDetails) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
  }, [stats?.expenses, searchTerm]);

  const renderSearch = () => (
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        placeholder="Buscar..."
        className="pl-9"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  );

  return (
    <>
      {/* MRR Modal */}
      <Dialog open={activeModal === "mrr"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-500" />
              Detalhamento de MRR
            </DialogTitle>
            <DialogDescription>
              Lista de empresas com assinatura ativa e seu valor mensal recorrente.
            </DialogDescription>
          </DialogHeader>
          {renderSearch()}
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCompanies.map((c: Company) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{getCompanyDisplayName(c)}</TableCell>
                    <TableCell className="text-right">
                      {brl(Number(c.monthly_price || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-right font-bold text-lg text-emerald-500">
            Total MRR: {brl(stats?.mrr || 0)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receita Acumulada Modal */}
      <Dialog open={activeModal === "receita"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-blue-500" />
              Receita Acumulada (Histórico)
            </DialogTitle>
            <DialogDescription>
              Total histórico de todas as cobranças efetivamente pagas.
            </DialogDescription>
          </DialogHeader>
          {renderSearch()}
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Ref/Competência</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paidCharges.map((c: ChargeWithCompany) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {getCompanyDisplayName(c.companies)}
                    </TableCell>
                    <TableCell>
                      {c.paid_at ? new Date(c.paid_at).toLocaleDateString("pt-BR") : "-"}
                    </TableCell>
                    <TableCell>{c.competence}</TableCell>
                    <TableCell className="text-right">{brl(Number(c.amount || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-right font-bold text-lg text-blue-500">
            Total Recebido: {brl(stats?.receitaAcumulada || 0)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Investimento Total Modal */}
      <Dialog open={activeModal === "investimento"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-orange-500" />
              Investimentos de Ativação (Histórico)
            </DialogTitle>
            <DialogDescription>
              Detalhamento de todos os gastos e investimentos históricos registrados.
            </DialogDescription>
          </DialogHeader>
          {renderSearch()}
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição/Empresa</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e: ExpenseWithDetails) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{e.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {getCompanyDisplayName(e.companies)}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{e.category}</TableCell>
                    <TableCell className="text-right">{brl(Number(e.amount || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-right font-bold text-lg text-orange-500">
            Total Investido: {brl(stats?.investimentoTotal || 0)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
