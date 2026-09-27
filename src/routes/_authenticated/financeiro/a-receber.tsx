import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search, Clock, AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAccess } from "@/hooks/use-access";
import { formatDateBR } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceiroStats, confirmManualPayment } from "@/lib/financeiro.functions";
import { getOrGeneratePix } from "@/lib/asaas.functions";
import { getCompanyDisplayName } from "@/lib/name-utils";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format } from "date-fns";
import { toast } from "sonner";
import type { FinanceiroStats, ChargeWithCompany } from "@/lib/financeiro.types";

export const Route = createFileRoute("/_authenticated/financeiro/a-receber")({
  head: () => ({
    meta: [{ title: "A Receber | Manos Tech" }],
  }),
  component: AReceberPage,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ChargeRow = ChargeWithCompany & { derivedStatus?: "pago" | "atrasado" | "pendente" };

function AReceberPage() {
  const queryClient = useQueryClient();
  const { data: access, isLoading: accessLoading } = useAccess();
  const [period, setPeriod] = useState("este-mes");
  const [searchTerm, setSearchTerm] = useState("");
  const isAdm = access?.role === "adm";
  const isMatriz = access?.role === "matriz";
  const isReseller = access?.role === "revenda";
  const canManageReceivables = isAdm || isReseller;

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<ChargeRow | null>(null);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [observation, setObservation] = useState("");
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode?: string; copyPaste?: string } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  const getStatsFn = useServerFn(getFinanceiroStats);
  const confirmPaymentFn = useServerFn(confirmManualPayment);
  const generatePixFn = useServerFn(getOrGeneratePix);

  const statsQuery = useQuery({
    queryKey: ["financeiro-stats", access?.companyId, access?.role, period],
    enabled: !!access && (isAdm || isMatriz || isReseller),
    queryFn: () =>
      getStatsFn({
        data: { companyId: isMatriz && access?.companyId ? access.companyId : null, period },
      }),
  });

  const confirmMutation = useMutation({
    mutationFn: (data: {
      chargeId: string;
      amount: number;
      paidAt: string;
      observation?: string;
    }) => confirmPaymentFn({ data }),
    onSuccess: () => {
      toast.success("Pagamento confirmado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["financeiro-stats"] });
      setConfirmModalOpen(false);
      setSelectedCharge(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao confirmar pagamento");
    },
  });

  if (statsQuery.isError) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="bg-destructive/10 p-6 rounded-lg border border-destructive/20 text-center">
          <Clock className="size-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-destructive mb-2">
            Erro ao carregar dados financeiros
          </h2>
          <p className="text-muted-foreground mb-4">
            Não foi possível recuperar a lista de recebíveis no momento.
          </p>
          <Button onClick={() => statsQuery.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (accessLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!isAdm && !isMatriz && !isReseller) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Acesso restrito</h2>
          <p className="text-muted-foreground">Esta área é exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  const totals = (statsQuery.data as FinanceiroStats) ?? {
    aReceber: 0,
    aReceberList: [],
    emAtraso: 0,
    emAtrasoList: [],
  };

  const filteredList: ChargeRow[] = (
    [...(totals.aReceberList || []), ...(totals.emAtrasoList || [])] as ChargeRow[]
  )
    .filter((c) =>
      getCompanyDisplayName(c.companies).toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (a.derivedStatus === "atrasado" && b.derivedStatus !== "atrasado") return -1;
      if (a.derivedStatus !== "atrasado" && b.derivedStatus === "atrasado") return 1;
      return a.due_date.localeCompare(b.due_date);
    });

  const handleOpenConfirm = (charge: ChargeRow) => {
    setSelectedCharge(charge);
    setPaymentAmount(Number(charge.amount));
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setObservation("");
    setConfirmModalOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedCharge) return;
    confirmMutation.mutate({
      chargeId: selectedCharge.id,
      amount: paymentAmount,
      paidAt: new Date(paymentDate + "T12:00:00").toISOString(),
      observation,
    });
  };

  const asaasEnabled = statsQuery.data?.asaasEnabled;

  const handlePayPix = async (charge: ChargeRow) => {
    if (!asaasEnabled) return;
    setSelectedCharge(charge);
    setPixLoading(true);
    setPixModalOpen(true);
    try {
      const result = await generatePixFn({ data: { chargeId: charge.id } });
      if (!result.success) {
        const res = result as { code?: string; message?: string };
        if (res.code === "ASAAS_NOT_CONFIGURED") {
          toast.error(res.message || "Asaas não configurado");
        } else {
          toast.error(res.message || "Erro ao gerar PIX");
        }
        setPixModalOpen(false);
        return;
      }
      setPixData(result as { qrCode?: string; copyPaste?: string });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro na comunicação com o servidor";
      toast.error(message);
      setPixModalOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="flex items-center gap-4">
        <RouterLink to="/financeiro">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </RouterLink>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-warning">A Receber</h1>
          <p className="text-muted-foreground">Cobranças futuras e previsão de caixa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm border-l-4 border-l-warning">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total a Receber
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h2 className="text-2xl font-bold text-warning">
              {brl(Number(totals.aReceber || 0) + Number(totals.emAtraso || 0))}
            </h2>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-rose-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total em Atraso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h2 className="text-2xl font-bold text-rose-500">{brl(totals.emAtraso || 0)}</h2>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quantidade Total
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h2 className="text-2xl font-bold">
              {(totals.aReceberList?.length || 0) + (totals.emAtrasoList?.length || 0)} cobranças
            </h2>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-semibold">Previsão de Recebimento</h3>
          <div className="flex w-full sm:w-auto gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="este-mes">Este mês</SelectItem>
                <SelectItem value="proximo-mes">Próximo mês</SelectItem>
                <SelectItem value="7-dias">Próximos 7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-border/50">
          <Table className="min-w-[800px] hidden sm:table">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Cliente / Empresa</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Dias Restantes</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {canManageReceivables && <TableHead className="w-[100px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </TableCell>
                    {canManageReceivables && <TableCell></TableCell>}
                  </TableRow>
                ))
              ) : filteredList.length > 0 ? (
                filteredList.map((c) => {
                  const daysLeft = differenceInDays(new Date(c.due_date), new Date());
                  const isAtrasado = c.derivedStatus === "atrasado";
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium truncate max-w-[150px]">
                          {getCompanyDisplayName(c.companies)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {c.reference}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={isAtrasado ? "text-rose-500 font-medium" : ""}>
                          {formatDateBR(c.due_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isAtrasado ? "destructive" : "secondary"}
                          className="flex items-center gap-1 w-fit text-[10px]"
                        >
                          {isAtrasado ? (
                            <>
                              <AlertCircle className="size-3" />
                              Vencida há {Math.abs(daysLeft)} dias
                            </>
                          ) : (
                            <>
                              <Clock className="size-3" />
                              {daysLeft} dias
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.competence}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${isAtrasado ? "text-rose-500" : "text-warning"}`}
                      >
                        {brl(Number(c.amount))}
                      </TableCell>
                      {(canManageReceivables || (isMatriz && asaasEnabled)) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {(isMatriz || isReseller) && asaasEnabled && (
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs px-2"
                                onClick={() => handlePayPix(c)}
                              >
                                PIX
                              </Button>
                            )}
                            {canManageReceivables && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs px-2"
                                onClick={() => handleOpenConfirm(c)}
                                disabled={confirmMutation.isPending && selectedCharge?.id === c.id}
                              >
                                {confirmMutation.isPending && selectedCharge?.id === c.id
                                  ? "..."
                                  : "OK"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={canManageReceivables ? 6 : 5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhuma cobrança futura encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Mobile View */}
          <div className="sm:hidden flex flex-col divide-y divide-border">
            {filteredList.map((c) => {
              const daysLeft = differenceInDays(new Date(c.due_date), new Date());
              const isAtrasado = c.derivedStatus === "atrasado";
              return (
                <div key={c.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm truncate">
                      {getCompanyDisplayName(c.companies)}
                    </span>
                    <span className={`font-bold ${isAtrasado ? "text-rose-500" : "text-warning"}`}>
                      {brl(Number(c.amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Vencimento: {formatDateBR(c.due_date)}</span>
                    <span>Ref: {c.competence}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <Badge
                      variant={isAtrasado ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {isAtrasado ? `Vencida (${Math.abs(daysLeft)}d)` : `${daysLeft} dias`}
                    </Badge>
                    <div className="flex gap-1">
                      {(isMatriz || isReseller) && asaasEnabled && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-[10px] px-2"
                          onClick={() => handlePayPix(c)}
                        >
                          PIX
                        </Button>
                      )}
                      {canManageReceivables && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] px-2"
                          onClick={() => handleOpenConfirm(c)}
                        >
                          Confirmar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredList.length === 0 && !statsQuery.isLoading && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma cobrança encontrada.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
            <DialogDescription>
              Registre o pagamento manual para a empresa {selectedCharge?.companies?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor Recebido</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Data de Recebimento</Label>
              <Input
                id="date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">Forma de Pagamento</Label>
              <Input id="method" value="Manual" disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Observação</Label>
              <Textarea
                id="notes"
                placeholder="Ex: Recebido via PIX, TED, etc."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code ou copie a chave para realizar o pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 gap-6">
            {pixLoading ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="size-8 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">Gerando PIX...</p>
              </div>
            ) : pixData?.qrCode ? (
              <>
                <div className="bg-white p-4 rounded-xl shadow-inner border">
                  <img
                          loading="lazy"
                          decoding="async"
                    src={`data:image/png;base64,${pixData.qrCode}`}
                    alt="QR Code PIX"
                    className="size-48"
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={pixData.copyPaste || ""} className="font-mono text-xs" />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (pixData.copyPaste) {
                          navigator.clipboard.writeText(pixData.copyPaste);
                          toast.success("Código copiado!");
                        }
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-destructive">Erro ao carregar dados do PIX.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPixModalOpen(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
