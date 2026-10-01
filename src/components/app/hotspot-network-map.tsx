import { useMemo, useState } from "react";
import { LocateFixed, Maximize2, Router, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { devices: any[]; onBlock?: (device: any) => void; onReboot?: (device: any) => void };

export function HotspotNetworkMap({ devices, onBlock, onReboot }: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const visible = useMemo(() => devices.filter((device) => String(device.router_identity ?? "").toLowerCase().includes(search.toLowerCase())), [devices, search]);
  const online = (device: any) => Boolean(device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 90000);

  return (
    <Card className="overflow-hidden border-primary/20 bg-[#071017]">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Router className="size-5 text-primary" />Mapa da rede</CardTitle><div className="flex gap-2"><Button size="icon" variant="outline" onClick={() => { setZoom(1); setSelected(null); }}><LocateFixed className="size-4" /></Button><Button size="icon" variant="outline" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}><Maximize2 className="size-4" /></Button></div></div>
        <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar RB" className="h-9 w-full rounded-md border border-white/10 bg-black/20 pl-9 text-sm" /></div>
      </CardHeader>
      <CardContent><div className="relative min-h-[min(58vh,520px)] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,#12303a_0,transparent_58%),linear-gradient(135deg,#071017,#0b1820)]"><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(120,190,200,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(120,190,200,.25)_1px,transparent_1px)] [background-size:42px_42px]" /><div className="absolute inset-0 origin-center" style={{ transform: `scale(${zoom})` }}>{visible.map((device, index) => <button type="button" key={device.id} onClick={() => setSelected(device)} className="absolute -translate-x-1/2 text-left" style={{ left: `${18 + ((index * 37) % 68)}%`, top: `${32 + ((index * 41) % 38)}%` }}><span className={`mx-auto block size-4 rounded-full border-2 border-white ${online(device) ? "bg-emerald-400" : "bg-red-400"}`} /><span className="mt-2 block rounded bg-black/70 px-2 py-1 text-xs text-white">{device.router_identity}<small className="block text-slate-400">TX {(Number(device.tx_bytes ?? 0) / 1000000).toFixed(1)} MB · RX {(Number(device.rx_bytes ?? 0) / 1000000).toFixed(1)} MB</small></span></button>)}</div></div>{selected && <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 p-3"><div><b>{selected.router_identity}</b><p className="text-xs text-muted-foreground">IP {selected.last_seen_ip ?? "—"} · Sessões {selected.active_sessions ?? 0}</p></div><div className="flex gap-2"><Button size="sm" variant="destructive" onClick={() => onBlock?.(selected)}>Bloquear</Button><Button size="sm" variant="outline" onClick={() => onReboot?.(selected)}>Reiniciar</Button><Button size="icon" variant="ghost" onClick={() => setSelected(null)}><X className="size-4" /></Button></div></div>}</CardContent>
    </Card>
  );
}
