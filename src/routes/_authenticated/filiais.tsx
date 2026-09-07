import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/app/page-header";
import { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { formatCnpj, isValidCnpj, slugify } from "@/lib/cnpj-utils";
import { lookupCnpj } from "@/lib/cnpj.functions";
import { createBranchWithAccess, deleteBranch, updateBranch } from "@/lib/branch.functions";
import { getBranchDisplayName, getCompanyDisplayName } from "@/lib/name-utils";

export const Route = createFileRoute("/_authenticated/filiais")({
  head: () => ({
    meta: [
      { title: "Filiais e portais | Manos Tech" },
      {
        name: "description",
        content:
          "Gestão das filiais, portais Wi-Fi permanentes e horário de reinício do período operacional.",
      },
      { property: "og:title", content: "Filiais e portais | Manos Tech" },
      {
        property: "og:description",
        content:
          "Gestão das filiais, portais Wi-Fi permanentes e horário de reinício do período operacional.",
      },
    ],
  }),
  component: BranchesPage,
});

const schema = z.object({
  company_id: z.string().uuid("Selecione a empresa"),
  name: z.string().trim().min(2, "Informe o nome da filial").max(120),
  portal_slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, números e hifen"),
  daily_reset_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  access_email: z.string().trim().email("E-mail de acesso inválido").max(160),
  access_password: z.string().min(8, "Senha de acesso precisa ter ao menos 8 caracteres").max(72),
});

const editSchema = schema.extend({
  access_password: z
    .union([
      z.string().min(8, "Nova senha precisa ter ao menos 8 caracteres").max(72),
      z.literal(""),
    ])
    .optional(),
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MAX_LOGO_BYTES = 10 * 1024 * 1024;

async function uploadBranchLogo(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Limite de 10 MB para a logo.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessão inválida para enviar a logo.");
  const path = `users/${authData.user.id}/branch-logos/${crypto.randomUUID()}.${ext}`;
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

const emptyForm = {
  company_id: "",
  name: "",
  portal_slug: "",
  city: "",
  state: "",
  daily_reset_time: "07:50",
  document: "",
  legal_name: "",
  trade_name: "",
  address: "",
  zip_code: "",
  neighborhood: "",
  registration_status: "",
  logo_url: "",
  access_email: "",
  access_password: "",
};

type BranchRow = {
  id: string;
  company_id: string;
  name: string | null;
  portal_slug: string | null;
  city: string | null;
  state: string | null;
  daily_reset_time: string | null;
  active: boolean | null;
  document: string | null;
  legal_name: string | null;
  trade_name: string | null;
  registration_status: string | null;
  address: string | null;
  zip_code: string | null;
  neighborhood: string | null;
  logo_url: string | null;
  access_email: string | null;
  is_headquarters: boolean | null;
};

function BranchesPage() {
  const { data: access, isLoading: accessLoading } = useAccess();

  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    const field = Object.keys(patch)[0];
    if (field && errors[field as keyof typeof errors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
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
        portal_slug: form.portal_slug || slugify(displayName),
        registration_status: data.registration_status,
        zip_code: data.zip_code,
        neighborhood: data.neighborhood,
        address: data.address,
        city: data.city,
        state: data.state,
      });
      toast.success("Dados encontrados. Confirme antes de criar a filial.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Consulta indisponivel."),
  });

  const company = useQuery({
    queryKey: ["my-company-subscription"],
    enabled: access?.role === "matriz",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, activation_limit")
        .eq("id", access?.companyId ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const companies = useQuery({
    queryKey: ["companies-options"],
    enabled: access?.role === "adm",
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select(
          "id, name, portal_slug, city, state, daily_reset_time, active, company_id, document, legal_name, trade_name, registration_status, address, zip_code, neighborhood, logo_url, access_email, is_headquarters",
        )
        .order("is_headquarters", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const headquarters = branchesQuery.data?.find((b) => b.is_headquarters);
  const branches = branchesQuery.data?.filter((b) => !b.is_headquarters) ?? [];

  const scrollToFirstError = () => {
    setTimeout(() => {
      const firstError = document.querySelector("[data-error='true']");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        (firstError as HTMLElement).focus();
      }
    }, 100);
  };

  const saveBranch = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};
      if (!form["name"].trim()) newErrors["name"] = "Informe o nome da filial.";
      if (!form["portal_slug"].trim())
        newErrors["portal_slug"] = "Informe o identificador do portal.";
      if (!form["access_email"].trim()) newErrors["access_email"] = "Informe o e-mail de acesso.";

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
      const companyId = editingId
        ? "00000000-0000-0000-0000-000000000000"
        : access?.role === "adm"
          ? form.company_id
          : (access?.companyId ?? "");
      if (editingId) {
        const parsedEdit = editSchema.parse({ ...form, company_id: companyId });
        return updateBranch({
          data: {
            id: editingId,
            name: parsedEdit.name,
            portal_slug: parsedEdit.portal_slug,
            daily_reset_time: parsedEdit.daily_reset_time,
            access_email: parsedEdit.access_email,
            access_password: form.access_password || "",
            document: form.document.trim() || null,
            legal_name: form.legal_name.trim() || null,
            trade_name: form.trade_name.trim() || null,
            registration_status: form.registration_status.trim() || null,
            address: form.address.trim() || null,
            zip_code: form.zip_code.trim() || null,
            neighborhood: form.neighborhood.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
            logo_url: form.logo_url.trim() || null,
          },
        });
      }
      const parsed = schema.parse({ ...form, company_id: companyId });
      return createBranchWithAccess({
        data: {
          company_id: parsed.company_id,
          name: parsed.name,
          portal_slug: parsed.portal_slug,
          daily_reset_time: parsed.daily_reset_time,
          access_email: parsed.access_email,
          access_password: parsed.access_password,
          document: form.document.trim() || null,
          legal_name: form.legal_name.trim() || null,
          trade_name: form.trade_name.trim() || null,
          registration_status: form.registration_status.trim() || null,
          address: form.address.trim() || null,
          zip_code: form.zip_code.trim() || null,
          neighborhood: form.neighborhood.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          logo_url: form.logo_url.trim() || null,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(editingId ? "Filial atualizada." : "Filial cadastrada com acesso próprio.");
      if (result && "passwordWarning" in result && result.passwordWarning) {
        toast.warning(`Dados salvos, mas a senha não foi alterada: ${result.passwordWarning}`);
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (error: unknown) => {
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
        if (error instanceof z.ZodError) {
          toast.error(error.issues[0]?.message ?? "Dados inválidos");
          return;
        }
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      }
    },
  });

  const removeBranch = useMutation({
    mutationFn: async (id: string) => deleteBranch({ data: { id } }),
    onSuccess: () => {
      toast.success("Filial excluida.");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir."),
  });

  const planLimit = Number(access?.activationLimit ?? 0);
  const branchCount = branches.length;
  const availableSlots = Math.max(planLimit - branchCount, 0);
  const canCreateBranch = access?.role === "adm" || availableSlots > 0;

  function startCreate() {
    if (!canCreateBranch && access?.role !== "adm") {
      toast.error(
        `Limite de filiais atingido (${planLimit}). Fale com a Manos Tech para ampliar seu plano.`,
      );
      return;
    }

    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setOpen(true);
  }

  function startEdit(branch: BranchRow) {
    setErrors({});
    setEditingId(branch.id);
    setForm({
      company_id: branch.company_id,
      name: branch.name ?? "",
      portal_slug: branch.portal_slug ?? "",
      city: branch.city ?? "",
      state: branch.state ?? "",
      daily_reset_time: String(branch.daily_reset_time ?? "07:50").slice(0, 5),
      document: branch.document ?? "",
      legal_name: branch.legal_name ?? "",
      trade_name: branch.trade_name ?? "",
      address: branch.address ?? "",
      zip_code: branch.zip_code ?? "",
      neighborhood: branch.neighborhood ?? "",
      registration_status: branch.registration_status ?? "",
      logo_url: branch.logo_url ?? "",
      access_email: branch.access_email ?? "",
      access_password: "",
    });
    setOpen(true);
  }

  if (accessLoading) return null;

  if (access?.role === "matriz" && Number(access?.activationLimit ?? 0) === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Building2 className="size-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-black mb-3">Operação de Filiais Indisponível</h1>
        <p className="text-muted-foreground mb-8">
          O seu plano atual não inclui a gestão de unidades filiais. 
          Entre em contato com a Manos Tech para ativar a operação de múltiplas unidades.
        </p>
        <Button asChild>
          <Link to="/dashboard">Voltar ao Painel</Link>
        </Button>
      </div>
    );
  }

  return (

    <div>
      <PageHeader
        title={<span className="font-display font-black tracking-tight">Filiais</span>}
        subtitle={<span className="text-base opacity-80">{availableSlots <= 0 ? `Limite de Filiais atingido (${planLimit}). Fale com a Manos Tech para ampliar sua operação.` : "Cada filial tem um portal Wi-Fi com link permanente e período operacional próprio."}</span>}
        action={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setEditingId(null);
                setForm(emptyForm);
                setErrors({});
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={startCreate} disabled={access?.role === "matriz" && availableSlots <= 0}>
                <Plus className="size-4" /> Nova filial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar filial" : "Nova filial"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>CNPJ da filial (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.document}
                    onChange={(e) => set({ document: formatCnpj(e.target.value) })}
                    placeholder="00.000.000/0002-00"
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
                  Preenchimento automatico pela BrasilAPI. Revise os dados antes de salvar.
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                {access?.role === "adm" && !editingId ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Empresa</Label>
                    <Select
                      value={form.company_id}
                      onValueChange={(v) => setForm({ ...form, company_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {(companies.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2 sm:col-span-2">
                  <Label className={errors["name"] ? "text-destructive" : ""}>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  <Label className={errors["portal_slug"] ? "text-destructive" : ""}>
                    Slug do portal *
                  </Label>
                  <Input
                    value={form.portal_slug}
                    onChange={(e) =>
                      setForm({ ...form, portal_slug: e.target.value.toLowerCase() })
                    }
                    placeholder="loja-centro"
                    className={
                      errors["portal_slug"]
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                    data-error={!!errors["portal_slug"]}
                  />
                  {errors["portal_slug"] && (
                    <p className="text-[10px] font-medium text-destructive">
                      {errors["portal_slug"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Reinício diario</Label>
                  <Input
                    type="time"
                    value={form.daily_reset_time}
                    onChange={(e) => setForm({ ...form, daily_reset_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={form.zip_code}
                    onChange={(e) => set({ zip_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={form.neighborhood}
                    onChange={(e) => set({ neighborhood: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Razao social</Label>
                  <Input
                    value={form.legal_name}
                    onChange={(e) => set({ legal_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Logo da filial</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const url = await uploadBranchLogo(file);
                        set({ logo_url: url });
                        toast.success("Logo enviada.");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Falha no upload.");
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  {form.logo_url ? (
                    <img
                          loading="lazy"
                          decoding="async"
                      src={form.logo_url}
                      alt={`Logo da filial ${form.name || "nova"}`}
                      className="h-12 w-auto rounded border border-border bg-card p-1"
                    />
                  ) : null}
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-sm font-medium">Acesso da filial</p>
                  <p className="text-xs text-muted-foreground">
                    A filial entra pelo mesmo endereço de login e ve somente a operação dela.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className={errors["access_email"] ? "text-destructive" : ""}>
                    E-mail de acesso *
                  </Label>
                  <Input
                    type="email"
                    value={form.access_email}
                    onChange={(e) => set({ access_email: e.target.value })}
                    placeholder="filial@empresa.com"
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
                    Senha de acesso *
                  </Label>
                  <Input
                    type="password"
                    value={form.access_password}
                    onChange={(e) => set({ access_password: e.target.value })}
                    placeholder={editingId ? "deixe vazio para manter" : "mínimo 8 caracteres"}
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
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveBranch.mutate()}
                  disabled={saveBranch.isPending || uploading}
                >
                  {saveBranch.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {headquarters && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Matriz</h2>
            <p className="text-sm text-muted-foreground">
              A Matriz não conta na contagem de filiais do seu plano.
            </p>
          </div>
          <Card className="glass-panel overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="w-[200px] py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {getBranchDisplayName(
                            headquarters as unknown as Database["public"]["Tables"]["branches"]["Row"],
                          )}
                        </p>
                        <Badge variant="secondary">Sede</Badge>
                      </div>
                      {headquarters.portal_slug ? (
                        <p className="text-xs text-muted-foreground">
                          /portal/{headquarters.portal_slug}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          Portal
                        </span>
                        <span className="text-sm">
                          {headquarters.portal_slug ? `/portal/${headquarters.portal_slug}` : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          Reinício
                        </span>
                        <span className="text-sm">
                          {String(headquarters.daily_reset_time ?? "07:50").slice(0, 5)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          Status
                        </span>
                        <Badge
                          className="w-fit"
                          variant={headquarters.active ? "outline" : "destructive"}
                        >
                          {headquarters.active ? "ativa" : "inativa"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${headquarters.name}`}
                        onClick={() => startEdit(headquarters)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Filiais</h2>
        <Card className="glass-panel">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filial</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Reinício</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <p className="font-medium">
                        {getBranchDisplayName(
                          branch as unknown as Database["public"]["Tables"]["branches"]["Row"],
                        )}
                      </p>
                      {branch.portal_slug ? (
                        <p className="text-xs text-muted-foreground">
                          /portal/{branch.portal_slug}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      /portal/{branch.portal_slug || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[branch.city, branch.state].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>{String(branch.daily_reset_time ?? "07:50").slice(0, 5)}</TableCell>
                    <TableCell>
                      <Badge variant={branch.active ? "outline" : "destructive"}>
                        {branch.active ? "ativa" : "inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${getBranchDisplayName(branch as unknown as Database["public"]["Tables"]["branches"]["Row"])}`}
                          onClick={() => startEdit(branch)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Excluir ${getBranchDisplayName(branch as unknown as Database["public"]["Tables"]["branches"]["Row"])}`}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Excluir{" "}
                                {getBranchDisplayName(
                                  branch as unknown as Database["public"]["Tables"]["branches"]["Row"],
                                )}
                                ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove a filial, suas campanhas, conexões registradas e o login
                                vinculado. Essa ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeBranch.mutate(branch.id)}
                                disabled={removeBranch.isPending}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!branchesQuery.isLoading && branches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma filial cadastrada ainda.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
