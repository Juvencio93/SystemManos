/**
 * Modal "Nova Empresa Cliente" do /revendas + download do kit completo.
 *
 * Fluxo (revendedor, com crédito): passo 1 dados do cliente → passo 2
 * equipamento (MAC) → passo 3 conclusão com o kit para baixar. O cadastro
 * consome 1 crédito (via `createCompanyWithAccess`) e o kit é vinculado pelo
 * MAC (via `registerClientKit`). Sem crédito, o modal avisa e oferece a
 * compra via PIX — não gera kit.
 *
 * O kit tem 4 arquivos: o script .rsc (gerador oficial, URL assinada),
 * login.html v4, alogin.html v4 e o LEIA-ME.txt com o passo a passo.
 * UniFi aparece como "Em breve" e não deixa selecionar: o adapter ainda não
 * existe no backend.
 */
import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Download, FileText, Router } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createCompanyWithAccess } from "@/lib/cnpj.functions";
import {
  checkClientKitMac,
  registerClientKit,
} from "@/lib/reseller-client-kit.functions";
import { downloadRbSetup } from "@/lib/rb-inventory.functions";
import {
  CLIENT_KIT_PLANS,
  CLIENT_KIT_VENDORS,
  buildKitReadme,
  buildResellerClientCompanyInput,
  formatMacInput,
  isValidMac,
  kitDownloadFileNames,
  type ClientKitPlan,
} from "@/lib/reseller-client-kit";
import { formatDocument, isValidDocument } from "@/lib/document-utils";
import { slugify } from "@/lib/cnpj-utils";

export type ClientKitResult = {
  deviceId: string;
  routerIdentity: string;
  mac: string;
  nickname: string | null;
  companyName: string;
  slug: string;
};

type KitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reseller: { id: string; name: string } | null;
  availableCredits: number;
  /** Quando informado, o modal abre direto no passo do equipamento (só gera o kit). */
  kitOnlyCompany?: { id: string; name: string } | null;
  onDone: () => void;
  onBuyCredits: () => void;
};

const emptyClient = {
  name: "",
  document: "",
  city: "",
  state: "",
  plan: "Essencial" as ClientKitPlan,
  accessEmail: "",
  accessPassword: "",
  monthlyPrice: "",
};

