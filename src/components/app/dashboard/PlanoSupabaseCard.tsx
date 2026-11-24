import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlanTriggerStatus } from "@/lib/plan-trigger.functions";
import type {
  PlanTriggerItem,
  PlanTriggerState,
  PlanTriggerStatus,
} from "@/lib/plan-trigger";

/**
 * Cartão "Plano Supabase" do painel do ADM (Frente 9): mostra o uso
 * atual contra cada gatilho de migração para o Pro. Só alerta — nada
 * aqui migra o plano e nada decide o spend cap.
 *
 * Recolhido por padrão: só o resumo aparece, e os 3 gatilhos abrem no
 * hover (desktop, group-hover) ou no toque/clique (celular, estado
 * `open`) — mesmo padrão do card "Wi-Fi dos visitantes" da landing.
 * Erro na medição só esconde o cartão.
 *
 * A medição roda 1x por dia: o resultado fica guardado neste navegador
 * por 24 h e, enquanto valer, o banco nem é consultado — nem ao abrir
 * o painel de novo. Sem polling.
 */

const STATE_BADGE: Record<PlanTriggerState, { label: string; className: string }> = {
  ok: {
    label: "Dentro do limite",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  near: {
    label: "Perto do limite",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  },
  triggered: {
    label: "Gatilho atingido",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  unknown: {
    label: "Sem medição",
    className: "bg-muted text-muted-foreground border-border",
  },
  manual: {
    label: "A conferir",
    className: "bg-muted text-muted-foreground border-border",
  },
};

/** O resultado da medição fica guardado neste navegador por 24 h. */
const PLAN_TRIGGER_CACHE_KEY = "manos-plan-trigger-status:v1";
const PLAN_TRIGGER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedPlanTrigger = { at: number; data: PlanTriggerStatus };

function readCachedPlanTrigger(): CachedPlanTrigger | null {
  try {
    const raw = window.localStorage.getItem(PLAN_TRIGGER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPlanTrigger | null;
    if (!parsed || typeof parsed.at !== "number" || !parsed.data || typeof parsed.data !== "object") {
      return null;
    }
    if (!("storage" in parsed.data) || !("egress" in parsed.data) || !("companies" in parsed.data)) {
      return null;
    }
    if (Date.now() - parsed.at >= PLAN_TRIGGER_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    // Sem armazenamento: mede de novo.
    return null;
  }
}

/** O pior estado entre os gatilhos — é o selo que aparece recolhido. */
function worstState(items: PlanTriggerItem[]): PlanTriggerState {
  if (items.some((item) => item.state === "triggered")) return "triggered";
  if (items.some((item) => item.state === "near")) return "near";
  if (items.some((item) => item.state === "unknown")) return "unknown";
  if (items.some((item) => item.state === "ok")) return "ok";
  return "manual";
}

function TriggerRow({ item }: { item: PlanTriggerItem }) {
  const badge = STATE_BADGE[item.state];
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{item.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {item.valueText !== null ? (
              <>
                <strong className="text-foreground">{item.valueText}</strong>
                {" / "}
                {item.limitText}
              </>
            ) : (
              <>limite de {item.limitText}</>
            )}
          </span>
          <Badge variant="outline" className={`text-[10px] py-0 h-4 ${badge.className}`}>
            {badge.label}
          </Badge>
        </div>
      </div>
      {item.percent !== null ? (
        <Progress value={Math.min(item.percent, 1) * 100} className="h-2" />
      ) : null}
      <p className="text-xs text-muted-foreground">{item.hint}</p>
    </div>
  );
}

export function PlanoSupabaseCard() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((value) => !value);
  // Medição guardada (1x por dia): vale por 24 h a partir da hora em que
  // foi medida — o tempo restante vira o staleTime, para não estender a
  // validade a cada abertura do painel.
  const [cached] = useState(readCachedPlanTrigger);
  const fetchPlanTriggerStatus = useServerFn(getPlanTriggerStatus);
  const planTrigger = useQuery({
    queryKey: ["plan-trigger-status"],
    queryFn: async () => {
      const data = await fetchPlanTriggerStatus({ data: {} });
      try {
        window.localStorage.setItem(
          PLAN_TRIGGER_CACHE_KEY,
          JSON.stringify({ at: Date.now(), data }),
        );
      } catch {
        // Sem armazenamento: a próxima abertura mede de novo.
      }
      return data;
    },
    initialData: () => cached?.data,
    staleTime: cached
      ? Math.max(0, PLAN_TRIGGER_CACHE_TTL_MS - (Date.now() - cached.at))
      : PLAN_TRIGGER_CACHE_TTL_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  if (planTrigger.isLoading) {
    return (
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Plano Supabase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  // Erro na medição só esconde o cartão — o painel segue funcionando.
  if (!planTrigger.data) return null;
  const status = planTrigger.data;
  const overallBadge = STATE_BADGE[worstState([status.storage, status.egress, status.companies])];
  const measuredAt = new Date(status.measuredAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      className="group cursor-pointer"
    >
      <Card
        className={
          status.anyTriggered
            ? "border-amber-500/50 bg-amber-500/10"
            : "glass-panel"
        }
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Plano Supabase — quando migrar para o Pro</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] py-0 h-4 ${overallBadge.className}`}>
              {overallBadge.label}
            </Badge>
            <Database className="size-4 text-primary/60" />
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform duration-500 ${open ? "rotate-180" : "group-hover:rotate-180"}`}
              aria-hidden="true"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className={`text-sm ${status.anyTriggered ? "font-medium text-amber-500" : "text-muted-foreground"}`}
          >
            {status.anyTriggered
              ? "Um gatilho já disparou — hora de migrar para o Pro."
              : "Tudo dentro do limite por enquanto."}
          </p>
          {/* Dica — some quando expande */}
          <p
            className={`text-xs text-muted-foreground ${open ? "hidden" : "group-hover:hidden"}`}
          >
            Toque ou passe o mouse para ver os 3 gatilhos
          </p>
          {/* Corpo expansível — abre no toque/clique OU no hover */}
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr] group-hover:grid-rows-[1fr]"}`}
          >
            <div className="overflow-hidden">
              <div className="space-y-4 pt-1">
                <p className="text-sm text-muted-foreground">
                  O plano gratuito aguenta até um dos três gatilhos abaixo disparar — o que
                  acontecer primeiro manda migrar para o Pro.
                </p>
                <TriggerRow item={status.storage} />
                <TriggerRow item={status.egress} />
                <TriggerRow item={status.companies} />
                <p className="text-xs text-muted-foreground">
                  Na migração, o spend cap vem ligado por padrão e bloqueia o uso acima da quota
                  em vez de cobrar — a decisão é sua na hora de migrar.
                </p>
                <p className="text-xs text-muted-foreground">
                  Medido em {measuredAt}. A medição se repete 1x por dia.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
