import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bot,
  CalendarClock,
  CreditCard,
  FileText,
  QrCode,
  Store,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { getStatusInfo, formatDateBR, getDiffDaysBR, getTodayBR } from "@/lib/utils";

import { useServerFn } from "@tanstack/react-start";
import { getOrGeneratePix, cancelMatrizPayment } from "@/lib/asaas.functions";
import { ensureCurrentCharge, getCurrentMatrizCharge } from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Minha Assinatura | Manos Tech Plataforma de Marketing Inteligente" },
      {
        name: "description",
        content:
          "Plano contratado, mensalidade, vencimento, histórico de pagamentos e recibos da sua assinatura Manos Tech.",
      },
      {
        property: "og:title",
        content: "Minha Assinatura | Manos Tech Plataforma de Marketing Inteligente",
      },
      {
        property: "og:description",
        content:
          "Plano contratado, mensalidade, vencimento, histórico de pagamentos e recibos da sua assinatura Manos Tech.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscriptionPage,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  if (value instanceof Date) {
    return formatDateBR(value.toISOString().split("T")[0]);
  }
  return formatDateBR(value);
};

const SUBSCRIPTION_LABEL: Record<string, string> = {
  ativa: "Ativa",
  pendente: "Pendente",
  inadimplente: "Pendente",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

const CHARGE_LABEL: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Em atraso",
  cancelado: "Cancelado",
};

function nextDueDate(dueDay: number | null) {
  if (!dueDay) return null;
  const today = getTodayBR();
  const day = Math.min(Math.max(dueDay, 1), 28);
  let due = new Date(today.getFullYear(), today.getMonth(), day);
  if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, day);

  const dueStr = `${due.getFullYear()}-${(due.getMonth() + 1).toString().padStart(2, "0")}-${due.getDate().toString().padStart(2, "0")}`;
  return { date: dueStr, days: getDiffDaysBR(dueStr) };
}

type Charge = {
  id: string;
  reference: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  method: string | null;
  receipt_code: string;
};

function openReceipt(chargeId: string) {
  const win = window.open(
    `/financeiro/recibo/${chargeId}`,
    "_blank",
    "width=850,height=900,menubar=no,toolbar=no,location=no,status=no",
  );
  if (!win) {
    toast.error("Permita pop-ups para visualizar o recibo.");
  }
}

