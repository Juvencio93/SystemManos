import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Loader2, MessageCircle, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWhatsAppOperationalIntegration, saveWhatsAppOperationalIntegration, testWhatsAppOperationalIntegration } from "@/lib/whatsapp-operational.functions";

const webhookPath = "/api/public/whatsapp-operational-webhook";

export function WhatsAppOperationalSettings() {
  const queryClient = useQueryClient();
  const getIntegration = useServerFn(getWhatsAppOperationalIntegration);
  const saveIntegration = useServerFn(saveWhatsAppOperationalIntegration);
  const testIntegration = useServerFn(testWhatsAppOperationalIntegration);
  const integration = useQuery({ queryKey: ["whatsapp-operational-integration"], queryFn: () => getIntegration() });
  const [form, setForm] = useState({ wabaId: "", phoneNumberId: "", businessPhone: "", alertPhone: "", accessToken: "", appSecret: "", templateName: "alerta_operacional" });
  const [revealedVerifyToken, setRevealedVerifyToken] = useState("");
  const webhookUrl = typeof window === "undefined" ? webhookPath : `${window.location.origin}${webhookPath}`;

  useEffect(() => {
    const data = integration.data as any;
    if (!data) return;
    setForm((current) => ({ ...current, wabaId: data.waba_id || "", phoneNumberId: data.phone_number_id || "", businessPhone: data.business_phone || "", alertPhone: data.alert_phone || "", templateName: data.alert_template_name || "alerta_operacional" }));
  }, [integration.data]);

  const save = useMutation({
    mutationFn: () => saveIntegration({ data: form }),
    onSuccess: async (result) => { setRevealedVerifyToken(result.verifyToken); setForm((current) => ({ ...current, accessToken: "", appSecret: "" })); await queryClient.invalidateQueries({ queryKey: ["whatsapp-operational-integration"] }); toast.success("WhatsApp Operacional configurado. Copie agora o código de verificação."); },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar a integração."),
  });
  const test = useMutation({
    mutationFn: () => testIntegration(),
    onSuccess: () => toast.success("Mensagem de teste enviada ao WhatsApp."),
    onError: (error: Error) => toast.error(error.message || "Não foi possível enviar o teste."),
  });
  const set = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); toast.success("Copiado."); };
  const data = integration.data as any;

  return <Card className="glass-panel border-primary/10">
    <CardHeader><div className="flex items-start justify-between gap-3"><div className="flex gap-2"><MessageCircle className="mt-0.5 size-5 text-emerald-400" /><div><CardTitle>WhatsApp Operacional</CardTitle><CardDescription>Canal oficial do Gerente Operacional IA para alertas administrativos.</CardDescription></div></div><Badge variant="outline" className={data?.configured ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "text-muted-foreground"}>{data?.configured ? "Configurado" : "Aguardando número"}</Badge></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-100"><p className="font-medium">Dados para configurar na Meta</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all">{webhookUrl}</code><Button size="icon" variant="ghost" onClick={() => copy(webhookUrl)}><Copy className="size-4" /></Button></div>{(revealedVerifyToken || data?.verifyTokenMasked) && <div className="mt-2 flex items-center gap-2"><span className="min-w-0 flex-1 break-all">Código de verificação: <code>{revealedVerifyToken || data.verifyTokenMasked}</code></span>{revealedVerifyToken && <Button size="icon" variant="ghost" onClick={() => copy(revealedVerifyToken)}><Copy className="size-4" /></Button>}</div>}{revealedVerifyToken && <p className="mt-2 text-amber-200">Copie este código agora. Depois que a página for fechada, ele ficará mascarado.</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>ID da conta WhatsApp Business</Label><Input value={form.wabaId} onChange={(e) => set("wabaId", e.target.value)} /></div><div className="space-y-2"><Label>ID do número de telefone</Label><Input value={form.phoneNumberId} onChange={(e) => set("phoneNumberId", e.target.value)} /></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Número do Gerente Operacional</Label><Input value={form.businessPhone} onChange={(e) => set("businessPhone", e.target.value)} placeholder="5547999999999" /></div><div className="space-y-2"><Label>Número que receberá os alertas</Label><Input value={form.alertPhone} onChange={(e) => set("alertPhone", e.target.value)} placeholder="5547999999999" /></div></div>
      <div className="space-y-2"><Label>Nome do modelo aprovado</Label><Input value={form.templateName} onChange={(e) => set("templateName", e.target.value)} /><p className="text-xs text-muted-foreground">Com o número de teste da Meta, use <code>hello_world</code>. Em produção, use <code>alerta_operacional</code> após a aprovação do modelo.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Token permanente</Label><Input type="password" autoComplete="new-password" value={form.accessToken} onChange={(e) => set("accessToken", e.target.value)} placeholder={data?.tokenMasked || "Cole o token da Meta"} /></div><div className="space-y-2"><Label>Segredo do aplicativo</Label><Input type="password" autoComplete="new-password" value={form.appSecret} onChange={(e) => set("appSecret", e.target.value)} placeholder="Cole o segredo do aplicativo" /></div></div>
      {data?.last_error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{data.last_error}</div>}
    </CardContent>
    <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30 py-4"><Button onClick={() => save.mutate()} disabled={save.isPending || !form.accessToken || !form.appSecret}>{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar integração</Button><Button variant="outline" onClick={() => test.mutate()} disabled={!data?.configured || test.isPending}>{test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar teste</Button>{data?.configured && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="size-4" /> Credenciais protegidas no servidor</span>}</CardFooter>
  </Card>;
}
