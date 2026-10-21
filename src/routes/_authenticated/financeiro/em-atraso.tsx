import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { getCompanyDisplayName } from "@/lib/name-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmManualPayment, getFinanceiroStats } from "@/lib/financeiro.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, Printer, Clock, CircleDollarSign, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useAccess } from "@/hooks/use-access";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateBR } from "@/lib/utils";
import defaultLogo from "@/assets/manos-tech-logo-institutional.png";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import type { ChargeWithDetails, FinanceiroStats } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_authenticated/financeiro/em-atraso")({
  component: EmAtrasoPage,
});

function EmAtrasoPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: access } = useAccess();
  const [selectedCharge, setSelectedCharge] = useState<ChargeWithDetails | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observation, setObservation] = useState("");
  const getStatsFn = useServerFn(getFinanceiroStats);
  const confirmPaymentFn = useServerFn(confirmManualPayment);

  const statsQuery = useQuery({
    queryKey: ["financeiro-stats", access?.companyId, access?.role, "todas-em-aberto"],
    enabled: access?.role === "adm" || access?.role === "revenda",
    queryFn: () => getStatsFn({ data: { period: "todas-em-aberto" } }),
  });

  const isReseller = access?.role === "revenda";
  const canManageReceivables = access?.role === "adm" || isReseller;
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedCharge) throw new Error("Selecione uma cobrança para dar baixa.");
      return confirmPaymentFn({
        data: {
          chargeId: selectedCharge.id,
          amount: Number(selectedCharge.amount),
          paidAt: new Date(`${paymentDate}T12:00:00`).toISOString(),
          observation,
        },
      });
    },
    onSuccess: () => {
      toast.success("Recebimento registrado. A cobrança foi baixada.");
      void queryClient.invalidateQueries({ queryKey: ["financeiro-stats"] });
      setConfirmDialogOpen(false);
      setSelectedCharge(null);
      setObservation("");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível dar baixa na cobrança."),
  });

  const openConfirmDialog = (charge: ChargeWithDetails) => {
    setSelectedCharge(charge);
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setObservation("");
    setConfirmDialogOpen(true);
  };

  if (access?.role !== "adm" && !isReseller) {
    return <div className="p-6">Acesso restrito.</div>;
  }

  if (statsQuery.isError) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 size-12 text-destructive" />
          <h2 className="mb-2 text-xl font-bold text-destructive">
            Não foi possível carregar a inadimplência
          </h2>
          <p className="mb-4 text-muted-foreground">
            O sistema não conseguiu consultar as cobranças agora. Tente novamente.
          </p>
          <Button onClick={() => void statsQuery.refetch()} disabled={statsQuery.isFetching}>
            {statsQuery.isFetching ? "Carregando..." : "Tentar novamente"}
          </Button>
        </div>
      </div>
    );
  }

  const totals = (statsQuery.data as FinanceiroStats | undefined) ?? {
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto print-report print:p-0 print:max-w-none">
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Relatório de Inadimplência
            </h1>
            <p className="text-sm text-slate-500">
              Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · {filteredList.length}{" "}
              cobranças em atraso
            </p>
          </div>
          <img
            src={access?.platformLogoRelatorios || access?.platformLogo || defaultLogo}
            alt="Manos Tech"
            className="h-12 max-w-[180px] object-contain"
          />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-500">Total em atraso</span>
          <span className="text-2xl font-black text-red-600">
            {formatCurrency(totals.emAtraso)}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <RouterLink to="/financeiro">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </RouterLink>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Em Atraso</h1>
            <p className="text-muted-foreground">
              {isReseller
                ? "Inadimplência das empresas da sua rede."
                : "Monitoramento detalhado de inadimplência."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-sm font-medium text-muted-foreground flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
            Total em Atraso
          </div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totals.emAtraso)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {filteredList.length} cobranças em atraso
          </div>
        </Card>
      </div>

      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por empresa..."
          className="pl-10 max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-slate-800 bg-slate-900/50 backdrop-blur-sm print:bg-white print:border-slate-300 print:shadow-none">
        <div className="overflow-x-auto">
          <div className="min-w-[800px] print:min-w-0">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 p-4 border-b border-slate-800 bg-slate-900 font-medium text-sm text-muted-foreground print:text-slate-100">
              <div>Empresa</div>
              <div>Vencimento</div>
              <div>Atraso</div>
              <div>Valor</div>
              <div className="text-right print:hidden">Ações</div>
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
                  <div className="bg-slate-800/30 px-4 py-2 text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center print:bg-slate-100 print:text-slate-600">
                    <Clock className="w-3 h-3 mr-2" />
                    {group} ({items.length})
                  </div>
                  {items.map((c) => {
                    const statusColor = c.days_overdue > 30 ? "text-red-500" : "text-orange-500";

                    return (
                      <div
                        key={c.id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] gap-4 p-4 border-b border-slate-800/50 items-center hover:bg-white/5 transition-colors group print:border-slate-200"
                      >
                        <div className="font-medium text-slate-200 truncate print:text-slate-900 print:whitespace-normal">
                          {getCompanyDisplayName(c.companies)}
                        </div>
                        <div className="text-sm text-slate-400 print:text-slate-600">{formatDateBR(c.due_date)}</div>
                        <div className={`text-sm font-semibold ${statusColor}`}>
                          {c.days_overdue} dias
                        </div>
                        <div className="font-semibold text-slate-100 print:text-slate-900">
                          {formatCurrency(c.amount)}
                        </div>
                        <div className="flex justify-end gap-2 print:hidden">
                          {canManageReceivables && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                              onClick={() => openConfirmDialog(c)}
                              disabled={confirmMutation.isPending && selectedCharge?.id === c.id}
                            >
                              <CircleDollarSign className="mr-1 size-3.5" />
                              Recebido
                            </Button>
                          )}
                          {c.invoice_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs hover:bg-blue-500/10 hover:text-blue-400"
                              onClick={() => window.open(c.invoice_url!, "_blank")}
                            >
                              Ver Fatura
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {filteredList.length === 0 && !statsQuery.isLoading && !statsQuery.isError && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma inadimplência encontrada.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
            <DialogDescription>
              Confirme o pagamento integral da cobrança de{" "}
              {getCompanyDisplayName(selectedCharge?.companies ?? null)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="received-amount">Valor da cobrança</Label>
              <Input
                id="received-amount"
                value={selectedCharge ? formatCurrency(Number(selectedCharge.amount)) : ""}
                disabled
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="received-date">Data do recebimento</Label>
              <Input
                id="received-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="received-notes">Observação</Label>
              <Textarea
                id="received-notes"
                placeholder="Ex.: recebido via PIX"
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || !paymentDate}
            >
              {confirmMutation.isPending ? "Registrando..." : "Confirmar recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