export function ResellerClientKitDialog({
  open,
  onOpenChange,
  reseller,
  availableCredits,
  kitOnlyCompany,
  onDone,
  onBuyCredits,
}: KitDialogProps) {
  const kitOnly = Boolean(kitOnlyCompany);
  const [step, setStep] = useState(1);
  const [client, setClient] = useState(emptyClient);
  const [mac, setMac] = useState("");
  const [nickname, setNickname] = useState("");
  const [slug, setSlug] = useState("");
  const [createdCompany, setCreatedCompany] = useState<{ id: string; name: string } | null>(null);
  const [kit, setKit] = useState<ClientKitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createCompany = useServerFn(createCompanyWithAccess);
  const checkMac = useServerFn(checkClientKitMac);
  const registerKit = useServerFn(registerClientKit);

  const close = () => {
    setStep(1);
    setClient(emptyClient);
    setMac("");
    setNickname("");
    setSlug("");
    setCreatedCompany(null);
    setKit(null);
    setError(null);
    setBusy(false);
    onOpenChange(false);
  };

  const findFreeSlug = async (base: string): Promise<string> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const { data, error: queryError } = await supabase
        .from("companies")
        .select("id")
        .eq("slug", candidate)
        .limit(1);
      if (queryError) return candidate;
      if (!data?.length) return candidate;
    }
    return base;
  };

  const validateStep1 = (): string | null => {
    if (client.name.trim().length < 2) return "Informe o nome do estabelecimento.";
    if (!slugify(client.name.trim())) return "Informe um nome válido para a empresa.";
    if (!isValidDocument(client.document)) return "Informe um CNPJ ou CPF válido.";
    if (client.city.trim().length < 2) return "Informe a cidade.";
    if (client.state.trim().length !== 2) return "Informe a UF com 2 letras (ex.: SC).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.accessEmail.trim()))
      return "Informe um e-mail válido para o acesso do cliente.";
    if (client.accessPassword.length < 8) return "A senha inicial precisa ter ao menos 8 caracteres.";
    const price = client.monthlyPrice.trim() === "" ? 0 : Number(client.monthlyPrice);
    if (Number.isNaN(price) || price < 0) return "Informe uma mensalidade válida (ou deixe em branco).";
    return null;
  };

  const goToStep2 = async () => {
    const validationError = validateStep1();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const freeSlug = await findFreeSlug(slugify(client.name.trim()));
      setSlug(freeSlug);
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const submitKit = async (companyId: string) => {
    const result = await registerKit({
      data: { companyId, mac: mac.trim(), nickname: nickname.trim() || null },
    });
    setKit(result);
    return result;
  };

  const submit = async () => {
    if (!isValidMac(mac)) {
      setError("MAC inválido. Confira os 12 caracteres da etiqueta da RB (ex.: AA:BB:CC:11:22:33).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await checkMac({ data: { mac: mac.trim() } });
      if (kitOnly && kitOnlyCompany) {
        await submitKit(kitOnlyCompany.id);
        setCreatedCompany({ id: kitOnlyCompany.id, name: kitOnlyCompany.name });
        setStep(3);
        return;
      }
      if (availableCredits <= 0) {
        setError("Você não tem créditos. Compre créditos via PIX para cadastrar o cliente.");
        return;
      }
      const price = client.monthlyPrice.trim() === "" ? 0 : Number(client.monthlyPrice);
      const created = await createCompany({
        data: buildResellerClientCompanyInput({
          name: client.name,
          slug,
          document: client.document.trim() || null,
          city: client.city.trim() || null,
          state: client.state.trim().toUpperCase() || null,
          plan: client.plan,
          monthlyPrice: price,
          accessEmail: client.accessEmail,
          accessPassword: client.accessPassword,
        }),
      });
      setCreatedCompany({ id: created.companyId, name: client.name.trim() });
      try {
        await submitKit(created.companyId);
      } catch (kitError) {
        // A empresa já foi criada e o crédito usado: fica na tela de conclusão
        // com o erro e o botão de tentar de novo (sem criar outra empresa).
        setError(
          kitError instanceof Error
            ? kitError.message
            : "Não foi possível gerar o kit. Tente de novo.",
        );
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setBusy(false);
    }
  };

  const retryKit = async () => {
    if (!createdCompany) return;
    setError(null);
    setBusy(true);
    try {
      await submitKit(createdCompany.id);
      toast.success("Kit gerado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o kit. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = kitOnly
    ? step === 3
      ? "Kit pronto"
      : "Passo 2 de 2 — Equipamento"
    : step === 1
      ? "Passo 1 de 3 — Cliente"
      : step === 2
        ? "Passo 2 de 3 — Equipamento"
        : "Passo 3 de 3 — Kit pronto";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kitOnly ? `Gerar kit — ${kitOnlyCompany?.name ?? ""}` : "Nova Empresa Cliente"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{stepTitle}</p>
        </DialogHeader>

        {availableCredits <= 0 && !kitOnly && step !== 3 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-semibold">Você está sem créditos.</p>
            <p className="mt-1 text-muted-foreground">
              Cada cliente novo usa 1 crédito. Compre créditos via PIX para continuar.
            </p>
            <Button className="mt-3" size="sm" onClick={onBuyCredits}>
              Comprar créditos via PIX
            </Button>
          </div>
        ) : null}

        {step === 1 && !kitOnly ? (
          <div className="grid gap-4 py-2">
            <Field label="Nome do estabelecimento *">
              <Input
                value={client.name}
                onChange={(event) => setClient({ ...client, name: event.target.value })}
                placeholder="Ex.: Bar do Zé"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CNPJ ou CPF *">
                <Input
                  value={client.document}
                  onChange={(event) =>
                    setClient({ ...client, document: formatDocument(event.target.value) })
                  }
                  placeholder="00.000.000/0000-00"
                />
              </Field>
              <Field label="Plano *">
                <Select
                  value={client.plan}
                  onValueChange={(value: ClientKitPlan) => setClient({ ...client, plan: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_KIT_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cidade *">
                <Input
                  value={client.city}
                  onChange={(event) => setClient({ ...client, city: event.target.value })}
                  placeholder="Ex.: Balneário Camboriú"
                />
              </Field>
              <Field label="UF *">
                <Input
                  value={client.state}
                  maxLength={2}
                  onChange={(event) =>
                    setClient({ ...client, state: event.target.value.toUpperCase() })
                  }
                  placeholder="SC"
                />
              </Field>
            </div>
            <Field label="E-mail de acesso do cliente *">
              <Input
                type="email"
                value={client.accessEmail}
                onChange={(event) => setClient({ ...client, accessEmail: event.target.value })}
                placeholder="contato@bar-do-ze.com.br"
              />
              <p className="text-xs text-muted-foreground">
                É com este e-mail que o cliente entra no painel dele.
              </p>
            </Field>
            <Field label="Senha inicial do cliente *">
              <Input
                type="password"
                autoComplete="new-password"
                value={client.accessPassword}
                onChange={(event) => setClient({ ...client, accessPassword: event.target.value })}
                placeholder="Mínimo de 8 caracteres"
              />
            </Field>
            <Field label="Mensalidade que você vai cobrar (opcional)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={client.monthlyPrice}
                onChange={(event) => setClient({ ...client, monthlyPrice: event.target.value })}
                placeholder="Ex.: 199,90 — deixe em branco se for combinar depois"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Ao concluir, 1 crédito é usado para ativar este cliente por 30 dias.
              {reseller ? ` Revenda: ${reseller.name}.` : ""}
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Equipamento *</Label>
              <div className="grid gap-2">
                {CLIENT_KIT_VENDORS.map((vendor) =>
                  vendor.id === "mikrotik" ? (
                    <div
                      key={vendor.id}
                      aria-current="true"
                      className="flex items-center justify-between gap-3 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Router className="size-4 text-primary" />
                        {vendor.label}
                      </span>
                      <Badge variant="outline">Kit Plug &amp; Play v4</Badge>
                    </div>
                  ) : (
                    <button
                      key={vendor.id}
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm opacity-60"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Router className="size-4 text-primary" />
                        {vendor.label}
                      </span>
                      <Badge variant="outline">Em breve</Badge>
                    </button>
                  ),
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                O UniFi ainda não tem kit neste painel. Por enquanto, só MikroTik.
              </p>
            </div>
            <Field label="MAC da RB *">
              <Input
                value={mac}
                onChange={(event) => setMac(formatMacInput(event.target.value))}
                placeholder="AA:BB:CC:11:22:33"
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                São os 12 caracteres da etiqueta da RB. O kit é gerado para este equipamento.
              </p>
            </Field>
            <Field label="Apelido do equipamento (opcional)">
              <Input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Ex.: RB Principal Salão"
              />
            </Field>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 py-2">
            {kit ? (
              <>
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                  <div className="text-sm">
                    <p className="font-semibold">
                      {kitOnly ? "Kit gerado!" : "Cliente cadastrado e kit gerado!"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {kit.companyName} · {kit.routerIdentity} · MAC {kit.mac}
                    </p>
                  </div>
                </div>
                <ClientKitDownload kit={kit} />
              </>
            ) : (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold">A empresa foi criada, mas o kit não saiu.</p>
                <p className="mt-1 text-muted-foreground">
                  O crédito já foi usado e a empresa está ativa. Confira o MAC e tente gerar o
                  kit de novo — não será criado outro cliente.
                </p>
                {createdCompany ? (
                  <Button className="mt-3" size="sm" disabled={busy} onClick={retryKit}>
                    {busy ? "Gerando..." : "Tentar gerar o kit de novo"}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {step === 1 && !kitOnly ? (
            <>
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button disabled={busy || availableCredits <= 0} onClick={goToStep2}>
                {busy ? "Verificando..." : "Continuar"}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              {!kitOnly ? (
                <Button variant="outline" disabled={busy} onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 size-4" />
                  Voltar
                </Button>
              ) : (
                <Button variant="outline" onClick={close}>
                  Cancelar
                </Button>
              )}
              <Button disabled={busy} onClick={submit}>
                {busy ? "Gerando..." : kitOnly ? "Gerar kit" : "Cadastrar cliente e gerar kit"}
              </Button>
            </>
          ) : null}
          {step === 3 ? (
            <Button
              onClick={() => {
                onDone();
                close();
              }}
            >
              Concluir
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/** Os 4 arquivos do kit, para baixar de novo a qualquer momento. */
export function ClientKitDownload({ kit }: { kit: ClientKitResult }) {
  const downloadSetup = useServerFn(downloadRbSetup);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadScript = async () => {
    setDownloadError(null);
    setBusy(true);
    try {
      const url = await downloadSetup({ data: { deviceId: kit.deviceId, kind: "setup" } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Não foi possível baixar o script.",
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadReadme = () => {
    const text = buildKitReadme({
      companyName: kit.companyName,
      slug: kit.slug,
      routerIdentity: kit.routerIdentity,
      mac: kit.mac,
      nickname: kit.nickname,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "LEIA-ME.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const files = kitDownloadFileNames(kit.routerIdentity);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Baixar kit completo</p>
      <div className="grid gap-2">
        <Button variant="outline" className="justify-start" disabled={busy} onClick={downloadScript}>
          <Download className="mr-2 size-4" />
          {files[0]?.fileName ?? "script.rsc"}
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            Script de instalação da RB
          </span>
        </Button>
        <a
          href="/mikrotik/login.html"
          download="login.html"
          className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Download className="size-4" />
          login.html
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            Página do portal Wi-Fi (v4)
          </span>
        </a>
        <a
          href="/mikrotik/alogin.html"
          download="alogin.html"
          className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Download className="size-4" />
          alogin.html
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            Página de pós-login (v4)
          </span>
        </a>
        <Button variant="outline" className="justify-start" onClick={downloadReadme}>
          <FileText className="mr-2 size-4" />
          LEIA-ME.txt
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            Passo a passo da instalação
          </span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Equipamento: {kit.nickname ? `${kit.nickname} · ` : ""}
        {kit.routerIdentity} · MAC {kit.mac}. Você pode baixar de novo quando quiser.
      </p>
      {downloadError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {downloadError}
        </p>
      ) : null}
    </div>
  );
}
