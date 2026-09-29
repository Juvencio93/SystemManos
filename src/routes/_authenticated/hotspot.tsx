import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Router, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/hotspot")({
  head: () => ({ meta: [{ title: "Hotspot | Manos Tech" }] }),
  component: HotspotPage,
});

function HotspotPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const clientsQuery = useQuery({ queryKey: ["hotspot-approved-clients"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("hotspot_devices").select("id,router_identity,ap_mac,status,company_id,branch_id,updated_at").order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  }});
  const clients = clientsQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(clients.length / 10));
  const visible = useMemo(() => clients.slice((page - 1) * 10, page * 10), [clients, page]);
  const statusLabel = (s: string) => s === "operational" ? "Homologado" : s === "blocked" ? "Bloqueado" : "Pendente";
  const statusClass = (s: string) => s === "operational" ? "border-emerald-400/40 text-emerald-300" : s === "blocked" ? "border-red-400/40 text-red-300" : "border-amber-400/40 text-amber-300";
  async function changeStatus(status: string) {
    if (!selected) return;
    await (supabase as any).from("hotspot_devices").update({ status, updated_at: new Date().toISOString() }).eq("id", selected.id);
    await clientsQuery.refetch();
    setSelected(null);
  }
  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <PageHeader title="Hotspot" description="Manuais e arquivos oficiais para instalação e atualização das RBs." />
      <Card className="glass-panel border-primary/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" /> Kit de instalação MikroTik</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">Use os arquivos abaixo em todas as RBs. A plataforma identifica cada equipamento pela identidade exclusiva do RouterOS.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"><p className="font-semibold text-primary">Arquivos atualizados</p><p className="text-muted-foreground">29/09/2026 às 09:00</p></div>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"><p className="font-semibold text-primary">Manual atualizado</p><p className="text-muted-foreground">29/09/2026 às 09:00</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><a href="/mikrotik/MANOS-HOTSPOT-BASE.rsc" download><Download className="size-4" /> Kit-base .rsc</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/MANOS-HOTSPOT-ACTIVATION.rsc" download><Download className="size-4" /> Ativação RADIUS .rsc</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/login.html" download><Download className="size-4" /> login.html</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/alogin.html" download><Download className="size-4" /> alogin.html</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf" target="_blank" rel="noreferrer"><BookOpen className="size-4" /> Abrir manual</a></Button>
          </div>
        </CardContent>
      </Card>
      <Card className="glass-panel border-primary/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" /> Clientes ativos homologados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {visible.map((client) => <button key={client.id} onClick={() => setSelected(client)} className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 p-3 text-left hover:border-primary/50"><span><span className="font-medium">{client.router_identity ?? "RB sem identidade"}</span><span className="ml-3 text-xs text-muted-foreground">MAC: {client.ap_mac ?? "não informado"}</span></span><Badge variant="outline" className={statusClass(client.status)}>{statusLabel(client.status)}</Badge></button>)}
          {!clients.length && <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado.</p>}
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div></div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.router_identity}</DialogTitle></DialogHeader><div className="space-y-4 text-sm"><p>MAC do dispositivo: <strong>{selected?.ap_mac ?? "não informado"}</strong></p><p>Status atual: <Badge variant="outline" className={statusClass(selected?.status)}>{selected && statusLabel(selected.status)}</Badge></p><div className="flex flex-wrap gap-2"><Button onClick={() => changeStatus("operational")}>Ativar homologação</Button><Button variant="outline" onClick={() => changeStatus("awaiting_homologation")}>Cancelar homologação</Button><Button variant="destructive" onClick={() => changeStatus("blocked")}>Bloquear dispositivo</Button></div></div></DialogContent></Dialog>
    </div>
  );
}
