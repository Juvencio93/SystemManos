import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Building2,
  Phone,
  Image as ImageIcon,
  Lock,
  Save,
  HelpCircle,
  ExternalLink,
  MessageCircle,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  Eye,
  Trash2,
  AlertCircle,
  RefreshCw,
  User,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSettingsData, updateSettings, updatePassword } from "@/lib/settings.functions";
import {
  getAsaasIntegration,
  removeAsaasIntegration,
  saveAsaasIntegration,
  testAsaasIntegration,
} from "@/lib/asaas-integration.functions";
import { finalizeLogoUpload } from "@/lib/storage.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["settings-data"],
      queryFn: () => getSettingsData(),
    });
  },
});

type UploadState =
  "idle" | "validating" | "processing" | "uploading" | "confirming" | "ready" | "error";

const asaasEnvironmentNotes = {
  production: {
    title: "Produção: cobranças reais",
    description:
      "Use somente quando for cobrar clientes de verdade. O PIX gerado movimenta dinheiro real e usa a chave de produção da Asaas.",
  },
  sandbox: {
    title: "Sandbox/Testes: simulação",
    description:
      "Use para testar API, webhook e QR Code sem cobrança real. Exige chave de sandbox/testes da Asaas.",
  },
} as const;

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const getSettings = useServerFn(getSettingsData);
  const updateSettingsFn = useServerFn(updateSettings);
  const updatePasswordFn = useServerFn(updatePassword);
  const finalizeLogoUploadFn = useServerFn(finalizeLogoUpload);
  const getAsaasIntegrationFn = useServerFn(getAsaasIntegration);
  const saveAsaasIntegrationFn = useServerFn(saveAsaasIntegration);
  const testAsaasIntegrationFn = useServerFn(testAsaasIntegration);
  const removeAsaasIntegrationFn = useServerFn(removeAsaasIntegration);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatAvatarInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: string;
    dimensions: string;
    type: string;
  } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data } = useSuspenseQuery({
    queryKey: ["settings-data"],
    queryFn: () => getSettings(),
  });

  const asaasQuery = useQuery({
    queryKey: ["asaas-integration"],
    queryFn: () => getAsaasIntegrationFn(),
    enabled: data.role === "adm" || data.role === "revenda",
  });

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [pendingLogoUrl, setPendingLogoUrl] = useState("");
  const [chatAvatarUrl, setChatAvatarUrl] = useState("");
  const [isChatAvatarUploading, setIsChatAvatarUploading] = useState(false);
  const [asaasAccessToken, setAsaasAccessToken] = useState("");
  const [asaasPixKey, setAsaasPixKey] = useState("");
  const [asaasEmail, setAsaasEmail] = useState("");
  const [asaasEnvironment, setAsaasEnvironment] = useState<"production" | "sandbox">("production");
  const [asaasSiteUrl, setAsaasSiteUrl] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setDisplayName(
      (data as { userProfile?: { display_name?: string } }).userProfile?.display_name || "",
    );
    setChatAvatarUrl(
      (data as { userProfile?: { chat_avatar_url?: string | null } }).userProfile?.chat_avatar_url || "",
    );

    if (data.role === "adm") {
      setName("Manos Tech"); // Identity is fixed for ADM
      setPhone(data.platformSettings?.support_phone || "");
      setLogoUrl(data.platformSettings?.logo_url_relatorios || "");
    } else if (data.role === "matriz") {
      setName(data.companyData?.trade_name || data.companyData?.name || "");
      setPhone(data.companyData?.contact_phone || "");
      setLogoUrl(data.companyData?.logo_url || "");
    } else if (data.role === "filial") {
      setName(data.branchData?.trade_name || data.branchData?.name || "");
      setPhone(data.branchData?.contact_phone || "");
      setLogoUrl(data.branchData?.logo_url || "");
    }
  }, [data]);

  useEffect(() => {
    if (asaasQuery.data?.environment) {
      setAsaasEnvironment(asaasQuery.data.environment as "production" | "sandbox");
    }
    if (asaasQuery.data?.notificationEmail) {
      setAsaasEmail(asaasQuery.data.notificationEmail);
    }
    if (asaasQuery.data?.webhookUrl) {
      try {
        setAsaasSiteUrl(new URL(asaasQuery.data.webhookUrl).origin);
      } catch {
        // Keep the current typed value if the stored webhook URL is not parseable.
      }
    }
  }, [asaasQuery.data]);

  useEffect(() => {
    if (!asaasSiteUrl && typeof window !== "undefined") {
      setAsaasSiteUrl(window.location.origin);
    }
  }, [asaasSiteUrl]);

  const updateProfileMutation = useMutation({
    mutationFn: async (variables: {
      name: string;
      displayName: string;
      contact_phone: string;
      logo_url: string;
    }) => {
      const result = await updateSettingsFn({ data: variables });
      if (!result.success) throw new Error("Falha na atualização");
      return result;
    },
    onSuccess: async () => {
      // Force immediate refresh of user profile and access data
      queryClient.invalidateQueries({ queryKey: ["settings-data"] });
      queryClient.invalidateQueries({ queryKey: ["access"] });

      toast.success("Configurações salvas com sucesso!");

      // Short delay to allow re-fetching before redirect, ensuring greeting is updated
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 300);
    },
    onError: (error: Error) => {
      console.error("[Settings Audit] Final save failed:", error);
      const validationError = error.message.includes("Nome muito curto") ||
        error.message.includes("pelo menos 2 caracteres") ||
        error.message.includes('"path":["name"]') ||
        error.message.includes('"path":["displayName"]');
      toast.error(
        validationError
          ? "Informe um nome com pelo menos 2 caracteres."
          : error.message || "Erro ao salvar alterações no banco de dados.",
      );
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadState === "processing" || uploadState === "uploading") {
      toast.warning("Aguarde o processamento da logo terminar.");
      return;
    }

    const finalLogoUrl = pendingLogoUrl || logoUrl;
    updateProfileMutation.mutate({
      name,
      displayName,
      contact_phone: phone,
      logo_url: finalLogoUrl,
    });
  };

  const handleChatAvatarUpload = async (file: File) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("A foto do bate-papo deve ter no máximo 20 MB.");
      return;
    }

    setIsChatAvatarUploading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Sua sessão expirou. Entre novamente.");

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const preview = new Image();
        const objectUrl = URL.createObjectURL(file);
        preview.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(preview);
        };
        preview.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Não foi possível ler esta imagem."));
        };
        preview.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a imagem.");

      const sourceSize = Math.min(image.width, image.height);
      context.drawImage(
        image,
        (image.width - sourceSize) / 2,
        (image.height - sourceSize) / 2,
        sourceSize,
        sourceSize,
        0,
        0,
        320,
        320,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Falha ao otimizar a imagem."))), "image/webp", 0.84),
      );

      const objectPath = `${authData.user.id}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("chat-avatars")
        .upload(objectPath, new File([blob], "perfil.webp", { type: "image/webp" }), {
          contentType: "image/webp",
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat-avatars").getPublicUrl(objectPath);
      const result = await updateSettingsFn({ data: { chatAvatarUrl: urlData.publicUrl } });
      if (!result.success) throw new Error("Não foi possível salvar a foto do bate-papo.");

      setChatAvatarUrl(urlData.publicUrl);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings-data"] }),
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
      toast.success("Foto do bate-papo atualizada.");
    } catch (error) {
      console.error("[Chat avatar] Upload failed:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setIsChatAvatarUploading(false);
    }
  };

  const processImage = async (file: File) => {
    setUploadState("validating");
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setUploadState("error");
      toast.error("Formato inválido. Use PNG, JPG, JPEG ou WebP.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadState("error");
      toast.error("A imagem deve ter no máximo 15 MB.");
      return;
    }

    if (file.size === 0) {
      setUploadState("error");
      toast.error("O arquivo selecionado está vazio.");
      return;
    }

    setUploadState("processing");
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      const imgLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Arquivo de imagem corrompido ou ilegível."));
      });

      img.src = objectUrl;
      await imgLoadPromise;
      URL.revokeObjectURL(objectUrl);

      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Ambiente de renderização não disponível.");
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("Falha ao inicializar contexto de processamento.");

      const maxSize = 1200;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixelData = imageData.data;

      const r = pixelData[0]!;
      const g = pixelData[1]!;
      const b = pixelData[2]!;
      const threshold = 25;

      let backgroundRemoved = false;
      for (let i = 0; i < pixelData.length; i += 4) {
        const dr = Math.abs(pixelData[i]! - r);
        const dg = Math.abs(pixelData[i + 1]! - g);
        const db = Math.abs(pixelData[i + 2]! - b);
        if (dr < threshold && dg < threshold && db < threshold) {
          pixelData[i + 3] = 0;
          backgroundRemoved = true;
        }
      }
      if (backgroundRemoved) ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Falha ao gerar o arquivo final."));
        }, "image/png", 0.9);
      });

      setUploadState("uploading");
      const finalFile = new File([blob], file.name, { type: "image/png" });
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Sessão inválida para enviar a imagem.");
      const path = `logos/${authData.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(path, finalFile);
      if (uploadError) throw uploadError;

      const finalResult = await finalizeLogoUploadFn({
        data: {
          bucket: "brand-assets",
          objectPath: uploadData.path,
          size: finalFile.size,
          mimeType: "image/png",
        },
      });

      setPendingLogoUrl(finalResult.publicUrl);
      setLogoUrl(finalResult.publicUrl);
      setUploadState("ready");
      toast.success("Imagem processada e carregada com sucesso!");
    } catch (error: unknown) {
      const err = error as Error;
      console.error("[Logo Upload] Error:", err);
      setUploadState("error");
      toast.error(err.message || "Falha ao processar imagem.");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    try {
      await updatePasswordFn({
        data: { currentPassword, newPassword, confirmPassword },
      });
      toast.success("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao atualizar senha.");
    }
  };

  const saveAsaasMutation = useMutation({
    mutationFn: () =>
      saveAsaasIntegrationFn({
        data: {
          accessToken: asaasAccessToken,
          pixKey: asaasPixKey,
          notificationEmail: asaasEmail,
          environment: asaasEnvironment,
          siteUrl: asaasSiteUrl,
        },
      }),
    onSuccess: async () => {
      setAsaasAccessToken("");
      setAsaasPixKey("");
      await queryClient.invalidateQueries({ queryKey: ["asaas-integration"] });
      toast.success("Integração Asaas ativada com webhook automático!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao ativar integração Asaas.");
    },
  });

  const testAsaasMutation = useMutation({
    mutationFn: () => testAsaasIntegrationFn(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["asaas-integration"] });
      toast.success("Conexão com Asaas validada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Falha ao testar conexão com Asaas.");
    },
  });

  const removeAsaasMutation = useMutation({
    mutationFn: () => removeAsaasIntegrationFn(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["asaas-integration"] });
      toast.success("Integração Asaas removida.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao remover integração Asaas.");
    },
  });

  const isAdm = data.role === "adm";
  const isReseller = data.role === "revenda";
  const isMatriz = data.role === "matriz";
  const resellerDocument = (data as { resellerData?: { document?: string | null } }).resellerData?.document ?? "";
  const showCompanyIdentity = !isReseller || resellerDocument.replace(/\D/g, "").length === 14;
  const activationLimit = (data.companyData as { activation_limit?: number })?.activation_limit ?? 0;
  const companyBranchCount = useQuery({
    queryKey: ["settings-company-branch-count", data.companyData?.id],
    enabled: isMatriz && Boolean(data.companyData?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .eq("company_id", data.companyData!.id)
        .eq("is_headquarters", false);
      if (error) throw error;
      return count ?? 0;
    },
  });


  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e identidade visual.</p>
      </div>

      <div className="grid gap-8">
        {/* Personal Greeting Section */}
        <Card className="glass-panel border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-5 text-primary" />
              <CardTitle>Perfil Pessoal</CardTitle>
            </div>
            <CardDescription>
              Configure como você deseja ser identificado na plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Como gostaria de ser chamado?</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex.: Jéssica, Gabriel, Carlos..."
              />
              <p className="text-xs text-muted-foreground">
                Esse nome será utilizado somente na saudação da sua tela inicial.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <Label>Foto do bate-papo</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aparece nos seus contatos e conversas. A imagem é recortada em formato quadrado e otimizada.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border-2 border-slate-500 bg-muted/50">
                  {chatAvatarUrl ? (
                    <img src={chatAvatarUrl} alt="Sua foto do bate-papo" className="size-full object-cover" />
                  ) : (
                    <User className="size-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => chatAvatarInputRef.current?.click()}
                    disabled={isChatAvatarUploading}
                  >
                    {isChatAvatarUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {chatAvatarUrl ? "Trocar foto" : "Enviar foto"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG ou WebP. Máximo de 20 MB.</p>
                </div>
              </div>
              <input
                ref={chatAvatarInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void handleChatAvatarUpload(file);
                }}
              />
            </div>
            <div className="flex justify-end border-t pt-4">
              <Button
                type="button"
                className="gap-2"
                onClick={() => updateProfileMutation.mutate({
                  name,
                  displayName,
                  contact_phone: phone,
                  logo_url: pendingLogoUrl || logoUrl,
                })}
                disabled={updateProfileMutation.isPending || isChatAvatarUploading}
              >
                {updateProfileMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Brand / Company Section */}
        <form onSubmit={handleSaveProfile} className="space-y-8">
          {showCompanyIdentity && (
          <Card className="glass-panel border-primary/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <CardTitle>Identidade da {isAdm ? "Plataforma" : "Empresa"}</CardTitle>
              </div>
              <CardDescription>
                {isAdm
                  ? "Configurações institucionais da Manos Tech."
                  : "Dados oficiais da sua unidade ou matriz."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isMatriz && activationLimit > 0 && (companyBranchCount.data ?? 0) > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Filiais no Plano</p>
                      <p className="text-xs text-muted-foreground">Limite contratado de unidades</p>
                    </div>
                  </div>
                  <div className="text-2xl font-black text-primary">
                    {activationLimit}
                  </div>
                </div>
              )}



              <div className="space-y-2">
                <Label htmlFor="name">{isAdm ? "Nome Institucional" : "Nome Fantasia"}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isAdm} // ADM name is fixed as "Manos Tech"
                  placeholder={isAdm ? "Manos Tech" : "Nome da sua empresa"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  {isAdm ? "Telefone de Suporte" : "Telefone de Contato"}
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-4">
                <Label>Logo {isAdm ? "Institucional" : "da Empresa"}</Label>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative group">
                    <div className="flex size-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-primary/20 bg-muted/50 transition-colors group-hover:border-primary/40">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="size-full object-contain p-2"
                        />
                      ) : (
                        <ImageIcon className="size-10 text-muted-foreground/40" />
                      )}
                    </div>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl("");
                          setPendingLogoUrl("");
                        }}
                        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadState === "processing" || uploadState === "uploading"}
                        className="h-9 gap-2"
                      >
                        {uploadState === "uploading" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        Alterar Logo
                      </Button>
                      {logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setIsPreviewOpen(true)}
                          className="h-9 gap-2"
                        >
                          <Eye className="size-4" />
                          Visualizar
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Sua logo será convertida para PNG. A remoção de fundo funciona melhor em
                        imagens com fundo único e uniforme. Para fotos ou fundos complexos, envie
                        preferencialmente uma logo em PNG com fundo transparente.
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        Formatos aceitos: PNG, JPG ou WebP. Tamanho máximo: 15 MB. Pré-visualização
                        disponível após o envio.
                      </p>
                    </div>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImage(file);
                  }}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/30 py-4">
              <Button
                type="submit"
                className="ml-auto gap-2"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar Alterações
              </Button>
            </CardFooter>
          </Card>
          )}
        </form>

        {(isAdm || isReseller) && (
          <Card className="glass-panel border-primary/10">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <WalletCards className="size-5 text-primary" />
                  <div>
                    <CardTitle>Asaas</CardTitle>
                    <CardDescription>{isReseller ? "Receba os pagamentos das empresas da sua rede via PIX." : "Receba mensalidades via PIX."}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-primary/30",
                    asaasQuery.data?.configured
                      ? "border-green-500/40 bg-green-500/10 text-green-400"
                      : "text-muted-foreground",
                  )}
                >
                  {asaasQuery.data?.configured ? "Configurado" : "Disponível"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-blue-200">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Acesse a área do cliente Asaas e abra Perfil &gt; Integrações.</li>
                  <li>Gere uma chave de API de produção e cole no campo abaixo.</li>
                  <li>Abra Pix &gt; Minhas chaves e cadastre uma chave aleatória.</li>
                  <li>Cole a chave aleatória abaixo.</li>
                  <li>
                    Ao ativar, o sistema testa a conexão e cria o webhook automaticamente.
                  </li>
                </ul>
              </div>

              {asaasQuery.data?.configured && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-200">
                  <p>Chave salva: {asaasQuery.data.accessTokenMasked}</p>
                  <p>Chave Pix salva: {asaasQuery.data.pixKeyMasked}</p>
                  {asaasQuery.data.webhookUrl && (
                    <p className="mt-1 break-all">Webhook: {asaasQuery.data.webhookUrl}</p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asaasEnvironment">Ambiente</Label>
                  <select
                    id="asaasEnvironment"
                    value={asaasEnvironment}
                    onChange={(event) =>
                      setAsaasEnvironment(event.target.value as "production" | "sandbox")
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="production">Produção</option>
                    <option value="sandbox">Sandbox/Testes</option>
                  </select>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      {asaasEnvironmentNotes[asaasEnvironment].title}
                    </p>
                    <p className="mt-1">{asaasEnvironmentNotes[asaasEnvironment].description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asaasEmail">E-mail para avisos do webhook</Label>
                  <Input
                    id="asaasEmail"
                    type="email"
                    value={asaasEmail}
                    onChange={(event) => setAsaasEmail(event.target.value)}
                    placeholder="financeiro@seudominio.com.br"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaasSiteUrl">URL pública do sistema</Label>
                <Input
                  id="asaasSiteUrl"
                  type="url"
                  value={asaasSiteUrl}
                  onChange={(event) => setAsaasSiteUrl(event.target.value)}
                  placeholder="https://manostech.lovable.app"
                />
                <p className="text-xs text-muted-foreground">
                  Usada pela Asaas para avisar pagamentos confirmados. Normalmente o sistema já
                  preenche com a URL aberta no navegador.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaasAccessToken">Chave de API</Label>
                <Input
                  id="asaasAccessToken"
                  type="password"
                  value={asaasAccessToken}
                  onChange={(event) => setAsaasAccessToken(event.target.value)}
                  placeholder={asaasQuery.data?.accessTokenMasked || "Cole a chave de API"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaasPixKey">Chave Aleatória PIX</Label>
                <Input
                  id="asaasPixKey"
                  type="password"
                  value={asaasPixKey}
                  onChange={(event) => setAsaasPixKey(event.target.value)}
                  placeholder={asaasQuery.data?.pixKeyMasked || "Cole a chave aleatória"}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                As chaves ficam disponíveis somente no servidor e aparecem mascaradas depois de
                salvas. Matrizes e Filiais não veem nem configuram esta integração.
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30 py-4">
              <Button
                type="button"
                className="gap-2"
                onClick={() => saveAsaasMutation.mutate()}
                disabled={
                  saveAsaasMutation.isPending ||
                  !asaasAccessToken.trim() ||
                  !asaasPixKey.trim()
                }
              >
                {saveAsaasMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Ativar integração
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => testAsaasMutation.mutate()}
                disabled={!asaasQuery.data?.configured || testAsaasMutation.isPending}
              >
                {testAsaasMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Testar conexão
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => removeAsaasMutation.mutate()}
                disabled={!asaasQuery.data?.configured || removeAsaasMutation.isPending}
              >
                <Trash2 className="size-4" />
                Remover
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Security Section */}
        <Card className="glass-panel border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-primary" />
              <CardTitle>Segurança</CardTitle>
            </div>
            <CardDescription>Atualize sua senha de acesso à plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary" className="gap-2">
                Atualizar Senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Visualização da Logo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-muted-foreground italic">
                Fundo Branco (Padrão Relatórios)
              </p>
              <div className="flex size-48 items-center justify-center rounded-xl border bg-white p-4 shadow-sm">
                <img src={logoUrl} alt="Logo White" className="size-full object-contain" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-muted-foreground italic">
                Fundo Escuro (Padrão App)
              </p>
              <div className="flex size-48 items-center justify-center rounded-xl bg-slate-900 p-4 shadow-sm">
                <img src={logoUrl} alt="Logo Dark" className="size-full object-contain" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

