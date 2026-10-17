import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ExternalLink, Mail, MapPin, MessageSquareText, Phone, RefreshCw, Search, Send, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/hooks/use-access";
import { getPreSales, retryPreSaleTelegram, updatePreSale, type PreSaleRecord } from "@/lib/pre-sales.functions";

export const Route = createFileRoute("/_authenticated/pre-venda")({
  head: () => ({ meta: [{ title: "Pré-venda | Manos Tech" }] }),
  component: PreSalesPage,
});

type PreSaleStatus = "novo" | "em_andamento" | "convertido" | "encerrado";
type PreSale = PreSaleRecord;

const statusLabels: Record<PreSaleStatus, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  convertido: "Convertido",
  encerrado: "Encerrado",
};

const statusStyles: Record<PreSaleStatus, string> = {
  novo: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  em_andamento: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  convertido: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  encerrado: "border-slate-400/20 bg-slate-400/10 text-slate-300",
};

function PreSalesPage() {
  const { data: access } = useAccess();
  const queryClient = useQueryClient();
  const fetchPreSales = useServerFn(getPreSales);
  const saveStatus = useServerFn(updatePreSale);
  const retryTelegram = useServerFn(retryPreSaleTelegram);
  const [search, setSearch] = useState("");

  const preSales = useQuery({
    queryKey: ["pre-sales"],
    queryFn: () => fetchPreSales(),
    enabled: access?.role === "adm",
  });

  useEffect(() => {
    if (preSales.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ["pre-sales-unread-count"] });
    }
  }, [preSales.isSuccess, queryClient]);

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: PreSaleStatus }) => saveStatus({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pre-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["pre-sales-unread-count"] });
    },
  });
  const retryMutation = useMutation({
    mutationFn: (id: string) => retryTelegram({ data: { id } }),
    onSuccess: (result) => {
      if (result.status === "pendente") toast.success("Aviso colocado na fila do Telegram");
      else toast.error(result.error || "Telegram não configurado");
      void queryClient.invalidateQueries({ queryKey: ["pre-sales"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível reenviar."),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return preSales.data ?? [];
    return (preSales.data ?? []).filter((item) =>
      [item.company_name, item.cnpj, item.contact_name, item.email, item.phone, item.city, item.summary]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [preSales.data, search]);

  if (access?.role && access.role !== "adm") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">A caixa de pré-vendas está disponível somente para o administrador.</p>
      </div>
    );
  }

  const newCount = preSales.data?.filter((item) => item.status === "novo").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pré-venda"
        subtitle="Solicitações comerciais recebidas pelo site ManosTech System."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<MessageSquareText className="size-4" />} label="Solicitações" value={String(preSales.data?.length ?? 0)} />
        <SummaryCard icon={<Clock3 className="size-4" />} label="Novas" value={String(newCount)} />
        <SummaryCard icon={<Send className="size-4" />} label="Telegram com falha" value={String(preSales.data?.filter((item) => item.telegram_status === "erro" || item.telegram_status === "nao_configurado").length ?? 0)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, contato ou necessidade" />
        </div>
        <Button variant="outline" onClick={() => void preSales.refetch()} disabled={preSales.isFetching}>
          {preSales.isFetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {preSales.isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando solicitações…</CardContent></Card>
      ) : preSales.isError ? (
        <Card><CardContent className="p-6 text-sm text-destructive">
          {preSales.error instanceof Error ? preSales.error.message : "Não foi possível carregar as pré-vendas."}
          <p className="mt-2 text-xs text-muted-foreground">Se a migration ainda não foi aplicada no banco, aplique a migration create_pre_sales_inbox.</p>
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="grid min-h-48 place-items-center p-6 text-center">
          <div><CheckCircle2 className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">{search ? "Nenhuma solicitação encontrada" : "Nenhuma solicitação recebida ainda"}</p><p className="mt-1 text-sm text-muted-foreground">Quando alguém preencher o formulário do site, os dados aparecerão aqui.</p></div>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {rows.map((item) => <PreSaleCard key={item.id} item={item} onStatusChange={(status) => updateMutation.mutate({ id: item.id, status })} onRetryTelegram={() => retryMutation.mutate(item.id)} saving={updateMutation.isPending && updateMutation.variables?.id === item.id} retrying={retryMutation.isPending && retryMutation.variables === item.id} />)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span></CardContent></Card>;
}

function PreSaleCard({ item, onStatusChange, onRetryTelegram, saving, retrying }: { item: PreSale; onStatusChange: (status: PreSaleStatus) => void; onRetryTelegram: () => void; saving: boolean; retrying: boolean }) {
  const status = item.status as PreSaleStatus;
  const deliveryLabel = item.telegram_status === "enviado" ? "Telegram enviado" : item.telegram_status === "nao_configurado" ? "Telegram não configurado" : item.telegram_status === "pendente" ? "Telegram pendente" : "Falha no Telegram";
  const phoneDigits = item.phone.replace(/\D/g, "");
  const whatsappNumber = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

  return (
    <Card className={item.viewed_at ? "" : "border-cyan-400/25"}>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold">{item.company_name}</h2>
              {!item.viewed_at ? <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Nova</Badge> : null}
              <Badge variant="outline" className={statusStyles[status]}>{statusLabels[status]}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Recebida em {new Date(item.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{item.cnpj ? ` · CNPJ ${item.cnpj}` : ""}</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span className="text-muted-foreground">Acompanhar</span>
            <select
              value={status}
              disabled={saving}
              onChange={(event) => onStatusChange(event.target.value as PreSaleStatus)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
            >
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <ContactDetail icon={<UserRound />} label="Contato" value={item.contact_name} />
          <ContactDetail icon={<Phone />} label="WhatsApp" value={item.phone} href={`https://wa.me/${whatsappNumber}`} />
          <ContactDetail icon={<Mail />} label="E-mail" value={item.email} href={`mailto:${item.email}`} />
          <ContactDetail icon={<MapPin />} label="Cidade" value={item.city || "Não informada"} />
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo do que precisa</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.summary}</p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className={`inline-flex items-center gap-2 ${item.telegram_status === "enviado" ? "text-emerald-400" : "text-amber-300"}`}>
            <Send className="size-3.5" /> {deliveryLabel}{item.telegram_error ? ` · ${item.telegram_error}` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {item.telegram_status !== "enviado" ? (
              <button type="button" disabled={retrying} onClick={onRetryTelegram} className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-60">
                <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} /> {retrying ? "Reenviando…" : "Reenviar Telegram"}
              </button>
            ) : null}
            <a href={`mailto:${item.email}?subject=${encodeURIComponent(`ManosTech System — ${item.company_name}`)}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Responder por e-mail <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactDetail({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href?: string }) {
  const content = <><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span><span className="min-w-0"><span className="block text-[11px] text-muted-foreground">{label}</span><span className="block truncate font-medium">{value}</span></span></>;
  return href ? <a className="flex min-w-0 items-center gap-2 hover:text-primary" href={href} target={href.startsWith("https://") ? "_blank" : undefined} rel={href.startsWith("https://") ? "noreferrer" : undefined}>{content}</a> : <div className="flex min-w-0 items-center gap-2">{content}</div>;
}

