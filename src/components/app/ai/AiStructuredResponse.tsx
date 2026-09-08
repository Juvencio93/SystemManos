import {
  Activity,
  Layout,
  Lightbulb,
  Palette,
  CheckCircle2,
  Sparkles,
  Info,
  Image as ImageIcon,
  Rocket,
  Copy,
  Check,
  ChevronRight,
  Target,
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { normalizeAiResponse, type AiMarketingResponse } from "@/lib/ai-response-parser";
import { cn } from "@/lib/utils";

interface AiStructuredResponseProps {
  data: string | AiMarketingResponse;
  className?: string;
}

const MarkdownContent = ({ content }: { content: string }) => (
  <ReactMarkdown
    components={{
      p: ({ children }) => (
        <p className="mb-3 last:mb-0 leading-relaxed text-base text-foreground/80">{children}</p>
      ),
      strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
      ul: ({ children }) => <ul className="mb-4 space-y-2 list-disc pl-5">{children}</ul>,
      ol: ({ children }) => <ol className="mb-4 space-y-2 list-decimal pl-5">{children}</ol>,
      li: ({ children }) => <li className="text-base text-foreground/80 leading-relaxed">{children}</li>,
      h1: ({ children }) => <h1 className="mb-4 text-xl font-bold text-white tracking-tight">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-3 text-lg font-bold text-white tracking-tight">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-2 text-base font-bold text-white tracking-tight">{children}</h3>,
    }}
  >
    {content}
  </ReactMarkdown>
);

export function AiStructuredResponse({
  data,
  className,
}: Omit<AiStructuredResponseProps, "onClear">) {
  const aiResult = useMemo(() => normalizeAiResponse(data), [data]);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    if (!aiResult || typeof aiResult === "string" || !aiResult.promptImagem) return;
    try {
      await navigator.clipboard.writeText(aiResult.promptImagem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  if (!aiResult) return null;

  if (typeof aiResult === "string") {
    return (
      <div
        className={cn(
          "p-4 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300",
          className,
        )}
      >
        <MarkdownContent content={aiResult} />
      </div>
    );
  }

  const removeEmojis = (text: string) => text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();

  return (
    <div className={cn("space-y-6 animate-in fade-in slide-in-from-top-2 duration-300", className)}>
      {aiResult.titulo && (
        <div>
          <h4 className="text-xl font-display font-black text-primary mb-5 flex items-center gap-3 tracking-tight">
            <Sparkles className="size-7 shrink-0 text-cyan-400" />
            {aiResult.titulo}
          </h4>
        </div>
      )}

      {aiResult.respostaDireta && (
        <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-2 mb-1 text-primary relative">
            <span className="text-xl">📌</span>
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
              Resposta direta
            </h5>
          </div>
          <p className="text-base leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap relative">
            {aiResult.respostaDireta}
          </p>
        </div>
      )}

      {aiResult.acaoPratica && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2 text-primary relative">
            <span className="text-xl">🎯</span>
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
              Ação prática
            </h5>
          </div>
          <p className="text-sm text-foreground font-semibold leading-relaxed whitespace-pre-wrap relative">
            {aiResult.acaoPratica}
          </p>
        </div>
      )}

      {aiResult.banner && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 shadow-inner">
          <div className="flex items-center gap-2 mb-4 text-cyan-400">
            <span className="text-xl">📣</span>
            <h5 className="text-xs font-bold uppercase tracking-widest opacity-80">
              Sugestão de banner
            </h5>
          </div>
          <div className="space-y-3">
            <div className="bg-background/60 rounded-lg p-5 border border-cyan-500/10 shadow-sm">
              {aiResult.banner.titulo && (
                <h6 className="font-display font-bold text-white text-base mb-2">
                  {aiResult.banner.titulo}
                </h6>
              )}
              {aiResult.banner.texto && (
                <p className="text-sm text-foreground/80 mb-6 leading-relaxed whitespace-pre-wrap">
                  {aiResult.banner.texto}
                </p>
              )}
              {aiResult.banner.cta && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-cyan-400/80 flex items-center gap-2">
                    <Activity className="size-4" />
                    Chamada para ação
                  </h5>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto pointer-events-none font-bold bg-cyan-600/90 text-white text-sm py-4 px-6 h-auto"
                  >
                    {aiResult.banner.cta}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {aiResult.passos && aiResult.passos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1 text-primary">
            <span className="text-xl">✅</span>
            <h5 className="text-xs font-bold uppercase tracking-widest opacity-80">
              Próximos passos
            </h5>
          </div>
          <ul className="space-y-2">
            {aiResult.passos.map((passo, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground/80 leading-relaxed">
                <span className="text-primary mt-1.5">•</span>
                <span>{passo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiResult.dicaRapida && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-amber-500">
            <span className="text-xl">💡</span>
            <h5 className="text-xs font-bold uppercase tracking-widest opacity-80">
              Dica rápida
            </h5>
          </div>
          <p className="text-base text-amber-200/90 leading-relaxed italic font-medium">
            {aiResult.dicaRapida}
          </p>
        </div>
      )}

      {aiResult.fontes && aiResult.fontes.length > 0 && (
        <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-xl">🔎</span>
            <h5 className="text-xs font-bold uppercase tracking-widest opacity-80">
              Fontes Consultadas
            </h5>
          </div>
          <ul className="space-y-1.5">
            {aiResult.fontes.map((fonte, i) => (
              <li key={i}>
                <a
                  href={fonte.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="size-1.5 rounded-full bg-primary/40 group-hover:bg-primary" />
                  <span className="flex-1 truncate">{fonte.titulo}</span>
                  <Rocket className="size-3 opacity-0 group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiResult.promptImagem && (
        <div className="flex flex-col gap-3 rounded-xl bg-purple-500/10 p-4 border border-purple-500/20 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-purple-400">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-5 shrink-0" />
              <h5 className="text-xs font-bold uppercase tracking-widest opacity-80">
                Prompt para criar a imagem (DeepSeek)
              </h5>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 hover:bg-purple-500/20 hover:text-purple-300"
              onClick={handleCopyPrompt}
              title="Copiar prompt"
            >
              {copied ? (
                <Check className="size-3.5 text-green-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
          <div className="space-y-3">
            <div className="relative group rounded bg-background/40 p-3 border border-purple-500/10">
              <p className="text-sm text-purple-200/90 leading-relaxed italic font-medium">
                "{aiResult.promptImagem}"
              </p>
              {copied && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded animate-in fade-in duration-200">
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Check className="size-3" />
                    Prompt copiado
                  </span>
                </div>
              )}
            </div>
            {aiResult.avisoImagem && (
              <div className="flex gap-2 items-start">
                <Info className="size-4 text-purple-400/70 mt-0.5" />
                <p className="text-xs text-purple-400/70 leading-relaxed">
                  {aiResult.avisoImagem}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {aiResult.cores && aiResult.cores.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Palette className="size-5" />
            <h5 className="text-xs font-bold uppercase tracking-widest opacity-80">Sugestão de Cores</h5>
          </div>
          <div className="flex gap-2">
            {aiResult.cores.map((cor, i) => (
              <div
                key={i}
                className="group relative size-6 rounded-full border border-white/10"
                style={{ backgroundColor: cor }}
                title={cor}
              >
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 scale-0 text-[8px] text-white opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100">
                  {cor}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
