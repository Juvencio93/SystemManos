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
import { HermesSetupCard } from "@/components/app/hermes-setup-card";
import { hotspotActionError, postHotspotAction } from "@/lib/hotspot-client";
import { hotspotEventLabel } from "@/lib/hotspot-events";
import { MikrotikPostflight } from "@/components/app/mikrotik-postflight";
import { MikrotikSecurityAudit } from "@/components/app/mikrotik-security-audit";

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
    const { data, error } = await query.not("company_id", "is", null).neq("status", "stock").neq("status", "transfer_pending").neq("status", "suspended").order("last_seen_at", { ascending: false, nullsFirst: false });
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
  const [expandedSection, setExpandedSection] = useState<"kit" | "hermes" | "maintenance" | "audit" | null>(null);
  const [policiesExpanded, setPoliciesExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [heartbeatSeconds, setHeartbeatSeconds] = useState(60);
  useEffect(() => { const timer = window.setInterval(() => setHeartbeatSeconds((v) => v <= 1 ? 60 : v - 1), 1000); return () => window.clearInterval(timer); }, []);
  const isOnline = (lastSeen?: string) =>
    Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 180_000);
  const hasOnlineTwin = (device: any) => Boolean(device.ap_mac && clients.some((other: any) =>
    other.id !== device.id && other.ap_mac === device.ap_mac && other.status === "operational" && isOnline(other.last_seen_at)
  ));
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
  async function retireDuplicate(device: any) {
    if (!device || !hasOnlineTwin(device) || isOnline(device.last_seen_at)) return;
    if (!window.confirm(`Arquivar o cadastro antigo ${device.router_identity}? O histórico será preservado. A RB online com o mesmo MAC continuará ativa.`)) return;
    const response = await postHotspotAction("/api/internal/hotspot-device-status", { routerIdentity: device.router_identity, retireDuplicate: true });
    const actionError = await hotspotActionError(response, "Não foi possível arquivar o cadastro duplicado.");
    if (actionError) { setSyncMessage(actionError); return; }
    setSyncMessage(`${device.router_identity} foi arquivada. O registro e o histórico foram preservados.`);
    setSelected(null);
    await clientsQuery.refetch();
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
      <Card className="glass-panel border-primary/20"><CardHeader><button type="button" aria-expanded={policiesExpanded} aria-controls="hotspot-policies-content" onClick={() => setPoliciesExpanded(value => !value)} className="flex w-full items-center text-left"><CardTitle>Cadastro e políticas das RBs</CardTitle><span className="ml-auto text-primary">{policiesExpanded ? "−" : "+"}</span></button></CardHeader><CardContent id="hotspot-policies-content" hidden={!policiesExpanded} className="grid gap-3 sm:grid-cols-2">{portalItems.map((item) => item.kind === "Evento" ? null : <div key={item.id} className="rounded-lg border border-border p-3"><p className="font-medium">{item.name}</p><p className="mb-3 text-xs text-muted-foreground">Política RADIUS e homologação do Hotspot</p><HotspotConfigDialog kind={item.kind === "Sede" ? "company" : "branch"} targetId={item.id} unitName={item.name} portalSlug={item.slug} baseUrl={typeof window !== "undefined" ? window.location.origin : ""} /></div>)}</CardContent></Card>
      <Card className="glass-panel border-primary/20">
        <CardHeader><button type="button" onClick={() => setExpandedSection(expandedSection === "kit" ? null : "kit")} className="flex w-full items-center gap-2 text-left"><Router className="size-5 text-primary" /><CardTitle>Kit de instalação MikroTik</CardTitle><span className="ml-auto text-primary">{expandedSection === "kit" ? "−" : "+"}</span></button></CardHeader>
        {expandedSection === "kit" && <CardContent className="space-y-5">
          <div><p className="font-semibold">Instalação padrão de RB nova ou reutilizada</p><p className="text-sm text-muted-foreground">Cada RB recebe um kit individual uma única vez. Nas transferências seguintes, o sistema atualiza o destino automaticamente. Pare ao primeiro erro de importação.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4 text-sm"><p className="font-semibold">Arquivos do kit</p><p className="text-muted-foreground">Um arquivo MT-IDENTIDADE-setup.rsc gerado em Estoque e transferência de RBs. Ele reúne base, ativação RADIUS e heartbeat. Não importe base, ativação e heartbeat separados na mesma instalação.</p></div>
            <div className="rounded-lg border border-border p-4 text-sm"><p className="font-semibold">Manual atualizado</p><p className="text-muted-foreground">{manualUpdatedAt}</p><Button variant="outline" size="sm" asChild><a href="/mikrotik/MANUAL%20DE%20INSTALA%C3%87%C3%83O.pdf" target="_blank" rel="noreferrer"><BookOpen className="size-4" />Abrir manual</a></Button></div>
          </div>
          <div className="rounded-lg border border-red-400/25 bg-red-400/5 p-4 text-sm"><p className="font-semibold">1. Limpeza da RB e do cadastro</p><p className="text-muted-foreground">Guarde backup fora da RB e confira seu cadastro anterior no sistema antes de registrar uma nova identidade. Reset com no-defaults limpa a configuração, mas pode deixar arquivos em Files; para apagar também os arquivos, use Netinstall sem Keep old configuration. Faça isso presencialmente e reconecte via MAC.</p><p className="text-xs text-muted-foreground">Reset comum, se escolhido: <code>/system reset-configuration no-defaults=yes skip-backup=yes</code></p></div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm"><p className="font-semibold">2. Conferência física</p><p className="text-muted-foreground">Confirme RouterOS v7, ether1 com internet DHCP, ether2 e ether3 no HotSpot, ether4 na rede livre e ether5 na extensão WAN. Se a ligação ou o provedor diferirem, adapte a preparação antes da importação.</p></div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm"><p className="font-semibold">3. Cadastro e kit individual</p><p className="text-muted-foreground">Em Estoque e transferência de RBs, cadastre ou selecione a RB correta e clique em Kit inicial · uma vez. Envie o arquivo baixado à raiz de Files no WinBox. Ele contém credenciais: não o compartilhe.</p><p className="text-xs text-muted-foreground">Terminal: <code>/import file-name="MT-IDENTIDADE-setup.rsc"</code> (substitua pelo nome exato do arquivo)</p></div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm"><p className="font-semibold">4. Sincronização e primeiro acesso</p><p className="text-muted-foreground">Aguarde a RB ficar Online. O heartbeat busca login.html e alogin.html; confira as páginas antes de homologar. Atribua a empresa ou filial com configuração MikroTik salva. Faça um check-in real pelo HotSpot para concluir a homologação.</p></div>
          <MikrotikPostflight />
          <div className="rounded-lg border border-border p-4 text-sm"><p className="font-semibold">Proteção de serviços e backup final</p><p className="text-muted-foreground">Após a conferência, aplique o endurecimento de serviços localmente e gere a exportação de backup. Guarde a cópia fora da RB.</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href="/mikrotik/MANOS-MANAGEMENT-HARDENING.rsc" download>Baixar proteção .rsc</a></Button><Button variant="outline" size="sm" asChild><a href="/mikrotik/MANOS-BACKUP-EXPORT.rsc" download>Baixar exportação .rsc</a></Button></div><p className="text-xs text-muted-foreground"><code>/import file-name=MANOS-MANAGEMENT-HARDENING.rsc</code><br/><code>/import file-name=MANOS-BACKUP-EXPORT.rsc</code></p></div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm"><p className="font-semibold">5. Monitoramento Hermes (agente IA)</p><p className="text-muted-foreground">Ativa o monitoramento proativo da RB: o Hermes passa a acompanhar CPU, memória, sessões e logs, e avisa no Telegram se algo sair do normal. É somente leitura — nada muda na RB sem a sua aprovação.</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href="/mikrotik/MANOS-HERMES-SETUP.rsc" download><Download className="size-4" /> Baixar instalador Hermes .rsc</a></Button></div><ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground"><li>Baixe o arquivo no botão acima e arraste para a <strong>raiz de Files</strong> no WinBox (a mesma pasta onde você colocou o kit).</li><li>No WinBox, abra o <strong>New Terminal</strong>, cole o comando abaixo e tecle Enter:<br /><code>/import file-name=MANOS-HERMES-SETUP.rsc</code></li><li><strong>Não edite nada</strong> no arquivo — ele é o mesmo para todas as RBs. A RB se cadastra sozinha.</li><li>Aprove o cadastro no <strong>Telegram</strong>: chega uma mensagem com os botões Aprovar / Rejeitar.</li><li>Para conferir, rode <code>/log print</code> e procure as linhas <strong>HERMES</strong>. Depois da aprovação, <code>/ping 10.77.0.1 count=3</code> deve responder.</li></ol><p className="mt-2 text-xs text-muted-foreground">Pré-requisitos: RouterOS v7 e RB com saída para a internet. Importe <strong>depois</strong> do endurecimento (passo anterior). Detalhes e solução de problemas na seção Monitoramento Hermes abaixo.</p></div>
          <p className="text-xs text-muted-foreground">MANOS-PREFLIGHT, atualizações avulsas e instalador manual das páginas são arquivos de diagnóstico ou recuperação. Não fazem parte da instalação padrão pelo kit individual.</p>
          <MikrotikSecurityAudit />
        </CardContent>}
      </Card>
      <HermesSetupCard expanded={expandedSection === "hermes"} onToggle={() => setExpandedSection(expandedSection === "hermes" ? null : "hermes")} />
      <Card className="glass-panel border-amber-300/25">
        <CardHeader><button type="button" onClick={() => setExpandedSection(expandedSection === "maintenance" ? null : "maintenance")} className="flex w-full items-center gap-2 text-left"><Router className="size-5 text-amber-300" /><CardTitle>Arquivos de manutenção e recuperação</CardTitle><span className="ml-auto text-amber-300">{expandedSection === "maintenance" ? "−" : "+"}</span></button></CardHeader>
        {expandedSection === "maintenance" && <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Use somente em RB já instalada, conforme a necessidade descrita em cada arquivo. Gere um backup atualizado antes de importar qualquer atualização.</p>
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm"><p className="font-semibold">1. Exportação antes de manutenção</p><p className="text-muted-foreground">Gera uma exportação local sem senhas em <code>flash/</code>. Copie o arquivo para fora da RB antes de qualquer alteração.</p><Button variant="outline" asChild><a href="/mikrotik/MANOS-BACKUP-EXPORT.rsc" download><Download className="size-4" /> Baixar exportação de backup .rsc</a></Button><p className="text-xs text-muted-foreground">Terminal: <code>/import file-name=MANOS-BACKUP-EXPORT.rsc</code></p></div>
          <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm"><p className="font-semibold">2. Atualização de isolamento entre redes</p><p className="text-muted-foreground">Use em RB antiga que ainda não possui isolamento entre visitantes e funcionários. Não use o kit-base em uma RB que já está funcionando.</p><Button variant="outline" asChild><a href="/mikrotik/MANOS-ISOLATION-UPDATE.rsc" download><Download className="size-4" /> Baixar atualização de isolamento .rsc</a></Button><p className="text-xs text-muted-foreground">Terminal: <code>/import file-name=MANOS-ISOLATION-UPDATE.rsc</code></p></div>
          <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm"><p className="font-semibold">3. Proteção adicional do HotSpot</p><p className="text-muted-foreground">Use em RB antiga que ainda não bloqueia visitantes da faixa do provedor e dos serviços de administração IP da RB.</p><Button variant="outline" asChild><a href="/mikrotik/MANOS-HOTSPOT-FIREWALL-UPDATE.rsc" download><Download className="size-4" /> Baixar proteção do HotSpot .rsc</a></Button><p className="text-xs text-muted-foreground">Terminal: <code>/import file-name=MANOS-HOTSPOT-FIREWALL-UPDATE.rsc</code></p></div>
          <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm"><p className="font-semibold">4. Proteção de entrada pela WAN</p><p className="text-muted-foreground">Use em RB antiga que ainda não protege a própria RB contra acesso pela bridge-wan. Aplique em Safe Mode pela ether4 ou acesso local; não pela ether5.</p><Button variant="outline" asChild><a href="/mikrotik/MANOS-WAN-FIREWALL-UPDATE.rsc" download><Download className="size-4" /> Baixar proteção WAN .rsc</a></Button><p className="text-xs text-muted-foreground">Terminal: <code>/import file-name=MANOS-WAN-FIREWALL-UPDATE.rsc</code></p></div>
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm"><p className="font-semibold">5. Recuperação da página do HotSpot</p><p className="text-muted-foreground">Use somente se for necessário restaurar manualmente a página de login na pasta <code>flash/hotspot</code>. A sincronização normal atualiza esses arquivos automaticamente.</p><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/mikrotik/login.html" download><Download className="size-4" /> Baixar login.html</a></Button><Button variant="outline" asChild><a href="/mikrotik/alogin.html" download><Download className="size-4" /> Baixar alogin.html</a></Button><Button variant="outline" asChild><a href="/mikrotik/MANOS-INSTALL-HOTSPOT-PAGES.rsc" download><Download className="size-4" /> Baixar instalador das páginas .rsc</a></Button></div><p className="text-xs text-muted-foreground">Envie os três arquivos para a raiz de <strong>Files</strong> e execute <code>/import file-name=MANOS-INSTALL-HOTSPOT-PAGES.rsc</code>. O instalador substitui e move os HTMLs para <code>flash/hotspot/</code>.</p></div>
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
          {access?.role === "adm" && <p className="text-xs text-muted-foreground">A limpeza automática diária apaga do banco apenas eventos com mais de 30 dias. Este botão permite antecipar a limpeza; os eventos recentes continuam disponíveis.</p>}
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
          <p className="text-xs text-muted-foreground">Sincronizar confirma RADIUS, página de login e bloqueio na RB. Para RB nova ou zerada, use o Kit inicial individual na seção Estoque; os downloads de Ativação e Heartbeat abaixo servem apenas para recuperação de RB já instalada.</p>
          <div className="flex flex-col gap-2 sm:flex-row"><Input placeholder="Buscar por identidade ou MAC" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><select className="rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="all">Todos os status</option><option value="operational">Homologados</option><option value="awaiting_homologation">Pendentes</option><option value="blocked">Bloqueados</option></select><Button variant="outline" onClick={exportCsv}>Exportar CSV</Button></div>
          {visible.map((client) => <div key={client.id} className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 p-3"><button onClick={() => setSelected(client)} className="min-w-0 text-left hover:text-primary"><span className="font-medium">{client.router_identity ?? "RB sem identidade"}</span><span className="ml-3 text-xs text-muted-foreground">MAC: {client.ap_mac ?? "não informado"}</span><span className="mt-1 block text-xs text-muted-foreground"><span className={isOnline(client.last_seen_at) ? "font-semibold text-emerald-300" : "text-muted-foreground"}>{isOnline(client.last_seen_at) ? "● Online" : "○ Offline"}</span> · última comunicação: {client.last_seen_at ? new Date(client.last_seen_at).toLocaleString("pt-BR") : "nunca"} · IP: {client.last_seen_ip ?? "—"} · RouterOS: {client.router_version ?? "—"}{syncProgress(client)}</span></button><div className="flex flex-col items-end gap-1"><div className="flex items-center gap-2"><Badge variant="outline" className={statusClass(client.status)}>{statusLabel(client.status)}</Badge><Button size="sm" variant="outline" onClick={() => void downloadActivation(client)}>Recuperar ativação</Button><Button size="sm" variant="outline" onClick={() => void downloadHeartbeat(client)}>Recuperar heartbeat</Button><Button size="sm" variant="outline" onClick={() => void requestSync(client)}>Sincronizar</Button></div><p className="text-[11px] text-muted-foreground">Arquivos individuais para recuperação. Na instalação inicial, use somente o Kit inicial do Estoque.</p></div></div>)}
          {!clients.length && <p className="text-sm text-muted-foreground">Nenhum dispositivo cadastrado.</p>}
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div></div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.router_identity}</DialogTitle></DialogHeader><div className="grid gap-3 text-sm sm:grid-cols-2"><p>MAC: <strong>{selected?.ap_mac ?? "não informado"}</strong></p><p>IP: <strong>{selected?.last_seen_ip ?? "não informado"}</strong></p><p>RouterOS: <strong>{selected?.router_version ?? "não informado"}</strong></p><p>Última comunicação: <strong>{selected?.last_seen_at ? new Date(selected.last_seen_at).toLocaleString("pt-BR") : "nunca"}</strong></p><p>Sessões ativas: <strong>{selected?.active_sessions ?? 0}</strong></p><p>Tráfego: <strong>TX {formatBytes(Number(selected?.tx_bytes ?? 0))} · RX {formatBytes(Number(selected?.rx_bytes ?? 0))}</strong></p><p>Conexão: <Badge variant="outline" className={isOnline(selected?.last_seen_at) ? "border-emerald-400/40 text-emerald-300" : "border-red-400/40 text-red-300"}>{isOnline(selected?.last_seen_at) ? "Online" : "Offline"}</Badge></p><p>Status atual: <Badge variant="outline" className={statusClass(selected?.status)}>{selected && statusLabel(selected.status)}</Badge></p></div><div className="flex flex-wrap gap-2">{selected?.status !== "suspended" && <><Button variant={selected?.status === "blocked" ? "default" : "destructive"} onClick={() => changeStatus(selected?.status === "blocked" ? "operational" : "blocked")}>{selected?.status === "blocked" ? "Desbloquear dispositivo" : "Bloquear dispositivo"}</Button><Button variant="outline" onClick={() => selected && void requestReboot(selected)}>Reiniciar RB</Button></>}{access?.role === "adm" && selected && !isOnline(selected.last_seen_at) && hasOnlineTwin(selected) && <Button variant="destructive" onClick={() => void retireDuplicate(selected)}>Arquivar cadastro duplicado</Button>}</div>{access?.role === "adm" && selected && !isOnline(selected.last_seen_at) && hasOnlineTwin(selected) && <p className="text-xs text-muted-foreground">Este cadastro está offline e compartilha o MAC com outra RB online. Arquivar preserva os registros, mas remove este duplicado das listas ativas.</p>}</DialogContent></Dialog>
    </div>
  );
}
