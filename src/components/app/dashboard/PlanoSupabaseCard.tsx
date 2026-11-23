import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlanTriggerStatus } from "@/lib/plan-trigger.functions";
import type {
  PlanTriggerItem,
  PlanTriggerState,
} from "@/lib/plan-trigger";

/**
 * Cartão "Plano Supabase" do painel do ADM (Frente 9): mostra o uso
 * atual contra cada gatilho de migração para o Pro. Só alerta — nada
 * aqui migra o plano e nada decide o spend cap.
 *
 * Uma consulta por abertura do painel, sem polling (mesmo padrão da
 * quota por empresa da Frente 8). Erro na medição só esconde o cartão.
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
  const fetchPlanTriggerStatus = useServerFn(getPlanTriggerStatus);
  const planTrigger = useQuery({
    queryKey: ["plan-trigger-status"],
    queryFn: () => fetchPlanTriggerStatus({ data: {} }),
    staleTime: 5 * 60 * 1000,
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

  return (
    <Card
      className={
        status.anyTriggered
          ? "border-amber-500/50 bg-amber-500/10"
          : "glass-panel"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Plano Supabase — quando migrar para o Pro</CardTitle>
        <Database className="size-4 text-primary/60" />
      </CardHeader>
      <CardContent className="space-y-4">
        {status.anyTriggered ? (
          <p className="text-sm font-medium text-amber-500">
            Um gatilho já disparou — hora de migrar para o Pro.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            O plano gratuito aguenta até um dos três gatilhos abaixo disparar — o que acontecer
            primeiro manda migrar para o Pro.
          </p>
        )}
        <TriggerRow item={status.storage} />
        <TriggerRow item={status.egress} />
        <TriggerRow item={status.companies} />
        <p className="text-xs text-muted-foreground">
          Na migração, o spend cap vem ligado por padrão e bloqueia o uso acima da quota em vez
          de cobrar — a decisão é sua na hora de migrar.
        </p>
      </CardContent>
    </Card>
  );
}
