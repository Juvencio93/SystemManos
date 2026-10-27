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
  Download,
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
import { getBannerIntro } from "@/lib/banner-agent.functions";
import {
  getBannerDescribeStatus,
  generateBannerImage,
} from "@/lib/banner-describe.functions";
import { getLatestOperationalAnalysis } from "@/lib/operational.functions";
import { AiStructuredResponse } from "@/components/app/ai/AiStructuredResponse";
import { normalizeAiResponse } from "@/lib/ai-response-parser";
import { cn } from "@/lib/utils";
import robotMascot from "@/assets/manos-tech-robot.png";
import { useAccess } from "@/hooks/use-access";


export function BannerEventObserver({ onOpen }: { onOpen: (p: string) => void }) {
  useEffect(() => {
    const handler = (e: any) => onOpen(e.detail.prompt);
    window.addEventListener('open-banner-agent', handler);
    return () => window.removeEventListener('open-banner-agent', handler);
  }, [onOpen]);
  return null;
}

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
    // gerador de banners. A mensagem vira a descrição inicial do diálogo
    // do modo descrever (sem chat, sem perguntas guiadas).
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

export const BannerAgentDialog = forwardRef<{ openWithPrompt: (prompt: string) => void }, any>((_props, ref) => {
  const fetchStatus = useServerFn(getBannerDescribeStatus);
  const generate = useServerFn(generateBannerImage);
  const fetchIntro = useServerFn(getBannerIntro);
  const introQuery = useQuery({
    queryKey: ["banner-intro"],
    queryFn: () => fetchIntro(),
    enabled: false,
  });
  const [isOpen, setIsOpen] = useState(false);
  const introCompany = introQuery.data?.companyName ?? null;
  const introSegment = introQuery.data?.segment ?? null;

  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<{ name: string; dataUrl: string }[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    available: boolean;
    hasLogo: boolean;
    used: number;
    remaining: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [image, setImage] = useState<{
    dataUrl: string;
    mimeType: string;
    summary: string;
    fileName: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  const generationStartRef = useRef<number | null>(null);
  const generationTokenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => {
      if (generationStartRef.current) {
        setElapsed(Math.floor((Date.now() - generationStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  const loadStatus = async () => {
    try {
      const next = await fetchStatus();
      if (next.available) {
        setStatus({
          available: true,
          hasLogo: next.hasLogo,
          used: next.used,
          remaining: next.remaining,
        });
      } else {
        setStatus({ available: false, hasLogo: false, used: 0, remaining: 0 });
      }
    } catch {
      setStatus({ available: false, hasLogo: false, used: 0, remaining: 0 });
    }
  };

  const reset = () => {
    generationTokenRef.current += 1;
    setDescription("");
    setFiles([]);
    setFileError(null);
    setIsGenerating(false);
    setElapsed(0);
    setError(null);
    setNotice(null);
    setQuotaExhausted(false);
    setImage(null);
    setDimensions(null);
  };

  useImperativeHandle(ref, () => ({
    openWithPrompt: (prompt: string) => {
      reset();
      setIsOpen(true);
      setDescription(prompt);
      introQuery.refetch();
      loadStatus();
    },
  }));

  const cancelGenerate = () => {
    generationTokenRef.current += 1;
    setIsGenerating(false);
    setNotice(
      "Geração cancelada no seu aparelho. Se o servidor concluir, a imagem conta na cota do dia.",
    );
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    setFileError(null);
    const picked = Array.from(list).filter((file) => file.type.startsWith("image/"));
    const room = 4 - files.length;
    if (picked.length > room) {
      setFileError(`Só cabem ${room} foto(s) a mais — o limite é 4 por geração.`);
    }
    const accepted = picked.slice(0, Math.max(0, room));
    const resized: { name: string; dataUrl: string }[] = [];
    for (const file of accepted) {
      try {
        resized.push({ name: file.name, dataUrl: await resizeImageFile(file) });
      } catch {
        setFileError(`Não consegui ler "${file.name}". Tenta outra foto.`);
      }
    }
    if (resized.length > 0) setFiles((prev) => [...prev, ...resized]);
  };

  const handleGenerate = async () => {
    const text = description.trim();
    if (!text || isGenerating) return;
    if (status && status.remaining <= 0) {
      setQuotaExhausted(true);
      return;
    }
    generationTokenRef.current += 1;
    const token = generationTokenRef.current;
    generationStartRef.current = Date.now();
    setElapsed(0);
    setIsGenerating(true);
    setError(null);
    setNotice(null);
    setQuotaExhausted(false);
    setImage(null);
    setDimensions(null);
    try {
      const response = await generate({
        data: {
          description: text,
          attachments: files.map((file) => ({ dataUrl: file.dataUrl, fileName: file.name })),
        },
      });
      if (token !== generationTokenRef.current) return;
      if (!response.success) {
        if ("code" in response && response.code === "QUOTA_EXHAUSTED") {
          setQuotaExhausted(true);
          setStatus((prev) => (prev ? { ...prev, remaining: 0 } : prev));
        } else {
          setError(response.error);
        }
        return;
      }
      const ext = response.mimeType === "image/jpeg" ? "jpg" : "png";
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
      setImage({
        dataUrl: response.imageDataUrl,
        mimeType: response.mimeType,
        summary: response.summary,
        fileName: `banner-${stamp}.${ext}`,
      });
      setStatus((prev) =>
        prev
          ? { ...prev, used: response.quota.used, remaining: response.quota.remaining }
          : prev,
      );
    } catch {
      if (token !== generationTokenRef.current) return;
      // Erro de rede ou do servidor: nunca mostre detalhe técnico.
      setError("Sistema indisponível no momento.");
    } finally {
      if (token === generationTokenRef.current) setIsGenerating(false);
    }
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
            Gerador de banners
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Descreva como você quer seu banner. A gente corrige a ortografia, organiza o pedido,
            anexa a logo da sua empresa automaticamente e gera a imagem.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]">
          {introCompany && (
            <p className="text-xs font-medium text-cyan-300/90">
              Criando para: {introCompany}
              {introSegment ? ` · ${introSegment}` : ""}
            </p>
          )}

          {status && !status.available && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
              Disponível apenas para os perfis Matriz e Filial.
            </div>
          )}

          {status && status.available && (
            <p className="text-[11px] text-muted-foreground">
              {quotaExhausted
                ? "Você já usou as 2 gerações de hoje. Volta amanhã."
                : `Você ainda pode gerar ${status.remaining} de 2 imagens hoje.`}
            </p>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="banner-describe-input">
              Descreva como você quer seu banner?
            </label>
            <textarea
              id="banner-describe-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Festival de cucas, toda quinta-feira, R$ 14,99 a unidade"
              disabled={isGenerating}
              rows={4}
              className="w-full rounded-md border border-cyan-500/20 bg-background/40 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              Sem preço no pedido, o banner sai sem preço. A logo da empresa vai anexada
              automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Fotos reais (opcional, até 4)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={isGenerating || files.length >= 4}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-cyan-500/30 file:bg-cyan-500/10 file:px-3 file:py-2 file:text-xs file:text-cyan-300 hover:file:bg-cyan-500/20 disabled:opacity-50"
            />
            {fileError && <p className="text-xs text-red-400">{fileError}</p>}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="relative">
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="size-16 rounded-md border border-white/10 object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remover ${file.name}`}
                      disabled={isGenerating}
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-black/80 text-white hover:bg-black"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {status && status.available && status.hasLogo && (
            <p className="flex items-center gap-2 text-xs text-cyan-300/90">
              <ImageIcon className="size-4" />
              Logo da empresa anexada automaticamente
            </p>
          )}
          {status && status.available && !status.hasLogo && (
            <p className="text-xs text-muted-foreground">
              Nenhuma logo cadastrada para esta empresa — o banner sai sem logo.
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={
              !description.trim() ||
              isGenerating ||
              quotaExhausted ||
              (status !== null && !status.available)
            }
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="size-4 mr-2 animate-spin" />
                Gerando imagem... {elapsed}s
              </>
            ) : (
              "Gerar imagem"
            )}
          </Button>
          {isGenerating && (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-red-300 hover:text-red-200"
                onClick={cancelGenerate}
              >
                Cancelar
              </Button>
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {image && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <p className="text-sm font-medium text-white">Pré-visualização</p>
              <p className="text-xs text-muted-foreground">
                Entendemos assim: {image.summary}
              </p>
              <img
                src={image.dataUrl}
                alt="Banner gerado"
                onLoad={(e) =>
                  setDimensions({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                className="w-full rounded-xl border border-cyan-500/20 object-contain"
              />
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4 space-y-3">
                <p className="text-sm font-medium text-white">Ação</p>
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a href={image.dataUrl} download={image.fileName}>
                    <Download className="size-4 mr-2" />
                    {dimensions
                      ? `Salvar ${image.mimeType === "image/jpeg" ? "JPG" : "PNG"} • ${dimensions.w}×${dimensions.h}`
                      : "Salvar"}
                  </a>
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {dimensions
                    ? `Exportar como ${image.mimeType === "image/jpeg" ? "JPG" : "PNG"} • ${dimensions.w}×${dimensions.h}`
                    : "A imagem baixa direto no seu aparelho — ela não fica salva no servidor."}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/10"
                    onClick={() => {
                      setImage(null);
                      setDimensions(null);
                    }}
                  >
                    Gerar outra
                  </Button>
                  <Button variant="outline" className="flex-1 border-white/10" onClick={reset}>
                    Novo pedido
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

BannerAgentDialog.displayName = "BannerAgentDialog";

/**
 * Redimensiona a foto no navegador (máx. 1024 px, JPEG) antes de enviar:
 * a referência não precisa de resolução total e o corpo da requisição
 * fica longe do limite do serverless. Acima de ~1,2 MB de base64, tenta
 * de novo com qualidade menor; acima de 2 MB, rejeita.
 */
async function resizeImageFile(file: File): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      URL.revokeObjectURL(url);
      resolve(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    element.src = url;
  });
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > 1_200_000) dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  if (dataUrl.length > 2_000_000) throw new Error("image too large");
  return dataUrl;
}
