import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings2, ShieldAlert, Wifi } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHotspotConfig, saveHotspotConfig } from "@/lib/hotspot-config.functions";

type Vendor = "test" | "mikrotik_hotspot" | "intelbras_zeus" | "intelbras_hotspot300_legacy";
type SelectableVendor = Exclude<Vendor, "intelbras_hotspot300_legacy">;

type FormState = {
  vendor: Vendor;
  displayName: string;
  apMac: string;
};

const EMPTY_FORM: FormState = {
  vendor: "mikrotik_hotspot",
  displayName: "",
  apMac: "",
};

const STATUS_LABELS: Record<string, string> = {
  not_configured: "Não configurado",
  configuration_incomplete: "Configuração incompleta",
  awaiting_radius: "Aguardando RADIUS",
  awaiting_secret: "Aguardando credencial segura",
  awaiting_homologation: "Aguardando homologação",
  simulation_only: "Somente simulação",
  operational: "Operacional",
  error: "Erro",
};

const VENDOR_HELP: Record<Vendor, string> = {
  test: "Somente para simulação. Não libera internet em equipamento real.",
  mikrotik_hotspot:
    "O MikroTik exigirá a etapa de integração com RADIUS. Esta tela não armazena o segredo RADIUS.",
  intelbras_zeus:
    "Para equipamentos Intelbras com portal cativo externo. Zeus OS/AP corporativo e HotSpot 300 original exigem homologação antes da liberação real.",
  intelbras_hotspot300_legacy:
    "HotSpot 300 com firmware original: integração separada e ainda não homologada. Não presuma compatibilidade com Zeus OS.",
};

const VENDOR_OPTIONS: Array<{ value: SelectableVendor; label: string }> = [
  { value: "mikrotik_hotspot", label: "MikroTik RouterOS com HotSpot/RADIUS" },
  { value: "intelbras_zeus", label: "Intelbras HotSpot / Portal Cativo" },
  { value: "test", label: "Simulação técnica" },
];

function normalizeVendor(value: string | undefined): Vendor {
  if (value === "intelbras_hotspot300_legacy") return "intelbras_zeus";
  if (value === "test" || value === "intelbras_zeus") {
    return value;
  }
  return "mikrotik_hotspot";
}

export function HotspotConfigDialog({
  kind,
  targetId,
  unitName,
}: {
  kind: "company" | "branch";
  targetId: string;
  unitName: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getHotspotConfig);
  const persistConfig = useServerFn(saveHotspotConfig);
  const queryKey = useMemo(() => ["hotspot-config", kind, targetId], [kind, targetId]);

  const configQuery = useQuery({
    queryKey,
    queryFn: () => fetchConfig({ data: { kind, targetId } }),
    enabled: open,
  });

  useEffect(() => {
    const config = configQuery.data?.config;
    if (!config) return;
    setForm({
      vendor: normalizeVendor(config.vendor),
      displayName: config.displayName ?? "",
      apMac: config.apMac ?? "",
    });
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      persistConfig({
        data: {
          kind,
          targetId,
          vendor: form.vendor,
          displayName: form.displayName,
          ssid: "",
          apMac: form.apMac,
          integrationMode:
            form.vendor === "mikrotik_hotspot"
              ? "radius"
              : form.vendor === "intelbras_zeus"
                ? "external_captive_portal"
                : form.vendor === "test"
                  ? "simulation"
                  : "pending_homologation",
          sessionTimeoutSeconds: null,
          idleTimeoutSeconds: null,
          downloadKbps: null,
          uploadKbps: null,
          limitSource: "equipment",
        },
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.setQueryData(queryKey, { config: result.config });
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      ),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="size-3.5" /> Configurar equipamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="size-5 text-primary" /> Equipamento Wi-Fi
          </DialogTitle>
          <DialogDescription>
            Configuração técnica de {unitName}. A URL e o QR Code permanentes não serão alterados.
          </DialogDescription>
        </DialogHeader>

        {configQuery.isLoading ? (
          <div className="grid min-h-56 place-items-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : configQuery.isError ? (
          <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Não foi possível carregar a configuração atual.</p>
              <p className="text-destructive/80">
                Feche esta janela e tente novamente. O salvamento fica bloqueado para evitar
                substituir a configuração existente por dados vazios.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Situação:</span>
              <Badge variant="outline">
                {STATUS_LABELS[configQuery.data?.config?.status ?? "not_configured"] ??
                  "Não configurado"}
              </Badge>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de equipamento</Label>
              <select
                value={form.vendor}
                onChange={(event) => set("vendor", event.target.value as Vendor)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {VENDOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{VENDOR_HELP[form.vendor]}</span>
              </div>
              {form.vendor === "intelbras_zeus" ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Documentação Intelbras nesta fase</p>
                  <p className="mt-1">
                    Esta opção cobre a família Intelbras usada para portal cativo. Para equipamentos
                    com Zeus OS / AP corporativo, considerar o fluxo de Portal Cativo Externo. Para
                    HotSpot 300 original, tratar como equipamento legado e homologar em aparelho
                    real antes de ativar a liberação automática.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`equipment-name-${targetId}`}>Nome do equipamento</Label>
                <Input
                  id={`equipment-name-${targetId}`}
                  value={form.displayName}
                  onChange={(event) => set("displayName", event.target.value)}
                  placeholder="Ex.: Roteador recepção"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ap-mac-${targetId}`}>MAC do equipamento/AP</Label>
                <Input
                  id={`ap-mac-${targetId}`}
                  value={form.apMac}
                  onChange={(event) => set("apMac", event.target.value)}
                  placeholder="Ex.: 00:11:22:33:44:55"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Senhas, segredos RADIUS, tokens e chaves não são solicitados nem enviados ao navegador
              nesta etapa.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={configQuery.isLoading || configQuery.isError || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
