import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2, ShieldAlert, Wifi } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import {
  getHotspotConfig,
  getMikrotikProvisioning,
  saveHotspotConfig,
} from "@/lib/hotspot-config.functions";
import { getBranchDisplayName } from "@/lib/name-utils";
import { cn } from "@/lib/utils";

type Vendor = "test" | "mikrotik_hotspot" | "intelbras_zeus" | "intelbras_hotspot300_legacy";

type FormState = {
  vendor: Vendor;
  displayName: string;
  apMac: string;
  routerIdentity: string;
  sessionTimeoutMinutes: string;
  idleTimeoutMinutes: string;
  downloadMbps: string;
  uploadMbps: string;
  checkinLimit: string;
  checkinBlockMinutes: string;
};

const EMPTY_FORM: FormState = {
  vendor: "mikrotik_hotspot",
  displayName: "",
  apMac: "",
  routerIdentity: "",
  sessionTimeoutMinutes: "10",
  idleTimeoutMinutes: "2",
  downloadMbps: "10",
  uploadMbps: "3",
  checkinLimit: "3",
  checkinBlockMinutes: "30",
};

function normalizeVendor(value: string | undefined): Vendor {
  if (value === "intelbras_hotspot300_legacy") return "intelbras_zeus";
  if (value === "test" || value === "intelbras_zeus") return value;
  return "mikrotik_hotspot";
}

type Unit = { kind: "company" | "branch"; id: string; label: string };

/**
 * Cartao expansivel "Wi-Fi dos visitantes" (capa da matriz e da filial):
 * a politica RADIUS do portal (sessao, inatividade, velocidades, limite
 * de check-ins e bloqueio) sem sair do dashboard. Usa as MESMAS funcoes
 * do dialogo de equipamento (Portais/Hotspot): mesma leitura, mesma
 * gravacao, mesmas permissoes (matriz edita; filial so visualiza).
 */
