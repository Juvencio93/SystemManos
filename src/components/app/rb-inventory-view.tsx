import { useState } from "react";
import { Package, Plus, ArrowRightLeft, Download, RefreshCw, ChevronDown, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { assignmentReady, deriveDestinationIdentity, inventorySection, rbStateLabels, stockCardTitle, type InventoryData, type InventoryDevice, type InventoryAction } from "@/lib/rb-inventory";


export type InventoryViewProps = {
  data?: InventoryData | undefined; loading?: boolean; error?: string | undefined; refresh: () => Promise<void>;
  action: (action: InventoryAction) => Promise<void>;
  download: (id: string, kind: "setup" | "activation" | "heartbeat") => Promise<void>;
};

export function RbInventoryView({ data, loading, error, refresh, action, download }: InventoryViewProps) {
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState<InventoryDevice | null>(null);
  const [archiving,setArchiving] = useState<InventoryDevice | null>(null);
  const [creating,setCreating] = useState(false);
  const [label,setLabel] = useState("");
  const [mac,setMac] = useState("");
  const [settingMac,setSettingMac] = useState<{ device: InventoryDevice; value: string } | null>(null);
  const [target,setTarget] = useState("");
  const [newIdentity,setNewIdentity] = useState("");
  const [busy,setBusy] = useState(false);
  const [expanded,setExpanded] = useState(true);
  const [openStock,setOpenStock] = useState(true);
  const [openOperational,setOpenOperational] = useState(false);
  const [message,setMessage] = useState("");
  const [failure,setFailure] = useState("");
  const devices = data?.devices ?? [];
  const targets = data?.targets ?? [];
  const destination = (d: InventoryDevice) => targets.find(t => t.id===d.hotspot_config_id)?.label ?? (d.company_id ? "Destino vinculado" : `Em estoque${d.inventory_reseller_id ? ` · ${data?.resellers?.find(r=>r.id===d.inventory_reseller_id)?.name || "Revenda"}` : " · Manos Tech"}`);
  const matches = (d: InventoryDevice) => !search.trim() || `${d.inventory_label ?? ""} ${d.router_identity} ${d.ap_mac ?? ""}`.toLowerCase().includes(search.toLowerCase());
  async function run(task: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setFailure(""); setMessage("");
    try { await task(); setMessage(success); setSelected(null); setCreating(false); setArchiving(null); setSettingMac(null); }
    catch(e) { setFailure(e instanceof Error ? e.message : "Não foi possível concluir a operação."); }
    finally { setBusy(false); }
  }
  function createPayload(): InventoryAction {
    const payload: InventoryAction = { action: "create" };
    if (label.trim()) payload.label = label.trim();
    if (mac.trim()) payload.mac = mac.trim();
    return payload;
  }
  function card(d: InventoryDevice) {
    const online = Boolean(d.last_seen_at && Date.now()-Date.parse(d.last_seen_at)<30000);
    const pureStock = !d.company_id;
    const title = pureStock ? (d.ap_mac || "RB sem MAC") : (d.inventory_label || d.router_identity);
    return <div key={d.id} className="rounded-xl border bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{title}</strong>
        <p className="text-xs text-muted-foreground">{pureStock ? "" : d.inventory_label ? `${d.router_identity} · ` : ""}{online ? "Online" : "Offline"}</p></div>
        <Badge variant="outline" className={d.status==="operational" ? "text-emerald-400" : "text-amber-300"}>{rbStateLabels[d.status] || d.status}</Badge></div>
      <p className="mt-3 text-sm">{destination(d)}</p>
      {!assignmentReady(d) && <p className="mt-1 text-xs text-amber-300">{online ? "Aguardando limpeza e confirmação do equipamento." : "A mudança será aplicada quando a RB se conectar à internet."}</p>}
      {d.status==="verifying" && <p className="mt-1 text-xs text-cyan-300">A primeira conexão real de um cliente confirmará automaticamente a homologação pelo RADIUS.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || d.status==="transfer_pending"} onClick={()=> {setSelected(d);setTarget("");setNewIdentity("");setFailure("");}}><ArrowRightLeft className="size-4" />{d.company_id ? "Transferir / devolver" : "Atribuir destino"}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(()=>download(d.id,"setup"),"Kit inicial solicitado.")}><Download className="size-3" />Kit inicial · uma vez</Button>
        {pureStock && !d.ap_mac && <Button size="sm" variant="ghost" disabled={busy} onClick={()=> {setSettingMac({ device: d, value: "" });setFailure("");}}>Informar MAC</Button>}
        {d.status!=="operational" && d.status!=="verifying" && <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={()=> {setArchiving(d);setFailure("");}}><Archive className="size-3" />Arquivar cadastro</Button>}
      </div>
    </div>;
  }
  function section(title: "Estoque de RBs" | "RBs Operacionais", list: InventoryDevice[], open: boolean, toggle: () => void) {
    const shown = open ? list.filter(matches) : [];
    return <div className="rounded-xl border bg-background/30">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <span><strong>{title}</strong> <span className="text-xs text-muted-foreground">({list.length})</span></span>
        <ChevronDown className={`size-4 text-primary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 p-4 pt-0">
        {title==="Estoque de RBs" && <p className="text-xs text-muted-foreground">RBs aguardando homologação aparecem aqui, com o selo “Em homologação”, até ficarem operacionais.</p>}
        {shown.length===0 && <p className="text-sm text-muted-foreground">{search.trim() ? "Nenhuma RB encontrada nesta categoria." : "Nenhuma RB nesta categoria."}</p>}
        {shown.map(card)}
      </div>}
    </div>;
  }
  const stockDevices = devices.filter(d => inventorySection(d)==="stock");
  const operationalDevices = devices.filter(d => inventorySection(d)==="operational");
  return <div className="space-y-4">
    {!loading && !error && <div className="grid grid-cols-3 gap-3">{[["Total de equipamentos",devices.length],["Estoque",stockDevices.length],["Operacional",operationalDevices.length]].map(([title,count]) => <div key={title} className="rounded-xl border bg-background/50 p-3"><div className="text-xs text-muted-foreground">{title}</div><strong className="text-2xl">{count}</strong></div>)}</div>}
    <Card className="border-cyan-400/20">
    <CardHeader>
      <button type="button" aria-expanded={expanded} aria-controls="rb-inventory-content" onClick={() => setExpanded(value => !value)} className="flex w-full items-center gap-2 text-left">
        <Package className="size-5 text-primary" /><CardTitle>Estoque e transferência de RBs</CardTitle>
        <ChevronDown className={`ml-auto size-4 text-primary transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
    </CardHeader>
    <CardContent id="rb-inventory-content" hidden={!expanded} className="space-y-4">
      <p className="text-sm text-muted-foreground">Prepare uma vez. Atribua ao cliente e acompanhe a confirmação do equipamento.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || loading} onClick={() => void run(refresh,"Estoque atualizado.")}><RefreshCw className="size-4" />Atualizar</Button>
      <Button size="sm" disabled={busy || loading || Boolean(error)} onClick={() => {setCreating(true);setLabel("");setMac("");setFailure("");}}><Plus className="size-4" />Cadastrar RB</Button></div>
      <Input aria-label="Buscar RB na categoria aberta" placeholder="Buscar na categoria aberta..." value={search} onChange={e=>setSearch(e.target.value)} />
      {(error || failure) && <p role="alert" className="text-sm text-red-400">{failure || error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando estoque…</p>}
      {!loading && !error && devices.length===0 && <p className="py-6 text-center text-muted-foreground">Cadastre a primeira RB para preparar seu estoque.</p>}
      {!loading && !error && devices.length>0 && <>
        {section("Estoque de RBs", stockDevices, openStock, () => setOpenStock(v => !v))}
        {section("RBs Operacionais", operationalDevices, openOperational, () => setOpenOperational(v => !v))}
      </>}
      <p className="text-xs text-muted-foreground">Antes de reinstalar uma RB usada, confira o cadastro anterior para evitar duplicidade. Para cada equipamento, importe apenas seu Kit inicial uma vez; depois, transferências, credenciais e portal são atualizados quando ele se conecta à internet.</p>
    </CardContent>
    <Dialog open={creating || Boolean(selected)} onOpenChange={open=> {if(!open && !busy){setCreating(false);setSelected(null);}}}>
      <DialogContent><DialogHeader><DialogTitle>{creating ? "Cadastrar RB no estoque" : `Transferir ${selected ? stockCardTitle(selected) : ""}`}</DialogTitle>
      <DialogDescription>{creating ? "Informe o nome ou o MAC do equipamento. Sem nome, o cartão mostra o MAC. A identidade permanente será gerada automaticamente." : "Os acessos do vínculo anterior serão revogados. A RB receberá a troca automaticamente ao se conectar; o primeiro check-in confirmará o novo destino."}</DialogDescription></DialogHeader>
      {creating ? <div className="space-y-4">
        <label className="space-y-2 text-sm">Nome da RB<Input autoFocus value={label} maxLength={80} placeholder="Ex.: 001" onChange={e=>setLabel(e.target.value)} /></label>
        <label className="space-y-2 text-sm">MAC da RB<Input value={mac} maxLength={20} placeholder="Ex.: CC:2D:E0:3B:D1:EF" onChange={e=>setMac(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Nome ou MAC: basta um dos dois. O MAC permite reconhecer a RB depois, mesmo sem nome.</p>
      </div>
      : <><label className="space-y-2 text-sm">Destino<select className="w-full rounded-lg border bg-background p-3" value={target} onChange={e=>{ const value = e.target.value; setTarget(value);
        const companyTarget = targets.find(t => t.id === value);
        setNewIdentity(companyTarget ? deriveDestinationIdentity(companyTarget.label) : "");
      }}>
        <option value="">Devolver ao estoque — sem empresa</option>
        {targets.filter(t=>t.id!==selected?.hotspot_config_id && !devices.some(d=>d.id!==selected?.id && d.hotspot_config_id===t.id)).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        {data?.resellers?.map(r=><option key={r.id} value={`reseller:${r.id}`}>Estoque da revenda · {r.name}</option>)}
      </select><span className="block text-xs text-muted-foreground">Destinos precisam de configuração MikroTik e não podem ter outra RB vinculada.</span></label>
      {target && !target.startsWith("reseller:") && <label className="space-y-2 text-sm">Nova identidade (opcional)<Input value={newIdentity} maxLength={51} onChange={e=>setNewIdentity(e.target.value.toUpperCase())} placeholder="Ex.: MT-BOTECO" /><span className="block text-xs text-muted-foreground">A RB passa a se chamar assim ao confirmar a atribuição. Se vazia, usa o nome do destino.</span></label>}</>}
      {failure && <p role="alert" className="text-sm text-red-400">{failure}</p>}
      <Button disabled={busy || (creating && !label.trim() && !mac.trim()) || (!creating && !selected?.company_id && !target)} onClick={()=>{ if (!creating && target && !target.startsWith("reseller:")) {
        const typed = newIdentity.trim().toUpperCase();
        if (typed && !/^MT-[A-Z0-9-]{6,48}$/.test(typed)) { setFailure("Identidade inválida. Use MT- seguido de letras, números e hífens."); return; }
      }
      // Campo limpo = derivar de novo do destino; sem destino (devolver ou
      // revenda) não há rename.
      const effective = !creating && target && !target.startsWith("reseller:")
        ? (newIdentity.trim().toUpperCase() || deriveDestinationIdentity(targets.find(t => t.id === target)?.label ?? ""))
        : "";
      void run(()=>action(creating ? createPayload() : target.startsWith("reseller:") ? {action:"allocate",deviceId:selected!.id,expectedVersion:selected!.assignment_version,resellerId:target.slice(9)} : {action:"transfer",deviceId:selected!.id,expectedVersion:selected!.assignment_version,configId:target || null, ...(effective ? { newIdentity: effective } : {})}),creating ? "RB cadastrada. Importe o kit inicial uma vez para prepará-la." : "Transferência solicitada. Aguarde a confirmação da RB."); }}>{busy ? "Salvando…" : creating ? "Cadastrar RB" : target ? "Confirmar transferência" : "Devolver ao estoque"}</Button>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(archiving)} onOpenChange={open=> {if(!open && !busy) setArchiving(null);}}>
      <DialogContent><DialogHeader><DialogTitle>Arquivar {archiving ? stockCardTitle(archiving) : ""}</DialogTitle>
      <DialogDescription>O cadastro some do estoque e os acessos pendentes dele são revogados. A RB física <strong>não</strong> é alterada — se ela opera hoje com outro cadastro, continua funcionando normalmente. Use para cadastros duplicados ou que nunca serão confirmados.</DialogDescription></DialogHeader>
      {archiving?.ap_mac && devices.some(o=>o.id!==archiving.id && o.ap_mac && o.ap_mac===archiving.ap_mac) && <p className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-200">⚠️ O cadastro <strong>{devices.find(o=>o.id!==archiving.id && o.ap_mac && o.ap_mac===archiving.ap_mac)?.router_identity}</strong> tem o mesmo MAC deste equipamento — provavelmente é a mesma RB física registrada duas vezes.</p>}
      {failure && <p role="alert" className="text-sm text-red-400">{failure}</p>}
      <Button disabled={busy || !archiving} onClick={()=> archiving && void run(()=>action({action:"archive",deviceId:archiving.id,expectedVersion:archiving.assignment_version}),"Cadastro arquivado.")}>{busy ? "Arquivando…" : "Arquivar cadastro"}</Button>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(settingMac)} onOpenChange={open=> {if(!open && !busy) setSettingMac(null);}}>
      <DialogContent><DialogHeader><DialogTitle>Informar MAC</DialogTitle>
      <DialogDescription>O cartão da RB passa a mostrar o MAC. Use para cadastros em estoque sem MAC.</DialogDescription></DialogHeader>
      <label className="space-y-2 text-sm">MAC da RB<Input autoFocus value={settingMac?.value ?? ""} maxLength={20} placeholder="Ex.: CC:2D:E0:3B:D1:EF" onChange={e=>setSettingMac(current => current ? { ...current, value: e.target.value } : current)} /></label>
      {failure && <p role="alert" className="text-sm text-red-400">{failure}</p>}
      <Button disabled={busy || !settingMac || !settingMac.value.trim()} onClick={()=> settingMac && void run(()=>action({action:"set_mac",deviceId:settingMac.device.id,expectedVersion:settingMac.device.assignment_version,mac:settingMac.value.trim()}),"MAC registrado. O cartão passa a mostrar o MAC.")}>{busy ? "Salvando…" : "Salvar MAC"}</Button>
      </DialogContent>
    </Dialog>
  </Card>
  </div>;
}
