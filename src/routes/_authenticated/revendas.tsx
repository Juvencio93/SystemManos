import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Copy,
  Handshake,
  Pencil,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { getCompanyDisplayName } from "@/lib/name-utils";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateResellerCreditPix } from "@/lib/reseller-credit-pix.functions";
import { createResellerLogin, deleteReseller } from "@/lib/reseller-access.functions";

export const Route = createFileRoute("/_authenticated/revendas")({
  head: () => ({ meta: [{ title: "Revendas | Manos Tech" }] }),
  component: ResellersPage,
});

type ResellerForm = {
  name: string;
  document: string;
  contact_email: string;
  contact_phone: string;
  status: "ativa" | "suspensa";
  notes: string;
  initialCredits: string;
  loginPassword: string;
};
const emptyForm: ResellerForm = {
  name: "",
  document: "",
  contact_email: "",
  contact_phone: "",
  status: "ativa",
  notes: "",
  initialCredits: "0",
  loginPassword: "",
};
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ResellersPage() {
  const { data: access } = useAccess();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResellerForm>(emptyForm);
  const [companyToLink, setCompanyToLink] = useState<Record<string, string>>({});
  const [creditDialogReseller, setCreditDialogReseller] = useState<any | null>(null);
  const [creditQuantity, setCreditQuantity] = useState("1");
  const [pixDialogReseller, setPixDialogReseller] = useState<any | null>(null);
  const [originFilter, setOriginFilter] = useState("todas");
  const [pixData, setPixData] = useState<{
    qrCode: string | null;
    copyPaste: string | null;
    totalAmount: number;
    dueDate: string;
  } | null>(null);
  const generateCreditPix = useServerFn(getOrCreateResellerCreditPix);
  const createLogin = useServerFn(createResellerLogin);
  const removeReseller = useServerFn(deleteReseller);
  const isAdm = access?.role === "adm";
  const isReseller = access?.role === "revenda";

  const resellers = useQuery({
    queryKey: ["resellers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resellers").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdm || isReseller,
    select: (data) =>
      isReseller ? data.filter((reseller) => reseller.user_id === access?.userId) : data,
  });
  const companies = useQuery({
    queryKey: ["reseller-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "id, name, trade_name, monthly_price, reseller_id, status, blocked, branches(id, active, is_headquarters)",
        )
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdm || isReseller,
  });
  const creditLots = useQuery({
    queryKey: ["reseller-credit-lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_credit_lots")
        .select("reseller_id, remaining_quantity, expires_at")
        .order("expires_at");
      if (error) throw error;
      return data;
    },
    enabled: isAdm || isReseller,
  });
  const creditAllocations = useQuery({
    queryKey: ["reseller-credit-allocations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_credit_allocations")
        .select("reseller_id, unit_id, expires_at");
      if (error) throw error;
      return data;
    },
    enabled: isAdm || isReseller,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["resellers"] }),
      queryClient.invalidateQueries({ queryKey: ["reseller-companies"] }),
      queryClient.invalidateQueries({ queryKey: ["reseller-credit-lots"] }),
      queryClient.invalidateQueries({ queryKey: ["reseller-credit-allocations"] }),
    ]);

  const saveReseller = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (!payload.name) throw new Error("Informe o nome da revenda.");
      if (editingId) {
        const { error } = await supabase.from("resellers").update(payload).eq("id", editingId);
        if (error) throw error;
        return { resellerId: editingId };
      }
      const initialCredits = Number(form.initialCredits || 0);
      if (!Number.isInteger(initialCredits) || initialCredits < 0)
        throw new Error("Informe uma quantidade inteira de créditos.");
      const { data: reseller, error } = await supabase
        .from("resellers")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      if (!payload.contact_email)
        throw new Error("Informe o e-mail que será usado no login da revenda.");
      if (!form.loginPassword) throw new Error("Defina a senha inicial da revenda.");
      if (form.loginPassword.length < 8) throw new Error("A senha deve ter ao menos 8 caracteres.");
      if (initialCredits > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const { error: creditsError } = await supabase.from("reseller_credit_lots").insert({
          reseller_id: reseller.id,
          quantity: initialCredits,
          remaining_quantity: initialCredits,
          source: "manual",
          reference: "Créditos iniciais cadastrados pelo ADM",
          expires_at: expiresAt.toISOString(),
          created_by: access?.userId || null,
        });
        if (creditsError) throw creditsError;
      }
      await createLogin({
        data: {
          resellerId: reseller.id,
          email: payload.contact_email,
          password: form.loginPassword,
        },
      });
      return { resellerId: reseller.id };
    },
    onSuccess: async () => {
      await refresh();
      toast.success(editingId ? "Revenda atualizada." : "Revenda cadastrada.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar a revenda."),
  });
  const removeResellerMutation = useMutation({
    mutationFn: async (reseller: { id: string; name: string }) => {
      if (
        !window.confirm(
          `Excluir a revenda ${reseller.name}? Os créditos e vínculos serão removidos; as Matrizes permanecerão no sistema.`,
        )
      )
        return;
      return removeReseller({ data: { resellerId: reseller.id } });
    },
    onSuccess: async (result) => {
      if (!result) return;
      await refresh();
      toast.success("Revenda excluída. O login dela não tem mais acesso ao sistema.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível excluir a revenda."),
  });
  const linkCompany = useMutation({
    mutationFn: async ({ resellerId, companyId }: { resellerId: string; companyId: string }) => {
      const { error } = await supabase
        .from("companies")
        .update({ reseller_id: resellerId })
        .eq("id", companyId);
      if (error) throw error;
      const { error: branchesError } = await supabase
        .from("branches")
        .update({ reseller_id: resellerId })
        .eq("company_id", companyId);
      if (branchesError) throw branchesError;
      const { data, error: coverageError } = await supabase.rpc(
        "reseller_refresh_credit_coverage",
        {
          p_reseller_id: resellerId,
        },
      );
      if (coverageError) throw coverageError;
      return data?.[0];
    },
    onSuccess: async (coverage) => {
      await refresh();
      const pending = coverage?.pending_count || 0;
      toast.success(
        pending
          ? `Matriz vinculada. ${pending} unidade(s) aguardam créditos.`
          : "Matriz vinculada e créditos aplicados.",
      );
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível vincular a Matriz."),
  });
  const claimCompany = useMutation({
    mutationFn: async ({ companyId, companyName }: { companyId: string; companyName: string }) => {
      if (!window.confirm('Assumir ' + companyName + ' para o ADM? A Matriz e todas as Filiais sairão da rede da Revenda.')) return false;
      const { error } = await supabase.from("companies").update({ reseller_id: null }).eq("id", companyId);
      if (error) throw error;
      const { error: branchesError } = await supabase
        .from("branches")
        .update({ reseller_id: null })
        .eq("company_id", companyId);
      if (branchesError) throw branchesError;
      return true;
    },
    onSuccess: async (changed) => {
      if (!changed) return;
      await refresh();
      toast.success("Matriz e Filiais assumidas pelo ADM.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível assumir a rede."),
  });
  const addCredits = useMutation({
    mutationFn: async () => {
      if (!creditDialogReseller) return;
      const quantity = Number(creditQuantity);
      if (!Number.isInteger(quantity) || quantity < 1)
        throw new Error("Informe uma quantidade inteira de créditos.");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { error } = await supabase.from("reseller_credit_lots").insert({
        reseller_id: creditDialogReseller.id,
        quantity,
        remaining_quantity: quantity,
        source: "manual",
        reference: "Créditos adicionados manualmente pelo ADM",
        expires_at: expiresAt.toISOString(),
        created_by: access?.userId || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Créditos adicionados com validade de 30 dias.");
      setCreditDialogReseller(null);
      setCreditQuantity("1");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível adicionar créditos."),
  });
  const createCreditPix = useMutation({
    mutationFn: async () => {
      if (!pixDialogReseller) throw new Error("Selecione a revenda.");
      const quantity = Number(creditQuantity);
      if (!Number.isInteger(quantity) || quantity < 1)
        throw new Error("Informe uma quantidade inteira de créditos.");
      return generateCreditPix({ data: { resellerId: pixDialogReseller.id, quantity } });
    },
    onSuccess: (result) => {
      setPixData({
        qrCode: result.qrCode,
        copyPaste: result.copyPaste,
        totalAmount: result.totalAmount,
        dueDate: result.dueDate,
      });
      toast.success("PIX gerado. Os créditos entrarão automaticamente após a confirmação.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível gerar o PIX."),
  });
  const applyCredits = useMutation({
    mutationFn: async (resellerId: string) => {
      const { data, error } = await supabase.rpc("reseller_refresh_credit_coverage", {
        p_reseller_id: resellerId,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: async (result) => {
      await refresh();
      const allocated = result?.allocated_count || 0;
      const pending = result?.pending_count || 0;
      toast.success(
        pending
          ? `${allocated} crédito(s) aplicado(s). ${pending} unidade(s) ainda aguardam créditos.`
          : allocated
            ? `${allocated} crédito(s) aplicado(s) às unidades ativas.`
            : "Todas as unidades ativas já estão cobertas.",
      );
    },
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível aplicar os créditos."),
  });

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (reseller: any) => {
    setEditingId(reseller.id);
    setForm({
      name: reseller.name || "",
      document: reseller.document || "",
      contact_email: reseller.contact_email || "",
      contact_phone: reseller.contact_phone || "",
      status: reseller.status === "suspensa" ? "suspensa" : "ativa",
      notes: reseller.notes || "",
      initialCredits: "0",
      loginPassword: "",
    });
    setDialogOpen(true);
  };

  if (!isAdm && !isReseller)
    return (
      <Card className="glass-panel mx-auto max-w-xl border-destructive/30">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>Somente o ADM principal pode administrar revendas.</CardDescription>
        </CardHeader>
      </Card>
    );

  const resellerList = resellers.data || [];
  const companyList = companies.data || [];
  const assigned = companyList.filter((company: any) => company.reseller_id);
  const totalUnits = assigned.reduce(
    (total: number, company: any) =>
      total +
      (company.status === "ativa" && !company.blocked ? 1 : 0) +
      (company.branches?.filter((branch: any) => branch.active && !branch.is_headquarters).length || 0),
    0,
  );
  const unassignedCompanies = companyList.filter((company: any) => !company.reseller_id);
  const visibleResellers = isAdm && originFilter !== "todas"
    ? resellerList.filter((reseller: any) => reseller.id === originFilter)
    : resellerList;
  const availableCredits = (resellerId: string) =>
    (creditLots.data || [])
      .filter(
        (lot) =>
          lot.reseller_id === resellerId &&
          lot.remaining_quantity > 0 &&
          new Date(lot.expires_at) > new Date(),
      )
      .reduce((total, lot) => total + lot.remaining_quantity, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdm ? "Revendas" : "Créditos disponíveis"}
        subtitle={
          isAdm
            ? "Cadastre parceiros e acompanhe as Matrizes e Filiais vinculadas a cada rede."
            : "Consulte seu saldo, validade dos créditos e compre novas ativações via PIX."
        }
        action={
          isAdm ? (
            <Button onClick={openNew}>
              <Plus className="mr-2 size-4" />
              Nova revenda
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {isAdm ? <>
          <MetricCard icon={Handshake} label="Revendas cadastradas" value={resellerList.length} />
          <MetricCard icon={Building2} label="Matrizes vinculadas" value={assigned.length} />
          <MetricCard icon={Store} label="Unidades sob revendas" value={totalUnits} />
        </> : <>
          <MetricCard icon={Wallet} label="Créditos disponíveis" value={availableCredits(access?.resellerId ?? "")} />
          <MetricCard icon={ShieldCheck} label="Validade" value={0} />
          <MetricCard icon={Building2} label="Empresas vinculadas" value={companyList.length} />
        </>}
      </div>
      <Card className="glass-panel border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary" />
            <div>
              <CardTitle>{isAdm ? "Base da operação de revendas" : "Gestão de créditos"}</CardTitle>
              <CardDescription>
                {isAdm
                  ? "O ADM cadastra revendas, cria o login e vincula Matrizes."
                  : "Cada crédito possui validade própria. Créditos não utilizados expiram conforme a data indicada."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      {isAdm && (
        <div className="flex items-center gap-3">
          <Label htmlFor="reseller-origin-filter" className="whitespace-nowrap text-sm">Filtrar por revenda</Label>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger id="reseller-origin-filter" className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as revendas</SelectItem>
              {resellerList.map((reseller: any) => <SelectItem key={reseller.id} value={reseller.id}>{reseller.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {resellers.isLoading || companies.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando revendas...</p>
      ) : resellerList.length === 0 ? (
        <Card className="glass-panel border-dashed border-primary/30">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 size-8 text-primary" />
            <p className="font-semibold">Nenhuma revenda cadastrada.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdm
                ? "Cadastre a primeira parceira para organizar a rede de clientes dela."
                : "Seu cadastro de revenda ainda não está vinculado corretamente."}
            </p>
            {isAdm && (
              <Button className="mt-4" onClick={openNew}>
                Cadastrar primeira revenda
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleResellers.map((reseller: any) => {
            const resellerCompanies = companyList.filter(
              (company: any) => company.reseller_id === reseller.id,
            );
            const resellerUnits = resellerCompanies.reduce(
              (total: number, company: any) =>
                total +
                (company.status === "ativa" && !company.blocked ? 1 : 0) +
                (company.branches?.filter((branch: any) => branch.active && !branch.is_headquarters).length || 0),
              0,
            );
            return (
              <Card key={reseller.id} className="glass-panel border-primary/15">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Handshake className="size-5 text-primary" />
                        {reseller.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {reseller.contact_email ||
                          reseller.contact_phone ||
                          "Contato não informado"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          reseller.status === "ativa"
                            ? "border-emerald-500/40 text-emerald-300"
                            : "border-amber-500/40 text-amber-300"
                        }
                      >
                        {reseller.status === "ativa" ? "Ativa" : "Suspensa"}
                      </Badge>
                      {isAdm && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(reseller)}
                            aria-label={`Editar ${reseller.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={removeResellerMutation.isPending}
                            onClick={() => removeResellerMutation.mutate(reseller)}
                            aria-label={`Excluir ${reseller.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/10 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Matrizes</p>
                      <p className="text-xl font-bold">{resellerCompanies.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unidades</p>
                      <p className="text-xl font-bold">{resellerUnits}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Créditos</p>
                      <p className="text-xl font-bold text-primary">
                        {availableCredits(reseller.id)}
                      </p>
                    </div>
                  </div>
                  {resellerCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma Matriz vinculada ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {resellerCompanies.map((company: any) => (
                        <div
                          key={company.id}
                          className="rounded-lg border border-white/10 px-3 py-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">{getCompanyDisplayName(company)}</p>
                            {isAdm && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-amber-300 hover:text-amber-200"
                                onClick={() =>
                                  claimCompany.mutate({
                                    companyId: company.id,
                                    companyName: getCompanyDisplayName(company),
                                  })
                                }
                                disabled={claimCompany.isPending}
                              >
                                Assumir pelo ADM
                              </Button>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Mensalidade {money.format(Number(company.monthly_price || 0))} · Matriz
                            e {company.branches?.filter((branch: any) => !branch.is_headquarters).length || 0} Filial(is)
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    {isAdm && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCreditDialogReseller(reseller);
                            setCreditQuantity("1");
                          }}
                        >
                          Adicionar créditos
                        </Button>
                        <Button
                          variant="outline"
                          disabled={applyCredits.isPending || reseller.status !== "ativa"}
                          onClick={() => applyCredits.mutate(reseller.id)}
                        >
                          Aplicar créditos
                        </Button>
                      </>
                    )}
                    {isReseller && (
                      <Button
                        onClick={() => {
                          setPixDialogReseller(reseller);
                          setPixData(null);
                          setCreditQuantity("1");
                        }}
                      >
                        Comprar créditos via PIX
                      </Button>
                    )}
                  </div>
                  {isAdm && (
                    <div className="flex gap-2">
                      <Select
                        value={companyToLink[reseller.id] || ""}
                        onValueChange={(value) =>
                          setCompanyToLink((current) => ({ ...current, [reseller.id]: value }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Vincular uma Matriz disponível" />
                        </SelectTrigger>
                        <SelectContent>
                          {unassignedCompanies.map((company: any) => (
                            <SelectItem key={company.id} value={company.id}>
                              {getCompanyDisplayName(company)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={!companyToLink[reseller.id] || linkCompany.isPending}
                        onClick={() =>
                          linkCompany.mutate({
                            resellerId: reseller.id,
                            companyId: companyToLink[reseller.id] ?? "",
                          })
                        }
                      >
                        Vincular
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar revenda" : "Cadastrar revenda"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Nome da revenda *">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ex.: Revenda Ana"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CPF ou CNPJ">
                <Input
                  value={form.document}
                  onChange={(event) => setForm({ ...form, document: event.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.contact_phone}
                  onChange={(event) => setForm({ ...form, contact_phone: event.target.value })}
                />
              </Field>
            </div>
            <Field label={editingId ? "E-mail" : "E-mail de contato e login *"}>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(event) => setForm({ ...form, contact_email: event.target.value })}
              />
            </Field>
            {!editingId && (
              <Field label="Senha inicial de acesso *">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.loginPassword}
                  onChange={(event) => setForm({ ...form, loginPassword: event.target.value })}
                  placeholder="Mínimo de 8 caracteres"
                />
                <p className="text-xs text-muted-foreground">
                  O login da revenda será criado automaticamente com este e-mail e senha.
                </p>
              </Field>
            )}
            <Field label="Situação">
              <Select
                value={form.status}
                onValueChange={(value: "ativa" | "suspensa") => setForm({ ...form, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="suspensa">Suspensa</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {!editingId && (
              <Field label="Créditos iniciais">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.initialCredits}
                  onChange={(event) => setForm({ ...form, initialCredits: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Cada crédito vale uma unidade ativa por 30 dias. A compra por PIX aparecerá no
                  painel da própria revenda.
                </p>
              </Field>
            )}
            <Field label="Observações">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Informações internas sobre a parceria"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saveReseller.isPending} onClick={() => saveReseller.mutate()}>
              {saveReseller.isPending ? "Salvando..." : "Salvar revenda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(creditDialogReseller)}
        onOpenChange={(open) => !open && setCreditDialogReseller(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar créditos</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Revenda:{" "}
              <span className="font-semibold text-foreground">{creditDialogReseller?.name}</span>
            </p>
            <Field label="Quantidade de créditos *">
              <Input
                type="number"
                min="1"
                step="1"
                value={creditQuantity}
                onChange={(event) => setCreditQuantity(event.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Cada crédito cobre uma Matriz ou Filial ativa por 30 dias. Nesta etapa, o lançamento é
              manual pelo ADM; o PIX automático entrará na fase financeira.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogReseller(null)}>
              Cancelar
            </Button>
            <Button disabled={addCredits.isPending} onClick={() => addCredits.mutate()}>
              {addCredits.isPending ? "Adicionando..." : "Adicionar créditos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pixDialogReseller)}
        onOpenChange={(open) => {
          if (!open) {
            setPixDialogReseller(null);
            setPixData(null);
            setCreditQuantity("1");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comprar créditos via PIX</DialogTitle>
          </DialogHeader>
          {!pixData ? (
            <div className="grid gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Revenda:{" "}
                <span className="font-semibold text-foreground">{pixDialogReseller?.name}</span>
              </p>
              <Field label="Quantidade de créditos *">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={creditQuantity}
                  onChange={(event) => setCreditQuantity(event.target.value)}
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                {money.format(Number(creditQuantity || 0) * 50)} · R$ 50 por crédito · validade de
                30 dias após a confirmação.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Valor:{" "}
                <span className="font-semibold text-foreground">
                  {money.format(pixData.totalAmount)}
                </span>{" "}
                · vence em {new Date(`${pixData.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}.
              </p>
              {pixData.qrCode ? (
                <div className="mx-auto w-fit rounded-xl border-4 border-white bg-white p-2">
                  <img
                    src={`data:image/png;base64,${pixData.qrCode}`}
                    alt="QR Code PIX"
                    className="size-48"
                  />
                </div>
              ) : null}
              <div className="flex gap-2">
                <Input readOnly value={pixData.copyPaste || ""} className="font-mono text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  disabled={!pixData.copyPaste}
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.copyPaste || "");
                    toast.success("Código PIX copiado.");
                  }}
                  aria-label="Copiar código PIX"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Após a confirmação do Asaas, os créditos serão incluídos automaticamente e ficarão
                disponíveis por 30 dias.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPixDialogReseller(null)}>
              {pixData ? "Fechar" : "Cancelar"}
            </Button>
            {!pixData && (
              <Button disabled={createCreditPix.isPending} onClick={() => createCreditPix.mutate()}>
                {createCreditPix.isPending ? "Gerando PIX..." : "Gerar PIX"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Handshake;
  label: string;
  value: number;
}) {
  return (
    <Card className="glass-panel border-primary/10">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-xl bg-primary/10 p-3">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

