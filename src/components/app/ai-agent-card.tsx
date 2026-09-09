import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { formatDateBR, CompanySnapshot } from "@/lib/utils/date-utils";
import {
  DollarSign,
  RefreshCw,
  Send,
  Sparkles,
  MessageSquare,
  Activity,
  CalendarDays,
  Info,
  ChevronRight,
  Calculator,
  Copy,
  Check,
  AlertCircle,
  Image as ImageIcon,
  X,
  ArrowRight,
  PanelLeft,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { forwardRef, useImperativeHandle, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  createOperationalAiConversation,
  getOperationalAiConversation,
  listOperationalAiConversations,
  setOperationalAiConversationPreference,
  getAiUsageSummary,
  type AskAgentResponse,
} from "@/lib/insights.functions";
import { askBannerAgent, type BannerAgentResponse } from "@/lib/banner-agent.functions";
import { getLatestOperationalAnalysis } from "@/lib/operational.functions";
import { AiStructuredResponse } from "@/components/app/ai/AiStructuredResponse";
import { normalizeAiResponse } from "@/lib/ai-response-parser";
import { cn } from "@/lib/utils";
import { isBannerCreationRequest } from "@/lib/banner-intent";
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

export function AiAgentCard({ role }: { role: string }) {
  const bannerAgentRef = useRef<{ openWithPrompt: (prompt: string) => void } | null>(null);
  const admChatRef = useRef<{ openWithPrompt: (prompt: string) => void } | null>(null);

  if (role === "adm") {
    return (
      <div className="space-y-6">
        <AdminAiAgentCard />
        <AdminFloatingAssistant ref={admChatRef} />
      </div>
    );
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

// Cresce a textarea junto com o texto digitado (até um teto), em vez de rolar
// horizontalmente como um input de uma linha só.
const CHAT_TEXTAREA_MAX_HEIGHT = 120;
function autoGrowTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, CHAT_TEXTAREA_MAX_HEIGHT)}px`;
}

const AdminFloatingAssistant = forwardRef<{ openWithPrompt: (prompt: string) => void }, any>((_props, ref) => {
  const ask = useServerFn(askAgent);
  const getConversation = useServerFn(getOperationalAiConversation);
  const createConversation = useServerFn(createOperationalAiConversation);
  const listConversations = useServerFn(listOperationalAiConversations);
  const setConversationPreference = useServerFn(setOperationalAiConversationPreference);
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<{ id?: string; role: "user" | "assistant"; content: any; createdAt?: string }[]>([]);
  const [input, setInput] = useState("");
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string | null } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery({
    queryKey: ["operational-ai-conversation", selectedConversationId],
    queryFn: () => getConversation({ data: selectedConversationId ? { conversationId: selectedConversationId } : {} }),
    enabled: isOpen,
    // A conversa é atualizada por mutações/realtime; um pequeno período de
    // frescor evita refetch duplicado durante a abertura e troca de foco.
    staleTime: 5_000,
  });

  const historyQuery = useQuery({
    queryKey: ["operational-ai-conversations"],
    queryFn: () => listConversations(),
    enabled: isOpen && isHistoryOpen,
    staleTime: 10_000,
  });

  const preferenceMutation = useMutation({
    mutationFn: (input: { conversationId: string; action: "pin" | "unpin" | "delete" }) =>
      setConversationPreference({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["operational-ai-conversations"] });
      if (variables.action === "delete" && selectedConversationId === variables.conversationId) {
        setSelectedConversationId(undefined);
        setMessages([]);
      }
    },
    onError: (mutationError) => setError({
      message: mutationError instanceof Error ? mutationError.message : "Não foi possível atualizar a conversa.",
    }),
  });

  useEffect(() => {
    if (!conversationQuery.data) return;
    setMessages(
      conversationQuery.data.messages.map((message: any) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    );
  }, [conversationQuery.data]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ai-assistant-open-change", {
      detail: { isOpen },
    }));
  }, [isOpen]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent("ai-assistant-open-change", {
      detail: { isOpen: false },
    }));
  }, []);

  const handleSend = async (customMessage?: string) => {
    const userMessage = (customMessage || input).trim();
    if (!userMessage || isProcessing) return;

    const newMessages = [...messages, { role: "user" as const, content: userMessage, createdAt: new Date().toISOString() }];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);
    setError(null);

    try {
      const response = await ask({ 
        data: { 
          question: userMessage,
          conversationId: selectedConversationId || conversationQuery.data?.conversation?.id,
        } 
      });

      if (!response.ok) {
        setError({
          message: response.error || "Erro ao processar consulta.",
          code: response.requestId ? `IA-${response.requestId.slice(0, 8)}` : null,
        });
      } else {
        const aiText = response.text || "";
        setMessages([...newMessages, { role: "assistant" as const, content: aiText, createdAt: new Date().toISOString() }]);
        await queryClient.invalidateQueries({ queryKey: ["operational-ai-conversation"] });
        await queryClient.invalidateQueries({ queryKey: ["operational-ai-conversations"] });

        // Detectar se a IA sugeriu abrir o banner e o usuário aceitou (ou a IA já decidiu abrir)
        const lowerText = aiText.toLowerCase();
        const shouldOpenBanner = 
          (lowerText.includes("abrir") || lowerText.includes("abrindo") || lowerText.includes("assistente")) && 
          (lowerText.includes("banner") || lowerText.includes("prompt"));

        if (shouldOpenBanner) {
          // No caso de ADM, a funcionalidade de banner pode ser diferente, mas para Matriz/Filial usamos o onBannerPrompt
          // Se a IA gerou um prompt específico no texto, tentamos extrair
          const promptMatch = aiText.match(/prompt[:\s]+(.*?)(?:\n|$)/i);
          const prompt = promptMatch ? promptMatch[1] : userMessage;
          
          // Pequeno delay para leitura da resposta antes de abrir o modal
          setTimeout(() => {
            // Este handle vem do componente pai AiAgentCard
            const event = new CustomEvent('open-banner-agent', { detail: { prompt } });
            window.dispatchEvent(event);
          }, 1500);
        }
      }
    } catch (err) {
      setError({ message: "Não foi possível obter a resposta agora. Tente novamente.", code: "ERR-NET" });
    } finally {
      setIsProcessing(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openWithPrompt: (prompt: string) => {
      setIsOpen(true);
      if (prompt) handleSend(prompt);
    },
  }));

  const handleNewConversation = async () => {
    if (isProcessing) return;
    try {
      const result = await createConversation();
      setSelectedConversationId(result.conversation.id);
      queryClient.setQueryData(["operational-ai-conversation", result.conversation.id], result);
      await queryClient.invalidateQueries({ queryKey: ["operational-ai-conversations"] });
      setMessages([]);
      setError(null);
      setIsHistoryOpen(false);
    } catch {
      setError({ message: "Não foi possível iniciar uma nova conversa.", code: "ERR-HIST" });
    }
  };

  const dayLabel = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const today = new Date();
    const start = (input: Date) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
    const days = Math.round((start(today) - start(date)) / 86400000);
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  };

  const timeLabel = (value?: string) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
      : "";

  return (
    <>
      {/* Persistent trigger: mascot when closed, X when open */}
      <div
        className="fixed right-[88px] z-[80]"
        style={{
          bottom: isOpen
            ? "calc(-4px + env(safe-area-inset-bottom))"
            : "calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(current => !current)}
          aria-label={isOpen ? "Fechar Gerente Operacional IA" : "Abrir Gerente Operacional IA"}
          title={isOpen ? "Fechar Gerente Operacional IA" : "Abrir Gerente Operacional IA"}
          className="group relative flex size-14 items-center justify-center rounded-full bg-[#0F172A] border border-primary/30 shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all duration-300 hover:scale-110 active:scale-95"
        >
          {!isOpen && (
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-20" />
          )}
          <div className="relative size-8">
            <img
              src={robotMascot}
              alt="IA Manos Tech"
              className={cn(
                "absolute inset-0 size-8 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-300",
                isOpen ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
              )}
            />
            <X
              className={cn(
                "absolute inset-1 size-6 text-primary transition-all duration-300",
                isOpen ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
              )}
            />
          </div>
        </button>
      </div>

      {/* Floating Chat Widget */}
      {isOpen && (
        <div 
          className={cn(
            "fixed right-5 z-[70] flex flex-col w-[90vw] sm:w-[380px] h-[580px] max-h-[calc(100dvh-112px)]",
            "bg-popover border border-primary/20 rounded-3xl overflow-hidden",
            "animate-in slide-in-from-bottom-5 fade-in duration-500 cubic-bezier(0.16, 1, 0.3, 1)"
          )}
          style={{ bottom: "calc(20px + 56px + 20px + env(safe-area-inset-bottom))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-black/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center">
                <img src={robotMascot} className="size-6 object-contain" alt="Robo" />
              </div>
              <div>
                <h3 className="text-white text-sm font-display font-black leading-none tracking-tight">
                  Gerente Operacional IA
                </h3>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">
                  Online
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsHistoryOpen((current) => !current)}
              aria-label="Abrir histórico de conversas"
              title="Histórico de conversas"
              className="size-8 text-muted-foreground hover:text-white hover:bg-white/5"
            >
              <PanelLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewConversation}
              disabled={isProcessing}
              className="mr-1 h-8 gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-white"
            >
              <MessageSquare className="size-3.5" />
              Nova conversa
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)}
              className="size-8 text-muted-foreground hover:text-white hover:bg-white/5"
            >
              <X className="size-5" />
            </Button>
            </div>
          </div>

          {isHistoryOpen && (
            <div className="absolute bottom-0 left-0 top-[81px] z-10 flex w-[82%] flex-col border-r border-white/10 bg-[#0F172A] shadow-2xl animate-in slide-in-from-left-3 fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Conversas anteriores</p>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setIsHistoryOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {historyQuery.isLoading && <p className="p-3 text-xs text-muted-foreground">Carregando histórico...</p>}
                {!historyQuery.isLoading && (historyQuery.data || []).length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">Nenhuma conversa anterior.</p>
                )}
                {[...(historyQuery.data || [])]
                  .sort((a: any, b: any) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))
                  .map((conversation: any) => (
                  <div
                    key={conversation.id}
                    className={cn("flex items-center gap-1 rounded-xl px-2 py-2 transition-colors hover:bg-white/10", conversation.id === conversationQuery.data?.conversation?.id && "bg-primary/10")}
                  >
                    <button type="button" className="min-w-0 flex-1 px-1 py-1 text-left" onClick={() => { setSelectedConversationId(conversation.id); setIsHistoryOpen(false); setError(null); }}>
                      <p className="truncate text-sm font-semibold text-white">{conversation.title}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{dayLabel(conversation.updated_at)} às {timeLabel(conversation.updated_at)}</p>
                    </button>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-primary" title={conversation.is_pinned ? "Desafixar conversa" : "Fixar conversa"} aria-label={conversation.is_pinned ? "Desafixar conversa" : "Fixar conversa"} disabled={preferenceMutation.isPending} onClick={() => preferenceMutation.mutate({ conversationId: conversation.id, action: conversation.is_pinned ? "unpin" : "pin" })}>
                      {conversation.is_pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" title="Excluir conversa" aria-label="Excluir conversa" disabled={preferenceMutation.isPending} onClick={() => preferenceMutation.mutate({ conversationId: conversation.id, action: "delete" })}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages area */}
          <div 
            ref={scrollRef} 
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-transparent to-black/20"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <img src={robotMascot} className="size-9 object-contain" alt="Robo" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Como posso te ajudar?</h3>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Estou pronto para analisar dados da plataforma, comparar filiais ou pesquisar o mercado via Tavily.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              const previous = messages[i - 1];
              const showDay = !previous || dayLabel(previous.createdAt) !== dayLabel(msg.createdAt);
              return (
                <div key={msg.id || `${msg.role}-${i}`}>
                  {showDay && msg.createdAt && (
                    <div className="my-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      <span className="h-px flex-1 bg-white/10" />
                      {dayLabel(msg.createdAt)}
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  )}
                  <div className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground font-bold rounded-tr-none"
                          : "bg-card border border-border text-foreground rounded-tl-none",
                      )}
                    >
                      {msg.role === "assistant" ? <AiStructuredResponse data={msg.content} /> : msg.content}
                    </div>
                    {msg.createdAt && <span className="px-1 text-[10px] text-muted-foreground/60">{timeLabel(msg.createdAt)}</span>}
                  </div>
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-primary animate-pulse py-2 ml-2">
                <Sparkles className="size-3.5" />
                <span>Gerando resposta estratégica...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 mx-2">
                <p className="font-semibold">{error.message}</p>
                {error.code && <p className="mt-1 opacity-60 font-mono uppercase">Código: {error.code}</p>}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-white/5 bg-black/40">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputTextareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrowTextarea(e.target);
                }}
                placeholder="Pergunte algo estratégico..."
                disabled={isProcessing}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                    e.currentTarget.style.height = "auto";
                  }
                }}
                className="bg-white/5 border-primary/20 focus-visible:ring-primary min-h-12 max-h-[120px] resize-none text-sm rounded-xl px-5 py-3 leading-tight"
              />
              <Button 
                onClick={() => {
                  handleSend();
                  if (inputTextareaRef.current) inputTextareaRef.current.style.height = "auto";
                }}
                disabled={isProcessing || !input.trim()}
                className="h-12 w-12 shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground p-0 shadow-glow"
              >
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

AdminFloatingAssistant.displayName = "AdminFloatingAssistant";


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
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const isMatriz = role === "matriz";
  const isFilial = role === "filial";

  const companyQuery = useQuery({
    queryKey: ["company-overview"],
    queryFn: () => fetchCompany(),
    enabled: isMatriz,
  });
  const aiUsageQuery = useQuery({
    queryKey: ["company-ai-usage", role],
    queryFn: () => fetchAiUsage(),
    enabled: isMatriz || isFilial,
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

    if (onBannerPrompt && isBannerCreationRequest(value)) {
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
                        if (branchesCount === 0) return "Resultados da Matriz.";
                        if (branchesCount === 1)
                          return "Resultados consolidados entre Matriz e Filial.";
                        return `Resultados consolidados entre Matriz e ${branchesCount} Filiais.`;
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
                  Seu assistente de marketing e CRM
                </span>
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">Consultoria de Marketing</h4>
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
                    <span className="font-semibold text-white">Comandos de IA hoje</span>
                    <span className="text-muted-foreground">{aiUsageQuery.data.used} usados · {aiUsageQuery.data.available} disponíveis · limite {aiUsageQuery.data.limit}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (aiUsageQuery.data.used / Math.max(1, aiUsageQuery.data.limit)) * 100)}%` }} /></div>
                  <p className="mt-2 text-[10px] text-muted-foreground">O histórico é removido automaticamente após {aiUsageQuery.data.retentionDays} dias sem novas mensagens relevantes.</p>
                </div>
              )}

              <div className="flex items-end gap-2">
                <Textarea
                  ref={questionTextareaRef}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    autoGrowTextarea(e.target);
                  }}
                  placeholder={
                    isFilial
                      ? "Pergunte sobre marketing ou peça um prompt para banner..."
                      : "Ex: Como atrair mais clientes hoje?"
                  }
                  rows={1}
                  className="bg-background/40 border-primary/20 focus-visible:ring-primary/40 min-h-11 max-h-[120px] resize-none text-base py-2.5 leading-tight"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(question);
                      e.currentTarget.style.height = "auto";
                    }
                  }}
                />
                <Button
                  size="icon"
                  disabled={chat.isPending || !question.trim()}
                  onClick={() => {
                    send(question);
                    if (questionTextareaRef.current) questionTextareaRef.current.style.height = "auto";
                  }}
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
                  Seu assistente de marketing e CRM
                </span>
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">Consultoria de Marketing</h4>
                <Badge
                  variant="outline"
                  className="text-xs text-primary border-primary/30 py-0.5 px-2 h-5 font-bold"
                >
                  Beta
                </Badge>
              </div>

              <div className="flex items-end gap-2">
                <Textarea
                  ref={questionTextareaRef}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    autoGrowTextarea(e.target);
                  }}
                  placeholder="Pergunte sobre marketing ou peça um prompt para banner..."
                  rows={1}
                  className="bg-background/40 border-primary/20 focus-visible:ring-primary/40 min-h-11 max-h-[120px] resize-none text-base py-2.5 leading-tight"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(question);
                      e.currentTarget.style.height = "auto";
                    }
                  }}
                />
                <Button
                  size="icon"
                  disabled={chat.isPending || !question.trim()}
                  onClick={() => {
                    send(question);
                    if (questionTextareaRef.current) questionTextareaRef.current.style.height = "auto";
                  }}
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

