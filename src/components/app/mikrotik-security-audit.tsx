import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeMikrotikSecurityAudit } from "@/lib/mikrotik-security-audit";

export function MikrotikSecurityAudit() {
  const [output, setOutput] = useState("");
  const report = useMemo(() => output.trim() ? analyzeMikrotikSecurityAudit(output) : null, [output]);
  return <div className="space-y-3 rounded-lg border border-amber-300/25 bg-amber-300/5 p-4 text-sm">
    <div><p className="font-semibold">Diagnóstico de segurança da RB</p><p className="text-muted-foreground">Somente leitura: verifica serviços, IPv6, contas locais, exportação e o item manual do isolamento Wi-Fi. Não altera a RB nem envia a saída ao sistema.</p></div>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" asChild><a href="/mikrotik/MANOS-SECURITY-AUDIT.rsc" download><Download className="size-4" /> Baixar diagnóstico de segurança .rsc</a></Button><span className="text-muted-foreground">Execute: <code>/import file-name=MANOS-SECURITY-AUDIT.rsc</code></span></div>
    <label className="block space-y-1"><span>Saída do Terminal</span><Textarea rows={6} value={output} onChange={(event) => setOutput(event.target.value)} placeholder="Cole aqui a saída entre MANOS-SECURITY|BEGIN e MANOS-SECURITY|END" /></label>
    {report && <div className="space-y-1" role="status">{report.findings.map((finding, index) => <p key={`${index}-${finding.message}`} className={finding.level === "ok" ? "text-emerald-300" : "text-amber-300"}>{finding.level === "ok" ? "✓ " : "● Conferir: "}{finding.message}</p>)}</div>}
  </div>;
}
