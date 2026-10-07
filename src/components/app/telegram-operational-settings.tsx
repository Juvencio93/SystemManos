import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTelegramOperationalIntegration, removeTelegramOperationalIntegration, saveTelegramOperationalIntegration, testTelegramOperationalIntegration } from "@/lib/telegram-operational.functions";

export function TelegramOperationalSettings() {
  const client = useQueryClient(); const get = useServerFn(getTelegramOperationalIntegration); const saveFn = useServerFn(saveTelegramOperationalIntegration); const testFn = useServerFn(testTelegramOperationalIntegration); const removeFn = useServerFn(removeTelegramOperationalIntegration);
  const query = useQuery({ queryKey: ["telegram-operational-integration"], queryFn: () => get() }); const data = query.data as any;
  const [botToken, setBotToken] = useState(""); const [alertChatId, setAlertChatId] = useState("");
  useEffect(() => { if (data?.alertChatId) setAlertChatId(data.alertChatId); }, [data]);
  const refresh = () => client.invalidateQueries({ queryKey: ["telegram-operational-integration"] });
  const save = useMutation({ mutationFn: () => saveFn({ data: { botToken, alertChatId } }), onSuccess: async () => { setBotToken(""); await refresh(); toast.success("Telegram Operacional configurado."); }, onError: (e: Error) => toast.error(e.message) });
  const test = useMutation({ mutationFn: () => testFn(), onSuccess: () => toast.success("Mensagem enviada ao Telegram."), onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: () => removeFn(), onSuccess: async () => { setBotToken(""); setAlertChatId(""); await refresh(); toast.success("Integração do Telegram excluída."); }, onError: (e: Error) => toast.error(e.message) });
  return <Card className="glass-panel border-primary/10"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Telegram Operacional</CardTitle><CardDescription>Alertas e canal do Gerente Operacional IA, exclusivo para ADM.</CardDescription></div><Badge variant="outline" className={data?.configured ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "text-muted-foreground"}>{data?.configured ? "Configurado" : "Disponível"}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100"><p>1. No Telegram, abra <strong>@BotFather</strong> e envie <code>/newbot</code>.</p><p>2. Cole abaixo o token fornecido.</p><p>3. Obtenha seu Chat ID com <strong>@userinfobot</strong> e informe abaixo.</p>{data?.botUsername && <p className="mt-2">Bot conectado: <strong>@{data.botUsername}</strong></p>}</div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Token do bot</Label><Input type="password" autoComplete="new-password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={data?.tokenMasked || "Token fornecido pelo BotFather"} /></div><div className="space-y-2"><Label>Chat ID autorizado</Label><Input value={alertChatId} onChange={(e) => setAlertChatId(e.target.value)} placeholder="Ex.: 123456789" /></div></div>{data?.lastError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{data.lastError}</div>}</CardContent><CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30 py-4"><Button onClick={() => save.mutate()} disabled={!botToken || !alertChatId || save.isPending}>{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar integração</Button><Button variant="outline" onClick={() => test.mutate()} disabled={!data?.saved || test.isPending}>{test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar teste</Button><Button variant="outline" className="border-destructive/30 text-destructive" onClick={() => { if (window.confirm("Excluir a integração do Telegram?")) remove.mutate(); }} disabled={!data?.saved || remove.isPending}>{remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir</Button></CardFooter></Card>;
}
