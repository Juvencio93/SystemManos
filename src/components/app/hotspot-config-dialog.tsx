import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Settings2, ShieldAlert, Wifi } from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cancelHotspotHomologation, getHotspotConfig, getMikrotikProvisioning, saveHotspotConfig, setHotspotBlocked } from "@/lib/hotspot-config.functions";
import { useAccess } from "@/hooks/use-access";

type Vendor = "test" | "mikrotik_hotspot" | "intelbras_zeus" | "intelbras_hotspot300_legacy";
type SelectableVendor = Exclude<Vendor, "intelbras_hotspot300_legacy">;

type FormState = {
  vendor: Vendor;
  displayName: string;
  apMac: string;
  sessionTimeoutMinutes: string;
  idleTimeoutMinutes: string;
  downloadMbps: string;
  uploadMbps: string;
};

const EMPTY_FORM: FormState = {
  vendor: "mikrotik_hotspot",
  displayName: "",
  apMac: "",
  sessionTimeoutMinutes: "10",
  idleTimeoutMinutes: "2",
  downloadMbps: "10",
  uploadMbps: "3",
};

const STATUS_LABELS: Record<string, string> = {
  not_configured: "Não configurado",
  configuration_incomplete: "Configuração incompleta",
  awaiting_radius: "Aguardando RADIUS",
  awaiting_secret: "Aguardando credencial segura",
  awaiting_homologation: "Aguardando homologação",
  simulation_only: "Somente simulação",
  operational: "Operacional",
  blocked: "Bloqueado",
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
  portalSlug,
  baseUrl,
}: {
  kind: "company" | "branch";
  targetId: string;
  unitName: string;
  portalSlug: string;
  baseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const { data: access } = useAccess();
  const isClientPolicyView = access?.role === "matriz" || access?.role === "filial";
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getHotspotConfig);
  const fetchProvisioning = useServerFn(getMikrotikProvisioning);
  const persistConfig = useServerFn(saveHotspotConfig);
  const cancelHomologation = useServerFn(cancelHotspotHomologation);
  const changeBlocked = useServerFn(setHotspotBlocked);
  const queryKey = useMemo(() => ["hotspot-config", kind, targetId], [kind, targetId]);

  const configQuery = useQuery({
    queryKey,
    queryFn: () => fetchConfig({ data: { kind, targetId } }),
    enabled: open,
  });
  const provisioningQuery = useQuery({
    queryKey: ["mikrotik-provisioning", kind, targetId],
    queryFn: () => fetchProvisioning({ data: { kind, targetId } }),
    enabled: open && configQuery.data?.config?.vendor === "mikrotik_hotspot",
  });

  useEffect(() => {
    const config = configQuery.data?.config;
    if (!config) return;
    setForm({
      vendor: normalizeVendor(config.vendor),
      displayName: config.displayName ?? "",
      apMac: config.apMac ?? "",
      sessionTimeoutMinutes: String((config.sessionTimeoutSeconds ?? 600) / 60),
      idleTimeoutMinutes: String((config.idleTimeoutSeconds ?? 120) / 60),
      downloadMbps: String((config.downloadKbps ?? 10_000) / 1_000),
      uploadMbps: String((config.uploadKbps ?? 3_000) / 1_000),
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
          sessionTimeoutSeconds: Math.round(Number(form.sessionTimeoutMinutes) * 60),
          idleTimeoutSeconds: Math.round(Number(form.idleTimeoutMinutes) * 60),
          downloadKbps: Math.round(Number(form.downloadMbps) * 1_000),
          uploadKbps: Math.round(Number(form.uploadMbps) * 1_000),
          limitSource: "system",
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
  const actionMutation = useMutation({
    mutationFn: (action: "cancel" | "block" | "unblock") => action === "cancel"
      ? cancelHomologation({ data: { kind, targetId } })
      : changeBlocked({ data: { kind, targetId, blocked: action === "block" } }),
    onSuccess: async () => { toast.success("Status do equipamento atualizado."); await queryClient.invalidateQueries({ queryKey }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o equipamento."),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const portalUrl = `${baseUrl}/portal/${portalSlug}?hotspot=intelbras`;
  const mikrotikEntryUrl = `${baseUrl}/api/public/hotspot-entry`;
  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Endereço copiado.");
  };

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
            {!isClientPolicyView ? <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Situação:</span>
              <Badge variant="outline">
                {STATUS_LABELS[configQuery.data?.config?.status ?? "not_configured"] ??
                  "Não configurado"}
              </Badge>
            </div> : null}

            {!isClientPolicyView ? <div className="grid gap-2">
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
            </div> : null}

            {!isClientPolicyView ? <div className="grid gap-4">
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
            </div> : null}

            {form.vendor === "mikrotik_hotspot" ? (
              <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-medium">Política do Wi-Fi para visitantes</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aplicada pelo RADIUS a cada novo check-in. A sessão é encerrada ao atingir o
                    tempo máximo ou o período sem tráfego.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`session-timeout-${targetId}`}>Tempo máximo por check-in (minutos)</Label>
                    <Input id={`session-timeout-${targetId}`} type="number" min="1" max="1440" value={form.sessionTimeoutMinutes} onChange={(event) => set("sessionTimeoutMinutes", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`idle-timeout-${targetId}`}>Inatividade máxima (minutos)</Label>
                    <Input id={`idle-timeout-${targetId}`} type="number" min="1" max="1440" value={form.idleTimeoutMinutes} onChange={(event) => set("idleTimeoutMinutes", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`download-rate-${targetId}`}>Velocidade por visitante — download (Mbps)</Label>
                    <Input id={`download-rate-${targetId}`} type="number" min="1" max="1000" value={form.downloadMbps} onChange={(event) => set("downloadMbps", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`upload-rate-${targetId}`}>Velocidade por visitante — upload (Mbps)</Label>
                    <Input id={`upload-rate-${targetId}`} type="number" min="1" max="1000" value={form.uploadMbps} onChange={(event) => set("uploadMbps", event.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Padrão: 10 min de sessão, 2 min sem tráfego e 10 Mbps ↓ / 3 Mbps ↑ por visitante.</p>
              </div>
            ) : null}

            {!isClientPolicyView ? <p className="text-xs text-muted-foreground">
              Senhas, segredos RADIUS, tokens e chaves não são solicitados nem enviados ao navegador
              nesta etapa.
            </p> : null}

            {!isClientPolicyView ? <Accordion type="single" collapsible className="rounded-xl border border-primary/25 px-3">
              {form.vendor === "mikrotik_hotspot" ? (
                <AccordionItem value="mikrotik-kit" className="border-b">
                  <AccordionTrigger className="text-sm text-primary hover:no-underline">
                    Kit de instalação MikroTik
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4 text-xs text-muted-foreground">
                    <p>
                      Use o mesmo kit-base e o mesmo <code>login.html</code> em todas as RBs. A plataforma
                      identifica esta unidade pela identidade exclusiva do RouterOS.
                    </p>
                    {provisioningQuery.isLoading ? (
                      <p className="flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Gerando identidade…</p>
                    ) : provisioningQuery.data ? (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="font-medium text-foreground">Identidade desta RB</p>
                        <code className="mt-1 block break-all text-foreground">{provisioningQuery.data.routerIdentity}</code>
                        <p className="mt-2">No arquivo de ativação desta unidade, a única identificação pública é essa. Chaves WireGuard, RADIUS e certificado são emitidos separadamente e não aparecem aqui.</p>
                      </div>
                    ) : (
                      <p>Salve a configuração MikroTik e reabra esta janela para gerar a identidade do equipamento.</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href="/mikrotik/MANOS-HOTSPOT-BASE.rsc" download>Baixar kit-base .rsc</a>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href="/mikrotik/login.html" download>Baixar login.html universal</a>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href="/mikrotik/alogin.html" download>Baixar alogin.html universal</a>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href="/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf" target="_blank" rel="noreferrer">
                          Abrir guia de instalação
                        </a>
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
              <AccordionItem value="real-test" className="border-0">
                <AccordionTrigger className="text-sm text-primary hover:no-underline">
                  Preparar teste real do portal cativo
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4 text-xs text-muted-foreground">
                  <p>
                    Use uma rede/SSID de homologação. O roteador que distribui Wi-Fi deve operar
                    como Access Point/bridge, sem DHCP ou NAT: o equipamento cativo precisa enxergar
                    diretamente o celular.
                  </p>

                  <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <p className="font-medium text-foreground">MikroTik HotSpot</p>
                    <p>Inclua o domínio público no Walled Garden. O login.html universal envia o <code>router-id</code>; não use slug de campanha:</p>
                    <div className="flex gap-2">
                      <code className="min-w-0 flex-1 break-all rounded bg-background p-2 text-[11px] text-foreground">
                        {mikrotikEntryUrl}
                      </code>
                      <Button type="button" size="icon" variant="outline" onClick={() => copyText(mikrotikEntryUrl)}>
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                    <p>
                      O login.html deve enviar por POST os campos <code>slug</code>, <code>mac</code>,
                      <code>ip</code>, <code>link-login</code>, <code>link-login-only</code> e <code>link-orig</code>.
                      Após o check-in, o portal devolve o visitante ao HotSpot para autenticação.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <p className="font-medium text-foreground">Intelbras com Portal Cativo Externo</p>
                    <p>
                      Em Zeus OS/INC Cloud, habilite Portal Cativo Externo no SSID de teste, use o método
                      de autenticação compatível com o modelo e permita este endereço como destino/Walled Garden:
                    </p>
                    <div className="flex gap-2">
                      <code className="min-w-0 flex-1 break-all rounded bg-background p-2 text-[11px] text-foreground">
                        {portalUrl}
                      </code>
                      <Button type="button" size="icon" variant="outline" onClick={() => copyText(portalUrl)}>
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                    <p>
                      Como os parâmetros e a forma de liberação variam por linha Intelbras, este passo
                      valida o redirecionamento e o check-in. A liberação automática será ativada somente
                      após a homologação do modelo e firmware usados.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion> : null}
          </div>
        )}

        <DialogFooter>
          {!isClientPolicyView && configQuery.data?.config ? (
            <div className="mr-auto flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate("cancel")}>Cancelar homologação</Button>
              <Button type="button" size="sm" variant="destructive" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate("block")}>Bloquear equipamento</Button>
            </div>
          ) : null}
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
