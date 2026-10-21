import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Power,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import {
  cancelarCampanhaWhatsapp,
  conectarWhatsapp,
  criarCampanhaWhatsapp,
  desconectarWhatsapp,
  getWhatsappPainel,
  pausarCampanhaWhatsapp,
  retomarCampanhaWhatsapp,
  statusWhatsapp,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsappPage,
});

function formatarNumero(numero: string | null): string {
  if (!numero) return "";
  const d = numero.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

const STATUS_CAMPANHA: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  enviando: { label: "Enviando", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  concluida: { label: "Concluída", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

function ComoFunciona() {
  const regras = [
    {
      icon: ShieldCheck,
      titulo: "Só quem autorizou",
      texto:
        "A lista é montada apenas com clientes que autorizaram receber mensagens no check-in do Wi-Fi. Quem não autorizou, nem entra na lista.",
    },
    {
      icon: Layers,
      titulo: "100 por dia, em lotes de 10",
      texto:
        "O sistema envia 10 mensagens, descansa de 45 a 60 minutos e envia mais 10 — até o limite de 100 no dia. Devagar de propósito: é o que protege seu número de bloqueio.",
    },
    {
      icon: Clock,
      titulo: "Pausas que imitam gente",
      texto:
        "Entre uma mensagem e outra há pausas aleatórias de 30 a 90 segundos, e o WhatsApp mostra 'digitando...' antes de cada envio. Nada de rajada de robô.",
    },
    {
      icon: Flame,
      titulo: "Número novo aquece aos poucos",
      texto:
        "Na primeira semana o limite é 30 por dia; na segunda, 50; depois, os 100. Número recém-conectado disparando tudo de uma vez é o que mais cai em bloqueio.",
    },
    {
      icon: CalendarClock,
      titulo: "Base grande? Continua amanhã",
      texto:
        "Se sua base tiver 350 pessoas, o disparo leva cerca de 4 dias: cada dia ele retoma de onde parou, e ninguém recebe a mesma campanha duas vezes.",
    },
    {
      icon: X,
      titulo: "Quem responder SAIR, sai pra sempre",
      texto:
        "Se o cliente responder SAIR, a autorização dele é cancelada na hora e ele não entra em nenhum disparo futuro.",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-5 w-5" /> Como funciona o disparo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Conecte o WhatsApp da unidade lendo o QR Code abaixo — igual ao WhatsApp Web.",
            "Escreva sua mensagem (dá pra usar {nome} e o sistema troca pelo nome de cada cliente).",
            "O sistema monta a lista só com os clientes que autorizaram no check-in.",
            "Você aperta Disparar e o sistema envia sozinho, no ritmo seguro, durante o dia (8h às 20h).",
          ].map((passo, i) => (
            <li key={i} className="flex gap-3 rounded-lg border p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-sm text-muted-foreground">{passo}</span>
            </li>
          ))}
        </ol>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {regras.map((r) => (
            <div key={r.titulo} className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <r.icon className="h-4 w-4 text-primary" /> {r.titulo}
              </p>
              <p className="text-sm text-muted-foreground">{r.texto}</p>
            </div>
          ))}
        </div>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          💡 Use um número dedicado da unidade para os disparos (um chip só pra isso), e não o seu
          número pessoal. É esse número que aparece para os clientes — e é ele que o ritmo seguro
          protege.
        </p>
      </CardContent>
    </Card>
  );
}

function WhatsappPage() {
  const access = useAccess();
  const queryClient = useQueryClient();
  const role = access.data?.role;
  const permitido = role === "matriz" || role === "filial";

  const painel = useQuery({
    queryKey: ["whatsapp-painel"],
    queryFn: () => getWhatsappPainel(),
    enabled: permitido && !access.isLoading,
    refetchInterval: (query) =>
      (query.state.data?.campanhas || []).some((c: any) => c.status === "enviando") ? 30_000 : false,
  });

  const [qr, setQr] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const dados = painel.data;
  const instancia = dados?.instancia;
  const conectada = instancia?.status === "conectada";
  const conectando = instancia?.status === "conectando" || Boolean(qr);

  const statusPoll = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => statusWhatsapp(),
    enabled: permitido && conectando && !conectada,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (statusPoll.data && "status" in statusPoll.data && statusPoll.data.status === "conectada") {
      setQr(null);
      toast.success("WhatsApp conectado!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-painel"] });
    }
  }, [statusPoll.data, queryClient]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["whatsapp-painel"] });

  const mutConectar = useMutation({
    mutationFn: () => conectarWhatsapp(),
    onSuccess: (r) => {
      if (!r.configurado) {
        toast.info("O serviço de envio está sendo ativado pela Manos Tech. Tente de novo em breve.");
        return;
      }
      if (r.status === "conectada") {
        setQr(null);
        toast.success("WhatsApp conectado!");
      } else {
        setQr(r.qr);
        if (!r.qr) toast.info("Abra o WhatsApp do número e toque em 'Aparelhos conectados'.");
      }
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao conectar."),
  });

  const mutDesconectar = useMutation({
    mutationFn: () => desconectarWhatsapp(),
    onSuccess: () => {
      setQr(null);
      toast.success("WhatsApp desconectado.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao desconectar."),
  });

  const mutCriar = useMutation({
    mutationFn: () => criarCampanhaWhatsapp({ data: { titulo, mensagem } }),
    onSuccess: (r) => {
      toast.success(
        `Disparo criado para ${r.total} pessoas — conclusão em cerca de ${r.diasEstimados} dia(s) no ritmo seguro.`,
      );
      setTitulo("");
      setMensagem("");
      setConfirmando(false);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar o disparo."),
  });

  const mutPausar = useMutation({
    mutationFn: (id: string) => pausarCampanhaWhatsapp({ data: { id } }),
    onSuccess: invalidar,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });
  const mutRetomar = useMutation({
    mutationFn: (id: string) => retomarCampanhaWhatsapp({ data: { id } }),
    onSuccess: invalidar,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });
  const mutCancelar = useMutation({
    mutationFn: (id: string) => cancelarCampanhaWhatsapp({ data: { id } }),
    onSuccess: () => {
      toast.success("Disparo cancelado. Quem já recebeu, não recebe de novo.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });

  const previa = useMemo(
    () => mensagem.replaceAll("{nome}", "Maria"),
    [mensagem],
  );

  if (!access.isLoading && !permitido) {
    return (
      <div className="space-y-6">
        <PageHeader title="Disparos WhatsApp" subtitle="Envio de mensagens para seus clientes" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Os disparos de WhatsApp estão disponíveis para os painéis da Matriz e das Filiais.
          </CardContent>
        </Card>
      </div>
    );
  }

  const autorizados = dados?.base.autorizados ?? 0;
  const totalBase = dados?.base.total ?? 0;
  const limiteHoje = dados?.limiteHoje ?? 30;
  const diasAprox = autorizados > 0 ? Math.max(1, Math.ceil(autorizados / Math.max(1, limiteHoje))) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disparos WhatsApp"
        subtitle="Mande promoções e novidades para os clientes que autorizaram no Wi-Fi — no ritmo seguro, sem bloquear seu número."
      />

      <ComoFunciona />

      {dados?.migrationRequired && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            A estrutura dos disparos está sendo preparada pela Manos Tech. Volte em alguns minutos.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5" />
              {role === "filial" ? "WhatsApp da sua unidade" : "WhatsApp da sua empresa"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {painel.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </p>
            ) : conectada ? (
              <>
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>
                    Conectado: <strong>{formatarNumero(instancia?.numero ?? null)}</strong>
                  </span>
                  <Badge variant="outline" className="border-green-300 text-green-700">ativo</Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  Envios de hoje: <strong>{dados?.enviadosHoje ?? 0}</strong> de{" "}
                  <strong>{limiteHoje}</strong>
                  {limiteHoje < 100 && " (número em aquecimento — o limite sobe sozinho)"}
                </p>
                <Button
                  variant="outline"
                  onClick={() => mutDesconectar.mutate()}
                  disabled={mutDesconectar.isPending}
                >
                  <Power className="mr-2 h-4 w-4" /> Desconectar número
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nenhum número conectado. Conecte o WhatsApp da unidade lendo o QR Code com o
                  aparelho — igual ao WhatsApp Web (Aparelhos conectados → Conectar aparelho).
                </p>
                {qr ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                      alt="QR Code para conectar o WhatsApp"
                      className="h-56 w-56 rounded-lg border bg-white p-2"
                    />
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Aguardando a leitura do QR
                      Code… (ele se renova sozinho se expirar)
                    </p>
                    <Button variant="outline" onClick={() => mutConectar.mutate()} disabled={mutConectar.isPending}>
                      <QrCode className="mr-2 h-4 w-4" /> Gerar novo QR Code
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => mutConectar.mutate()} disabled={mutConectar.isPending}>
                    {mutConectar.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="mr-2 h-4 w-4" />
                    )}
                    Conectar WhatsApp
                  </Button>
                )}
                {dados && !dados.evolutionConfigurado && (
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    O serviço de envio está sendo ativado pela Manos Tech. Assim que estiver
                    pronto, o QR Code aparece aqui.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" /> Sua base autorizada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-6">
              <div>
                <p className="text-3xl font-bold">{autorizados}</p>
                <p className="text-sm text-muted-foreground">podem receber seus disparos</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-muted-foreground">{totalBase}</p>
                <p className="text-sm text-muted-foreground">clientes na base (CRM)</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Só recebe quem autorizou no check-in do Wi-Fi — e a base cresce sozinha a cada novo
              check-in autorizado. Quem respondeu SAIR já está fora desta conta.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5" /> Novo disparo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-titulo">Nome do disparo (só você vê)</Label>
            <Input
              id="wa-titulo"
              placeholder="Ex.: Promoção de sábado"
              maxLength={80}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-msg">Mensagem</Label>
              <Textarea
                id="wa-msg"
                rows={6}
                maxLength={1000}
                placeholder={"Olá, {nome}! 🎉 Hoje tem promoção especial te esperando. Passa aqui!"}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{nome}"} e o sistema troca pelo primeiro nome de cada cliente.{" "}
                {mensagem.length}/1000
              </p>
            </div>
            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="rounded-lg bg-[#e7f6df] p-3 text-sm whitespace-pre-wrap min-h-[9rem] dark:bg-green-950">
                {previa || "Sua mensagem aparece aqui…"}
              </div>
            </div>
          </div>
          {!conectada && (
            <p className="text-sm text-amber-700">
              Conecte o WhatsApp da unidade acima para poder disparar.
            </p>
          )}
          {autorizados === 0 && (
            <p className="text-sm text-amber-700">
              Ainda não há contatos autorizados na base. Eles entram automaticamente quando o
              cliente autoriza no check-in do Wi-Fi.
            </p>
          )}
          {confirmando ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <p className="text-sm">
                Disparar para <strong>{autorizados} pessoas</strong>
                {diasAprox > 1 && (
                  <> — no ritmo seguro, leva cerca de <strong>{diasAprox} dias</strong></>
                )}
                ?
              </p>
              <Button onClick={() => mutCriar.mutate()} disabled={mutCriar.isPending}>
                {mutCriar.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Confirmar disparo
              </Button>
              <Button variant="ghost" onClick={() => setConfirmando(false)}>
                Voltar
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setConfirmando(true)}
              disabled={!conectada || autorizados === 0 || titulo.trim().length < 3 || mensagem.trim().length < 10}
            >
              <Send className="mr-2 h-4 w-4" /> Iniciar disparo
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seus disparos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(dados?.campanhas || []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum disparo ainda.</p>
          )}
          {(dados?.campanhas || []).map((c: any) => {
            const st = STATUS_CAMPANHA[c.status] ?? { label: c.status, variant: "outline" as const };
            const pct = c.total > 0 ? Math.round(((c.enviados + c.falhas + c.optouts) / c.total) * 100) : 0;
            return (
              <div key={c.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.titulo}</p>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>✅ {c.enviados} enviados</span>
                  <span>⏳ {c.pendentes} na fila</span>
                  {c.falhas > 0 && <span>⚠️ {c.falhas} sem WhatsApp/erro</span>}
                  {c.optouts > 0 && <span>🚫 {c.optouts} pediram pra sair</span>}
                  <span className="ml-auto flex gap-1">
                    {c.status === "enviando" && (
                      <Button size="sm" variant="outline" onClick={() => mutPausar.mutate(c.id)} disabled={mutPausar.isPending}>
                        <Pause className="mr-1 h-3 w-3" /> Pausar
                      </Button>
                    )}
                    {c.status === "pausada" && (
                      <Button size="sm" variant="outline" onClick={() => mutRetomar.mutate(c.id)} disabled={mutRetomar.isPending}>
                        <Play className="mr-1 h-3 w-3" /> Retomar
                      </Button>
                    )}
                    {(c.status === "enviando" || c.status === "pausada") && (
                      <Button size="sm" variant="ghost" onClick={() => mutCancelar.mutate(c.id)} disabled={mutCancelar.isPending}>
                        <X className="mr-1 h-3 w-3" /> Cancelar
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
