import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Router, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
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
import { HotspotNetworkMap } from "@/components/app/hotspot-network-map";
import { hotspotActionError, postHotspotAction } from "@/lib/hotspot-client";
import { hotspotEventLabel } from "@/lib/hotspot-events";
import { MikrotikPreflight } from "@/components/app/mikrotik-preflight";
import { MikrotikPostflight } from "@/components/app/mikrotik-postflight";

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
  const clientsQuery = useQuery({ queryKey: ["hotspot-approved-clients", access?.role, access?.resellerId, access?.companyId, access?.branchId], enabled: canManageHotspot, refetchInterval: 5000, queryFn: async () => {
    let query = (supabase as any).from("hotspot_devices").select("id,router_identity,ap_mac,status,company_id,branch_id,updated_at,last_seen_at,last_seen_ip,last_seen_uptime,router_version,active_sessions,rx_bytes,tx_bytes,latency_ms,packet_loss_pct,sync_requested_at,sync_applied_at,reboot_requested_at,reboot_applied_at,router_applied_status,router_status_applied_at,latitude,longitude,maps_url,companies(name,trade_name,address,neighborhood,city,state,zip_code),branches(name,trade_name,address,neighborhood,city,state,zip_code)");
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
    return (data ?? []).map((device: any) => {
      const unit = device.branches ?? device.companies ?? {};
      return {
        ...device,
        unit_name: unit.trade_name ?? unit.name ?? device.router_identity,
        address: unit.address ?? null,
        neighborhood: unit.neighborhood ?? null,
        city: unit.city ?? null,
        location_state: unit.state ?? null,
        zip_code: unit.zip_code ?? null,
      };
    }) as any[];
  }});
  const auditQuery = useQuery({ queryKey: ["hotspot-audit"], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => {
    const { data, error } = await (supabase as any).from("hotspot_device_audit").select("id,device_id,action,previous_status,new_status,created_at").order("created_at", { ascending: false }).limit(20);
    if (error) throw error; return (data ?? []) as any[];
  }});
  const healthQuery = useQuery({ queryKey: ["hotspot-health"], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => { const response = await fetch("/api/internal/hotspot-health"); if (!response.ok) throw new Error("Falha no diagnóstico"); return response.json() as Promise<{ radiusConfigured: boolean; heartbeatConfigured: boolean; reason: string; checkedAt: string }>; } });
  const filesQuery = useQuery({ queryKey: ["hotspot-files"], enabled: canManageHotspot, refetchInterval: 60000, queryFn: async () => (await fetch("/api/internal/hotspot-files")).json() as Promise<{ files: { path: string; available: boolean }[]; kitUpdatedAt: string | null; manualUpdatedAt: string | null }> });
  const clients = clientsQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFrom, setAuditFrom] = useState(""); const [auditTo, setAuditTo] = useState("");
  const [cleaningAudit, setCleaningAudit] = useState(false);
  const [auditCleanupMessage, setAuditCleanupMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [expandedKitCard, setExpandedKitCard] = useState<"files" | "manual" | null>(null);
  const [expandedSection, setExpandedSection] = useState<"kit" | "audit" | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [heartbeatSeconds, setHeartbeatSeconds] = useState(5);
  useEffect(() => { const timer = window.setInterval(() => setHeartbeatSeconds((v) => v <= 1 ? 5 : v - 1), 1000); return () => window.clearInterval(timer); }, []);
  const isOnline = (lastSeen?: string) =>
    Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 15_000);
  const filteredClients = clients.reduce<any[]>((items, client) => {
    const text = `${client.router_identity ?? ""} ${client.ap_mac ?? ""}`.toLowerCase();
    if (text.includes(search.toLowerCase()) && (statusFilter === "all" || client.status === statusFilter)) items.push(client);
    return items;
  }, []);
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / 10));
  const offlineCount = clients.reduce((count, client) => count + (isOnline(client.last_seen_at) ? 0 : 1), 0);
  const activeSessions = clients.reduce((sum, c) => sum + Number(c.active_sessions ?? 0), 0);
  const trafficBytes = clients.reduce((sum, c) => sum + Number(c.rx_bytes ?? 0) + Number(c.tx_bytes ?? 0), 0);
  const auditItems = (auditQuery.data ?? []).reduce<any[]>((items, item) => { const t = new Date(item.created_at).getTime(); if (`${hotspotEventLabel(item.action)} ${item.action} ${item.device_id}`.toLowerCase().includes(auditSearch.toLowerCase()) && (!auditFrom || t >= new Date(auditFrom).getTime()) && (!auditTo || t <= new Date(`${auditTo}T23:59:59`).getTime())) items.push(item); return items; }, []);
  const formatBytes = (n: number) => n > 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(1)} GB` : `${(n / 1_000_000).toFixed(1)} MB`;
  const formatReleaseDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Data da última atualização indisponível";
  const kitUpdatedAt = formatReleaseDate(filesQuery.data?.kitUpdatedAt);
  const manualUpdatedAt = formatReleaseDate(filesQuery.data?.manualUpdatedAt);
  const visible = useMemo(() => filteredClients.slice((page - 1) * 10, page * 10), [filteredClients, page]);
  const statusLabel = (s: string) => s === "operational" ? "Homologado" : s === "blocked" ? "Bloqueado" : "Pendente";
  const statusClass = (s: string) => s === "operational" ? "border-emerald-400/40 text-emerald-300" : s === "blocked" ? "border-red-400/40 text-red-300" : "border-amber-400/40 text-amber-300";
  const syncProgress = (client: any) => {
    if (!client.sync_requested_at) return "";
    const requested = Date.parse(client.sync_requested_at);
    const applied = client.sync_applied_at ? Date.parse(client.sync_applied_at) : 0;
    if (applied >= requested) return " · sincronização confirmada pela RB";
    if (Date.now() - requested >= 3 * 60_000) return " · falhou: RB não confirmou a sincronização";
    return " · aguardando confirmação da RB";
  };
  if (access && !canManageHotspot) {
    return <div className="container max-w-3xl py-10"><Card className="border-amber-400/30"><CardContent className="p-6"><PageHeader title="Acesso restrito" subtitle="O gerenciamento de equipamentos, homologação e arquivos Hotspot é exclusivo para administradores e revendas." /></CardContent></Card></div>;
  }
    async function changeStatus(status: string) {
      if (!selected) return;
      const response = await postHotspotAction("/api/internal/hotspot-device-status", { routerIdentity: selected.router_identity, blocked: status === "blocked" });
      const actionError = await hotspotActionError(response, "Não foi possível alterar o bloqueio.");
      if (actionError) { window.alert(actionError); return; }
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
      const response = await postHotspotAction("/api/internal/hotspot-sync", { routerIdentity: client.router_identity });
      setSyncMessage(response.ok ? `Sincronização solicitada para ${client.router_identity}.` : "Não foi possível solicitar a sincronização.");
      await clientsQuery.refetch();
    }
    async function requestReboot(client: any) {
      if (!window.confirm(`Confirmar reinicialização da RB ${client.router_identity}? A conexão ficará indisponível por alguns minutos.`)) return;
      const response = await postHotspotAction("/api/internal/hotspot-reboot", { routerIdentity: client.router_identity });
      const actionError = await hotspotActionError(response, "Não foi possível solicitar a reinicialização.");
      if (actionError) { setSyncMessage(actionError); return; }
      setSyncMessage(`Reinício solicitado para ${client.router_identity}; aguardando execução e retorno da RB.`);
      await clientsQuery.refetch();
      setSelected(null);
  }
  function exportCsv() {
    const header = "Identidade,MAC,Status,IP,RouterOS,Última comunicação\n";
    const rows = filteredClients.map((c) => [c.router_identity, c.ap_mac, statusLabel(c.status), c.last_seen_ip, c.router_version, c.last_seen_at].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "hotspot-dispositivos.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function exportAuditCsv() {
    const csv = "Ação,Dispositivo,Status anterior,Novo status,Data\n" + auditItems.map((i) => [hotspotEventLabel(i.action), i.device_id, i.previous_status, i.new_status, i.created_at].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "hotspot-auditoria.csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function cleanOldAudit() {
    if (!window.confirm("Apagar permanentemente os registros de auditoria com mais de 30 dias? Os registros recentes serão mantidos.")) return;
    setCleaningAudit(true);
    setAuditCleanupMessage("");
    try {
      const response = await postHotspotAction("/api/internal/hotspot-audit-cleanup", {});
      const actionError = await hotspotActionError(response, "Não foi possível limpar o histórico.");
      if (actionError) { setAuditCleanupMessage(actionError); return; }
      const result = await response.json() as { deleted: number };
      await auditQuery.refetch();
      setAuditCleanupMessage(result.deleted === 0
        ? "Nenhum registro com mais de 30 dias para apagar."
        : `${result.deleted} registro${result.deleted === 1 ? "" : "s"} antigo${result.deleted === 1 ? "" : "s"} apagado${result.deleted === 1 ? "" : "s"} do banco.`);
    } catch (error) {
      setAuditCleanupMessage(error instanceof Error ? error.message : "Não foi possível limpar o histórico.");
    } finally {
      setCleaningAudit(false);
    }
  }
  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <PageHeader title="Hotspot" subtitle="Manuais e arquivos oficiais para instalação e atualização das RBs." />
        <HotspotNetworkMap devices={clients} isLoading={clientsQuery.isLoading} onBlock={async (device, blocked) => { const response = await postHotspotAction("/api/internal/hotspot-device-status", { routerIdentity: device.router_identity, blocked }); const actionError = await hotspotActionError(response, "Não foi possível alterar o bloqueio."); if (actionError) { setSyncMessage(actionError); return; } await clientsQuery.refetch(); }} onReboot={requestReboot} />
      <div className="-mt-2 grid gap-3 sm:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Dispositivos cadastrados</p><p className="mt-1 text-2xl font-bold">{clients.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Homologados</p><p className="mt-1 text-2xl font-bold text-emerald-400">{clients.reduce((n, c) => n + (c.status === "operational" ? 1 : 0), 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bloqueados</p><p className="mt-1 text-2xl font-bold text-red-400">{clients.reduce((n, c) => n + (c.status === "blocked" ? 1 : 0), 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sessões ativas</p><p className="mt-1 text-2xl font-bold">{activeSessions}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tráfego total</p><p className="mt-1 text-2xl font-bold">{formatBytes(trafficBytes)}</p></CardContent></Card>
      </div>
      <Card className="hidden overflow-hidden border-primary/20 bg-[#071017]">
        <CardHeader className="gap-3 border-b border-white/5">
          <div><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" /> Mapa da rede</CardTitle><p className="mt-1 text-xs text-muted-foreground">Visão operacional das RBs cadastradas</p></div>
          <div className="flex flex-wrap items-center gap-2"><Input className="min-w-[220px] flex-1" placeholder="Buscar RB ou MAC" value={search} onChange={(e) => setSearch(e.target.value)} /><Button size="sm" variant="outline" onClick={() => setMapZoom(1)}>Centralizar</Button><Button size="sm" variant="outline" onClick={() => setMapZoom((v) => Math.min(1.4, v + .1))}>Zoom +</Button><span className="text-xs text-muted-foreground">Heartbeat em {heartbeatSeconds}s</span></div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-emerald-400" />Online {clients.filter((c) => isOnline(c.last_seen_at)).length}</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-300" />Instável</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-red-400" />Offline {offlineCount}</span></div>
        </CardHeader>
        <CardContent className="p-0"><div className="relative min-h-[min(58vh,520px)] overflow-hidden bg-[radial-gradient(circle_at_center,#12303a_0,transparent_58%),linear-gradient(135deg,#071017,#0b1820)]"><div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs"><span>Latência: —</span><span>Perda: —</span><span className="text-emerald-300">Online: {clients.filter((c) => isOnline(c.last_seen_at)).length}</span><span className="text-red-300">Offline: {offlineCount}</span></div><div style={{ transform: `scale(${mapZoom})`, transformOrigin: "center" }}>
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(120,190,200,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(120,190,200,.25)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="absolute right-3 top-3 z-20 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px]"><span className="text-emerald-400">● Online</span><span className="ml-3 text-amber-400">● Instável</span><span className="ml-3 text-red-400">● Offline</span></div>
          <svg className="absolute inset-0 size-full" aria-hidden="true">{clients.map((client, index) => <line key={`connection-${client.id}`} x1="50%" y1="50%" x2={`${18 + ((index * 37) % 68)}%`} y2={`${28 + ((index * 53) % 45)}%`} stroke="rgba(34,211,238,.28)" strokeWidth="1" strokeDasharray="5 5" />)}</svg>
          {clients.map((client, index) => { const online = isOnline(client.last_seen_at); const unstable = online && client.last_seen_at ? Date.now() - new Date(client.last_seen_at).getTime() > 5 * 60 * 1000 : false; const city = portalItems.find((item) => item.id === (client.branch_id ?? client.company_id))?.city ?? "Cidade não cadastrada"; const color = online ? (unstable ? "bg-amber-300 shadow-amber-300/70" : "bg-emerald-400 shadow-emerald-400/70") : "bg-red-400 shadow-red-400/70"; return <button key={client.id} onClick={() => setSelected(client)} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-left" style={{ left: `${18 + ((index * 37) % 68)}%`, top: `${28 + ((index * 53) % 45)}%` }}><span className={`mx-auto block size-4 rounded-full border-2 border-white/80 shadow-[0_0_18px_5px] ${color}`} /><span className="mt-2 block max-w-36 truncate rounded bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur">{client.router_identity ?? "RB"}<small className="block text-[10px] text-slate-400">{city} · TX {formatBytes(Number(client.tx_bytes ?? 0))} · RX {formatBytes(Number(client.rx_bytes ?? 0))}</small></span></button>; })}
          {!clients.length && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Nenhuma RB cadastrada para exibir no mapa.</div>}
        </div></div></CardContent>
      </Card>
      <Card className="glass-panel border-primary/20"><CardHeader><CardTitle>Cadastro e políticas das RBs</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{portalItems.map((item) => item.kind === "Evento" ? null : <div key={item.id} className="rounded-lg border border-border p-3"><p className="font-medium">{item.name}</p><p className="mb-3 text-xs text-muted-foreground">Política RADIUS e homologação do Hotspot</p><HotspotConfigDialog kind={item.kind === "Sede" ? "company" : "branch"} targetId={item.id} unitName={item.name} portalSlug={item.slug} baseUrl={typeof window !== "undefined" ? window.location.origin : ""} /></div>)}</CardContent></Card>
      <Card className="glass-panel border-primary/20">
        <CardHeader><button type="button" onClick={() => setExpandedSection(expandedSection === "kit" ? null : "kit")} className="flex w-full items-center gap-2 text-left"><Router className="size-5 text-primary" /><CardTitle>Kit de instalação MikroTik</CardTitle><span className="ml-auto text-primary">{expandedSection === "kit" ? "−" : "+"}</span></button></CardHeader>
        {expandedSection === "kit" && <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">Instalação em RB nova: siga os passos 1 a 5 nesta ordem. Ativação e Heartbeat são exclusivos de cada RB.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setExpandedKitCard(expandedKitCard === "files" ? null : "files")} className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-left text-sm transition hover:border-primary/60"><p className="font-semibold text-primary">Arquivos atualizados <span className="float-right">{expandedKitCard === "files" ? "−" : "+"}</span></p><p className="text-muted-foreground">{kitUpdatedAt}</p>{expandedKitCard === "files" && <p className="mt-2 border-t border-primary/15 pt-2 text-xs text-muted-foreground">O kit-base, diagnósticos, atualização de isolamento e arquivos de recuperação do portal são padrão. Ativação e Heartbeat são baixados individualmente para cada RB.</p>}</button>
            <button type="button" onClick={() => setExpandedKitCard(expandedKitCard === "manual" ? null : "manual")} className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-left text-sm transition hover:border-primary/60"><p className="font-semibold text-primary">Manual atualizado <span className="float-right">{expandedKitCard === "manual" ? "−" : "+"}</span></p><p className="text-muted-foreground">{manualUpdatedAt}</p>{expandedKitCard === "manual" && <p className="mt-2 border-t border-primary/15 pt-2 text-xs text-muted-foreground">Procedimento completo de reset HTML, importação dos arquivos, validação de rede, Hotspot, RADIUS e Heartbeat.</p>}</button>
          </div>
          <MikrotikPreflight />
          <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm">
            <p className="font-semibold">2. Importar kit-base</p>
            <p className="text-muted-foreground">Use em RB nova somente após concluir a pré-verificação.</p>
            <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/mikrotik/MANOS-HOTSPOT-BASE.rsc" download><Download className="size-4" /> Baixar kit-base .rsc</a></Button><Button variant="outline" asChild><a href="/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf" target="_blank" rel="noreferrer"><BookOpen className="size-4" /> Abrir manual</a></Button></div>
          </div>
          <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm">
            <p className="font-semibold">3 e 4. Baixar Ativação e Heartbeat da RB</p>
            <p className="text-muted-foreground">Na lista de Clientes ativos homologados, localize a RB e baixe primeiro <strong>Ativação</strong>, depois <strong>Heartbeat</strong>. Esses dois arquivos são exclusivos daquela RB.</p>
            <Button variant="outline" asChild><a href="#clientes-ativos">Ir para Clientes ativos homologados</a></Button>
          </div>
          <MikrotikPostflight />
          <div className="border-t border-border pt-5"><p className="mb-3 text-sm font-semibold text-muted-foreground">Arquivos de manutenção e recuperação</p>
          <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm">
            <p className="font-semibold">Manutenção de RB já instalada</p>
            <p className="text-muted-foreground">Atualiza somente o isolamento entre visitantes e funcionários. Não use o kit-base em uma RB que já está funcionando.</p>
            <Button variant="outline" asChild><a href="/mikrotik/MANOS-ISOLATION-UPDATE.rsc" download><Download className="size-4" /> Baixar atualização de isolamento .rsc</a></Button>
          </div></div>
          <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm">
            <p className="font-semibold">Proteção adicional do HotSpot</p>
            <p className="text-muted-foreground">Bloqueia visitantes da faixa do provedor e dos serviços de administração IP da RB. Não altera ether4, ether5, impressoras, RADIUS, filas ou Heartbeat.</p>
            <Button variant="outline" asChild><a href="/mikrotik/MANOS-HOTSPOT-FIREWALL-UPDATE.rsc" download><Download className="size-4" /> Baixar proteção do HotSpot .rsc</a></Button>
          </div>
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <p className="font-semibold">Recuperação da página do HotSpot</p>
            <p className="text-muted-foreground">Use somente se for necessário restaurar manualmente a página de login na pasta <code>flash/hotspot</code>. A sincronização normal atualiza esses arquivos automaticamente.</p>
            <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/mikrotik/login.html" download><Download className="size-4" /> Baixar login.html</a></Button><Button variant="outline" asChild><a href="/mikrotik/alogin.html" download><Download className="size-4" /> Baixar alogin.html</a></Button></div>
          </div>
        </CardContent>}
      </Card>
      <Card className="glass-panel border-primary/20">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setExpandedSection(expandedSection === "audit" ? null : "audit")} className="flex min-w-0 flex-1 items-center text-left">
            <CardTitle>Histórico recente</CardTitle><span className="ml-auto text-primary">{expandedSection === "audit" ? "−" : "+"}</span>
          </button>
          {expandedSection === "audit" && <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportAuditCsv}>Exportar histórico</Button>
            {access?.role === "adm" && <Button variant="outline" size="sm" disabled={cleaningAudit} onClick={() => void cleanOldAudit()}><Trash2 className="size-4" /> {cleaningAudit ? "Limpando..." : "Limpar +30 dias"}</Button>}
          </div>}
        </CardHeader>
        {expandedSection === "audit" && <CardContent className="space-y-2">
          {access?.role === "adm" && <p className="text-xs text-muted-foreground">A limpeza apaga do banco apenas eventos com mais de 30 dias. Os eventos recentes continuam disponíveis.</p>}
          {auditCleanupMessage && <p className="text-xs" role="status">{auditCleanupMessage}</p>}
          <Input placeholder="Filtrar histórico por ação ou dispositivo" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
          <div className="flex gap-2"><Input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} /><Input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} /></div>
          {auditItems.map((item) => <div key={item.id} className="flex items-center justify-between rounded border border-border p-2 text-xs"><span>{hotspotEventLabel(item.action)} · dispositivo {String(item.device_id).slice(0, 8)}</span><span className="text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span></div>)}
          {!auditItems.length && <p className="text-sm text-muted-foreground">Nenhuma ação encontrada.</p>}
        </CardContent>}
      </Card>
      {offlineCount > 0 && <Card className="border-amber-400/30 bg-amber-400/5"><CardContent className="p-4 text-sm"><p className="font-semibold text-amber-300">Atenção operacional</p><p className="text-muted-foreground">{offlineCount} dispositivo(s) perderam três heartbeats consecutivos. Verifique a conexão da RB e o RADIUS.</p></CardContent></Card>}
      {syncMessage && <Card className="border-primary/30 bg-primary/5"><CardContent className="p-4 text-sm text-primary">{syncMessage}</CardContent></Card>}
      <Card id="clientes-ativos" className="glass-panel border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" /> Clientes ativos homologados</CardTitle><Button variant="outline" size="sm" disabled={clientsQuery.isFetching || auditQuery.isFetching || healthQuery.isFetching || filesQuery.isFetching} onClick={async () => { await Promise.all([clientsQuery.refetch(), auditQuery.refetch(), healthQuery.refetch(), filesQuery.refetch()]); setSyncMessage(`Dados atualizados às ${new Date().toLocaleTimeString("pt-BR")}.`); }}> {clientsQuery.isFetching || auditQuery.isFetching ? "Atualizando..." : "Atualizar dados"}</Button></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Sincronizar confirma RADIUS, página de login e bloqueio na RB. Portas e faixas IP são verificadas antes da instalação pelo diagnóstico do kit.</p>
          <div className="flex flex-col gap-2 sm:flex-row"><Input placeholder="Buscar por identidade ou MAC" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><select className="rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="all">Todos os status</option><option value="operational">Homologados</option><option value="awaiting_homologation">Pendentes</option><option value="blocked">Bloqueados</option></select><Button variant="outline" onClick={exportCsv}>Exportar CSV</Button></div>
          {visible.map((client) => <div key={client.id} className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 p-3"><button onClick={() => setSelected(client)} className="min-w-0 text-left hover:text-primary"><span className="font-medium">{client.router_identity ?? "RB sem identidade"}</span><span className="ml-3 text-xs text-muted-foreground">MAC: {client.ap_mac ?? "não informado"}</span><span className="mt-1 block text-xs text-muted-foreground"><span className={isOnline(client.last_seen_at) ? "font-semibold text-emerald-300" : "text-muted-foreground"}>{isOnline(client.last_seen_at) ? "● Online" : "○ Offline"}</span> · última comunicação: {client.last_seen_at ? new Date(client.last_seen_at).toLocaleString("pt-BR") : "nunca"} · IP: {client.last_seen_ip ?? "—"} · RouterOS: {client.router_version ?? "—"}{syncProgress(client)}</span></button><div className="flex items-center gap-2"><Badge variant="outline" className={statusClass(client.status)}>{statusLabel(client.status)}</Badge><Button size="sm" variant="outline" onClick={() => void downloadActivation(client)}>Ativação</Button><Button size="sm" variant="outline" onClick={() => void downloadHeartbeat(client)}>Heartbeat</Button><Button size="sm" variant="outline" onClick={() => void requestSync(client)}>Sincronizar</Button></div></div>)}
          {!clients.length && <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado.</p>}
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div></div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.router_identity}</DialogTitle></DialogHeader><div className="grid gap-3 text-sm sm:grid-cols-2"><p>MAC: <strong>{selected?.ap_mac ?? "não informado"}</strong></p><p>IP: <strong>{selected?.last_seen_ip ?? "não informado"}</strong></p><p>RouterOS: <strong>{selected?.router_version ?? "não informado"}</strong></p><p>Última comunicação: <strong>{selected?.last_seen_at ? new Date(selected.last_seen_at).toLocaleString("pt-BR") : "nunca"}</strong></p><p>Sessões ativas: <strong>{selected?.active_sessions ?? 0}</strong></p><p>Tráfego: <strong>TX {formatBytes(Number(selected?.tx_bytes ?? 0))} · RX {formatBytes(Number(selected?.rx_bytes ?? 0))}</strong></p><p>Conexão: <Badge variant="outline" className={isOnline(selected?.last_seen_at) ? "border-emerald-400/40 text-emerald-300" : "border-red-400/40 text-red-300"}>{isOnline(selected?.last_seen_at) ? "Online" : "Offline"}</Badge></p><p>Status atual: <Badge variant="outline" className={statusClass(selected?.status)}>{selected && statusLabel(selected.status)}</Badge></p></div><div className="flex flex-wrap gap-2"><Button variant={selected?.status === "blocked" ? "default" : "destructive"} onClick={() => changeStatus(selected?.status === "blocked" ? "operational" : "blocked")}>{selected?.status === "blocked" ? "Desbloquear dispositivo" : "Bloquear dispositivo"}</Button><Button variant="outline" onClick={() => selected && void requestReboot(selected)}>Reiniciar RB</Button></div></DialogContent></Dialog>
    </div>
  );
}
