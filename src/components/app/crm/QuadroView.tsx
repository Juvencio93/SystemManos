import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flame, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getCrmLeads,
  updateCrmLead,
  type CrmLeadListItem,
  type CrmStage,
} from "@/lib/crm.functions";

const STAGE_LABELS: Record<CrmStage, string> = {
  interessado: "Interessado",
  sem_interesse: "Sem interesse",
  convertido: "Convertido",
  nao_contatar: "Não contatar",
};

// Regras de validação do drag-and-drop (decisão do Gabriel):
// - "Interessado" e "Sem interesse" são AUTOMÁTICAS (opt-in) — o usuário não move entre elas.
// - "Não contatar" é LGPD: uma vez opt-out, só volta com ação explícita (confirmação).
// - Demais movimentos: apenas os pares permitidos abaixo.
type MoveVerdict =
  | { kind: "ok" }
  | { kind: "blocked-auto"; reason: string }
  | { kind: "blocked-lgpd" };

function checkMove(from: CrmStage, to: CrmStage): MoveVerdict {
  // LGPD: opt-out não volta sem ação explícita
  if (from === "nao_contatar") return { kind: "blocked-lgpd" };
  // Etapas automáticas pelo opt-in
  if (
    (from === "interessado" && to === "sem_interesse") ||
    (from === "sem_interesse" && to === "interessado")
  ) {
    return {
      kind: "blocked-auto",
      reason: "Etapa automática baseada no opt-in — não pode ser alterada manualmente.",
    };
  }
  // Movimentos permitidos
  if (
    (from === "interessado" && (to === "convertido" || to === "nao_contatar")) ||
    (from === "sem_interesse" && to === "nao_contatar") ||
    (from === "convertido" && to === "interessado")
  ) {
    return { kind: "ok" };
  }
  return {
    kind: "blocked-auto",
    reason: `Não é possível mover de "${STAGE_LABELS[from]}" para "${STAGE_LABELS[to]}".`,
  };
}

const STAGE_ORDER: CrmStage[] = ["interessado", "sem_interesse", "convertido", "nao_contatar"];

const COLUMN_THEMES: Record<CrmStage, { border: string; title: string; dot: string }> = {
  interessado: {
    border: "border-amber-500/30",
    title: "text-amber-300",
    dot: "bg-amber-400",
  },
  sem_interesse: {
    border: "border-slate-500/30",
    title: "text-slate-300",
    dot: "bg-slate-400",
  },
  convertido: {
    border: "border-emerald-500/30",
    title: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  nao_contatar: {
    border: "border-red-500/30",
    title: "text-red-300",
    dot: "bg-red-400",
  },
};

function scoreBadgeClass(visits: number): string {
  if (visits >= 5) return "bg-emerald-500/15 text-emerald-300";
  if (visits >= 3) return "bg-amber-500/15 text-amber-300";
  return "bg-slate-500/15 text-slate-300";
}

function LeadCard({ lead }: { lead: CrmLeadListItem }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-lg border border-white/[0.06] bg-[#111827] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] active:cursor-grabbing active:opacity-70"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{lead.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">📱 {lead.phoneE164}</p>
        </div>
        <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-bold ${scoreBadgeClass(lead.connectionsCount)}`}>
          <Flame className="size-3" />
          {lead.connectionsCount}x
        </span>
        <span className="text-muted-foreground">
          {lead.connectionsCount === 1 ? "1 visita" : `${lead.connectionsCount} visitas`}
        </span>
      </div>
    </div>
  );
}

export function QuadroView({ term, campaignId }: { term: string; campaignId: string }) {
  const fetchLeads = useServerFn(getCrmLeads);
  const saveLead = useServerFn(updateCrmLead);
  const queryClient = useQueryClient();
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [lgpdPending, setLgpdPending] = useState<{ lead: CrmLeadListItem; to: CrmStage } | null>(null);

  // O quadro mostra todas as etapas (sem filtro de stage), até 100 leads,
  // respeitando busca e filtro de campanha.
  const { data, isLoading } = useQuery({
    queryKey: ["crm-leads-quadro", term, campaignId],
    queryFn: () =>
      fetchLeads({
        data: {
          term,
          stage: null,
          campaignId: campaignId === "all" ? null : campaignId,
          page: 1,
          pageSize: 100,
        },
      }),
  });

  const leads = data?.leads ?? [];

  const doMove = async (lead: CrmLeadListItem, targetStage: CrmStage) => {
    setMovingId(lead.id);
    try {
      await saveLead({ data: { leadId: lead.id, stage: targetStage } });
      toast.success(`${lead.fullName} movido para "${STAGE_LABELS[targetStage]}"`);
      // Atualiza o quadro e a lista (mesma query key base)
      queryClient.invalidateQueries({ queryKey: ["crm-leads-quadro"] });
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    } catch {
      toast.error("Não foi possível mover o lead. Tente novamente.");
    } finally {
      setMovingId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: CrmStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    const verdict = checkMove(lead.stage, targetStage);
    if (verdict.kind === "blocked-auto") {
      toast.error(verdict.reason);
      return;
    }
    if (verdict.kind === "blocked-lgpd") {
      // LGPD: exige confirmação explícita para sair de "Não contatar"
      setLgpdPending({ lead, to: targetStage });
      return;
    }
    await doMove(lead, targetStage);
  };

  const confirmLgpdMove = async () => {
    if (!lgpdPending) return;
    const { lead, to } = lgpdPending;
    setLgpdPending(null);
    await doMove(lead, to);
  };

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Carregando quadro...</p>;
  }

  if (leads.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Nenhum lead encontrado. Os visitantes que passarem pelo portal aparecem aqui automaticamente.
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGE_ORDER.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          const theme = COLUMN_THEMES[stage];
          const isDragOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => handleDrop(e, stage)}
              className={`min-h-[400px] rounded-xl border bg-[#0a0f1e] p-4 transition-all duration-200 ${theme.border} ${
                isDragOver ? "ring-2 ring-cyan-400/60 bg-cyan-500/[0.04]" : ""
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider ${theme.title}`}>
                  <span className={`size-2.5 rounded-full ${theme.dot}`} />
                  {STAGE_LABELS[stage]}
                </h3>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold">
                  {stageLeads.length}
                </span>
              </div>
              <div className="space-y-3">
                {stageLeads.map((lead) => (
                  <div key={lead.id} className={movingId === lead.id ? "opacity-40" : ""}>
                    <LeadCard lead={lead} />
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground/60">
                    Arraste leads para cá
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Arraste um cartão para outra coluna para mudar a etapa.
        "Interessado" e "Sem interesse" são automáticas (opt-in) e não podem ser alteradas manualmente.
      </p>

      <AlertDialog
        open={lgpdPending !== null}
        onOpenChange={(open) => {
          if (!open) setLgpdPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "Não contatar"?</AlertDialogTitle>
            <AlertDialogDescription>
              {lgpdPending && (
                <>
                  <strong>{lgpdPending.lead.fullName}</strong> pediu para não ser contatado (LGPD).
                  Movê-lo para "{STAGE_LABELS[lgpdPending.to]}" reativa o contato com ele.
                  Só faça isso com autorização explícita do lead.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLgpdMove}>Tenho autorização</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
