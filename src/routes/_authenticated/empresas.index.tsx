import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Search, Upload } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCnpj, isValidCnpj, slugify } from "@/lib/cnpj-utils";
import { createCompanyWithAccess, lookupCnpj, updateCompany } from "@/lib/cnpj.functions";
import { getCompanyDisplayName } from "@/lib/name-utils";

export const Route = createFileRoute("/_authenticated/empresas/")({
  head: () => ({
    meta: [
      { title: "Empresas clientes | Manos Tech" },
      {
        name: "description",
        content:
          "Cadastro e gestão das empresas clientes da Manos Tech: planos, limites de ativacao e bloqueios.",
      },
      { property: "og:title", content: "Empresas clientes | Manos Tech" },
      {
        property: "og:description",
        content:
          "Cadastro e gestão das empresas clientes da Manos Tech: planos, limites de ativacao e bloqueios.",
      },
    ],
  }),
  component: CompaniesPage,
});

const PLANS = ["Mensal", "Bimestral", "Trimestral"] as const;
const MAX_LOGO_BYTES = 10 * 1024 * 1024;
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

const emptyForm = {
  document: "",
  legal_name: "",
  trade_name: "",
  name: "",
  slug: "",
  registration_status: "",
  segment: "",
  cnae_code: "",
  cnae_description: "",
  address: "",
  zip_code: "",
  neighborhood: "",
  city: "",
  state: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
  plan_name: "Mensal",
  monthly_price: "0",
  activation_limit: "1",
  ai_daily_command_limit: "20",
  due_day: "10",
  activated_at: new Date().toISOString().split("T")[0],
  subscription_status: "ativa",
  access_name: "",
  access_email: "",
  access_password: "",
  business_segment: "",
  business_description: "",
  wifi_marketing_goal: "",
};

type FormState = typeof emptyForm;