function SubscriptionPage() {
  const { data: access } = useAccess();
  const isAdm = access?.role === "adm";
  const isMatriz = access?.role === "matriz";
  const companyId = access?.companyId ?? null;

  const company = useQuery({
    queryKey: ["my-subscription-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "id, name, trade_name, document, plan_name, monthly_price, activation_limit, subscription_status, due_day, blocked, created_at",
        )
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const branches = useQuery({
    queryKey: ["my-subscription-branches", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, city, state, active, is_headquarters")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const charges = useQuery({
    queryKey: ["my-subscription-charges", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_charges")
        .select(
          "id, reference, amount, due_date, status, paid_at, method, receipt_code, asaas_pix_qr_code, asaas_pix_copy_paste",
        )
        .eq("company_id", companyId!)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Charge & {
        asaas_pix_qr_code?: string;
        asaas_pix_copy_paste?: string;
      })[];
    },
  });

  const fetchCurrentCharge = useServerFn(getCurrentMatrizCharge);
  const currentMatrizCharge = useQuery({
    queryKey: ["current-matriz-charge"],
    enabled: isMatriz,
    queryFn: () => fetchCurrentCharge(),
  });

  const [pixDialog, setPixDialog] = useState<{
    open: boolean;
    chargeId: string | null;
    qrCode: string | null;
    copyPaste: string | null;
  }>({
    open: false,
    chargeId: null,
    qrCode: null,
    copyPaste: null,
  });
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const generatePixFn = useServerFn(getOrGeneratePix);
  const cancelPaymentFn = useServerFn(cancelMatrizPayment);
  const ensureChargeFn = useServerFn(ensureCurrentCharge);

  // Efeito para garantir a cobrança atual (apenas criação idempotente)
  useState(() => {
    if (companyId) {
      ensureCurrentCharge({ data: { companyId } })
        .then(() => {
          charges.refetch();
        })
        .catch((err) => {
          console.error("[SubscriptionInit] Erro:", err);
        });
    }
  });

  const handleOpenPix = async (chargeId: string, isProjected = false) => {
    setIsGeneratingPix(true);
    setPixDialog({ open: true, chargeId, qrCode: null, copyPaste: null });

    try {
      // Se for projetada, precisamos primeiro garantir que ela existe no banco
      // O getOrGeneratePix já deve lidar com IDs de empresa para criar se necessário,
      // mas vamos manter o padrão do financeiro.tsx
      const result = await generatePixFn({ data: { chargeId } });
      if (!result.success) {
        toast.error(result.message || "Não foi possível gerar o código PIX");
        setPixDialog({ open: false, chargeId: null, qrCode: null, copyPaste: null });
        return;
      }
      setPixDialog((prev) => ({ ...prev, qrCode: result.qrCode, copyPaste: result.copyPaste }));
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!pixDialog.chargeId) return;
    try {
      await cancelPaymentFn({ data: { chargeId: pixDialog.chargeId } });
      toast.success("Pagamento cancelado.");
      setPixDialog({ open: false, chargeId: null, qrCode: null, copyPaste: null });
      await charges.refetch();
      await currentMatrizCharge.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o pagamento.");
    }
  };

  const summary = useMemo(() => {
    const c = company.data;
    const list = branches.data ?? [];
    const activeBranches = list.filter((b) => b.active && !b.is_headquarters).length;
    const operations = activeBranches + 1;

    const realCharges = charges.data ?? [];
    const pending = currentMatrizCharge.data ?? null;

    // REGRA DE OURO: A fonte de verdade para valores e vencimentos é a cobrança real pendente.
    const monthly = pending ? Number(pending.amount) : Number(c?.monthly_price ?? 0);

    const due = pending
      ? {
          date: pending.due_date,
          days: getDiffDaysBR(pending.due_date),
        }
      : nextDueDate(c?.due_day ?? null);

    const paid = realCharges.filter((ch) => ch.status === "pago");
    return { activeBranches, operations, monthly, due, pending, paid };
  }, [company.data, branches.data, charges.data, currentMatrizCharge.data]);

  if (!isMatriz) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <PageHeader title="Minha Assinatura" subtitle="Área restrita." />
        <Card className="glass-panel max-w-md">
          <CardContent className="py-10 text-muted-foreground">
            <Info className="mx-auto mb-4 size-10 opacity-20" />
            <p className="text-sm">Esta área é exclusiva para gestores da matriz.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const c = company.data;
  const statusLabel = c?.blocked
    ? "Suspensa"
    : (SUBSCRIPTION_LABEL[c?.subscription_status ?? "ativa"] ?? "Ativa");
  const inOrder = !c?.blocked && !summary.pending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha Assinatura"
        subtitle="Plano contratado, mensalidade, vencimento, pagamentos e recibos."
      />

      {company.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <Card className="glass-panel border-primary/30">
          <CardContent className="flex flex-wrap items-end justify-between gap-6 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Plano contratado
              </p>
              <h2 className="font-display text-2xl font-semibold">
                Plano {c?.plan_name ?? "Essencial"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.operations} de {c?.activation_limit ?? 1}{" "}
                {Number(c?.activation_limit ?? 1) === 1 ? "operação" : "operações"} em uso
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "mt-3 border-primary/30",
                  inOrder
                    ? "text-primary"
                    : summary.pending &&
                        getStatusInfo(summary.pending.status, summary.pending.due_date).label ===
                          "Pagamento em atraso"
                      ? "border-destructive/50 text-destructive bg-destructive/10"
                      : "border-amber-500/50 text-amber-600 bg-amber-500/10",
                )}
              >
                {inOrder ? (
                  <>
                    <Check className="mr-1 size-3 text-green-500" /> Assinatura ativa
                  </>
                ) : (
                  <>
                    {c?.blocked
                      ? `⚠️ Assinatura ${statusLabel.toLowerCase()}`
                      : summary.pending
                        ? getStatusInfo(summary.pending.status, summary.pending.due_date).label
                        : "Pagamento pendente"}
                  </>
                )}
              </Badge>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-semibold">{brl(summary.monthly)}</p>
              <p className="text-xs text-muted-foreground">por mês</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Próximo vencimento:{" "}
                <span className="text-foreground">{formatDateBR(summary.due?.date || null)}</span>
                {summary.due
                  ? ` (${summary.due.days === 0 ? "hoje" : summary.due.days === 1 ? "amanhã" : summary.due.days > 1 ? `${summary.due.days} dias` : `${Math.abs(summary.due.days)} dias atrás`})`
                  : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className={cn(
            "glass-panel border-l-4 transition-all duration-300",
            summary.pending &&
              getStatusInfo(summary.pending.status, summary.pending.due_date).label ===
                "Pagamento em atraso"
              ? "border-l-destructive shadow-lg shadow-destructive/10"
              : summary.due && summary.due.days <= 7 && summary.due.days >= 0
                ? "border-l-amber-500 shadow-lg shadow-amber-500/10"
                : summary.pending
                  ? "border-l-green-500 shadow-lg shadow-green-500/5"
                  : "border-l-primary/30",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="size-4 text-primary" /> Pagamento atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary.pending ? (
              <>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{summary.pending.reference}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Vencimento: {dateBR(summary.pending.due_date)}</span>
                    {summary.due !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 text-[10px]",
                          getStatusInfo(summary.pending.status, summary.pending.due_date).color,
                        )}
                      >
                        {getStatusInfo(summary.pending.status, summary.pending.due_date).label}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="font-display text-2xl font-semibold">
                  {brl(Number(summary.pending.amount))}
                </p>

                <Button
                  className={cn(
                    "w-full transition-all duration-300",
                    summary.due && summary.due.days <= 0
                      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground ring-2 ring-destructive/20 ring-offset-2"
                      : summary.due && summary.due.days <= 2
                        ? "bg-orange-600 hover:bg-orange-700 text-white"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground",
                  )}
                  onClick={() => handleOpenPix(summary.pending!.id)}
                  disabled={isGeneratingPix}
                >
                  {isGeneratingPix ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-2 size-4" />
                  )}
                  Pagar agora via PIX
                </Button>

                {summary.due !== null && summary.due.days <= 7 && (
                  <div
                    className={cn(
                      "flex gap-2 rounded-lg border p-2.5 text-[11px] leading-tight transition-all duration-300",
                      getStatusInfo(summary.pending.status, summary.pending.due_date).color,
                    )}
                  >
                    <AlertTriangle
                      className={cn("size-3.5 shrink-0", summary.due.days <= 0 && "animate-pulse")}
                    />
                    <p>
                      {summary.due.days < 0
                        ? "Atenção: sua mensalidade está em atraso."
                        : summary.due.days === 0
                          ? `Sua mensalidade vence hoje, no valor de ${brl(Number(summary.pending.amount))}. O não pagamento até o fim do dia poderá impactar o acesso ao sistema.`
                          : summary.due.days >= 1 && summary.due.days <= 7
                            ? `Sua mensalidade vence em ${summary.due.days} ${summary.due.days === 1 ? "dia" : "dias"}, no valor de ${brl(Number(summary.pending.amount))}.`
                            : `Sua assinatura está em dia. Vencimento em ${formatDateBR(summary.pending.due_date)}.`}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Check className="mb-2 size-8 text-green-500 opacity-20" />
                <p className="text-muted-foreground text-xs uppercase tracking-wider">
                  Assinatura em dia
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={pixDialog.open}
        onOpenChange={(open) => !open && setPixDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
            <DialogDescription>
              Utilize o QR Code ou o código Copia e Cola para realizar o pagamento da sua
              mensalidade.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            {isGeneratingPix ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando cobrança no Asaas...</p>
              </div>
            ) : pixDialog.qrCode ? (
              <>
                <div className="overflow-hidden rounded-xl border-4 border-white bg-white p-2 shadow-sm">
                  <img
                          loading="lazy"
                          decoding="async"
                    src={`data:image/png;base64,${pixDialog.qrCode}`}
                    alt="QR Code PIX"
                    className="size-48"
                  />
                </div>
                <div className="w-full space-y-2">
                  <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                    Código Copia e Cola
                  </p>
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
                    <code className="min-w-0 flex-1 max-h-20 overflow-y-auto break-all whitespace-normal text-[10px] leading-4">{pixDialog.copyPaste}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        navigator.clipboard.writeText(pixDialog.copyPaste ?? "");
                        toast.success("Código copiado!");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-destructive">
                <AlertTriangle className="size-8" />
                <p className="text-sm">Erro ao carregar dados de pagamento.</p>
              </div>
            )}
          </div>
          <div className="flex justify-center border-t pt-4">
            {pixDialog.qrCode && (
              <Button variant="destructive" size="sm" className="mr-3" onClick={handleCancelPayment}>
                Cancelar pagamento
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground">
              O pagamento é processado instantaneamente pelo Asaas.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-primary" /> Histórico de pagamentos e recibos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recibo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(charges.data ?? []).map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell>{dateBR(charge.due_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{charge.reference}</TableCell>
                  <TableCell>{brl(Number(charge.amount))}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        getStatusInfo(charge.status, charge.due_date).colorHistory ||
                          getStatusInfo(charge.status, charge.due_date).color,
                      )}
                    >
                      {getStatusInfo(charge.status, charge.due_date).labelHistory ||
                        getStatusInfo(charge.status, charge.due_date).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {charge.status === "pago" ? (
                      <Button size="sm" variant="ghost" onClick={() => openReceipt(charge.id)}>
                        <FileText className="size-4" /> Baixar recibo
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!charges.isLoading && (charges.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma cobrança registrada ainda.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {Number(c?.activation_limit ?? 1) > 1 && (
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filiais vinculadas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            {(branches.data ?? [])
              .filter((b) => !b.is_headquarters)
              .map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span>
                    {b.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[b.city, b.state].filter(Boolean).join(" / ")}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className={b.active ? "border-primary/50 text-primary" : ""}
                  >
                    {b.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              ))}
            {(branches.data ?? []).filter((b) => !b.is_headquarters).length === 0 ? (
              <p className="text-muted-foreground text-xs italic">Nenhuma filial cadastrada.</p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
