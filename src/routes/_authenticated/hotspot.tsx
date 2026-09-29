import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, Router } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/hotspot")({
  head: () => ({ meta: [{ title: "Hotspot | Manos Tech" }] }),
  component: HotspotPage,
});

function HotspotPage() {
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
    </div>
  );
}