export function WifiVisitantesCard() {
  const { data: access } = useAccess();
  const role = access?.role ?? null;
  const companyId = access?.companyId ?? null;
  const branchId = access?.branchId ?? null;
  const canEdit = role === "matriz";
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(false);
  const [unitKey, setUnitKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const branchesQuery = useQuery({
    queryKey: ["wifi-card-branches", companyId, branchId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data } = await supabase
        .from("branches")
        .select("id, name, trade_name, legal_name, is_headquarters")
        .eq("company_id", companyId as string);
      return data ?? [];
    },
  });

  const units = useMemo<Unit[]>(() => {
    if (role === "filial") {
      if (!branchId) return [];
      const own = (branchesQuery.data ?? []).find((b) => b.id === branchId);
      return [
        {
          kind: "branch",
          id: branchId,
          label: own ? getBranchDisplayName(own) : "Minha unidade",
        },
      ];
    }
    if (role === "matriz" && companyId) {
      const filiais = (branchesQuery.data ?? [])
        .filter((b) => !b.is_headquarters)
        .map<Unit>((b) => ({ kind: "branch", id: b.id, label: getBranchDisplayName(b) }));
      return [{ kind: "company", id: companyId, label: "Matriz (sede)" }, ...filiais];
    }
    return [];
  }, [role, companyId, branchId, branchesQuery.data]);

  const selected = useMemo<Unit | null>(() => {
    if (!units.length) return null;
    return units.find((u) => `${u.kind}:${u.id}` === unitKey) ?? units[0] ?? null;
  }, [units, unitKey]);

  const fetchConfig = useServerFn(getHotspotConfig);
  const fetchProvisioning = useServerFn(getMikrotikProvisioning);
  const persistConfig = useServerFn(saveHotspotConfig);
  const queryKey = useMemo(
    () => ["hotspot-config", selected?.kind, selected?.id],
    [selected?.kind, selected?.id],
  );

  const configQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchConfig({ data: { kind: selected!.kind, targetId: selected!.id } }),
    enabled: Boolean(selected),
  });
  const provisioningQuery = useQuery({
    queryKey: ["mikrotik-provisioning", selected?.kind, selected?.id],
    queryFn: () =>
      fetchProvisioning({ data: { kind: selected!.kind, targetId: selected!.id } }),
    enabled: Boolean(selected) && configQuery.data?.config?.vendor === "mikrotik_hotspot",
  });

  useEffect(() => {
    const config = configQuery.data?.config;
    if (!config) return;
    setForm({
      vendor: normalizeVendor(config.vendor),
      displayName: config.displayName ?? "",
      apMac: config.apMac ?? "",
      routerIdentity: "",
      sessionTimeoutMinutes: String((config.sessionTimeoutSeconds ?? 600) / 60),
      idleTimeoutMinutes: String((config.idleTimeoutSeconds ?? 120) / 60),
      downloadMbps: String((config.downloadKbps ?? 10_000) / 1_000),
      uploadMbps: String((config.uploadKbps ?? 3_000) / 1_000),
      checkinLimit: String(config.checkinLimit ?? 3),
      checkinBlockMinutes: String(config.checkinBlockMinutes ?? 30),
    });
  }, [configQuery.data]);

  useEffect(() => {
    if (provisioningQuery.data?.routerIdentity) {
      setForm((current) => ({ ...current, routerIdentity: provisioningQuery.data.routerIdentity }));
    }
  }, [provisioningQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      persistConfig({
        data: {
          kind: selected!.kind,
          targetId: selected!.id,
          vendor: form.vendor,
          displayName: form.displayName,
          ssid: "",
          apMac: form.apMac,
          routerIdentity: form.routerIdentity,
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
          checkinLimit: Math.round(Number(form.checkinLimit)),
          checkinBlockMinutes: Math.round(Number(form.checkinBlockMinutes)),
          limitSource: "system",
        },
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.setQueryData(queryKey, { config: result.config });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      ),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (role !== "matriz" && role !== "filial") return null;
  if (!selected && !branchesQuery.isLoading) return null;

  const resumo = configQuery.isLoading
    ? "Carregando a política atual…"
    : configQuery.isError
      ? "Não foi possível carregar a política atual"
      : `${form.sessionTimeoutMinutes} min por check-in · ${form.downloadMbps}↓/${form.uploadMbps}↑ Mbps por visitante · ${form.checkinLimit} check-ins por aparelho`;

  const campo = (
    id: string,
    rotulo: string,
    chave: keyof FormState,
    min: number,
    max: number,
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`wifi-${id}`}>{rotulo}</Label>
      <Input
        id={`wifi-${id}`}
        type="number"
        min={min}
        max={max}
        disabled={!canEdit}
        value={form[chave]}
        onChange={(event) => set(chave, event.target.value)}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center gap-2 text-left"
        >
          <CardTitle className="flex items-center gap-2">
            <Wifi className="size-5 text-primary" /> Wi-Fi dos visitantes
            {selected ? (
              <span className="text-sm font-medium text-muted-foreground">— {selected.label}</span>
            ) : null}
          </CardTitle>
          <span className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block">{resumo}</span>
            <ChevronDown
              className={cn("size-4 text-primary transition-transform", expanded && "rotate-180")}
            />
          </span>
        </button>
      </CardHeader>

      {expanded ? (
        <CardContent className="space-y-5">
          {units.length > 1 ? (
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="wifi-unidade">Unidade</Label>
              <select
                id="wifi-unidade"
                value={`${selected!.kind}:${selected!.id}`}
                onChange={(event) => setUnitKey(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                {units.map((unit) => (
                  <option key={`${unit.kind}:${unit.id}`} value={`${unit.kind}:${unit.id}`}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {configQuery.isLoading ? (
            <div className="grid min-h-32 place-items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : configQuery.isError ? (
            <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <p>
                Não foi possível carregar a configuração atual. O salvamento fica bloqueado para
                não substituir a configuração existente por dados vazios.
              </p>
            </div>
          ) : form.vendor !== "mikrotik_hotspot" ? (
            <p className="text-sm text-muted-foreground">
              Este equipamento não usa a política RADIUS do sistema — as regras de sessão e
              velocidade dele são ajustadas no próprio aparelho.
            </p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">Política do Wi-Fi para visitantes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aplicada pelo RADIUS a cada novo check-in. A sessão é encerrada ao atingir o
                  tempo máximo ou o período sem tráfego.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {campo("session", "Tempo máximo por check-in (minutos)", "sessionTimeoutMinutes", 1, 1440)}
                {campo("idle", "Inatividade máxima (minutos)", "idleTimeoutMinutes", 1, 1440)}
                {campo("down", "Velocidade por visitante — download (Mbps)", "downloadMbps", 1, 1000)}
                {campo("up", "Velocidade por visitante — upload (Mbps)", "uploadMbps", 1, 1000)}
                {campo("limit", "Limite de check-ins por dispositivo", "checkinLimit", 0, 50)}
                {campo("block", "Bloqueio temporário após o limite (minutos)", "checkinBlockMinutes", 1, 1440)}
              </div>
              <p className="text-xs text-muted-foreground">
                Padrão: 10 min de sessão, 2 min sem tráfego, 10 Mbps ↓ / 3 Mbps ↑ e 3 check-ins
                por dispositivo. Use 0 para desativar o limite.
              </p>
              {canEdit ? (
                <div className="flex justify-end">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Salvar configuração
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Quem ajusta essas regras é a sua matriz. Fale com ela se precisar mudar algum
                  valor.
                </p>
              )}
            </>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
