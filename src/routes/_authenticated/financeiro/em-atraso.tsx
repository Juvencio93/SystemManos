import { createFileRoute } from "@tanstack/react-router";
import { getCompanyDisplayName } from "@/lib/name-utils";
import { useQuery } from "@tanstack/react-query";
import { Database } from "@/integrations/supabase/types";
import { getFinanceiroStats } from "@/lib/financeiro.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, Printer, Clock } from "lucide-react";
import { useState } from "react";
import { useAccess } from "@/hooks/use-access";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/financeiro/em-atraso")({
  component: EmAtrasoPage,
});

function EmAtrasoPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: access } = useAccess();

  const statsQuery = useQuery({
    queryKey: ["financial-stats"],
    queryFn: () => getFinanceiroStats(),
  });

  const isReseller = access?.role === "revenda";
  if (access?.role !== "adm" && !isReseller) {
    return <div className="p-6">Acesso restrito.</div>;
  }

  const totals = statsQuery.data ?? {
    receitaAcumulada: 0,
    receitaAcumuladaTotal: 0,
    mrr: 0,
    inadimplencia: 0,
    inadimplentesCount: 0,
    aReceber: 0,
    emAtraso: 0,
    investimentoTotal: 0,
    investimentoTotalHistorico: 0,
    competencia: "",
    emAtrasoList: [],
    aReceberList: [],
  };

  const filteredList = totals.emAtrasoList.filter((c) =>
    getCompanyDisplayName(c.companies).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getGroup = (days: number) => {
    if (days >= 31) return "31+ dias";
    if (days >= 16) return "16-30 dias";
    if (days >= 8) return "8-15 dias";
    return "1-7 dias";
  };

  const grouped = filteredList.reduce(
    (acc: Record<string, (typeof filteredList)[0][]>, curr) => {
      const g = getGroup(curr.days_overdue);
      if (!acc[g]) acc[g] = [];
      acc[g].push(curr);
      return acc;
    },
    {} as Record<string, (typeof filteredList)[0][]>,
  );

  const groups = ["31+ dias", "16-30 dias", "8-15 dias", "1-7 dias"];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Em Atraso</h1>
          <p className="text-muted-foreground">{isReseller ? "Inadimplência das empresas da sua rede." : "Monitoramento detalhado de inadimplência."}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-sm font-medium text-muted-foreground flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
            Total em Atraso
          </div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totals.emAtraso)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {filteredList.length} faturas pendentes
          </div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por empresa..."
          className="pl-10 max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 p-4 border-b border-slate-800 bg-slate-900 font-medium text-sm text-muted-foreground">
              <div>Empresa</div>
              <div>Vencimento</div>
              <div>Atraso</div>
              <div>Valor</div>
              <div className="text-right">Ações</div>
            </div>

            {statsQuery.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 p-4 border-b border-slate-800/50"
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 ml-auto" />
                </div>
              ))}

            {groups.map((group) => {
              const items = grouped[group] || [];
              if (items.length === 0) return null;

              return (
                <div key={group}>
                  <div className="bg-slate-800/30 px-4 py-2 text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center">
                    <Clock className="w-3 h-3 mr-2" />
                    {group} ({items.length})
                  </div>
                  {items.map((c) => {
                    const statusColor = c.days_overdue > 30 ? "text-red-500" : "text-orange-500";

                    return (
                      <div
                        key={c.id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 p-4 border-b border-slate-800/50 items-center hover:bg-white/5 transition-colors group"
                      >
                        <div className="font-medium text-slate-200 truncate">
                          {getCompanyDisplayName(c.companies)}
                        </div>
                        <div className="text-sm text-slate-400">{formatDateBR(c.due_date)}</div>
                        <div className={`text-sm font-semibold ${statusColor}`}>
                          {c.days_overdue} dias
                        </div>
                        <div className="font-semibold text-slate-100">
                          {formatCurrency(c.amount)}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs hover:bg-blue-500/10 hover:text-blue-400"
                            onClick={() => c.invoice_url && window.open(c.invoice_url, "_blank")}
                          >
                            Ver Fatura
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {filteredList.length === 0 && !statsQuery.isLoading && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma inadimplência encontrada.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
