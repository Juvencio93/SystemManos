import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeMikrotikPostflight } from "@/lib/mikrotik-postflight";

export function MikrotikPostflight() {
  const [output, setOutput] = useState("");
  const [visitorInternet, setVisitorInternet] = useState(false);
  const [visitorSpeed, setVisitorSpeed] = useState(false);
  const report = useMemo(() => output.trim() ? analyzeMikrotikPostflight(output) : null, [output]);
  const blockers = report?.findings.filter((finding) => finding.level === "blocker") ?? [];
  const ready = report?.valid && blockers.length === 0 && visitorInternet && visitorSpeed;

  return <div className="space-y-3 rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-4 text-sm">
    <div><p className="font-semibold">Conferência pós-instalação</p><p className="text-muted-foreground">Leitura local: confirma portas, IPs, fila da ether4, RADIUS, login e isolamento. Não altera a RB nem envia a saída ao sistema.</p></div>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" asChild><a href="/mikrotik/MANOS-POSTFLIGHT.rsc" download><Download className="size-4" /> Baixar conferência .rsc</a></Button><span className="text-muted-foreground">Envie para Files na RB e execute: <code>/import file-name=MANOS-POSTFLIGHT.rsc</code></span></div>
    <label className="block space-y-1"><span>Saída do Terminal</span><Textarea rows={7} value={output} onChange={(event) => setOutput(event.target.value)} placeholder="Cole aqui a saída entre MANOS-POSTFLIGHT|BEGIN|1 e MANOS-POSTFLIGHT|END|1" /></label>
    {report && <div className="space-y-1" role="status">{report.findings.map((finding, index) => <p key={`${index}-${finding.message}`} className={finding.level === "blocker" ? "text-red-300" : finding.level === "warning" ? "text-amber-300" : "text-emerald-300"}>{finding.level === "blocker" ? "● Corrigir: " : finding.level === "warning" ? "● Conferir: " : "✓ "}{finding.message}</p>)}</div>}
    <div className="space-y-1 text-muted-foreground"><p>Testes externos:</p><label className="flex items-start gap-2"><input type="checkbox" checked={visitorInternet} onChange={(event) => setVisitorInternet(event.target.checked)} /> Visitante conectado na ether2/3 navegou na internet.</label><label className="flex items-start gap-2"><input type="checkbox" checked={visitorSpeed} onChange={(event) => setVisitorSpeed(event.target.checked)} /> Velocidade do visitante conferida conforme a política RADIUS.</label></div>
    <p className={ready ? "font-medium text-emerald-300" : "font-medium text-amber-300"}>{ready ? "Conferência concluída. A RB corresponde ao kit Manos Tech." : "Conferência incompleta. Resolva os alertas antes de homologar a RB."}</p>
  </div>;
}
