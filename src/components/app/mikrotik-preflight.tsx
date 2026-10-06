import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeMikrotikPreflight } from "@/lib/mikrotik-preflight";

export function MikrotikPreflight() {
  const [output, setOutput] = useState("");
  const [backupSaved, setBackupSaved] = useState(false);
  const [providerDhcp, setProviderDhcp] = useState(false);
  const [localAccess, setLocalAccess] = useState(false);
  const report = useMemo(() => output.trim() ? analyzeMikrotikPreflight(output) : null, [output]);
  const blockers = report?.findings.filter((finding) => finding.level === "blocker") ?? [];
  const ready = report?.valid && blockers.length === 0 && backupSaved && providerDhcp && localAccess;

  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm">
      <div>
        <p className="font-semibold">Pré-verificação da RB</p>
        <p className="text-muted-foreground">Leitura local antes de importar o kit. O diagnóstico não altera a RB nem envia a saída ao sistema.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <a href="/mikrotik/MANOS-PREFLIGHT.rsc" download><Download className="size-4" /> Baixar diagnóstico .rsc</a>
        </Button>
        <span className="text-muted-foreground">Envie para Files na RB e execute no Terminal: <code>/import file-name=MANOS-PREFLIGHT.rsc</code></span>
      </div>
      <label className="block space-y-1">
        <span>Saída do Terminal</span>
        <Textarea rows={7} value={output} onChange={(event) => setOutput(event.target.value)} placeholder="Cole aqui a saída entre MANOS-PREFLIGHT|BEGIN|1 e MANOS-PREFLIGHT|END|1" />
      </label>
      {report && (
        <div className="space-y-1" role="status">
          {report.findings.map((finding, index) => (
            <p key={`${index}-${finding.message}`} className={finding.level === "blocker" ? "text-red-300" : finding.level === "warning" ? "text-amber-300" : "text-emerald-300"}>
              {finding.level === "blocker" ? "● Corrigir: " : finding.level === "warning" ? "● Conferir: " : "✓ "}{finding.message}
            </p>
          ))}
        </div>
      )}
      <div className="space-y-1 text-muted-foreground">
        <p>Confirmações antes da instalação:</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={backupSaved} onChange={(event) => setBackupSaved(event.target.checked)} /> Backup da configuração atual salvo fora da RB.</label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={providerDhcp} onChange={(event) => setProviderDhcp(event.target.checked)} /> Provedor entrega IP por DHCP; ether5 pode compartilhar sua rede com ether1.</label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={localAccess} onChange={(event) => setLocalAccess(event.target.checked)} /> Tenho acesso local à RB e aplicarei mudanças de rede em etapas com Safe Mode.</label>
      </div>
      <p className={ready ? "font-medium text-emerald-300" : "font-medium text-amber-300"}>
        {ready ? "Pré-verificação concluída. Confira o manual antes de importar o kit." : "Pré-verificação incompleta. Resolva os alertas antes de importar o kit."}
      </p>
    </div>
  );
}
