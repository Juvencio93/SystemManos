import { useState } from "react";
import { Package, Plus, ArrowRightLeft, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { assignmentReady, rbStateLabels, type InventoryData, type InventoryDevice, type InventoryAction } from "@/lib/rb-inventory";


export type InventoryViewProps = {
  data?: InventoryData | undefined; loading?: boolean; error?: string | undefined; refresh: () => Promise<void>;
  action: (action: InventoryAction) => Promise<void>;
  download: (id: string, kind: "setup" | "activation" | "heartbeat") => Promise<void>;
};

export function RbInventoryView({ data, loading, error, refresh, action, download }: InventoryViewProps) {
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState<InventoryDevice | null>(null);
  const [creating,setCreating] = useState(false);
  const [label,setLabel] = useState("");
  const [target,setTarget] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [failure,setFailure] = useState("");
  const devices = data?.devices ?? [];
  const targets = data?.targets ?? [];
  const destination = (d: InventoryDevice) => targets.find(t => t.id===d.hotspot_config_id)?.label ?? (d.company_id ? "Destino vinculado" : `Em estoque${d.inventory_reseller_id ? ` · ${data?.resellers?.find(r=>r.id===d.inventory_reseller_id)?.name || "Revenda"}` : " · Manos Tech"}`);
  async function run(task: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setFailure(""); setMessage("");
    try { await task(); setMessage(success); setSelected(null); setCreating(false); }
    catch(e) { setFailure(e instanceof Error ? e.message : "Não foi possível concluir a operação."); }
    finally { setBusy(false); }
  }
  return <Card className="border-cyan-400/20">
    <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><CardTitle className="flex items-center gap-2"><Package className="size-5 text-primary" />Estoque e transferência de RBs</CardTitle>
      <p className="mt-2 text-sm text-muted-foreground">Prepare uma vez. Atribua ao cliente e acompanhe a confirmação do equipamento.</p></div>
      <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || loading} onClick={() => void run(refresh,"Estoque atualizado.")}><RefreshCw className="size-4" />Atualizar</Button>
      <Button size="sm" disabled={busy || loading || Boolean(error)} onClick={() => {setCreating(true);setLabel("");setFailure("");}}><Plus className="size-4" />Cadastrar RB</Button></div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-3 gap-3">{[["Equipamentos",devices.length],["Em estoque",devices.filter(d=>d.status==="stock").length],["Aguardando RB",devices.filter(d=>!assignmentReady(d)).length]].map(([title,count]) => <div key={title} className="rounded-xl border bg-background/50 p-3"><div className="text-xs text-muted-foreground">{title}</div><strong className="text-2xl">{count}</strong></div>)}</div>
      <Input aria-label="Buscar RB no estoque" placeholder="Buscar por nome ou identidade da RB..." value={search} onChange={e=>setSearch(e.target.value)} />
      {(error || failure) && <p role="alert" className="text-sm text-red-400">{failure || error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando estoque…</p>}
      {!loading && !error && devices.length===0 && <p className="py-6 text-center text-muted-foreground">Cadastre a primeira RB para preparar seu estoque.</p>}
      {devices.filter(d=>`${d.inventory_label ?? ""} ${d.router_identity}`.toLowerCase().includes(search.toLowerCase())).map(d=> {
        const online = Boolean(d.last_seen_at && Date.now()-Date.parse(d.last_seen_at)<30000);
        return <div key={d.id} className="rounded-xl border bg-background/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{d.inventory_label || d.router_identity}</strong>
            <p className="text-xs text-muted-foreground">{d.inventory_label ? `${d.router_identity} · ` : ""}{online ? "Online" : "Offline"}</p></div>
            <Badge variant="outline" className={d.status==="operational" ? "text-emerald-400" : "text-amber-300"}>{rbStateLabels[d.status] || d.status}</Badge></div>
          <p className="mt-3 text-sm">{destination(d)}</p>
          {!assignmentReady(d) && <p className="mt-1 text-xs text-amber-300">{online ? "Aguardando limpeza e confirmação do equipamento." : "A mudança será aplicada quando a RB se conectar à internet."}</p>}
          {d.status==="verifying" && <p className="mt-1 text-xs text-cyan-300">A primeira conexão real de um cliente confirmará automaticamente a homologação pelo RADIUS.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || d.status==="transfer_pending"} onClick={()=> {setSelected(d);setTarget("");setFailure("");}}><ArrowRightLeft className="size-4" />{d.company_id ? "Transferir / devolver" : "Atribuir destino"}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(()=>download(d.id,"setup"),"Kit inicial solicitado.")}><Download className="size-3" />Kit inicial · uma vez</Button>
          </div>
        </div>;
      })}
      <p className="text-xs text-muted-foreground">Antes de reinstalar uma RB usada, confira o cadastro anterior para evitar duplicidade. Para cada equipamento, importe apenas seu Kit inicial uma vez; depois, transferências, credenciais e portal são atualizados quando ele se conecta à internet.</p>
    </CardContent>
    <Dialog open={creating || Boolean(selected)} onOpenChange={open=> {if(!open && !busy){setCreating(false);setSelected(null);}}}>
      <DialogContent><DialogHeader><DialogTitle>{creating ? "Cadastrar RB no estoque" : `Transferir ${selected?.inventory_label || selected?.router_identity}`}</DialogTitle>
      <DialogDescription>{creating ? "Dê um nome ao equipamento. A identidade permanente será gerada automaticamente." : "Os acessos do vínculo anterior serão revogados. A RB receberá a troca automaticamente ao se conectar; o primeiro check-in confirmará o novo destino."}</DialogDescription></DialogHeader>
      {creating ? <label className="space-y-2 text-sm">Nome da RB<Input autoFocus value={label} maxLength={80} placeholder="Ex.: 001" onChange={e=>setLabel(e.target.value)} /></label>
      : <label className="space-y-2 text-sm">Destino<select className="w-full rounded-lg border bg-background p-3" value={target} onChange={e=>setTarget(e.target.value)}>
        <option value="">Devolver ao estoque — sem empresa</option>
        {targets.filter(t=>t.id!==selected?.hotspot_config_id && !devices.some(d=>d.id!==selected?.id && d.hotspot_config_id===t.id)).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        {data?.resellers?.map(r=><option key={r.id} value={`reseller:${r.id}`}>Estoque da revenda · {r.name}</option>)}
      </select><span className="block text-xs text-muted-foreground">Destinos precisam de configuração MikroTik e não podem ter outra RB vinculada.</span></label>}
      {failure && <p role="alert" className="text-sm text-red-400">{failure}</p>}
      <Button disabled={busy || (creating && !label.trim()) || (!creating && !selected?.company_id && !target)} onClick={()=>void run(()=>action(creating ? {action:"create",label} : target.startsWith("reseller:") ? {action:"allocate",deviceId:selected!.id,expectedVersion:selected!.assignment_version,resellerId:target.slice(9)} : {action:"transfer",deviceId:selected!.id,expectedVersion:selected!.assignment_version,configId:target || null}),creating ? "RB cadastrada. Importe o kit inicial uma vez para prepará-la." : "Transferência solicitada. Aguarde a confirmação da RB.")}>{busy ? "Salvando…" : creating ? "Cadastrar RB" : target ? "Confirmar transferência" : "Devolver ao estoque"}</Button>
      </DialogContent>
    </Dialog>
  </Card>;
}
