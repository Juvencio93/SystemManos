import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getFinanceiroStats } from "@/lib/financeiro.functions";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanyDisplayName } from "@/lib/name-utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { useAccess } from "@/hooks/use-access";

export const Route = createFileRoute("/_authenticated/financeiro/faturamento")({
  component: FaturamentoPage,
});

function FaturamentoPage() {
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

  const brl = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturamento</h1>
        <p className="text-muted-foreground">{isReseller ? "Faturamento das empresas da sua rede." : "Visão geral de recebíveis e faturamento."}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-900">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead>Empresa</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsQuery.isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-800/50">
                      <TableCell>
                        <Skeleton className="h-5 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                : [...totals.aReceberList, ...totals.emAtrasoList]
                    .filter((c) =>
                      getCompanyDisplayName(c.companies)
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()),
                    )
                    .map((c) => (
                      <TableRow
                        key={c.id}
                        className="border-slate-800/50 hover:bg-white/5 transition-colors"
                      >
                        <TableCell className="font-medium text-slate-200">
                          {getCompanyDisplayName(c.companies)}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {new Date(c.due_date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-slate-400">{c.competence}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "pago"
                                ? "default"
                                : c.status === "atrasado"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              c.status === "pago"
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : c.status === "atrasado"
                                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                                  : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                            }
                          >
                            {c.status === "pago"
                              ? "Pago"
                              : c.status === "atrasado"
                                ? "Atrasado"
                                : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-100">
                          {brl(Number(c.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