const BannerAgentDialog = forwardRef<{ openWithPrompt: (prompt: string) => void }, any>((_props, ref) => {
  const ask = useServerFn(askBannerAgent);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinalTurn, setIsFinalTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BannerAgentResponse["data"]>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, result]);

  const handleSend = async (customMessage?: string) => {
    const userMessage = (customMessage || input).trim();
    if (!userMessage || isProcessing) return;

    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);
    setError(null);

    try {
      // O frontend deve enviar todo o histórico da conversa
      const response = await ask({
        data: {
          messages: newMessages,
          isFinalTurn: isFinalTurn || (newMessages.length >= 3), // Turno 2+ é considerado final se a IA já perguntou
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
        setMessages([
          ...newMessages,
          { role: "assistant" as const, content: response.data.question! },
        ]);
        setIsFinalTurn(true);
      } else if (response.data.promptOptions) {
        setResult(response.data);
      } else {
        setError("Não foi possível gerar os prompts. Tente ser mais específico na descrição.");
      }
    } catch (err) {
      setError("Não foi possível processar sua solicitação.");
    } finally {
      setIsProcessing(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openWithPrompt: (prompt: string) => {
      reset();
      setIsOpen(true);
      // Wait for state reset to settle before sending
      setTimeout(() => {
        handleSend(prompt);
      }, 0);
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
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputTextareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrowTextarea(e.target);
                }}
                placeholder={isFinalTurn ? "Responda à IA..." : "O que será o banner?"}
                disabled={isProcessing}
                rows={1}
                className="bg-background/40 border-cyan-500/20 focus-visible:ring-cyan-500/40 min-h-10 max-h-[120px] resize-none py-2.5 leading-tight"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                    e.currentTarget.style.height = "auto";
                  }
                }}
              />
              <Button
                disabled={!input.trim() || isProcessing}
                onClick={() => {
                  handleSend();
                  if (inputTextareaRef.current) inputTextareaRef.current.style.height = "auto";
                }}
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
