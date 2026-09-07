import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { getBranchDisplayName, getCompanyDisplayName } from "@/lib/name-utils";

import { Handshake, ImagePlus, Loader2, Monitor, Palette, Pencil, Play, Plus, Smartphone, Square, Trash2, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { getPublicStorageUrl } from "@/lib/storage.functions";
import { LogoResolver } from "@/components/app/campaigns/LogoResolver";
import {
  campaignSchema,
  MAX_BANNER_FILE_BYTES,
  MAX_OTHER_FILE_BYTES,
  uploadCampaignAsset,
  uploadSponsorAsset,
  type Campaign,
  type CampaignFormState,
  type EditingCampaignState,
  type SponsorDraft,
  type UploadProgress,
} from "@/components/app/campaigns/campaign-editor-model";
import { CampaignPortalPreview } from "@/components/app/campaign-portal-preview";
import {
  normalizePortalAppearance,
  portalLogoPositions,
  portalVisualStyles,
  type PortalAppearance,
} from "@/lib/campaign-appearance";
import {
  normalizeSponsorDisplayType,
  type PortalSponsor,
  type SponsorDisplayType,
} from "@/lib/campaign-sponsors";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas | Manos Tech" },
      {
        name: "description",
        content:
          "Crie e ative campanhas por filial ou evento. Apenas uma campanha ativa por operação ao mesmo tempo.",
      },
      { property: "og:title", content: "Campanhas | Manos Tech" },
      {
        property: "og:description",
        content:
          "Crie e ative campanhas por filial ou evento. Apenas uma campanha ativa por operação ao mesmo tempo.",
      },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const { data: access } = useAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [editing, setEditing] = useState<EditingCampaignState | null>(null);
  const [colorsConfigured, setColorsConfigured] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [form, setForm] = useState<CampaignFormState>({
    name: "",
    description: "",
    target: "",
    redirect_url: "",
    appearance: normalizePortalAppearance(),
  });

  // New optimized state for direct uploads
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);

  // Track preview URLs created with URL.createObjectURL
  const [localPreviewUrls, setLocalPreviewUrls] = useState<string[]>([]);
  const [localLogoPreviewUrl, setLocalLogoPreviewUrl] = useState<string | null>(null);

  // Resolved signed URLs for existing storage assets
  const [resolvedBannerUrls, setResolvedBannerUrls] = useState<string[]>([]);
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(null);

  // Patrocinadores (somente campanhas do tipo Evento)
  const [sponsors, setSponsors] = useState<SponsorDraft[]>([]);
  const [removedSponsorIds, setRemovedSponsorIds] = useState<string[]>([]);

  const [uploading, setUploading] = useState<UploadProgress>({
    status: "idle",
    pendingCount: 0,
    totalCount: 0,
  });

  const companies = useQuery({
    queryKey: ["companies-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, trade_name, legal_name, logo_url")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: access?.role === "adm",
  });

  const branches = useQuery({
    queryKey: ["branches-options", access?.companyId, access?.role],
    queryFn: async () => {
      let query = supabase
        .from("branches")
        .select("id, name, trade_name, legal_name, company_id, is_headquarters, logo_url, active")
        .eq("active", true);

      if (access?.role === "matriz" && access.companyId) {
        query = query.eq("company_id", access.companyId);
      } else if (access?.role === "filial" && access.branchId) {
        query = query.eq("id", access.branchId);
      }

      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!access,
  });

  const events = useQuery({
    queryKey: ["events-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, company_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const campaigns = useQuery({
    queryKey: ["campaigns", access?.companyId, access?.branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(
          "id, name, description, status, started_at, ended_at, branch_id, event_id, company_id, logo_url, banner_urls, redirect_url, primary_color, accent_color, visual_style, logo_position, button_text, autoplay_enabled, show_arrows, show_indicators, show_progress_bar, quick_info_1, quick_info_2, quick_info_3",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isAdm = access?.role === "adm";
  const isMatriz = access?.role === "matriz";
  const isBranch = access?.role === "filial";

  const targetOptions: { value: string; label: string; isHeadquarters?: boolean }[] =
    useMemo(() => {
      const options: { value: string; label: string; isHeadquarters?: boolean }[] = [];

      const filialLimit = Number(access?.activationLimit ?? 0);
      const showFilialFeatures = access?.role === "adm" || filialLimit > 1;

      if (isMatriz && access?.companyId) {
        options.push({
          value: `company:${access.companyId}`,
          label: `${access.companyName || "Matriz"} — Matriz`,
          isHeadquarters: true,
        });
      }

      const branchOptions = (branches.data ?? [])
        .filter((b) => {
          if (isBranch) return b.id === access?.branchId;
          if (isMatriz) return !b.is_headquarters && showFilialFeatures;
          return true;
        })

        .map((b) => ({
          value: `branch:${b.id}`,
          label: b.is_headquarters
            ? `${getBranchDisplayName(b as import("@/lib/name-utils").Branch)} — Matriz`
            : `${getBranchDisplayName(b as import("@/lib/name-utils").Branch)} — Filial`,
          isHeadquarters: b.is_headquarters,
        }));

      options.push(...branchOptions);

      if (!isBranch) {
        const eventOptions = (events.data ?? []).map((e) => ({
          value: `event:${e.id}`,
          label: `Evento · ${e.name}`,
        }));
        options.push(...eventOptions);
      }

      return options;
    }, [isMatriz, isBranch, access, branches.data, events.data]);

  const isMatrizWithoutBranches = isMatriz && targetOptions.length === 1;
  const isFilialLocked = isBranch && targetOptions.length === 1;

  useEffect(() => {
    if (!access || branches.isLoading || editing) return;

    if (isMatriz && access.companyId && !form.target) {
      setForm((prev) => ({ ...prev, target: `company:${access.companyId}` }));
    } else if (isBranch && access.branchId && !form.target) {
      setForm((prev) => ({ ...prev, target: `branch:${access.branchId}` }));
    }
  }, [access, branches.isLoading, isMatriz, isBranch, editing, form.target]);

  const operationName = (branchId: string | null, eventId: string | null) => {
    if (branchId) {
      const branch = (branches.data ?? []).find((b) => b.id === branchId);
      if (!branch) return "Filial";
      return branch.is_headquarters
        ? `Matriz · ${getBranchDisplayName(branch as { name: string; trade_name?: string | null; legal_name?: string | null })}`
        : getBranchDisplayName(
            branch as { name: string; trade_name?: string | null; legal_name?: string | null },
          );
    }
    if (eventId) return (events.data ?? []).find((e) => e.id === eventId)?.name ?? "Evento";
    return "—";
  };

  const updateAppearance = (changes: Partial<PortalAppearance>) => {
    if ("primaryColor" in changes || "accentColor" in changes) setColorsConfigured(true);
    setForm((current) => ({
      ...current,
      appearance: normalizePortalAppearance({ ...current.appearance, ...changes }),
    }));
  };

  const previewCompanyName =
    targetOptions.find((option) => option.value === form.target)?.label.replace(/^(Matriz · |Evento · )/, "") ||
    "Sua empresa";
  const isEvent = form.target.startsWith("event:");

  const updateSponsor = (key: string, changes: Partial<SponsorDraft>) =>
    setSponsors((current) =>
      current.map((sponsor) => (sponsor.key === key ? { ...sponsor, ...changes } : sponsor)),
    );

  const removeSponsor = (key: string) =>
    setSponsors((current) => {
      const target = current.find((sponsor) => sponsor.key === key);
      if (target?.persistedId) {
        setRemovedSponsorIds((ids) => [...ids, target.persistedId as string]);
      }
      return current.filter((sponsor) => sponsor.key !== key);
    });

  const sponsorCompanyId = () =>
    isAdm
      ? form.target.startsWith("company:")
        ? form.target.split(":")[1]
        : access?.companyId
      : access?.companyId;

  const previewSponsors: PortalSponsor[] = isEvent
    ? sponsors
        .filter((sponsor) => sponsor.active)
        .map((sponsor) => ({
          id: sponsor.key,
          name: sponsor.name || "Patrocinador",
          displayType: sponsor.displayType,
          logoUrl: sponsor.logoUrl,
          bannerUrl: sponsor.bannerUrl,
          linkUrl: null,
        }))
    : [];

  const previewLogoUrl = localLogoPreviewUrl || resolvedLogoUrl || undefined;
  const previewBannerUrls = [...resolvedBannerUrls, ...localPreviewUrls];

  const resetForm = () => {
    let defaultTarget = "";
    if (isMatriz && access?.companyId) {
      defaultTarget = `company:${access.companyId}`;
    } else if (isBranch && access?.branchId) {
      defaultTarget = `branch:${access.branchId}`;
    }

    setForm({
      name: "",
      description: "",
      target: defaultTarget,
      redirect_url: "",
      appearance: normalizePortalAppearance(),
    });
    setColorsConfigured(false);

    // Revoke object URLs to avoid memory leaks
    localPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    if (localLogoPreviewUrl) URL.revokeObjectURL(localLogoPreviewUrl);

    setLogoUrl(null);
    setBannerUrls([]);
    setLocalPreviewUrls([]);
    setLocalLogoPreviewUrl(null);
    setResolvedBannerUrls([]);
    setResolvedLogoUrl(null);
    setSponsors([]);
    setRemovedSponsorIds([]);
    setUploading({ status: "idle", pendingCount: 0, totalCount: 0 });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = async (campaign: Campaign) => {
    setEditing({
      id: campaign.id,
      companyId: campaign.company_id,
      logoUrl: campaign.logo_url,
      bannerUrls: campaign.banner_urls || [],
    });

    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      target: campaign.branch_id
        ? `branch:${campaign.branch_id}`
        : campaign.event_id
          ? `event:${campaign.event_id}`
          : `company:${campaign.company_id}`,
      redirect_url: campaign.redirect_url ?? "",
      appearance: normalizePortalAppearance({
        primaryColor: campaign.primary_color ?? undefined,
        accentColor: campaign.accent_color ?? undefined,
        visualStyle: campaign.visual_style as PortalAppearance["visualStyle"] | undefined,
        logoPosition: campaign.logo_position as PortalAppearance["logoPosition"] | undefined,
        buttonText: campaign.button_text ?? undefined,
        autoplayEnabled: campaign.autoplay_enabled ?? undefined,
        showArrows: campaign.show_arrows ?? undefined,
        showIndicators: campaign.show_indicators ?? undefined,
        showProgressBar: campaign.show_progress_bar ?? undefined,
        quickInfo: [campaign.quick_info_1 ?? "", campaign.quick_info_2 ?? "", campaign.quick_info_3 ?? ""],
      }),
    });
    setColorsConfigured(Boolean(campaign.primary_color && campaign.accent_color));
    setLogoUrl(null);
    setBannerUrls([]);
    setLocalPreviewUrls([]);
    setLocalLogoPreviewUrl(null);
    setResolvedBannerUrls([]);
    setResolvedLogoUrl(null);
    setSponsors([]);
    setRemovedSponsorIds([]);
    setUploading({ status: "idle", pendingCount: 0, totalCount: 0 });
    setOpen(true);

    // Patrocinadores existem apenas em campanhas de evento.
    if (campaign.event_id) {
      const { data: sponsorRows } = await supabase
        .from("campaign_sponsors")
        .select("id, name, display_type, logo_path, banner_path, link_url, sort_order, active")
        .eq("campaign_id", campaign.id)
        .order("sort_order", { ascending: true });

      if (sponsorRows) {
        const drafts = await Promise.all(
          sponsorRows.map(async (row) => ({
            key: row.id,
            persistedId: row.id,
            name: row.name,
            displayType: normalizeSponsorDisplayType(row.display_type),
            logoPath: row.logo_path ?? null,
            logoUrl: row.logo_path
              ? await getPublicStorageUrl({
                  data: { bucket: "campaign-assets", path: row.logo_path },
                }).catch(() => null)
              : null,
            bannerPath: row.banner_path ?? null,
            bannerUrl: row.banner_path
              ? await getPublicStorageUrl({
                  data: { bucket: "campaign-assets", path: row.banner_path },
                }).catch(() => null)
              : null,
            linkUrl: row.link_url ?? "",
            active: row.active,
          })),
        );
        setSponsors(drafts);
      }
    }

    // Resolve storage paths to signed URLs
    if (campaign.banner_urls && campaign.banner_urls.length > 0) {
      try {
        const urls = await Promise.all(
          campaign.banner_urls.map(async (path) => {
            if (path.startsWith("http")) return path;
            return await getPublicStorageUrl({ data: { bucket: "campaign-assets", path } });
          }),
        );
        setResolvedBannerUrls(urls);
      } catch (err) {
        console.error("Failed to resolve banners:", err);
        toast.error("Algumas imagens não puderam ser carregadas.");
      }
    }

    if (campaign.logo_url) {
      if (campaign.logo_url.startsWith("http")) {
        setResolvedLogoUrl(campaign.logo_url);
      } else {
        try {
          const url = await getPublicStorageUrl({
            data: { bucket: "campaign-assets", path: campaign.logo_url },
          });
          setResolvedLogoUrl(url);
        } catch (err) {
          console.error("Failed to resolve logo:", err);
        }
      }
    }
  };

  const saveCampaign = useMutation({
    mutationFn: async () => {
      if (uploading.pendingCount > 0) {
        throw new Error("Aguarde o término dos envios das imagens.");
      }

      const parsed = campaignSchema.parse(form);
      const appearance = normalizePortalAppearance(form.appearance);
      const [kind, id] = parsed.target.split(":") as ["company" | "branch" | "event", string];

      let companyId = access?.companyId;
      let branchId = kind === "branch" ? id : null;
      let eventId = kind === "event" ? id : null;

      if (kind === "company") {
        branchId = null;
        eventId = null;
      }

      if (isAdm) {
        interface ResourceOwner {
          company_id: string;
        }
        const owner = (
          kind === "branch"
            ? (branches.data ?? []).find((b) => b.id === id)
            : kind === "company"
              ? (companies.data ?? []).find((c) => c.id === id)
              : (events.data ?? []).find((e) => e.id === id)
        ) as ResourceOwner | undefined;
        companyId = owner?.company_id || (kind === "company" ? id : null);
      }

      if (!companyId) throw new Error("Empresa não identificada");

      // Extract paths from resolved URLs for storage if they were paths before
      // Rule: save path stable: companyId/campaignId/name.ext
      // However, we are saving them as companyId/kind/uuid.ext currently.
      // We'll keep the current successful pattern but ensure it's a path.
      const getAssetPath = (urlOrPath: string) => {
        if (!urlOrPath) return null;
        if (urlOrPath.startsWith("http")) {
          // If it's a Supabase public URL, extract the path
          if (urlOrPath.includes("/storage/v1/object/public/campaign-assets/")) {
            return urlOrPath.split("/storage/v1/object/public/campaign-assets/")[1];
          }
          return urlOrPath; // External URL
        }
        return urlOrPath; // Already a path
      };

      const finalLogoUrl = logoUrl
        ? getAssetPath(logoUrl)
        : editing?.logoUrl
          ? getAssetPath(editing.logoUrl)
          : null;

      const currentBannerPaths = (editing?.bannerUrls ?? [])
        .map(getAssetPath)
        .filter(Boolean) as string[];
      const newBannerPaths = bannerUrls.map(getAssetPath).filter(Boolean) as string[];
      const finalBannerUrls = [...currentBannerPaths, ...newBannerPaths];

      const payload = {
        name: parsed.name,
        branch_id: branchId,
        event_id: eventId,
        company_id: companyId,
        description: parsed.description?.trim() ? parsed.description : null,
        redirect_url: parsed.redirect_url || null,
        logo_url: finalLogoUrl as string | null,
        banner_urls: finalBannerUrls,
        primary_color: appearance.primaryColor,
        accent_color: appearance.accentColor,
        visual_style: appearance.visualStyle,
        logo_position: appearance.logoPosition,
        button_text: appearance.buttonText,
        autoplay_enabled: appearance.autoplayEnabled,
        show_arrows: appearance.showArrows,
        show_indicators: appearance.showIndicators,
        show_progress_bar: appearance.showProgressBar,
        quick_info_1: appearance.quickInfo[0] || null,
        quick_info_2: appearance.quickInfo[1] || null,
        quick_info_3: appearance.quickInfo[2] || null,
      };

      let campaignId = editing?.id ?? null;

      if (editing) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from("campaigns")
          .insert({
            ...payload,
            status: "ativa" as const, // Força ativação na criação conforme solicitado
          })
          .select("id")
          .single();

        if (error) throw error;
        campaignId = created.id;
      }

      // Patrocinadores: exclusivos de campanhas do tipo Evento.
      if (campaignId && eventId) {
        if (removedSponsorIds.length > 0) {
          const { error } = await supabase
            .from("campaign_sponsors")
            .delete()
            .in("id", removedSponsorIds);
          if (error) throw error;
        }

        const validSponsors = sponsors.filter(
          (sponsor) =>
            sponsor.name.trim().length > 0 &&
            (sponsor.displayType === "banner" ? sponsor.bannerPath : sponsor.logoPath),
        );

        for (const [index, sponsor] of validSponsors.entries()) {
          const row = {
            campaign_id: campaignId,
            name: sponsor.name.trim().slice(0, 120),
            display_type: sponsor.displayType,
            logo_path: sponsor.logoPath,
            banner_path: sponsor.bannerPath,
            link_url: sponsor.linkUrl.trim() || null,
            sort_order: index,
            active: sponsor.active,
          };

          const { error } = sponsor.persistedId
            ? await supabase.from("campaign_sponsors").update(row).eq("id", sponsor.persistedId)
            : await supabase.from("campaign_sponsors").insert(row);
          if (error) throw error;
        }
      }

      return;
    },
    onSuccess: () => {
      toast.success(editing ? "Campanha atualizada." : "Campanha criada e ativada.");
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (error: unknown) => {
      console.error("Save campaign error:", error);
      const err = error as { message?: string; details?: string };
      const message = err.message || err.details || "Não foi possível salvar a campanha.";
      toast.error(
        error instanceof z.ZodError ? (error.issues[0]?.message ?? "Dados inválidos") : message,
        {
          duration: 7000,
        },
      );
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ativa" | "encerrada" }) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.status === "ativa" ? "Campanha ativada." : "Campanha encerrada.");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
    onError: () => toast.error("Não foi possível alterar o status."),
  });

  // Track all preview URLs for cleanup
  const allCurrentPreviews = useMemo(() => {
    return [...localPreviewUrls, ...(localLogoPreviewUrl ? [localLogoPreviewUrl] : [])];
  }, [localPreviewUrls, localLogoPreviewUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      allCurrentPreviews.forEach((url) => {
        if (url.startsWith("blob:")) {
          console.log("[Preview] Revoking URL on unmount:", url);
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [allCurrentPreviews]);

  return (
    <div>
      <PageHeader
        title={<span className="font-display font-black tracking-tight">Campanhas</span>}
        subtitle={<span className="text-base opacity-80">Crie e ative campanhas por filial ou evento para sua operação.</span>}
        action={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="shadow-glow">
                <Plus className="size-4" /> Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] space-y-8 overflow-y-auto pr-1">
                {/* CONFIGURAÇÃO DA CAMPANHA */}
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                    1. Configuração da campanha
                  </h3>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome interno da campanha *</Label>
                    <p className="text-xs text-muted-foreground">
                      Usado apenas para identificação no sistema. Não será exibido aos visitantes.
                    </p>
                    <Input
                      id="name"
                      placeholder="Ex.: Campanha Wi-Fi - Agosto 2026"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Chamada exibida no portal</Label>
                    <p className="text-xs text-muted-foreground">
                      Frase curta que o visitante verá no portal. Máx. 120 caracteres.
                    </p>
                    <Textarea
                      id="description"
                      placeholder="Ex.: Conecte-se e aproveite nossas ofertas."
                      maxLength={120}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                    <div className="flex justify-end">
                      <span
                        className={`text-[10px] ${form.description.length >= 110 ? "text-destructive font-bold" : "text-muted-foreground"}`}
                      >
                        {form.description.length}/120
                      </span>
                    </div>
                  </div>

                  {isAdm && (
                    <div className="space-y-2">
                      <Label>Empresa (ADM)</Label>
                      <Select
                        value={access?.companyId || ""}
                        disabled={true} // O contexto de empresa no ADM é gerido globalmente ou pelo seletor de topo
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {(companies.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {getCompanyDisplayName(
                                c as {
                                  name: string;
                                  trade_name?: string | null;
                                  legal_name?: string | null;
                                },
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {isMatrizWithoutBranches || isFilialLocked ? (
                    <div className="space-y-1">
                      <Label>Local de exibição da campanha *</Label>
                      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                        {isMatrizWithoutBranches
                          ? (targetOptions[0]?.label ?? "")
                          : (targetOptions[0]?.label ?? "")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Local de exibição da campanha *</Label>
                      <p className="text-xs text-muted-foreground">
                        Selecione em qual operação a campanha será exibida no portal cativo.
                      </p>
                      <Select
                        value={form.target}
                        onValueChange={(v) => setForm({ ...form, target: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={undefined} />
                        </SelectTrigger>
                        <SelectContent>
                          {targetOptions.some((o) => o.isHeadquarters) && (
                            <SelectGroup>
                              <SelectLabel>Matriz</SelectLabel>
                              {targetOptions
                                .filter((o) => o.isHeadquarters)
                                .map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label.replace(" — Matriz", "")}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}

                          {targetOptions.some(
                            (o) => o.value.startsWith("branch:") && !o.isHeadquarters,
                          ) && (
                            <SelectGroup>
                              <SelectLabel>Filial</SelectLabel>
                              {targetOptions
                                .filter((o) => o.value.startsWith("branch:") && !o.isHeadquarters)
                                .map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label.replace(" — Filial", "")}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}

                          {targetOptions.some((o) => o.value.startsWith("event:")) && (
                            <SelectGroup>
                              <SelectLabel>Evento</SelectLabel>
                              {targetOptions
                                .filter((o) => o.value.startsWith("event:"))
                                .map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label.replace("Evento · ", "")}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="redirect_url">Redirecionamento após o acesso (Opcional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Após o check-in, o visitante será direcionado automaticamente para este
                      endereço.
                    </p>
                    <Input
                      id="redirect_url"
                      type="url"
                      placeholder="Ex.: https://instagram.com/manostech"
                      value={form.redirect_url}
                      onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                    />
                  </div>
                </section>

                {/* IDENTIDADE DO PORTAL */}
                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                    2. Identidade do Portal
                  </h3>

                  <div className="space-y-4">
                    <Label>Logo do Portal</Label>
                    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
                      <div className="grid size-32 place-items-center overflow-hidden rounded-2xl border bg-background shadow-sm relative">
                        {uploading.status === "uploading" &&
                          uploading.message?.includes("logo") && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                              <Loader2 className="size-6 animate-spin text-primary" />
                            </div>
                          )}
                        {localLogoPreviewUrl ? (
                          <img
                          loading="lazy"
                          decoding="async"
                            src={localLogoPreviewUrl}
                            alt="Preview Local"
                            className="h-full w-full object-contain p-2"
                          />
                        ) : resolvedLogoUrl ? (
                          <img
                          loading="lazy"
                          decoding="async"
                            src={resolvedLogoUrl}
                            alt="Preview Remoto"
                            className="h-full w-full object-contain p-2"
                          />
                        ) : editing?.logoUrl ? (
                          <LogoResolver path={editing.logoUrl} />
                        ) : (
                          (() => {
                            const targetParts = form.target.split(":");
                            const kind = targetParts[0];
                            const id = targetParts[1];
                            let inheritedLogo = null;

                            if (kind === "branch" && id) {
                              const branch = branches.data?.find((b) => b.id === id);
                              inheritedLogo = branch?.logo_url || access?.logoUrl;
                            } else if (kind === "event" && id) {
                              // Eventos herdam da matriz (access.logoUrl já resolveu matriz se for adm/matriz)
                              inheritedLogo = access?.logoUrl;
                            } else {
                              // Se não tiver target selecionado, mostra a logo do contexto do usuário
                              inheritedLogo = access?.logoUrl;
                            }

                            return inheritedLogo ? (
                              <img
                          loading="lazy"
                          decoding="async"
                                src={inheritedLogo}
                                alt="Herdada"
                                className="h-full w-full object-contain p-2 opacity-60"
                              />
                            ) : (
                              <Wifi className="size-10 text-muted-foreground/40" />
                            );
                          })()
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="relative cursor-pointer"
                        >
                          <Plus className="mr-2 size-4" />
                          {editing?.logoUrl || logoUrl ? "Alterar logo" : "Adicionar logo"}
                          <input
                            type="file"
                            className="absolute inset-0 cursor-pointer opacity-0"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={uploading.status === "uploading"}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (file.size > MAX_OTHER_FILE_BYTES) {
                                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                                toast.error(
                                  `A imagem possui ${sizeMB} MB. O limite é de 5 MB por imagem.`,
                                );
                                e.target.value = "";
                                return;
                              }

                              const companyId = isAdm
                                ? form.target.startsWith("company:")
                                  ? form.target.split(":")[1]
                                  : access?.companyId
                                : access?.companyId;

                              if (!companyId) {
                                toast.error(
                                  "Selecione a empresa ou operação antes de enviar imagens.",
                                );
                                e.target.value = "";
                                return;
                              }

                              try {
                                setUploading({
                                  status: "uploading",
                                  message: "Enviando logo...",
                                  pendingCount: 1,
                                  totalCount: 1,
                                });

                                // Show local preview immediately
                                const localUrl = URL.createObjectURL(file);
                                setLocalLogoPreviewUrl(localUrl);

                                const path = await uploadCampaignAsset(companyId, "logo", file);

                                // Resolve to signed URL after upload
                                const signedUrl = await getPublicStorageUrl({
                                  data: { bucket: "campaign-assets", path },
                                });
                                setResolvedLogoUrl(signedUrl);

                                setLogoUrl(path);
                                setUploading({ status: "idle", pendingCount: 0, totalCount: 0 });
                                toast.success("Logo enviada com sucesso.");
                              } catch (err: unknown) {
                                const message =
                                  err instanceof Error ? err.message : "Erro desconhecido";
                                setUploading({ status: "error", pendingCount: 0, totalCount: 0 });
                                toast.error(message);
                              } finally {
                                e.target.value = "";
                              }
                            }}
                          />
                        </Button>
                        <p className="text-[10px] text-muted-foreground">
                          PNG, JPG ou WEBP • Máximo 5 MB
                        </p>
                      </div>

                      {(logoUrl || editing?.logoUrl) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive"
                          disabled={uploading.status === "uploading"}
                          onClick={() => {
                            if (logoUrl) setLogoUrl(null);
                            else setEditing({ ...editing!, logoUrl: null });
                          }}
                        >
                          Remover logo personalizada
                        </Button>
                      )}
                    </div>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Se não enviar uma logo, o portal usará automaticamente a identidade da filial
                      ou matriz.
                    </p>
                  </div>
                </section>

                {/* CONTEÚDO DO PORTAL */}
                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                    3. Conteúdo do Portal
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <ImagePlus className="size-4" /> Banners (carrossel)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Adicione os banners que serão exibidos no carrossel. Recomendado: proporção
                      16:9.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {localPreviewUrls.map((url, index) => (
                        <div
                          key={`local-${index}`}
                          className="group relative aspect-[16/9] overflow-hidden rounded-lg border bg-muted"
                        >
                          <img
                          loading="lazy"
                          decoding="async"
                            src={url}
                            alt={`Banner preview ${index + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => console.error("Banner preview failed:", e)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              // We do not revoke here as it might be used by browser cache,
                              // we revoke on modal close or unmount
                              setLocalPreviewUrls((prev) => prev.filter((_, i) => i !== index));
                              setBannerUrls((prev) => prev.filter((_, i) => i !== index));
                            }}
                            className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 shadow-sm"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}

                      {resolvedBannerUrls.map((url, index) => (
                        <div
                          key={`remote-${index}`}
                          className="group relative aspect-[16/9] overflow-hidden rounded-lg border bg-muted"
                        >
                          <img
                          loading="lazy"
                          decoding="async"
                            src={url}
                            alt={`Banner atual ${index + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              console.error("Signed URL failed:", e);
                              (e.target as HTMLImageElement).src = ""; // Clear src to avoid loop
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setResolvedBannerUrls((prev) => prev.filter((_, i) => i !== index));
                              setEditing((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      bannerUrls: prev.bannerUrls.filter((_, i) => i !== index),
                                    }
                                  : null,
                              );
                            }}
                            className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 shadow-sm"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Loading placeholders if editing and resolved URLs are still pending */}
                      {editing &&
                        resolvedBannerUrls.length < editing.bannerUrls.length &&
                        Array.from({
                          length: editing.bannerUrls.length - resolvedBannerUrls.length,
                        }).map((_, i) => (
                          <div
                            key={`loading-${i}`}
                            className="flex aspect-[16/9] items-center justify-center rounded-lg border bg-muted/50"
                          >
                            <Loader2 className="size-6 animate-spin text-muted-foreground/20" />
                          </div>
                        ))}

                      <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/10 transition-colors hover:bg-muted/20">
                        <Plus className="size-5 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Adicionar banner
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          disabled={uploading.status === "uploading"}
                          onChange={async (e) => {
                            const selectedFiles = Array.from(e.target.files ?? []);
                            if (selectedFiles.length === 0) return;

                            const companyId = isAdm
                              ? form.target.startsWith("company:")
                                ? form.target.split(":")[1]
                                : access?.companyId
                              : access?.companyId;

                            if (!companyId) {
                              toast.error(
                                "Selecione a empresa ou operação antes de enviar imagens.",
                              );
                              e.target.value = "";
                              return;
                            }

                            const validFiles = selectedFiles.filter((f) => {
                              if (f.size > MAX_BANNER_FILE_BYTES) {
                                const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
                                toast.error(
                                  `A imagem possui ${sizeMB} MB. O limite é de 10 MB por imagem.`,
                                );
                                return false;
                              }
                              return true;
                            });

                            if (validFiles.length === 0) {
                              e.target.value = "";
                              return;
                            }

                            setUploading({
                              status: "uploading",
                              pendingCount: validFiles.length,
                              totalCount: validFiles.length,
                              message: `Enviando imagem 1 de ${validFiles.length}...`,
                            });

                            const newPaths: string[] = [];
                            let current = 0;

                            for (const file of validFiles) {
                              current++;
                              setUploading((prev) => ({
                                ...prev,
                                message: `Enviando imagem ${current} de ${validFiles.length}...`,
                                pendingCount: validFiles.length - current + 1,
                              }));

                              try {
                                // 1. Create local URL with URL.createObjectURL(file)
                                const localUrl = URL.createObjectURL(file);

                                // 2. Save it directly to the visual preview state
                                setLocalPreviewUrls((prev) => [...prev, localUrl]);

                                // 3. Upload file
                                const path = await uploadCampaignAsset(companyId, "banner", file);

                                // 4. Attempt to resolve Signed URL, but keep local preview visible
                                try {
                                  const signedUrl = await getPublicStorageUrl({
                                    data: { bucket: "campaign-assets", path },
                                  });

                                  // 5. Replace local blob: URL ONLY after confirming success
                                  setResolvedBannerUrls((prev) => [...prev, signedUrl]);
                                  setLocalPreviewUrls((prev) =>
                                    prev.filter((url) => url !== localUrl),
                                  );
                                } catch (resolveErr) {
                                  console.error(
                                    "Signed URL resolution failed, keeping local preview:",
                                    resolveErr,
                                  );
                                  // Preservation of local preview is handled by NOT removing it from localPreviewUrls here
                                }

                                newPaths.push(path);
                              } catch (err: unknown) {
                                const message =
                                  err instanceof Error ? err.message : "Erro desconhecido";
                                toast.error(`Falha no envio de ${file.name}: ${message}`);
                              }
                            }

                            if (newPaths.length > 0) {
                              setBannerUrls((prev: string[]) => [...prev, ...newPaths]);
                              toast.success(`${newPaths.length} banner(s) enviado(s).`);
                            }

                            setUploading({ status: "idle", pendingCount: 0, totalCount: 0 });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      Máximo 10 MB por imagem.
                    </p>
                  </div>
                </section>

                {/* PATROCINADORES E APOIADORES — exclusivo de campanhas do tipo Evento */}
                {isEvent && (
                  <section className="space-y-4 border-t pt-6">
                    <div className="flex items-center gap-2">
                      <Handshake className="size-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                          Patrocinadores e apoiadores
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Exibidos em um carrossel próprio no final do portal, sem competir com o
                          banner do evento nem com o check-in.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {sponsors.map((sponsor, index) => (
                        <div
                          key={sponsor.key}
                          className="space-y-3 rounded-xl border bg-muted/10 p-4"
                        >
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                            <div className="space-y-1">
                              <Label htmlFor={`sponsor-name-${sponsor.key}`}>Nome da empresa *</Label>
                              <Input
                                id={`sponsor-name-${sponsor.key}`}
                                value={sponsor.name}
                                maxLength={120}
                                placeholder="Ex.: Loja Parceira"
                                onChange={(event) =>
                                  updateSponsor(sponsor.key, { name: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Ordem</Label>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-label="Subir patrocinador"
                                  disabled={index === 0}
                                  onClick={() =>
                                    setSponsors((current) => {
                                      const next = [...current];
                                      const [item] = next.splice(index, 1);
                                      if (item) next.splice(index - 1, 0, item);
                                      return next;
                                    })
                                  }
                                >
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-label="Descer patrocinador"
                                  disabled={index === sponsors.length - 1}
                                  onClick={() =>
                                    setSponsors((current) => {
                                      const next = [...current];
                                      const [item] = next.splice(index, 1);
                                      if (item) next.splice(index + 1, 0, item);
                                      return next;
                                    })
                                  }
                                >
                                  ↓
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-end justify-end gap-3">
                              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                                Ativo
                                <Switch
                                  checked={sponsor.active}
                                  onCheckedChange={(checked) =>
                                    updateSponsor(sponsor.key, { active: checked })
                                  }
                                />
                              </label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label="Excluir patrocinador"
                                className="text-destructive"
                                onClick={() => removeSponsor(sponsor.key)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Tipo de divulgação</Label>
                              <Select
                                value={sponsor.displayType}
                                onValueChange={(value) =>
                                  updateSponsor(sponsor.key, {
                                    displayType: value as SponsorDisplayType,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="logo">Logo</SelectItem>
                                  <SelectItem value="banner">Mini banner</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`sponsor-link-${sponsor.key}`}>Link (opcional)</Label>
                              <Input
                                id={`sponsor-link-${sponsor.key}`}
                                type="url"
                                placeholder="https://"
                                value={sponsor.linkUrl}
                                onChange={(event) =>
                                  updateSponsor(sponsor.key, { linkUrl: event.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Logo {sponsor.displayType === "logo" ? "*" : "(opcional)"}</Label>
                              <div className="grid h-20 place-items-center overflow-hidden rounded-lg border bg-background p-2">
                                {sponsor.logoUrl ? (
                                  <img
                                    src={sponsor.logoUrl}
                                    alt={`Logo de ${sponsor.name || "patrocinador"}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <ImagePlus className="size-5 text-muted-foreground/50" />
                                )}
                              </div>
                              <Button type="button" variant="outline" size="sm" className="relative w-full cursor-pointer">
                                {sponsor.logoUrl ? "Alterar logo" : "Enviar logo"}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                  className="absolute inset-0 cursor-pointer opacity-0"
                                  onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (!file) return;
                                    const companyId = sponsorCompanyId();
                                    if (!companyId) {
                                      toast.error("Selecione a operação antes de enviar imagens.");
                                      return;
                                    }
                                    try {
                                      const path = await uploadSponsorAsset(
                                        companyId,
                                        "sponsor-logo",
                                        file,
                                      );
                                      const url = await getPublicStorageUrl({
                                        data: { bucket: "campaign-assets", path },
                                      });
                                      updateSponsor(sponsor.key, { logoPath: path, logoUrl: url });
                                      toast.success("Logo do patrocinador enviada.");
                                    } catch (error: unknown) {
                                      toast.error(
                                        error instanceof Error ? error.message : "Erro no envio.",
                                      );
                                    }
                                  }}
                                />
                              </Button>
                              <p className="text-[10px] text-muted-foreground">
                                Proporção original preservada • Máximo 2 MB
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Mini banner {sponsor.displayType === "banner" ? "*" : "(opcional)"}
                              </Label>
                              <div className="grid aspect-[4/1] place-items-center overflow-hidden rounded-lg border bg-background">
                                {sponsor.bannerUrl ? (
                                  <img
                                    src={sponsor.bannerUrl}
                                    alt={`Mini banner de ${sponsor.name || "patrocinador"}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <ImagePlus className="size-5 text-muted-foreground/50" />
                                )}
                              </div>
                              <Button type="button" variant="outline" size="sm" className="relative w-full cursor-pointer">
                                {sponsor.bannerUrl ? "Alterar mini banner" : "Enviar mini banner"}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="absolute inset-0 cursor-pointer opacity-0"
                                  onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (!file) return;
                                    const companyId = sponsorCompanyId();
                                    if (!companyId) {
                                      toast.error("Selecione a operação antes de enviar imagens.");
                                      return;
                                    }
                                    try {
                                      const path = await uploadSponsorAsset(
                                        companyId,
                                        "sponsor-banner",
                                        file,
                                      );
                                      const url = await getPublicStorageUrl({
                                        data: { bucket: "campaign-assets", path },
                                      });
                                      updateSponsor(sponsor.key, {
                                        bannerPath: path,
                                        bannerUrl: url,
                                      });
                                      toast.success("Mini banner do patrocinador enviado.");
                                    } catch (error: unknown) {
                                      toast.error(
                                        error instanceof Error ? error.message : "Erro no envio.",
                                      );
                                    }
                                  }}
                                />
                              </Button>
                              <p className="text-[10px] text-muted-foreground">
                                Formato 4:1 recomendado • Máximo 3 MB
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSponsors((current) => [
                          ...current,
                          {
                            key: crypto.randomUUID(),
                            persistedId: null,
                            name: "",
                            displayType: "logo",
                            logoPath: null,
                            logoUrl: null,
                            bannerPath: null,
                            bannerUrl: null,
                            linkUrl: "",
                            active: true,
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 size-4" /> Adicionar patrocinador
                    </Button>
                  </section>
                )}

                <section className="space-y-5 border-t pt-6">
                  <div className="flex items-center gap-2">
                    <Palette className="size-4 text-primary" />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                        4. Aparência do portal
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Personalize a experiência visual sem alterar o link, o QR Code ou as regras da campanha.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="primary_color">Cor principal</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary_color"
                          type="color"
                          value={form.appearance.primaryColor}
                          onChange={(event) => updateAppearance({ primaryColor: event.target.value })}
                          className="h-10 w-14 p-1"
                        />
                        <Input
                          value={form.appearance.primaryColor}
                          onChange={(event) => updateAppearance({ primaryColor: event.target.value })}
                          maxLength={7}
                          aria-label="Código da cor principal"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accent_color">Cor de destaque</Label>
                      <div className="flex gap-2">
                        <Input
                          id="accent_color"
                          type="color"
                          value={form.appearance.accentColor}
                          onChange={(event) => updateAppearance({ accentColor: event.target.value })}
                          className="h-10 w-14 p-1"
                        />
                        <Input
                          value={form.appearance.accentColor}
                          onChange={(event) => updateAppearance({ accentColor: event.target.value })}
                          maxLength={7}
                          aria-label="Código da cor de destaque"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Estilo visual</Label>
                      <Select
                        value={colorsConfigured ? form.appearance.visualStyle : ""}
                        disabled={!colorsConfigured}
                        onValueChange={(value) => updateAppearance({ visualStyle: value as PortalAppearance["visualStyle"] })}
                      >
                        <SelectTrigger><SelectValue placeholder={colorsConfigured ? "Escolha um estilo" : "Defina as cores primeiro"} /></SelectTrigger>
                        <SelectContent>
                          {portalVisualStyles.map((style) => (
                            <SelectItem key={style} value={style} className="capitalize">{style}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Posicionamento da logo</Label>
                      <Select
                        value={form.appearance.logoPosition}
                        onValueChange={(value) => updateAppearance({ logoPosition: value as PortalAppearance["logoPosition"] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {portalLogoPositions.map((position) => (
                            <SelectItem key={position} value={position}>
                              {{ left: "Esquerda", center: "Centro", right: "Direita" }[position]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="button_text">Texto do botão de conexão</Label>
                    <Input
                      id="button_text"
                      value={form.appearance.buttonText}
                      maxLength={60}
                      placeholder="Conectar ao Wi-Fi grátis"
                      onChange={(event) => updateAppearance({ buttonText: event.target.value })}
                    />
                  </div>

                  <div className="grid gap-3 rounded-xl border bg-muted/15 p-4 sm:grid-cols-2">
                    {([
                      ["autoplayEnabled", "Autoplay do carrossel"],
                      ["showArrows", "Exibir setas"],
                      ["showIndicators", "Exibir indicadores"],
                      ["showProgressBar", "Exibir barra de progresso"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                        {label}
                        <Switch
                          checked={form.appearance[key]}
                          onCheckedChange={(checked) => updateAppearance({ [key]: checked })}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Informações rápidas (opcional)</Label>
                    <p className="text-xs text-muted-foreground">Inclua até três pequenos destaques para aparecerem perto do banner.</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {form.appearance.quickInfo.map((item, index) => (
                        <Input
                          key={index}
                          value={item}
                          maxLength={48}
                          placeholder={`Informação ${index + 1}`}
                          onChange={(event) => {
                            const quickInfo = [...form.appearance.quickInfo] as [string, string, string];
                            quickInfo[index] = event.target.value;
                            updateAppearance({ quickInfo });
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Prévia do portal</p>
                        <p className="text-xs text-muted-foreground">A aparência abaixo acompanha as opções desta campanha antes de salvar.</p>
                      </div>
                      <div className="flex rounded-lg border p-1">
                        <Button type="button" variant={previewMode === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setPreviewMode("desktop")}>
                          <Monitor className="mr-1 size-3.5" /> Desktop
                        </Button>
                        <Button type="button" variant={previewMode === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setPreviewMode("mobile")}>
                          <Smartphone className="mr-1 size-3.5" /> Celular
                        </Button>
                      </div>
                    </div>
                    <CampaignPortalPreview
                      appearance={form.appearance}
                      companyName={previewCompanyName}
                      callout={form.description}
                      logoUrl={previewLogoUrl}
                      bannerUrls={previewBannerUrls}
                      mode={previewMode}
                      sponsors={previewSponsors}
                    />
                  </div>
                </section>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveCampaign.mutate()}
                  disabled={
                    saveCampaign.isPending ||
                    branches.isLoading ||
                    !form.target ||
                    uploading.pendingCount > 0
                  }
                >
                  {saveCampaign.isPending
                    ? "Salvando..."
                    : uploading.pendingCount > 0
                      ? uploading.message
                      : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="glass-panel">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(campaigns.data ?? []).map((campaign: Campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <p className="font-medium">{campaign.name}</p>
                    {campaign.description ? (
                      <p className="max-w-md truncate text-xs text-muted-foreground italic">
                        "{campaign.description}"
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {operationName(campaign.branch_id, campaign.event_id)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.started_at
                      ? new Date(campaign.started_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={campaign.status === "ativa" ? "default" : "outline"}
                      className={
                        campaign.status === "ativa" ? "bg-primary text-primary-foreground" : ""
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/marketing/$campaignId" params={{ campaignId: campaign.id }}>
                          Dashboard
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(campaign)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      {campaign.status === "ativa" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            changeStatus.mutate({ id: campaign.id, status: "encerrada" })
                          }
                        >
                          <Square className="size-4" /> Desativar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => changeStatus.mutate({ id: campaign.id, status: "ativa" })}
                        >
                          <Play className="size-4" /> Ativar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!campaigns.isLoading && (campaigns.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma campanha criada ainda.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


