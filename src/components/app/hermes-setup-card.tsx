import { Download, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HermesSetupCardProps {
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Integração do Hermes no menu Hotspot: apresenta o agente IA de
 * monitoramento proativo das RBs e disponibiliza o instalador
 * MANOS-HERMES-SETUP.rsc (arquivo universal — o mesmo em todas as RBs).
 */
export function HermesSetupCard({ expanded, onToggle }: HermesSetupCardProps) {
  return (
    <Card className="glass-panel border-primary/20">
      <CardHeader>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 text-left"
        >
          <Radar className="size-5 text-primary" />
          <span>
            <CardTitle>Monitoramento Hermes</CardTitle>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Agente IA que monitora as RBs de forma proativa — somente leitura
            </span>
          </span>
          <span className="ml-auto text-primary">{expanded ? "−" : "+"}</span>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            O Hermes coleta a cada 5 minutos CPU, memória, sessões PPPoE, interfaces,
            temperatura e logs de cada RB e envia alertas no Telegram. Nenhuma ação de
            escrita acontece sem a sua aprovação.
          </p>
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <p className="font-semibold">Instalador do agente na RB</p>
            <p className="text-muted-foreground">
              Arquivo universal: o mesmo em todas as RBs, sem editar nada. Na importação,
              a RB se cadastra sozinha e aguarda a sua aprovação no Telegram.
            </p>
            <Button variant="outline" asChild>
              <a href="/mikrotik/MANOS-HERMES-SETUP.rsc" download>
                <Download className="size-4" /> Baixar MANOS-HERMES-SETUP.rsc
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Terminal: <code>/import file-name=MANOS-HERMES-SETUP.rsc</code>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-semibold">1. Pré-requisitos</p>
              <p className="text-muted-foreground">
                RouterOS v7, RB com saída para a internet e kit já instalado. Importe{" "}
                <strong>depois</strong> do MANOS-MANAGEMENT-HARDENING.rsc.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-semibold">2. Instalação na RB</p>
              <p className="text-muted-foreground">
                Envie o arquivo à raiz de Files no WinBox. Depois, no New Terminal,
                rode <code>/import file-name=MANOS-HERMES-SETUP.rsc</code>. A RB gera o
                próprio par de chaves WireGuard — a chave privada nunca sai da RB.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-semibold">3. Aprovação no Telegram</p>
              <p className="text-muted-foreground">
                A RB envia o pedido de cadastro (só chave pública, identidade, modelo e
                versão). Aprove ou rejeite pelos botões no Telegram.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-semibold">4. Monitoramento ativo</p>
              <p className="text-muted-foreground">
                Aprovada, a RB recebe IP do túnel, usuário de leitura e entra no ciclo
                de monitoramento a cada 5 minutos.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
