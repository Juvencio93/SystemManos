import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { formatDateBR, CompanySnapshot } from "@/lib/utils/date-utils";
import {
  DollarSign,
  RefreshCw,
  Send,
  Sparkles,
  Activity,
  CalendarDays,
  Info,
  Calculator,
  Copy,
  Check,
  AlertCircle,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { forwardRef, useImperativeHandle, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  askAgent,
  getAiBriefing,
  getCompanyBriefing,
  getCompanyOverview,
  getAiUsageSummary,
  type AskAgentResponse,
} from "@/lib/insights.functions";
import { askBannerAgent, type BannerAgentResponse } from "@/lib/banner-agent.functions";
import { getLatestOperationalAnalysis } from "@/lib/operational.functions";
import { AiStructuredResponse } from "@/components/app/ai/AiStructuredResponse";
import { normalizeAiResponse } from "@/lib/ai-response-parser";
import { cn } from "@/lib/utils";
import robotMascot from "@/assets/manos-tech-robot.png";
import { useAccess } from "@/hooks/use-access";


function BannerEventObserver({ onOpen }: { onOpen: (p: string) => void }) {
  useEffect(() => {
    const handler = (e: any) => onOpen(e.detail.prompt);
    window.addEventListener('open-banner-agent', handler);
    return () => window.removeEventListener('open-banner-agent', handler);
  }, [onOpen]);
  return null;
}

const SUGESTOES_BANNER = [
  "Promoção de chopp em dobro na sexta",
  "Feijoada de sábado com música ao vivo",
  "Aviso de feriado: horário especial",
  "Novidade no cardápio",
  "Aniversário da casa: semana de descontos",
];

export function AiAgentCard({ role }: { role: string }) {
  const bannerAgentRef = useRef<{ openWithPrompt: (prompt: string) => void } | null>(null);

  if (role === "adm") {
    // Bate-papo do Gerente Operacional IA desabilitado (decisão 2026-10-18):
    // ações operacionais agora são 100% via Hermes no Telegram.
    return <AdminAiAgentCard />;
  }
  if (role === "revenda") {
    return <AdminAiAgentCard />;
  }
  if (role === "matriz" || role === "filial" || role === "revenda") {
    return (
      <>
        <ClientAiAgentCard role={role} onBannerPrompt={(p) => bannerAgentRef.current?.openWithPrompt(p)} />
        <BannerAgentDialog ref={bannerAgentRef} />
        <BannerEventObserver onOpen={(p) => bannerAgentRef.current?.openWithPrompt(p)} />
      </>
    );
  }
  return null;
}

function AdminAiAgentCard() {
  const fetchOpAnalysis = useServerFn(getLatestOperationalAnalysis);
  const opAnalysis = useQuery({
    queryKey: ["operational-analysis-full"],
    queryFn: () => fetchOpAnalysis(),
    refetchOnWindowFocus: true,
  });
  const analysis = opAnalysis.data;
  return (
    <Card className="glass-panel border-primary/30 overflow-hidden rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-3 text-lg font-display font-black tracking-tight">

          <span className="relative flex size-12 shrink-0 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/25 blur-xl animate-pulse"
            />
            <img
              src={robotMascot}
              alt="Gerente Operacional"
              width={816}
              height={816}
              className="relative size-12 object-contain drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
            />
          </span>
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />

              Gerente Operacional IA
            </span>
            <span className="text-sm font-normal text-muted-foreground/80">
              Acompanhamento diário do desempenho das empresas.
            </span>
          </span>
        </CardTitle>
      </CardHeader>

      {/* Botão mobile: aparece acima dos indicadores, escondido no sm+ */}
      <div className="px-4 pb-4 sm:hidden">
        <Button
          size="sm"
          variant="outline"
          asChild
          className="w-full h-11 text-xs font-black uppercase tracking-widest border-primary/30 hover:bg-primary/10 rounded-xl"
        >
          <Link to="/gerente-operacional">
            <Activity className="size-4 mr-2" />
            Ver análise completa
          </Link>
        </Button>
      </div>

      {/* Botão desktop: visível no sm+, escondido no mobile */}
      <div className="hidden sm:block absolute top-4 right-4">
        <Button
          size="sm"
          variant="outline"
          asChild
          className="h-11 px-5 text-xs font-black uppercase tracking-widest border-primary/30 hover:bg-primary/10 rounded-xl"
        >
          <Link to="/gerente-operacional">
            <Activity className="size-4 mr-2" />
            Ver análise completa
          </Link>
        </Button>
      </div>

      <CardContent className="space-y-6">
        {analysis ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/60 bg-green-500/10 p-3">
                <p className="text-xs uppercase tracking-widest text-green-500/80 mb-1 font-semibold">Destaque</p>
                <p className="font-display text-2xl font-black text-green-500 tracking-tighter">
                  {analysis.indicators?.["destaque"] || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-yellow-500/10 p-3">
                <p className="text-xs uppercase tracking-widest text-yellow-500/80 mb-1 font-semibold">Atenção</p>
                <p className="font-display text-2xl font-black text-yellow-500 tracking-tighter">
                  {analysis.indicators?.["atencao"] || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-red-500/10 p-3">
                <p className="text-xs uppercase tracking-widest text-red-500/80 mb-1 font-semibold">Crítico</p>
                <p className="font-display text-2xl font-black text-red-500 tracking-tighter">
                  {analysis.indicators?.["critico"] || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-blue-500/10 p-3">
                <p className="text-xs uppercase tracking-widest text-blue-500/80 mb-1 font-semibold">Observação</p>
                <p className="font-display text-2xl font-black text-blue-500 tracking-tighter">
                  {analysis.indicators?.["observacao"] || 0}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground/80">
              <p>
                Última análise válida:{" "}
                {analysis.updatedAt || analysis.createdAt
                  ? formatDateBR(String(analysis.updatedAt || analysis.createdAt), {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "---"}
              </p>

              <div className="flex items-center gap-2 text-primary">
                {analysis.status === "processando" ? (
                  <>
                    <RefreshCw className="size-3 animate-spin" />
                    <span>Atualizando análise operacional…</span>
                  </>
                ) : (
                  <>
                    <CalendarDays className="size-3" />
                    <span>Atualização automática diária às 06:00</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              A primeira análise operacional está sendo preparada.
            </p>
            <p className="text-[10px] text-muted-foreground/60 italic">
              Execução agendada diariamente às 06:00
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
const ENCARGOS_ESTIMATED_DESC = "Estimativa adicional para encargos, benefícios e estrutura: 70%";

function ClientAiAgentCard({
  role,
  onBannerPrompt,
}: {
  role: string;
  onBannerPrompt?: (prompt: string) => void;
}) {
  const fetchCompany = useServerFn(getCompanyOverview);
  const fetchBriefing = useServerFn(getAiBriefing);
  const ask = useServerFn(askAgent);
  const fetchAiUsage = useServerFn(getAiUsageSummary);
  const [question, setQuestion] = useState("");
  const queryClient = useQueryClient();

  const isMatriz = role === "matriz";
  const isFilial = role === "filial";
  const { data: access } = useAccess();

  const companyQuery = useQuery({
    // Metrics belong to the authenticated operational scope. A shared key
    // could briefly show the previous account's cached overview after login
    // or a role/company switch.
    queryKey: ["company-overview", access?.userId, access?.companyId, access?.branchId],
    queryFn: () => fetchCompany(),
    enabled: isMatriz && Boolean(access?.userId),
  });
  const aiUsageQuery = useQuery({
    queryKey: ["company-ai-usage", role, access?.userId, access?.companyId, access?.branchId],
    queryFn: () => fetchAiUsage(),
    enabled: (isMatriz || isFilial) && Boolean(access?.userId),
  });

  const briefingMutation = useMutation({
    mutationFn: () => fetchBriefing(),
  });

  const [chatResponse, setChatResponse] = useState<AskAgentResponse | null>(null);
  const [chatError, setChatError] = useState<{ message: string; code?: string | null } | null>(
    null,
  );

  const isQuotaError = (error: string) => {
    const msg = error.toLowerCase();
    return msg.includes("cota") || msg.includes("limite") || msg.includes("excedido");
  };

  const chat = useMutation({
    mutationFn: async (q: string): Promise<AskAgentResponse> => {
      return await ask({ data: { question: q } });
    },
    onMutate: () => {
      setChatError(null);
    },
    onSuccess: (data) => {
      if (!data?.ok) {
        const errorMsg = data.error || "Erro ao processar consulta.";
        const displayMessage = (isFilial && isQuotaError(errorMsg))
          ? "Seu limite diário de comandos IA foi atingido. Entre em contato com o Suporte."
          : errorMsg;

        setChatError({
          message: displayMessage,
          code: (isFilial && isQuotaError(errorMsg)) ? null : (data.requestId ? `IA-${data.requestId.slice(0, 8)}` : null),
        });
      } else if (!data?.text) {
        setChatError({ message: "A IA retornou uma resposta vazia.", code: "IA-EMPTY" });
      } else {
        setChatResponse(data);
        setQuestion("");
      }
      queryClient.invalidateQueries({ queryKey: ["company-overview"] });
      queryClient.invalidateQueries({ queryKey: ["company-ai-usage"] });
    },
    onError: (err: unknown) => {
      const error = err as Error;
      console.error("[AiAgentCard] Mutation error:", error.message);
      setChatError({
        message: "Não foi possível obter a resposta agora. Tente novamente.",
        code: "ERR-NET",
      });
    },
  });

  const send = (q: string) => {
    const value = q.trim();
    if (!value || chat.isPending) return;

    // No dashboard de Matriz e Filial, a Manos Tech IA é a entrada do
    // gerador de prompts. Toda mensagem segue para o mesmo diálogo, que
    // interpreta o texto livre e pergunta apenas o que ainda for necessário.
    if (onBannerPrompt) {
      onBannerPrompt(value);
      setQuestion("");
      return;
    }

    chat.mutate(value);
  };

  const aiResult = useMemo(() => {
    if (chatResponse?.text) return normalizeAiResponse(chatResponse.text);
    return null;
  }, [chatResponse]);

  const companyData = companyQuery.data as CompanySnapshot | undefined;

  // 1. Dashboard Card para Matriz (Compacto, navegação direta)
  if (isMatriz) {
    return (
      <div className="space-y-6">
        <Card className="glass-panel border-primary/30 overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                  <DollarSign className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
                    Transformando conexões em{" "}
                    <span className="text-cyan-400">OPORTUNIDADES.</span>
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground/90">
                    Captação automática de contatos sem precisar ampliar sua equipe.
                  </p>
                </div>
              </div>

              {/* Métricas Reais do Mês */}
              <div className="flex flex-col items-center gap-1">
                {companyQuery.isError ? (
                  <p className="text-[10px] text-red-400 font-medium bg-red-400/10 py-2 px-4 rounded-full border border-red-400/20">
                    Não foi possível carregar os resultados do mês.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-sm text-muted-foreground/90 bg-white/5 py-3 px-6 rounded-2xl border border-white/10 shadow-inner">
                      <div
                        className="flex items-center gap-1.5"
                        title="Total de acessos (connections)"
                      >
                        <span className="font-bold text-foreground text-base">

                          {companyData?.realMetrics?.conexoesMes || 0}
                        </span>
                        <span className="font-normal">
                          {companyData?.realMetrics?.conexoesMes === 1 ? "acesso" : "acessos"}
                        </span>
                      </div>
                      <div className="text-white/20 hidden sm:block">·</div>
                      <div
                        className="flex items-center gap-1.5"
                        title="Visitantes únicos (distintos)"
                      >
                        <span className="font-bold text-foreground text-base">

                          {companyData?.realMetrics?.visitantesUnicosMes || 0}
                        </span>
                        <span className="font-normal">
                          {companyData?.realMetrics?.visitantesUnicosMes === 1
                            ? "visitante único"
                            : "visitantes únicos"}
                        </span>
                      </div>
                      <div className="text-white/20 hidden sm:block">·</div>
                      <div
                        className="flex items-center gap-1.5"
                        title="Captados pela primeira vez no mês"
                      >
                        <span className="font-bold text-foreground text-base">

                          {companyData?.realMetrics?.contatosNovosMes || 0}
                        </span>
                        <span className="font-normal">
                          {companyData?.realMetrics?.contatosNovosMes === 1
                            ? "novo contato"
                            : "novos contatos"}
                        </span>
                      </div>
                      <div className="text-white/20 hidden sm:block">·</div>
                      <div
                        className="flex items-center gap-1.5"
                        title="Visitantes que já haviam acessado antes do mês"
                      >
                        <span className="font-bold text-foreground text-base">
                          {companyData?.realMetrics?.contatosRecorrentesMes || 0}
                        </span>
                        <span className="font-normal">
                          {companyData?.realMetrics?.contatosRecorrentesMes === 1
                            ? "recorrente"
                            : "recorrentes"}
                        </span>
                      </div>
                    </div>

                    {/* Escopo dos Resultados */}
                    <p className="text-xs text-muted-foreground/80 font-medium">
                      {(() => {
                        const branchesCount = companyData?.activeBranchesCount || 0;
                        if (branchesCount === 0) return "Resultados da Matriz neste mês.";
                        if (branchesCount === 1)
                          return "Resultados deste mês, consolidados entre Matriz e Filial.";
                        return `Resultados deste mês, consolidados entre Matriz e ${branchesCount} Filiais.`;
                      })()}
                    </p>
                  </>
                )}
              </div>

              {/* Investimento e Comparativo */}
              <div className="flex flex-col items-center sm:items-end justify-center gap-1 text-center sm:text-right">
                {companyData?.savings?.custoSistemaMensal !== undefined &&
                  companyData.savings.custoSistemaMensal > 0 && (
                    <p className="text-xs text-muted-foreground/90 font-medium">
                      Seu investimento:{" "}
                      <span className="text-foreground font-medium">
                        {companyData.savings.custoSistemaMensal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                        /mês
                      </span>
                    </p>
                  )}

                <Dialog>
                  <DialogTrigger asChild>
                    <button className="text-xs text-primary font-bold hover:text-primary/80 flex items-center gap-2 group transition-colors py-1">
                      <Calculator className="size-3 group-hover:scale-110 transition-transform" />
                      Ver comparação
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-[#0F172A] border-primary/20">
                    <DialogHeader>
                      <DialogTitle className="font-display text-lg text-white">
                        Manos Tech x operação manual
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground text-xs">
                        Comparativo baseado no custo estimado para manter uma operação dedicada à
                        captação de leads.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Manos Tech
                          </p>
                          <p className="text-lg font-bold text-primary">
                            {(companyData?.savings?.custoSistemaMensal || 0).toLocaleString(
                              "pt-BR",
                              {
                                style: "currency",
                                currency: "BRL",
                              },
                            )}
                            <span className="text-xs font-normal text-muted-foreground">/mês</span>
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Operação Manual
                          </p>
                          <p className="text-lg font-bold text-white">
                            {(companyData?.savings?.custoTotalHumanosMensal || 0).toLocaleString(
                              "pt-BR",
                              {
                                style: "currency",
                                currency: "BRL",
                              },
                            )}
                            <span className="text-xs font-normal text-muted-foreground">/mês</span>
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-cyan-500/10 p-4 border border-cyan-500/20 text-center">
                        <p className="text-xs text-cyan-200/70 mb-1">
                          Economia operacional estimada
                        </p>
                        <p className="text-2xl font-bold text-cyan-400">
                          {(companyData?.savings?.economiaMensal || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>

                      <div className="space-y-2 text-[11px] text-muted-foreground bg-black/20 p-3 rounded-lg border border-white/5">
                        <p className="font-semibold text-white/80">Componentes do cálculo:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>
                            Referência utilizada: salário mínimo nacional de{" "}
                            {companyData?.savings?.manualConfig?.referenceYear || 2026} —{" "}
                            {companyData?.savings?.manualConfig?.salaryReference?.toLocaleString(
                              "pt-BR",
                              { style: "currency", currency: "BRL" },
                            )}
                            .
                          </li>
                          <li>{ENCARGOS_ESTIMATED_DESC}.</li>
                          <li>
                            Este percentual é uma referência estimada e pode variar conforme regime
                            tributário, convenção coletiva, benefícios, estrutura, região e modelo
                            de contratação.
                          </li>
                        </ul>
                      </div>

                      <p className="text-[10px] italic text-muted-foreground leading-relaxed">
                        Esta é uma estimativa comparativa. Os custos de uma operação manual podem
                        variar conforme estrutura, região e modelo de contratação.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-primary/30 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Activity className="size-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-white mb-1">
                  Gerente Operacional IA
                </h3>
                <p className="text-sm text-muted-foreground/90 mb-4">
                  Análise detalhada da sua Matriz e Filiais.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/gerente-operacional" className="text-sm font-bold py-2">Abrir análise operacional</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-primary/30 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3 text-lg">

              <span className="relative flex size-14 shrink-0 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/25 blur-xl animate-pulse"
                />
                <img
                  src={robotMascot}
                  alt="Assistente Manos Tech"
                  width={816}
                  height={816}
                  className="relative size-14 object-contain drop-shadow-[0_0_14px_hsl(var(--primary)/0.6)] motion-safe:animate-[float_4s_ease-in-out_infinite]"
                />
              </span>
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />

                  Manos Tech IA
                </span>
                <span className="text-sm font-normal text-muted-foreground/80">
                  Seu assistente para criação de banners
                </span>
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">Gerador de Prompts para Banners</h4>
                <Badge
                  variant="outline"
                  className="text-xs text-primary border-primary/30 py-0.5 px-2 h-5 font-bold"
                >
                  Beta
                </Badge>
              </div>

              {aiUsageQuery.data && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-white">Criações com IA hoje</span>
                    <span className="text-muted-foreground">{aiUsageQuery.data.used} usados · {aiUsageQuery.data.available} disponíveis · limite {aiUsageQuery.data.limit}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (aiUsageQuery.data.used / Math.max(1, aiUsageQuery.data.limit)) * 100)}%` }} /></div>
                  <p className="mt-2 text-[10px] text-muted-foreground">As conversas não são salvas — ao fechar esta janela, o histórico se perde.</p>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Conte o que você quer divulgar no banner..."
                  className="bg-background/40 border-primary/20 focus-visible:ring-primary/40 h-11 text-base"

                  onKeyDown={(e) => e.key === "Enter" && send(question)}
                />
                <Button
                  size="icon"
                  disabled={chat.isPending || !question.trim()}
                  onClick={() => send(question)}
                  className="shrink-0 size-11"

                >
                  <Send className={`size-4 ${chat.isPending ? "animate-pulse" : ""}`} />
                </Button>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">Sem ideia? Toque numa sugestão pra começar:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGESTOES_BANNER.map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => setQuestion(sugestao)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>

              {chat.isPending && (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/90 animate-pulse py-1">
                  <Sparkles className="size-4 text-primary" />
                  <span>Analisando dados...</span>
                </div>
              )}

              {chatError && !chat.isPending && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  <p>{chatError.message}</p>
                  {chatError.code && (
                    <p className="mt-1 text-[10px] opacity-50 uppercase font-mono">
                      Código: {chatError.code}
                    </p>
                  )}
                </div>
              )}

              {aiResult && !chat.isPending && !chatError && (
                <AiStructuredResponse data={aiResult} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Dashboard Card para Filial (Visão original simplificada, se necessário)
  if (isFilial) {
    return (
      <div className="space-y-6">
        {/* Content moved to conditional Dialog in AiAgentCard */}

        <Card className="glass-panel border-primary/30 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="relative flex size-14 shrink-0 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/25 blur-xl animate-pulse"
                />
                <img
                  src={robotMascot}
                  alt="Assistente Manos Tech"
                  width={816}
                  height={816}
                  className="relative size-14 object-contain drop-shadow-[0_0_14px_hsl(var(--primary)/0.6)] motion-safe:animate-[float_4s_ease-in-out_infinite]"
                />
              </span>
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />

                  Manos Tech IA
                </span>
                <span className="text-sm font-normal text-muted-foreground/80">
                  Seu assistente para criação de banners
                </span>
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">Gerador de Prompts para Banners</h4>
                <Badge
                  variant="outline"
                  className="text-xs text-primary border-primary/30 py-0.5 px-2 h-5 font-bold"
                >
                  Beta
                </Badge>
              </div>

              <div className="flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Conte o que você quer divulgar no banner..."
                  className="bg-background/40 border-primary/20 focus-visible:ring-primary/40 h-11 text-base"
                  onKeyDown={(e) => e.key === "Enter" && send(question)}
                />
                <Button
                  size="icon"
                  disabled={chat.isPending || !question.trim()}
                  onClick={() => send(question)}
                  className="shrink-0 size-11"
                >
                  <Send className={`size-4 ${chat.isPending ? "animate-pulse" : ""}`} />
                </Button>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">Sem ideia? Toque numa sugestão pra começar:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGESTOES_BANNER.map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => setQuestion(sugestao)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>

              {chat.isPending && (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/90 animate-pulse py-1">
                  <Sparkles className="size-4 text-primary" />
                  <span>Analisando dados...</span>
                </div>
              )}

              {chatError && !chat.isPending && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                  <p>{chatError.message}</p>
                  {chatError.code && (
                    <p className="mt-1 text-[10px] opacity-50 uppercase font-mono">
                      Código: {chatError.code}
                    </p>
                  )}
                </div>
              )}

              {aiResult && !chat.isPending && !chatError && (
                <AiStructuredResponse data={aiResult} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

const BannerAgentDialog = forwardRef<{ openWithPrompt: (prompt: string) => void }, any>((_props, ref) => {
  const ask = useServerFn(askBannerAgent);
  const queryClient = useQueryClient();
  const { data: access } = useAccess();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinalTurn, setIsFinalTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BannerAgentResponse["data"]>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [brief, setBrief] = useState<NonNullable<BannerAgentResponse["data"]>["brief"]>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const openSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, result]);

  const handleSend = async (customMessage?: string) => {
    const userMessage = (customMessage || input).trim();
    if (!userMessage || isProcessing) return;

    const greetingName = access?.displayName?.trim() || access?.fullName?.trim();
    const openingGreeting =
      messages.length === 0
        ? [
            {
              role: "assistant" as const,
              content: greetingName
                ? `Oi, tudo bom, ${greetingName}? Me conta o que você quer divulgar que eu preparo duas ideias bem caprichadas.`
                : "Oi, tudo bom? Me conta o que você quer divulgar que eu preparo duas ideias bem caprichadas.",
            },
          ]
        : [];
    const newMessages = [
      ...messages,
      ...openingGreeting,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);
    setError(null);

    try {
      // O frontend deve enviar todo o histórico da conversa
      const response = await ask({
        data: {
          messages: newMessages,
          // O briefing decide quando está completo; a quantidade de mensagens
          // nunca deve forçar a geração antes de interpretar a resposta atual.
          // A conversa só deve ser finalizada quando o agente confirmar que
          // não faltam dados; nunca pelo estado local de uma pergunta anterior.
          isFinalTurn: false,
          conversationId: conversationIdRef.current,
          brief,
        },
      });

      if (!response.success) {
        const errorMsg = response.error || "Erro ao processar sua solicitação.";
        const isQuotaMsg = errorMsg.toLowerCase().includes("cota") || 
                          errorMsg.toLowerCase().includes("limite") || 
                          errorMsg.toLowerCase().includes("excedido");

        setError(isQuotaMsg ? "Seu limite diário de comandos IA foi atingido. Entre em contato com o Suporte." : errorMsg);
        setIsProcessing(false);
        return;
      }

      if (response.data.needsMoreInfo) {
        setBrief(response.data.brief ?? brief);
        setMessages([
          ...newMessages,
          { role: "assistant" as const, content: response.data.question! },
        ]);
        setIsFinalTurn(true);
      } else if (response.data.promptOptions) {
        setBrief(response.data.brief ?? brief);
        setResult(response.data);
        queryClient.invalidateQueries({ queryKey: ["company-ai-usage"] });
      } else {
        setBrief(response.data.brief ?? brief);
        // A resposta pode chegar sem opções quando a IA precisa de um dado
        // comercial adicional. Não transforme isso em uma falha silenciosa:
        // mantenha a conversa aberta e peça o próximo dado de forma clara.
        setMessages([
          ...newMessages,
          {
            role: "assistant" as const,
            content:
              response.data.question ||
              "Quero entender melhor o que você tem em mente. Pode me contar um pouco mais?",
          },
        ]);
      }
    } catch (err) {
      setError("Não foi possível processar sua solicitação.");
    } finally {
      setIsProcessing(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openWithPrompt: (prompt: string) => {
      if (openSendTimerRef.current) clearTimeout(openSendTimerRef.current);
      reset();
      setIsOpen(true);
      // Wait for the originating click to finish before sending. Otherwise
      // Radix can interpret the same pointer event as an outside click and
      // close the newly opened dialog immediately.
      openSendTimerRef.current = setTimeout(() => {
        handleSend(prompt);
        openSendTimerRef.current = null;
      }, 180);
    },
  }));

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const reset = () => {
    setMessages([]);
    setResult(null);
    setIsFinalTurn(false);
    setError(null);
    setInput("");
    setBrief({});
    conversationIdRef.current = crypto.randomUUID();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) reset();
      }}
    >
      <DialogContent className="max-w-2xl bg-[#0F172A] border-cyan-500/20 max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b border-white/5">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="size-5 text-cyan-400" />
            Assistente de prompts para banner
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            A Manos Tech IA não gera a imagem. Ela ajuda você a preparar até 2 prompts profissionais
            para copiar e usar no ChatGPT, Gemini ou em outra IA de geração de imagens.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]">
          {messages.length === 0 && !result && (
            <div className="text-center py-12 space-y-6">
              <div className="inline-flex items-center justify-center p-4 rounded-full bg-cyan-500/10 text-cyan-400 mb-2">
                <ImageIcon className="size-8" />
              </div>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground px-12">
                  Diga o que você quer promover. Ex: "Quero um banner para a promoção de pizza de
                  calabresa por R$ 49,90."
                </p>
                <Button 
                  onClick={() => setInput("Quero criar um banner")}
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                >
                  Quero criar um banner
                </Button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex w-max max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                msg.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {msg.content}
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Sparkles className="size-3 text-cyan-400" />
              <span>Analisando cadastro e referências...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.promptOptions?.map((opt, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3"
                  >
                    <h5 className="font-semibold text-cyan-300 text-sm">{opt.title}</h5>
                    <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                      {opt.prompt}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full text-[10px] h-8 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/20"
                      onClick={() => copyToClipboard(opt.prompt, i)}
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="size-3 mr-2" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3 mr-2" />
                          Copiar prompt
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4 flex gap-3">
                <AlertCircle className="size-5 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-sm text-cyan-200/90 leading-relaxed font-medium">
                  {result.reminder || "Para maior fidelidade, envie à IA de imagens a logo original e fotos reais dos produtos, serviços ou ambiente citados no prompt."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20">
          {!result ? (
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isFinalTurn ? "Responda à IA..." : "O que será o banner?"}
                disabled={isProcessing}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="bg-background/40 border-cyan-500/20 focus-visible:ring-cyan-500/40"
              />
              <Button
                disabled={!input.trim() || isProcessing}
                onClick={() => handleSend()}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <Send className="size-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full border-white/10" onClick={reset}>
              Preparar outros prompts
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

BannerAgentDialog.displayName = "BannerAgentDialog";


