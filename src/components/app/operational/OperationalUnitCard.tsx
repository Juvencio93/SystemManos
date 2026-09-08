import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import {
  Phone,
  ExternalLink,
  Home,
  MapPin,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeOperationalStatus } from "@/lib/operational-status.utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SafeMarkdown = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      components={{
        h1: "p",
        h2: "p",
        h3: "p",
        h4: "p",
        h5: "p",
        h6: "p",
        a: "span",
        img: () => null,
        script: () => null,
        iframe: () => null,
        style: () => null,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export type OperationalUnitStatus = "critico" | "atencao" | "estavel" | "destaque" | "observacao";

interface OperationalUnitCardProps {
  unitName: string;
  unitType: "matriz" | "filial";
  status: string;
  reason: string;
  connections7d: number;
  phone?: string | null;
  companyId: string;
  branchId?: string | null;
  isAdminView?: boolean;
  onAction?: (action: string) => void;
  isNew?: boolean;
}

const statusConfig: Record<
  OperationalUnitStatus,
  {
    label: string;
    icon: LucideIcon;
    colors: string;
    badge: string;
    indicator: string;
  }
> = {
  observacao: {
    label: "Em observação",
    icon: HelpCircle,
    colors: "border-blue-500/30 bg-blue-500/5",
    badge: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    indicator: "text-blue-400",
  },
  estavel: {
    label: "Estável",
    icon: CheckCircle2,
    colors: "border-green-500/30 bg-green-500/5",
    badge: "text-green-500 border-green-500/30 bg-green-500/10",
    indicator: "text-green-500",
  },
  atencao: {
    label: "Atenção",
    icon: AlertCircle,
    colors: "border-yellow-500/30 bg-yellow-500/5",
    badge: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
    indicator: "text-yellow-500",
  },
  critico: {
    label: "Crítico",
    icon: AlertTriangle,
    colors: "border-red-500/30 bg-red-500/5",
    badge: "text-red-500 border-red-500/30 bg-red-500/10",
    indicator: "text-red-500",
  },
  destaque: {
    label: "Destaque",
    icon: Sparkles,
    colors: "border-cyan-500/30 bg-cyan-500/5",
    badge: "text-cyan-500 border-cyan-500/30 bg-cyan-500/10",
    indicator: "text-cyan-500",
  },
};

export function OperationalUnitCard({
  unitName,
  unitType,
  status: rawStatus,
  reason,
  connections7d,
  phone,
  companyId,
  branchId,
  isAdminView,
  onAction,
  isNew,
}: OperationalUnitCardProps) {
  const status = normalizeOperationalStatus(rawStatus);
  const config = statusConfig[status] || statusConfig.estavel;

  const description = isNew
    ? "Operação em fase inicial. Ainda é cedo para comparar o desempenho."
    : reason;

  const StatusIcon = config.icon;

  return (
    <Card
      className={cn(
        "transition-colors duration-150 hover:bg-card/80 border-l-4 rounded-xl",
        config.colors,
      )}
    >
      <CardContent className="p-4 flex flex-col sm:flex-row gap-4 h-full items-start">
        {/* Lado Esquerdo: Identificação e Status */}
        <div className="flex gap-3 flex-1 min-w-0 w-full">
          <div
            className={cn(
              "p-2.5 rounded-xl bg-background/60 border border-border/40 shrink-0 self-start mt-1",
              config.indicator,
            )}
          >
            {unitType === "matriz" ? <Home className="size-5" /> : <MapPin className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="text-base font-display font-black text-white leading-tight break-words tracking-tight">
                      {unitName}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{unitName}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge
                variant="outline"
                className={cn("shrink-0 h-6 text-[10px] uppercase font-bold px-2", config.badge)}
              >
                <StatusIcon className="size-3 mr-1" />
                {config.label}
              </Badge>
            </div>

            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 opacity-60">
              {unitType === "matriz" ? "Matriz" : "Filial"}
            </p>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-display font-black text-white tracking-tighter">{connections7d}</span>
              <span className="text-sm font-medium text-muted-foreground">
                {connections7d === 1 ? "conexão" : "conexões"} (7 dias)
              </span>
            </div>

            <div className="text-sm font-medium text-muted-foreground/90 leading-relaxed whitespace-pre-wrap">
              <SafeMarkdown content={description} />
            </div>
          </div>
        </div>

        {/* Lado Direito: Ações */}
        <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/20">
          <Button
            size="sm"
            variant="outline"
            asChild
            className="flex-1 sm:flex-initial h-9 px-4 text-[10px] font-black uppercase tracking-widest border-border/60 bg-background/40 hover:bg-background/80 rounded-xl"
          >
            <Link to="/empresas/$companyId" params={{ companyId }}>
              <ExternalLink className="size-3 mr-1.5" />
              {unitType === "matriz" ? "Abrir empresa" : "Abrir filial"}
            </Link>
          </Button>

          {phone && (isAdminView || unitType === "filial") && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-initial h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 border-green-500/30 hover:bg-green-500/10 text-green-500 rounded-xl"
              onClick={() => {
                const sanitized = phone.replace(/\D/g, "");
                window.open(`https://wa.me/55${sanitized}`, "_blank");
                onAction?.("whatsapp");
              }}
            >
              <Phone className="size-3" />
              WhatsApp
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