async function uploadCompanyLogo(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Limite de 10 MB para a logo.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessão inválida para enviar a logo.");
  const path = `users/${authData.user.id}/company-logos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("campaign-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data, error: signError } = await supabase.storage
    .from("campaign-assets")
    .createSignedUrl(path, TEN_YEARS);
  if (signError || !data?.signedUrl)
    throw new Error(signError?.message ?? "Falha ao gerar link da logo.");
  return data.signedUrl;
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    document: form.document || null,
    legal_name: form.legal_name || null,
    trade_name: form.trade_name || null,
    registration_status: form.registration_status || null,
    segment: form.segment || null,
    cnae_code: form.cnae_code || null,
    cnae_description: form.cnae_description || null,
    address: form.address || null,
    zip_code: form.zip_code || null,
    neighborhood: form.neighborhood || null,
    city: form.city || null,
    state: form.state || null,
    contact_email: form.contact_email || null,
    contact_phone: form.contact_phone || null,
    logo_url: form.logo_url || null,
    plan_name: form.plan_name.trim(),
    monthly_price: Number(form.monthly_price),
    activation_limit: Number(form.activation_limit),
    ai_daily_command_limit: Number(form.ai_daily_command_limit),
    due_day: form.due_day ? Number(form.due_day) : null,
    activated_at: form.activated_at ? new Date(form.activated_at).toISOString() : null,
    subscription_status: form.subscription_status as
      "ativa" | "pendente" | "inadimplente" | "cancelada",
    access_email: form.access_email.trim(),
    access_name: form.access_name || null,
    business_segment: form.business_segment || null,
    business_description: form.business_description || null,
    wifi_marketing_goal: form.wifi_marketing_goal || null,
  };
}

function CompaniesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    // Limpa erro do campo quando ele é alterado
    const field = Object.keys(patch)[0];
    if (field && errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };
  const isEditing = Boolean(editingId);

  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, resellers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setPartners([]);
    setOpen(true);
  };

  const openEdit = (company: Tables<"companies">) => {
    const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    setEditingId(s(company.id));
    setErrors({});
    setPartners([]);
    setForm({
      ...emptyForm,
      document: s(company.document),
      legal_name: s(company.legal_name),
      trade_name: s(company.trade_name),
      name: s(company.name),
      slug: s(company.slug),
      registration_status: s(company.registration_status),
      segment: s(company.segment),
      cnae_code: s(company.cnae_code),
      cnae_description: s(company.cnae_description),
      address: s(company.address),
      zip_code: s(company.zip_code),
      neighborhood: s(company.neighborhood),
      city: s(company.city),
      state: s(company.state),
      contact_email: s(company.contact_email),
      contact_phone: s(company.contact_phone),
      logo_url: s(company.logo_url),
      plan_name: s(company.plan_name) || "Mensal",
      monthly_price: s(company.monthly_price) || "0",
      activation_limit: s(company.activation_limit) || "1",
      ai_daily_command_limit:
        s((company as { ai_daily_command_limit?: number }).ai_daily_command_limit) || "20",
      due_day: s(company.due_day),
      subscription_status: s(company.subscription_status) || "ativa",
      access_name: "",
      access_email: s(company.access_email) || s(company.contact_email),
      access_password: "",
      business_segment: s((company as { business_segment?: string }).business_segment),
      business_description: s((company as { business_description?: string }).business_description),
      wifi_marketing_goal: s((company as { wifi_marketing_goal?: string }).wifi_marketing_goal),
    });
    setOpen(true);
  };

  const consultCnpj = useMutation({
    mutationFn: async () => {
      if (!isValidCnpj(form.document)) throw new Error("Informe um CNPJ valido.");
      return lookupCnpj({ data: { cnpj: form.document } });
    },
    onSuccess: (data) => {
      const displayName = data.trade_name || data.legal_name;
      set({
        document: data.document,
        legal_name: data.legal_name,
        trade_name: data.trade_name,
        name: form.name || displayName,
        slug: form.slug || slugify(displayName),
        registration_status: data.registration_status,
        segment: data.cnae_description,
        cnae_code: data.cnae_code,
        cnae_description: data.cnae_description,
        address: data.address,
        zip_code: data.zip_code,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        contact_email: data.contact_email || form.contact_email,
        contact_phone: data.contact_phone || form.contact_phone,
        access_email: form.access_email || data.contact_email,
      });
      setPartners(data.partners);
      toast.success("Dados encontrados na BrasilAPI. Revise antes de salvar.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Consulta indisponivel."),
  });

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCompanyLogo(file);
      set({ logo_url: url });
      toast.success("Logo carregada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload da logo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const scrollToFirstError = () => {
    setTimeout(() => {
      const firstError = document.querySelector("[data-error='true']");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        (firstError as HTMLElement).focus();
      }
    }, 100);
  };

  const saveCompany = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};
      if (!form["name"].trim()) newErrors["name"] = "Informe o nome da empresa.";
      if (!form["slug"].trim()) newErrors["slug"] = "Informe o identificador (slug) da empresa.";
      if (!form["access_email"].trim())
        newErrors["access_email"] = "Informe o e-mail de acesso da matriz.";
      if (!form["business_segment"]) newErrors["business_segment"] = "O segmento é obrigatório.";
      if (!form["activated_at"]) newErrors["activated_at"] = "A data de ativação é obrigatória.";

      if (form["business_description"].length < 30)
        newErrors["business_description"] =
          "A descrição comercial precisa ter ao menos 30 caracteres.";
      if (form["business_description"].length > 1000)
        newErrors["business_description"] =
          "A descrição comercial pode ter no máximo 1000 caracteres.";

      if (editingId) {
        if (form["access_password"] && form["access_password"].length < 8)
          newErrors["access_password"] = "Nova senha precisa ter ao menos 8 caracteres.";
      } else {
        if (form["access_password"].length < 8)
          newErrors["access_password"] = "Senha inicial precisa ter ao menos 8 caracteres.";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        scrollToFirstError();
        throw new Error("Preencha todos os campos obrigatórios.");
      }

      const payload = toPayload(form);
      if (editingId) {
        if (form.access_password && form.access_password.length < 8)
          throw new Error("Nova senha precisa ter ao menos 8 caracteres.");
        return updateCompany({
          data: { ...payload, id: editingId, access_password: form.access_password || "" },
        });
      }
      if (form.access_password.length < 8)
        throw new Error("Senha inicial precisa ter ao menos 8 caracteres.");
      return createCompanyWithAccess({
        data: { ...payload, access_password: form.access_password },
      });
    },
    onSuccess: (result: {
      billingSync?: {
        action: string;
        error?: string;
        newAmount?: number;
        newDueDate?: string;
        newStatus?: string;
        competence?: string;
        oldDueDate?: string;
        oldStatus?: string;
      } | null;
      email?: string;
      passwordWarning?: string | null;
    }) => {
      const billingSync = result.billingSync;

      const message = editingId
        ? "Empresa atualizada com sucesso."
        : `Empresa cadastrada. Acesso criado para ${result.email}.`;

      if (billingSync) {
        if (billingSync.action === "failed") {
          toast.warning(message, {
            description: `A empresa foi salva, mas houve uma falha na sincronização financeira: ${billingSync.error}. Revise manualmente no módulo Financeiro.`,
            duration: 8000,
          });
        } else if (billingSync.action !== "none_paid") {
          const formatDate = (dateStr: string) => {
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y}`;
          };

          const syncMsg =
            billingSync.action === "created"
              ? `Nova cobrança criada: R$ ${(billingSync.newAmount ?? 0).toFixed(2)} vencendo em ${formatDate(billingSync.newDueDate ?? "")} (${billingSync.newStatus ?? ""}).`
              : billingSync.action === "recovered"
                ? `Cobrança de ${billingSync.competence ?? ""} já existia e foi vinculada com sucesso.`
                : `Cobrança sincronizada: De ${formatDate(billingSync.oldDueDate ?? "")} (${billingSync.oldStatus ?? ""}) para ${formatDate(billingSync.newDueDate ?? "")} (${billingSync.newStatus ?? ""}). Valor: R$ ${(billingSync.newAmount ?? 0).toFixed(2)}.`;

          toast.success(message, {
            description: syncMsg,
            duration: 10000,
          });
        } else {
          toast.success(message);
        }
      } else {
        toast.success(message);
      }

      if ("passwordWarning" in result && result.passwordWarning) {
        toast.warning(`Dados salvos, mas a senha não foi alterada: ${result.passwordWarning}`);
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setErrors({});
      setPartners([]);
      queryClient.invalidateQueries({
        predicate: (query) =>
          [
            "companies",
            "financeiro-stats",
            "financeiro-empresas",
            "financeiro-cobrancas",
            "financeiro-eventos",
            "companies-options",
            "my-subscription-company",
            "my-subscription-charges",
            "my-subscription-branches",
            "company-detail",
          ].some((key) => query.queryKey.includes(key)),
      });
    },
    onError: (error: Error | z.ZodError) => {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes("Este e-mail já e o acesso de outra empresa") ||
        message.includes('duplicate key value violates unique constraint "profiles_email_key"')
      ) {
        setErrors((prev) => ({
          ...prev,
          access_email: "Este e-mail já é utilizado como acesso de outra empresa.",
        }));
        scrollToFirstError();
        return;
      }

      if (Object.keys(errors).length === 0) {
        toast.error(
          error instanceof z.ZodError
            ? (error.issues[0]?.message ?? "Dados inválidos")
            : error instanceof Error
              ? error.message
              : "Não foi possível salvar.",
        );
      }
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { error } = await supabase
        .from("companies")
        .update({ blocked, status: blocked ? "bloqueada" : "ativa" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          [
            "companies",
            "financeiro-empresas",
            "financeiro-cobrancas",
            "financeiro-eventos",
            "companies-options",
            "my-subscription-company",
            "my-subscription-charges",
            "my-subscription-branches",
            "company-detail",
          ].some((key) => query.queryKey.includes(key)),
      }),
    onError: () => toast.error("Não foi possível atualizar o bloqueio."),
  });

  return (
    <div>
      <PageHeader
        title={<span className="font-display font-black tracking-tight">Empresas</span>}
        subtitle={<span className="text-base opacity-80">Cada empresa é uma operação independente com filiais, eventos, campanhas e CRM próprios.</span>}
        action={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Nova empresa
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditingId(null);
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  value={form.document}
                  onChange={(e) => set({ document: formatCnpj(e.target.value) })}
                  placeholder="00.000.000/0001-00"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => consultCnpj.mutate()}
                  disabled={consultCnpj.isPending}
                >
                  {consultCnpj.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Consultar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Consulta na BrasilAPI apenas para preencher o cadastro. Os dados ficam salvos no
                Manos Tech.
              </p>
            </div>

            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dados cadastrais
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Razao social</Label>
                <Input
                  value={form.legal_name}
                  onChange={(e) => set({ legal_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome fantasia</Label>
                <Input
                  value={form.trade_name}
                  onChange={(e) => set({ trade_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className={errors["name"] ? "text-destructive" : ""}>
                  Nome no sistema *
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className={
                    errors["name"] ? "border-destructive focus-visible:ring-destructive" : ""
                  }
                  data-error={!!errors["name"]}
                />
                {errors["name"] && (
                  <p className="text-[10px] font-medium text-destructive">{errors["name"]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={errors["slug"] ? "text-destructive" : ""}>Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
                  placeholder="minha-empresa"
                  className={
                    errors["slug"] ? "border-destructive focus-visible:ring-destructive" : ""
                  }
                  data-error={!!errors["slug"]}
                />
                {errors["slug"] && (
                  <p className="text-[10px] font-medium text-destructive">{errors["slug"]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Situação cadastral</Label>
                <Input
                  value={form.registration_status}
                  onChange={(e) => set({ registration_status: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CNAE</Label>
                <Input
                  value={form.cnae_code}
                  onChange={(e) => set({ cnae_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Atividade economica</Label>
                <Input value={form.segment} onChange={(e) => set({ segment: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.zip_code} onChange={(e) => set({ zip_code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={form.neighborhood}
                  onChange={(e) => set({ neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={form.state} onChange={(e) => set({ state: e.target.value })} />
              </div>
            </div>
            {partners.length > 0 ? (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Socios
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {partners.map((partner) => (
                    <li key={partner}>{partner}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plano Manos Tech
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plano contratado</Label>
                <Select value={form.plan_name} onValueChange={(plan_name) => set({ plan_name })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensalidade (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.monthly_price}
                  onChange={(e) => set({ monthly_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Filiais incluídas no plano</Label>
                <Input
                  type="number"
                  min={0}
                  value={Math.max(0, Number(form.activation_limit) - 1)}
                  onChange={(e) => set({ activation_limit: String(Number(e.target.value) + 1) })}
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Total: 1 Matriz + {Math.max(0, Number(form.activation_limit) - 1)} Filial(is) ={" "}
                  {form.activation_limit} operações
                </p>
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.due_day}
                  onChange={(e) => set({ due_day: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className={errors["activated_at"] ? "text-destructive" : ""}>
                  Data de ativação *
                </Label>
                <Input
                  type="date"
                  value={form.activated_at}
                  onChange={(e) => set({ activated_at: e.target.value })}
                  disabled={isEditing}
                  className={
                    errors["activated_at"]
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                  data-error={!!errors["activated_at"]}
                />
                {errors["activated_at"] && (
                  <p className="text-[10px] font-medium text-destructive">
                    {errors["activated_at"]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Status da assinatura</Label>
                <Select
                  value={form.subscription_status}
                  onValueChange={(subscription_status) => set({ subscription_status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Limite diário de comandos IA</Label>
                <Input
                  type="number"
                  min={10}
                  value={form.ai_daily_command_limit}
                  onChange={(e) => set({ ai_daily_command_limit: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Min: 10 comandos. Padrão: 20.
                </p>
              </div>
            </div>

            {!isEditing && (
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <p className="text-sm font-bold flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin hidden" />{" "}
                  {/* Placeholder for logic icon */}
                  Prévia do Faturamento Inicial
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ativação (Hoje)</p>
                    <p className="font-semibold text-cyan-500">
                      R$ {Number(form.monthly_price).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Próxima Fatura</p>
                    <p className="font-semibold">
                      {(() => {
                        const activated = new Date(form.activated_at + "T12:00:00");
                        const dueDay = Number(form.due_day);
                        const activatedDay = activated.getDate();
                        const monthlyPrice = Number(form.monthly_price);

                        if (activatedDay === dueDay) {
                          return `R$ ${monthlyPrice.toFixed(2)} (Integral)`;
                        }

                        // Lógica simplificada para a prévia (mesma do servidor)
                        const targetDate = new Date(activated);
                        if (activatedDay < dueDay) {
                          targetDate.setDate(dueDay);
                        } else {
                          targetDate.setMonth(targetDate.getMonth() + 1);
                          targetDate.setDate(dueDay);
                        }

                        // Ajustar para último dia do mês se necessário
                        if (targetDate.getDate() !== dueDay) {
                          targetDate.setDate(0);
                        }

                        const diff = Math.ceil(
                          (targetDate.getTime() - activated.getTime()) / (1000 * 60 * 60 * 24),
                        );
                        const propValue = (monthlyPrice / 30) * diff;
                        return `R$ ${propValue.toFixed(2)} (Proporcional)`;
                      })()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Vencimento estimado:{" "}
                      {(() => {
                        const activated = new Date(form.activated_at + "T12:00:00");
                        const dueDay = Number(form.due_day);
                        const targetDate = new Date(activated);
                        if (activated.getDate() < dueDay) {
                          targetDate.setDate(dueDay);
                        } else {
                          targetDate.setMonth(targetDate.getMonth() + 1);
                          targetDate.setDate(dueDay);
                        }
                        if (targetDate.getDate() !== dueDay) targetDate.setDate(0);
                        return targetDate.toLocaleDateString("pt-BR");
                      })()}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Valores calculados com base em meses de 30 dias conforme regra do sistema.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Logo da empresa</Label>
              <div className="flex flex-wrap items-center gap-3">
                {form.logo_url ? (
                  <img
                          loading="lazy"
                          decoding="async"
                    src={form.logo_url}
                    alt={`Logo de ${form.name || "empresa"}`}
                    className="size-14 rounded-lg border border-border/60 object-contain"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Carregar do computador
                </Button>
                {form.logo_url ? (
                  <Button type="button" variant="ghost" onClick={() => set({ logo_url: "" })}>
                    Remover
                  </Button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLogoFile(e.target.files?.[0])}
                />
              </div>
              <Input
                value={form.logo_url}
                onChange={(e) => set({ logo_url: e.target.value })}
                placeholder="ou cole a URL da logo"
              />
            </div>

            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acesso da empresa/matriz
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Responsavel</Label>
                <Input
                  value={form.access_name}
                  onChange={(e) => set({ access_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className={errors["access_email"] ? "text-destructive" : ""}>
                  E-mail de acesso *
                </Label>
                <Input
                  type="email"
                  value={form.access_email}
                  onChange={(e) => set({ access_email: e.target.value })}
                  className={
                    errors["access_email"]
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                  data-error={!!errors["access_email"]}
                />
                {errors["access_email"] && (
                  <p className="text-[10px] font-medium text-destructive">
                    {errors["access_email"]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={errors["access_password"] ? "text-destructive" : ""}>
                  {isEditing ? "Nova senha (opcional)" : "Senha inicial *"}
                </Label>
                <Input
                  type="password"
                  value={form.access_password}
                  onChange={(e) => set({ access_password: e.target.value })}
                  placeholder={isEditing ? "deixe vazio para manter" : "mínimo 8 caracteres"}
                  className={
                    errors["access_password"]
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                  data-error={!!errors["access_password"]}
                />
                {errors["access_password"] && (
                  <p className="text-[10px] font-medium text-destructive">
                    {errors["access_password"]}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Telefone de contato</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => set({ contact_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>E-mail de contato</Label>
                <Input
                  value={form.contact_email}
                  onChange={(e) => set({ contact_email: e.target.value })}
                />
              </div>
            </div>

            <Separator />
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Perfil comercial para IA
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={errors["business_segment"] ? "text-destructive" : ""}>
                    Segmento / ramo de atuação *
                  </Label>
                  <Select
                    value={form.business_segment}
                    onValueChange={(v) => set({ business_segment: v })}
                  >
                    <SelectTrigger
                      className={
                        errors["business_segment"]
                          ? "border-destructive focus:ring-destructive"
                          : ""
                      }
                      data-error={!!errors["business_segment"]}
                    >
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" className="z-[220]">
                      <SelectItem value="Restaurante / Bar">Restaurante / Bar</SelectItem>
                      <SelectItem value="Varejo / Loja">Varejo / Loja</SelectItem>
                      <SelectItem value="Hotelaria / Pousada">Hotelaria / Pousada</SelectItem>
                      <SelectItem value="Saúde / Clínica">Saúde / Clínica</SelectItem>
                      <SelectItem value="Educação / Escola">Educação / Escola</SelectItem>
                      <SelectItem value="Serviços">Serviços</SelectItem>
                      <SelectItem value="Evento">Evento</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors["business_segment"] && (
                    <p className="text-[10px] font-medium text-destructive">
                      {errors["business_segment"]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Principal objetivo no Wi-Fi</Label>
                  <Select
                    value={form.wifi_marketing_goal}
                    onValueChange={(v) => set({ wifi_marketing_goal: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qual o objetivo?" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" className="z-[220]">
                      <SelectItem value="Atrair novos clientes">Atrair novos clientes</SelectItem>
                      <SelectItem value="Divulgar promoções">Divulgar promoções</SelectItem>
                      <SelectItem value="Aumentar retorno de clientes">
                        Aumentar retorno de clientes
                      </SelectItem>
                      <SelectItem value="Captar contatos">Captar contatos</SelectItem>
                      <SelectItem value="Divulgar campanhas">Divulgar campanhas</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className={errors["business_description"] ? "text-destructive" : ""}>
                      Sobre o negócio *
                    </Label>
                    <span
                      className={`text-[10px] ${errors["business_description"] || form["business_description"].length < 30 || form["business_description"].length > 1000 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {form["business_description"].length}/1000
                    </span>
                  </div>
                  <textarea
                    className={`flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors["business_description"] ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-ring"}`}
                    placeholder="Descreva o que a empresa vende, quais serviços oferece e o tipo de cliente que deseja atrair."
                    value={form.business_description}
                    onChange={(e) => set({ business_description: e.target.value })}
                    data-error={!!errors["business_description"]}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {errors["business_description"] || "Mínimo de 30 e máximo de 1000 caracteres."}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>
              {saveCompany.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEditing ? "Salvar alteracoes" : "Cadastrar empresa e criar acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="glass-panel">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Filiais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Bloqueio</TableHead>
                <TableHead className="text-right">Editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(companies.data ?? []).map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      to="/empresas/$companyId"
                      params={{ companyId: company.id }}
                      className="flex items-center gap-3 hover:opacity-80"
                    >
                      {company.logo_url ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={company.logo_url}
                          alt={`Logo de ${getCompanyDisplayName(company)}`}
                          className="size-9 rounded-md border border-border/60 object-contain"
                        />
                      ) : null}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{getCompanyDisplayName(company)}</p>
                          {(!company.business_segment ||
                            company.business_segment === "não informado" ||
                            !company.business_description ||
                            company.business_description.length < 30) && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30 py-0 h-4"
                            >
                              Perfil IA incompleto
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">/{company.slug}</p>
                        <Badge
                          variant="outline"
                          className={
                            company.reseller_id
                              ? "mt-1 h-4 border-violet-500/30 bg-violet-500/10 py-0 text-[10px] text-violet-300"
                              : "mt-1 h-4 border-emerald-500/30 bg-emerald-500/10 py-0 text-[10px] text-emerald-300"
                          }
                        >
                          {company.reseller_id
                            ? "Pertence à Revenda " + ((company.resellers as { name?: string } | null)?.name || "vinculada")
                            : "Pertence ao ADM"}
                        </Badge>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.document ?? "—"}</TableCell>
                  <TableCell>
                    {company.plan_name}
                    <span className="block text-xs text-muted-foreground">
                      R${" "}
                      {Number(company.monthly_price).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                      {company.due_day ? ` · vence dia ${company.due_day}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>{Number(company.activation_limit) - 1} filiais</TableCell>
                  <TableCell>
                    <Badge variant={company.blocked ? "destructive" : "outline"}>
                      {company.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={company.blocked}
                      onCheckedChange={(blocked) => toggleBlock.mutate({ id: company.id, blocked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${company.name}`}
                      onClick={() => openEdit(company)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!companies.isLoading && (companies.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma empresa cadastrada ainda.
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

