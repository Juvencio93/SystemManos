import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Router, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getPortals, type PortalItem } from "@/lib/portals.functions";
import { HotspotConfigDialog } from "@/components/app/hotspot-config-dialog";
import { useServerFn } from "@tanstack/react-start";
import { getMikrotikActivationDownload } from "@/lib/hotspot-config.functions";
import { useAccess } from "@/hooks/use-access";

export const Route = createFileRoute("/_authenticated/hotspot")({
  head: () => ({ meta: [{ title: "Hotspot | Manos Tech" }] }),
  component: HotspotPage,
});

function HotspotPage() {
  const { data: access } = useAccess();
  const canManageHotspot = access?.role === "adm" || access?.role === "revenda";
  const getActivation = useServerFn(getMikrotikActivationDownload);
  const fetchPortals = useServerFn(getPortals);
  const portalsQuery = useQuery({ queryKey: ["hotspot-portals"], enabled: canManageHotspot, queryFn: () => fetchPortals() });
  const portalItems = (portalsQuery.data?.items ?? []) as PortalItem[];
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const clientsQuery = useQuery({ queryKey: ["hotspot-approved-clients", access?.role, access?.resellerId, access?.companyId, access?.branchId], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => {
    let query = (supabase as any).from("hotspot_devices").select("id,router_identity,ap_mac,status,company_id,branch_id,updated_at,last_seen_at,last_seen_ip,router_version,active_sessions,rx_bytes,tx_bytes,sync_requested_at,sync_applied_at");
    if (access?.role === "revenda" && access.resellerId) {
      const [{ data: companies }, { data: branches }] = await Promise.all([
        (supabase as any).from("companies").select("id").eq("reseller_id", access.resellerId),
        (supabase as any).from("branches").select("id").eq("reseller_id", access.resellerId),
      ]);
      const companyIds = (companies ?? []).map((row: any) => row.id);
      const branchIds = (branches ?? []).map((row: any) => row.id);
      if (!companyIds.length && !branchIds.length) return [];
      const filters = [...(companyIds.length ? [`company_id.in.(${companyIds.join(",")})`] : []), ...(branchIds.length ? [`branch_id.in.(${branchIds.join(",")})`] : [])];
      query = query.or(filters.join(","));
    } else if (access?.role === "matriz" && access.companyId) query = query.eq("company_id", access.companyId);
    else if (access?.role === "filial" && access.branchId) query = query.eq("branch_id", access.branchId);
    const { data, error } = await query.order("last_seen_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as any[];
  }});
  const auditQuery = useQuery({ queryKey: ["hotspot-audit"], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => {
    const { data, error } = await (supabase as any).from("hotspot_device_audit").select("id,device_id,action,previous_status,new_status,created_at").order("created_at", { ascending: false }).limit(20);
    if (error) throw error; return (data ?? []) as any[];
  }});
  const healthQuery = useQuery({ queryKey: ["hotspot-health"], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => { const response = await fetch("/api/internal/hotspot-health"); if (!response.ok) throw new Error("Falha no diagnóstico"); return response.json() as Promise<{ radiusConfigured: boolean; heartbeatConfigured: boolean; reason: string; checkedAt: string }>; } });
  const filesQuery = useQuery({ queryKey: ["hotspot-files"], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => (await fetch("/api/internal/hotspot-files")).json() as Promise<{ files: { path: string; available: boolean }[]; publishedAt: string | null }> });
  const clients = clientsQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFrom, setAuditFrom] = useState(""); const [auditTo, setAuditTo] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const isOnline = (lastSeen?: string) => Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 15 * 60 * 1000);
  const filteredClients = clients.reduce<any[]>((items, client) => {
    const text = `${client.router_identity ?? ""} ${client.ap_mac ?? ""}`.toLowerCase();
    if (text.includes(search.toLowerCase()) && (statusFilter === "all" || client.status === statusFilter)) items.push(client);
    return items;
  }, []);
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / 10));
  const offlineCount = clients.reduce((count, client) => count + (isOnline(client.last_seen_at) ? 0 : 1), 0);
  const activeSessions = clients.reduce((sum, c) => sum + Number(c.active_sessions ?? 0), 0);
  const trafficBytes = clients.reduce((sum, c) => sum + Number(c.rx_bytes ?? 0) + Number(c.tx_bytes ?? 0), 0);
  const auditItems = (auditQuery.data ?? []).reduce<any[]>((items, item) => { const t = new Date(item.created_at).getTime(); if (`${item.action} ${item.device_id}`.toLowerCase().includes(auditSearch.toLowerCase()) && (!auditFrom || t >= new Date(auditFrom).getTime()) && (!auditTo || t <= new Date(`${auditTo}T23:59:59`).getTime())) items.push(item); return items; }, []);
  const formatBytes = (n: number) => n > 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(1)} GB` : `${(n / 1_000_000).toFixed(1)} MB`;
  const filesCheckedAt = filesQuery.data?.publishedAt ? new Date(filesQuery.data.publishedAt).toLocaleString("pt-BR") : "Data da última publicação indisponível";
  const visible = useMemo(() => filteredClients.slice((page - 1) * 10, page * 10), [filteredClients, page]);
  const statusLabel = (s: string) => s === "operational" ? "Homologado" : s === "blocked" ? "Bloqueado" : "Pendente";
  const statusClass = (s: string) => s === "operational" ? "border-emerald-400/40 text-emerald-300" : s === "blocked" ? "border-red-400/40 text-red-300" : "border-amber-400/40 text-amber-300";
  if (access && !canManageHotspot) {
    return <div className="container max-w-3xl py-10"><Card className="border-amber-400/30"><CardContent className="p-6"><PageHeader title="Acesso restrito" description="O gerenciamento de equipamentos, homologação e arquivos Hotspot é exclusivo para administradores e revendas." /></CardContent></Card></div>;
  }
  async function changeStatus(status: string) {
    if (!selected) return;
    await (supabase as any).from("hotspot_devices").update({ status, updated_at: new Date().toISOString() }).eq("id", selected.id);
    const { data: authData } = await supabase.auth.getUser();
    await (supabase as any).from("hotspot_device_audit").insert({ device_id: selected.id, action: status === "operational" ? "activate_homologation" : status === "blocked" ? "block_device" : "cancel_homologation", previous_status: selected.status, new_status: status, actor_id: authData.user?.id ?? null });
    await clientsQuery.refetch();
    setSelected(null);
  }
  async function downloadActivation(client: any) {
    const path = await getActivation({ data: { kind: client.branch_id ? "branch" : "company", targetId: client.branch_id ?? client.company_id, fileKind: "activation" } });
    window.location.href = path;
  }
  async function downloadHeartbeat(client: any) {
    const path = await getActivation({ data: { kind: client.branch_id ? "branch" : "company", targetId: client.branch_id ?? client.company_id, fileKind: "heartbeat" } });
    window.location.href = path;
  }
  async function requestSync(client: any) {
    const response = await fetch("/api/internal/hotspot-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ routerIdentity: client.router_identity }) });
    setSyncMessage(response.ok ? `Sincronização solicitada para ${client.router_identity}.` : "Não foi possível solicitar a sincronização.");
    await clientsQuery.refetch();
  }
  function exportCsv() {
    const header = "Identidade,MAC,Status,IP,RouterOS,Última comunicação\n";
    const rows = filteredClients.map((c) => [c.router_identity, c.ap_mac, statusLabel(c.status), c.last_seen_ip, c.router_version, c.last_seen_at].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "hotspot-dispositivos.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function exportAuditCsv() {
    const csv = "Ação,Dispositivo,Status anterior,Novo status,Data\n" + auditItems.map((i) => [i.action, i.device_id, i.previous_status, i.new_status, i.created_at].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "hotspot-auditoria.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <PageHeader title="Hotspot" description="Manuais e arquivos oficiais para instalação e atualização das RBs." />
      <div className="-mt-2 grid gap-3 sm:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Dispositivos cadastrados</p><p className="mt-1 text-2xl font-bold">{clients.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Homologados</p><p className="mt-1 text-2xl font-bold text-emerald-400">{clients.reduce((n, c) => n + (c.status === "operational" ? 1 : 0), 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bloqueados</p><p className="mt-1 text-2xl font-bold text-red-400">{clients.reduce((n, c) => n + (c.status === "blocked" ? 1 : 0), 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sessões ativas</p><p className="mt-1 text-2xl font-bold">{activeSessions}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tráfego total</p><p className="mt-1 text-2xl font-bold">{formatBytes(trafficBytes)}</p></CardContent></Card>
      </div>
      <Card className="border-primary/20"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span className="font-semibold">Diagnóstico da integração</span><span className={healthQuery.data?.radiusConfigured && healthQuery.data?.heartbeatConfigured ? "text-emerald-400" : "text-amber-300"}>{healthQuery.isLoading ? "Verificando…" : healthQuery.data?.reason ?? "Não foi possível verificar"}</span></CardContent></Card>
      <Card className="border-primary/20"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span className="font-semibold">Arquivos publicados</span><span className={filesQuery.data?.files.every((file) => file.available) ? "text-emerald-400" : "text-amber-300"}>{filesQuery.isLoading ? "Validando…" : filesQuery.data?.files.every((file) => file.available) ? "Todos disponíveis" : "Há arquivos indisponíveis"}</span></CardContent></Card>
      <Card className="glass-panel border-primary/20"><CardHeader><CardTitle>Cadastro e políticas das RBs</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{portalItems.map((item) => item.kind === "Evento" ? null : <div key={item.id} className="rounded-lg border border-border p-3"><p className="font-medium">{item.name}</p><p className="mb-3 text-xs text-muted-foreground">Política RADIUS e homologação do Hotspot</p><HotspotConfigDialog kind={item.kind === "Sede" ? "company" : "branch"} targetId={item.id} unitName={item.name} portalSlug={item.slug} baseUrl={typeof window !== "undefined" ? window.location.origin : ""} /></div>)}</CardContent></Card>
      <Card className="glass-panel border-primary/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" /> Kit de instalação MikroTik</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">Use os arquivos abaixo em todas as RBs. A plataforma identifica cada equipamento pela identidade exclusiva do RouterOS.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"><p className="font-semibold text-primary">Arquivos atualizados</p><p className="text-muted-foreground">{filesCheckedAt}</p></div>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"><p className="font-semibold text-primary">Manual atualizado</p><p className="text-muted-foreground">{filesCheckedAt}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><a href="/mikrotik/MANOS-HOTSPOT-BASE.rsc" download><Download className="size-4" /> Kit-base .rsc</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/login.html" download><Download className="size-4" /> login.html</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/alogin.html" download><Download className="size-4" /> alogin.html</a></Button>
            <Button variant="outline" asChild><a href="/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf" target="_blank" rel="noreferrer"><BookOpen className="size-4" /> Abrir manual</a></Button>
          </div>
        </CardContent>
      </Card>
      <Card className="glass-panel border-primary/20"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Histórico recente</CardTitle><Button variant="outline" size="sm" onClick={exportAuditCsv}>Exportar histórico</Button></CardHeader><CardContent className="space-y-2"><Input placeholder="Filtrar histórico por ação ou dispositivo" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} /><div className="flex gap-2"><Input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} /><Input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} /></div>{auditItems.map((item) => <div key={item.id} className="flex items-center justify-between rounded border border-border p-2 text-xs"><span>{item.action} · dispositivo {String(item.device_id).slice(0, 8)}</span><span className="text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span></div>)}{!auditItems.length && <p className="text-sm text-muted-foreground">Nenhuma ação encontrada.</p>}</CardContent></Card>
      {offlineCount > 0 && <Card className="border-amber-400/30 bg-amber-400/5"><CardContent className="p-4 text-sm"><p className="font-semibold text-amber-300">Atenção operacional</p><p className="text-muted-foreground">{offlineCount} dispositivo(s) não enviaram heartbeat nos últimos 15 minutos. Verifique a conexão da RB e o RADIUS.</p></CardContent></Card>}
      {syncMessage && <Card className="border-primary/30 bg-primary/5"><CardContent className="p-4 text-sm text-primary">{syncMessage}</CardContent></Card>}
      <Card className="glass-panel border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" /> Clientes ativos homologados</CardTitle><Button variant="outline" size="sm" disabled={clientsQuery.isFetching || auditQuery.isFetching || healthQuery.isFetching || filesQuery.isFetching} onClick={async () => { await Promise.all([clientsQuery.refetch(), auditQuery.refetch(), healthQuery.refetch(), filesQuery.refetch()]); setSyncMessage(`Dados atualizados às ${new Date().toLocaleTimeString("pt-BR")}.`); }}> {clientsQuery.isFetching || auditQuery.isFetching ? "Atualizando..." : "Atualizar dados"}</Button></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row"><Input placeholder="Buscar por identidade ou MAC" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><select className="rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="all">Todos os status</option><option value="operational">Homologados</option><option value="awaiting_homologation">Pendentes</option><option value="blocked">Bloqueados</option></select><Button variant="outline" onClick={exportCsv}>Exportar CSV</Button></div>
          {visible.map((client) => <div key={client.id} className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 p-3"><button onClick={() => setSelected(client)} className="min-w-0 text-left hover:text-primary"><span className="font-medium">{client.router_identity ?? "RB sem identidade"}</span><span className="ml-3 text-xs text-muted-foreground">MAC: {client.ap_mac ?? "não informado"}</span><span className="mt-1 block text-xs text-muted-foreground"><span className={isOnline(client.last_seen_at) ? "font-semibold text-emerald-300" : "text-muted-foreground"}>{isOnline(client.last_seen_at) ? "● Online" : "○ Offline"}</span> · última comunicação: {client.last_seen_at ? new Date(client.last_seen_at).toLocaleString("pt-BR") : "nunca"} · IP: {client.last_seen_ip ?? "—"} · RouterOS: {client.router_version ?? "—"}{client.sync_requested_at && !client.sync_applied_at ? " · sincronização pendente" : ""}</span></button><div className="flex items-center gap-2"><Badge variant="outline" className={statusClass(client.status)}>{statusLabel(client.status)}</Badge><Button size="sm" variant="outline" onClick={() => void downloadActivation(client)}>Ativação</Button><Button size="sm" variant="outline" onClick={() => void downloadHeartbeat(client)}>Heartbeat</Button><Button size="sm" variant="outline" onClick={() => void requestSync(client)}>Sincronizar</Button></div></div>)}
          {!clients.length && <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado.</p>}
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div></div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.router_identity}</DialogTitle></DialogHeader><div className="space-y-3 text-sm"><p>MAC: <strong>{selected?.ap_mac ?? "não informado"}</strong></p><p>IP: <strong>{selected?.last_seen_ip ?? "não informado"}</strong></p><p>RouterOS: <strong>{selected?.router_version ?? "não informado"}</strong></p><p>Última comunicação: <strong>{selected?.last_seen_at ? new Date(selected.last_seen_at).toLocaleString("pt-BR") : "nunca"}</strong></p><p>Conexão: <Badge variant="outline" className={isOnline(selected?.last_seen_at) ? "border-emerald-400/40 text-emerald-300" : "border-red-400/40 text-red-300"}>{isOnline(selected?.last_seen_at) ? "Online" : "Offline"}</Badge></p><p>Status atual: <Badge variant="outline" className={statusClass(selected?.status)}>{selected && statusLabel(selected.status)}</Badge></p><div className="flex flex-wrap gap-2"><Button onClick={() => changeStatus("operational")}>Ativar homologação</Button><Button variant="outline" onClick={() => changeStatus("awaiting_homologation")}>Cancelar homologação</Button><Button variant="destructive" onClick={() => changeStatus("blocked")}>Bloquear dispositivo</Button></div></div></DialogContent></Dialog>
    </div>
  );
}
