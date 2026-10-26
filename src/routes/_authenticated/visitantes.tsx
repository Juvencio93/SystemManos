import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  MessageCircle,
  Search,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { VisitorHistoryModal } from "@/components/app/crm/VisitorHistoryModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CRM_STAGES,
  getCrmCompanies,
  getCrmLeadActivities,
  getCrmCampaigns,
  getCrmLeads,
  registerCrmWhatsAppOpen,
  updateCrmLead,
  type CrmLeadActivity,
  type CrmLeadListItem,
  type CrmStage,
} from "@/lib/crm.functions";
import { useAccess } from "@/hooks/use-access";
import { formatDateTimeBR } from "@/lib/utils/date-utils";

export const Route = createFileRoute("/_authenticated/visitantes")({
  head: () => ({
    meta: [
      { title: "CRM de Leads Wi-Fi | Manos Tech" },
      {
        name: "description",
        content: "Prospecção e conversão dos leads captados pelo portal Wi-Fi.",
      },
    ],
  }),
  component: CrmWifiLeadsPage,
});

const STAGE_LABELS: Record<CrmStage, string> = {
  novo: "Novo lead",
  contato_iniciado: "Contato iniciado",
  respondeu: "Respondeu",
  interessado: "Interessado",
  convertido: "Convertido",
  nao_respondeu: "Não respondeu",
  sem_interesse: "Sem interesse",
  nao_contatar: "Não contatar",
};

const STAGE_BADGES: Record<CrmStage, string> = {
  novo: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  contato_iniciado: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  respondeu: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  interessado: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  convertido: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  nao_respondeu: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  sem_interesse: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  nao_contatar: "border-red-500/30 bg-red-500/10 text-red-300",
};

function CrmWifiLeadsPage() {
  const queryClient = useQueryClient();
  const fetchCampaigns = useServerFn(getCrmCampaigns);
  const fetchLeads = useServerFn(getCrmLeads);
  const saveLead = useServerFn(updateCrmLead);
  const recordWhatsApp = useServerFn(registerCrmWhatsAppOpen);

  const { data: access } = useAccess();
  const isAdm = access?.role === "adm";
  const [term, setTerm] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  const [companyId, setCompanyId] = useState("all");
  const [stage, setStage] = useState<CrmStage | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<CrmLeadListItem | null>(null);
  const [note, setNote] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");

  const campaigns = useQuery({
    queryKey: ["crm-campaigns"],
    queryFn: () => fetchCampaigns(),
  });

  const fetchCompanies = useServerFn(getCrmCompanies);
  const companies = useQuery({
    queryKey: ["crm-companies"],
    queryFn: () => fetchCompanies(),
    enabled: isAdm,
  });

  const fetchActivities = useServerFn(getCrmLeadActivities);
  const activities = useQuery({
    queryKey: ["crm-lead-activities", editingLead?.id ?? ""],
    queryFn: () => fetchActivities({ data: { leadId: editingLead!.id } }),
    enabled: !!editingLead,
  });

  const leads = useQuery({
    queryKey: ["crm-leads", campaignId, companyId, stage, overdueOnly, term, page],
    queryFn: () =>
      fetchLeads({
        data: {
          campaignId: campaignId === "all" ? null : campaignId,
          companyId: companyId === "all" ? null : companyId,
          stage: stage === "all" ? null : stage,
          overdueOnly,
          term,
          page,
          pageSize: 25,
        },
      }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      leadId: string;
      stage?: CrmStage;
      note?: string;
      nextActionAt?: string | null;
      doNotContact?: boolean;
    }) => saveLead({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      setEditingLead(null);
      setNote("");
      setNextActionAt("");
      toast.success("Lead atualizado.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível atualizar o lead."),
  });

  const openWhatsApp = async (lead: CrmLeadListItem) => {
    if (!lead.whatsappOptIn || lead.doNotContact) {
      toast.error("Este lead não possui autorização ativa para contato pelo WhatsApp.");
      return;
    }

    try {
      await recordWhatsApp({ data: { leadId: lead.id } });
      await queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      const phone = lead.phoneE164.replace(/\D/g, "");
      const message = [
        `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem?`,
        "",
        `Você conheceu a empresa ${lead.companyName} pelo nosso Wi-Fi e autorizou o recebimento de novidades.`,
        "Podemos apresentar uma oferta especial para você?",
      ].join("\n");
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o WhatsApp.");
    }
  };

  const result = leads.data;
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)));
  const converted = result?.stageCounts.convertido ?? 0;
  const interested = result?.stageCounts.interessado ?? 0;
  const pending = (result?.stageCounts.novo ?? 0) + (result?.stageCounts.nao_respondeu ?? 0);
  const funnelTotal = CRM_STAGES.reduce((acc, item) => acc + (result?.stageCounts[item] ?? 0), 0);
  const conversionPct = funnelTotal > 0 ? Math.round((converted / funnelTotal) * 100) : 0;
  const campaignNameById = new Map((campaigns.data ?? []).map((campaign) => [campaign.id, campaign.name]));

  return (
    <div>
      <PageHeader
        title={<span className="font-display font-black tracking-tight">CRM de Leads Wi-Fi</span>}
        subtitle={
          <span className="text-base opacity-80">
            Transforme pessoas captadas pelo portal cativo em oportunidades e clientes.
          </span>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Leads encontrados" value={result?.total ?? 0} />
        <MetricCard icon={Target} label="Interessados" value={interested} />
        <MetricCard
          icon={UserCheck}
          label="Convertidos"
          value={converted}
          hint={funnelTotal > 0 ? `${conversionPct}% dos leads` : undefined}
        />
        <MetricCard icon={CalendarClock} label="Aguardando contato" value={pending} />
      </div>

      <Card className="glass-panel mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_220px_210px]">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar nome, telefone, e-mail ou cidade"
              className="border-0 bg-transparent focus-visible:ring-0"
              maxLength={80}
            />
          </div>

          <Select
            value={campaignId}
            onValueChange={(value) => {
              setCampaignId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {(campaigns.data ?? []).map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name} {campaign.status === "ativa" ? "• Ativa" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={stage}
            onValueChange={(value) => {
              setStage(value as CrmStage | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Etapa do funil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {CRM_STAGES.map((item) => (
                <SelectItem key={item} value={item}>
                  {STAGE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isAdm && (
          <Select
            value={companyId}
            onValueChange={(value) => {
              setCompanyId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[220px] rounded-xl">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {(companies.data ?? []).map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={overdueOnly ? "default" : "outline"}
          size="sm"
          className="rounded-xl"
          onClick={() => {
            setOverdueOnly((current) => !current);
            setPage(1);
          }}
        >
          Só ações atrasadas
        </Button>
        {overdueOnly && (
          <span className="text-xs text-muted-foreground">
            Mostrando só leads com próximo contato vencido.
          </span>
        )}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <FunnelChart stageCounts={result?.stageCounts} total={funnelTotal} />
        <CampaignChart
          campaignCounts={result?.campaignCounts ?? []}
          campaignNameById={campaignNameById}
        />
      </div>
      <div className="mb-4">
        <EvolutionChart evolution={result?.evolution ?? []} />
      </div>

      <Card className="glass-panel overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="border-b border-border bg-white/[0.02] text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Lead</th>
                  {isAdm && <th className="px-4 py-4">Empresa</th>}
                  <th className="px-4 py-4">Campanha / origem</th>
                  <th className="px-4 py-4">Etapa</th>
                  <th className="px-4 py-4">Comportamento</th>
                  <th className="px-4 py-4">WhatsApp</th>
                  <th className="px-4 py-4">Próxima ação</th>
                  <th className="px-5 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(result?.leads ?? []).map((lead) => (
                  <tr key={lead.id} className="border-b border-border/60 hover:bg-white/[0.025]">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-foreground">{lead.fullName}</p>
                      <p className="text-xs text-muted-foreground">{lead.phoneE164}</p>
                      {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                    </td>
                    {isAdm && (
                      <td className="px-4 py-4">
                        <p className="max-w-[180px] truncate font-medium">{lead.companyName}</p>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <p className="max-w-[220px] truncate font-medium">{lead.campaignName}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.sourceType} • {lead.sourceName}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Select
                        value={lead.stage}
                        onValueChange={(value) =>
                          updateMutation.mutate({ leadId: lead.id, stage: value as CrmStage })
                        }
                      >
                        <SelectTrigger className={`h-9 w-[180px] rounded-lg ${STAGE_BADGES[lead.stage]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_STAGES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {STAGE_LABELS[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-4">
                      <p title="Contagem desde o horário de virada configurado para a unidade">                        Período atual: {lead.todayConnectionsCount} acesso{lead.todayConnectionsCount === 1 ? "" : "s"}                      </p>
                      <p className="text-xs text-muted-foreground">Total histórico: {lead.connectionsCount}</p>
                      <p className="text-xs text-muted-foreground">
                        Último: {formatDateTimeBR(lead.lastSeenAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant="outline"
                        className={
                          lead.whatsappOptIn && !lead.doNotContact
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/30 bg-red-500/10 text-red-300"
                        }
                      >
                        {lead.whatsappOptIn && !lead.doNotContact ? "Autorizado" : "Não autorizado"}
                      </Badge>
                      {lead.lastContactedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Contato: {formatDateTimeBR(lead.lastContactedAt)}
                        </p>
                      )}
                    </td>
                    <td
                      className={`px-4 py-4 text-xs ${lead.overdue ? "font-semibold text-red-300" : "text-muted-foreground"}`}
                    >
                      {lead.nextActionAt ? formatDateTimeBR(lead.nextActionAt) : "Não agendada"}
                      {lead.overdue && <span className="block">Atrasada</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openWhatsApp(lead)}
                          disabled={!lead.whatsappOptIn || lead.doNotContact}
                          title="Chamar no WhatsApp"
                          className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        >
                          <MessageCircle className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingLead(lead);
                            setNote("");
                            setNextActionAt(lead.nextActionAt?.slice(0, 16) ?? "");
                          }}
                          title="Registrar acompanhamento"
                        >
                          <CalendarClock className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedVisitorId(lead.visitorId)}
                          title="Histórico de acessos"
                        >
                          <History className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!leads.isLoading && !(result?.leads.length ?? 0) && (
                  <tr>
                    <td colSpan={isAdm ? 8 : 7} className="px-5 py-14 text-center text-muted-foreground">
                      Nenhum lead encontrado para estes filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} • {result?.total ?? 0} leads
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="mr-1 size-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Acompanhamento de {editingLead?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="crm-note" className="mb-1.5 block text-sm font-medium">
                Observação interna
              </label>
              <textarea
                id="crm-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ex.: Demonstrou interesse na oferta e pediu retorno na sexta-feira."
                maxLength={2000}
                className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="next-action" className="mb-1.5 block text-sm font-medium">
                Próximo contato
              </label>
              <Input
                id="next-action"
                type="datetime-local"
                value={nextActionAt}
                onChange={(event) => setNextActionAt(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="destructive"
                onClick={() =>
                  editingLead &&
                  updateMutation.mutate({
                    leadId: editingLead.id,
                    stage: "nao_contatar",
                    doNotContact: true,
                    note: note || "Contato bloqueado pelo operador.",
                  })
                }
              >
                Marcar “Não contatar”
              </Button>
              <Button
                disabled={updateMutation.isPending || (!note.trim() && !nextActionAt)}
                onClick={() =>
                  editingLead &&
                  updateMutation.mutate({
                    leadId: editingLead.id,
                    ...(note.trim() ? { note: note.trim() } : {}),
                    ...(nextActionAt
                      ? { nextActionAt: new Date(nextActionAt).toISOString() }
                      : {}),
                  })
                }
              >
                Salvar acompanhamento
              </Button>
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-semibold">Histórico</p>
              {activities.isLoading && (
                <p className="text-sm text-muted-foreground">Carregando histórico…</p>
              )}
              {!activities.isLoading && !(activities.data?.activities.length ?? 0) && (
                <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
              )}
              <div className="space-y-3">
                {(activities.data?.activities ?? []).map((activity) => (
                  <div key={activity.id} className="text-sm">
                    <p className="font-medium">{ACTIVITY_LABELS[activity.type]}</p>
                    <p className="text-muted-foreground">{activityDetail(activity)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeBR(activity.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <VisitorHistoryModal
        visitorId={selectedVisitorId}
        onClose={() => setSelectedVisitorId(null)}
      />
    </div>
  );
}

const STAGE_BAR_COLORS: Record<CrmStage, string> = {
  novo: "bg-blue-500",
  contato_iniciado: "bg-cyan-500",
  respondeu: "bg-violet-500",
  interessado: "bg-amber-500",
  convertido: "bg-emerald-500",
  nao_respondeu: "bg-slate-500",
  sem_interesse: "bg-orange-500",
  nao_contatar: "bg-red-500",
};

const CAMPAIGN_BAR_COLORS = [
  "bg-cyan-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-blue-400",
  "bg-orange-400",
  "bg-teal-400",
];

const ACTIVITY_LABELS: Record<CrmLeadActivity["type"], string> = {
  note: "Observação",
  stage_changed: "Etapa alterada",
  follow_up_scheduled: "Acompanhamento agendado",
  opt_out: "Não contatar",
  whatsapp_opened: "WhatsApp aberto",
};

function activityDetail(activity: CrmLeadActivity): string {
  if (activity.type === "note" || activity.type === "opt_out") {
    return activity.note ?? "Sem detalhes.";
  }
  if (activity.type === "stage_changed") {
    const from = activity.metadata["from"];
    const to = activity.metadata["to"];
    const fromLabel =
      typeof from === "string" ? (STAGE_LABELS[from as CrmStage] ?? from) : "?";
    const toLabel = typeof to === "string" ? (STAGE_LABELS[to as CrmStage] ?? to) : "?";
    return `De ${fromLabel} para ${toLabel}.`;
  }
  if (activity.type === "follow_up_scheduled") {
    const next = activity.metadata["nextActionAt"];
    return typeof next === "string" && next
      ? `Próximo contato em ${formatDateTimeBR(next)}.`
      : "Próximo contato removido.";
  }
  return "Contato iniciado pelo WhatsApp.";
}

function FunnelChart({
  stageCounts,
  total,
}: {
  stageCounts?: Record<CrmStage, number> | undefined;
  total: number;
}) {
  const max = Math.max(1, ...CRM_STAGES.map((item) => stageCounts?.[item] ?? 0));
  return (
    <Card className="glass-panel">
      <CardContent className="space-y-2.5 p-4">
        <p className="text-sm font-semibold">Funil de vendas</p>
        {total === 0 && (
          <p className="text-sm text-muted-foreground">Sem dados para estes filtros.</p>
        )}
        {CRM_STAGES.map((item) => {
          const count = stageCounts?.[item] ?? 0;
          return (
            <div key={item} className="flex items-center gap-3 text-sm">
              <span className="w-[130px] shrink-0 text-muted-foreground">{STAGE_LABELS[item]}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${STAGE_BAR_COLORS[item]}`}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-semibold">
                {count}
                {total > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {Math.round((count / total) * 100)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CampaignChart({
  campaignCounts,
  campaignNameById,
}: {
  campaignCounts: { campaignId: string | null; total: number }[];
  campaignNameById: Map<string, string>;
}) {
  const max = Math.max(1, ...campaignCounts.map((item) => item.total));
  return (
    <Card className="glass-panel">
      <CardContent className="space-y-2.5 p-4">
        <p className="text-sm font-semibold">Leads por campanha</p>
        {campaignCounts.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem dados para estes filtros.</p>
        )}
        {campaignCounts.map((item, index) => (
          <div key={item.campaignId ?? "none"} className="flex items-center gap-3 text-sm">
            <span className="w-[130px] shrink-0 truncate text-muted-foreground">
              {item.campaignId ? (campaignNameById.get(item.campaignId) ?? "Campanha") : "Sem campanha"}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${CAMPAIGN_BAR_COLORS[index % CAMPAIGN_BAR_COLORS.length]}`}
                style={{ width: `${(item.total / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-semibold">{item.total}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EvolutionChart({
  evolution,
}: {
  evolution: { date: string; total: number }[];
}) {
  const max = Math.max(1, ...evolution.map((item) => item.total));
  return (
    <Card className="glass-panel">
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold">Novos leads — últimos 14 dias</p>
        <div className="flex h-28 items-end gap-1.5">
          {evolution.map((item, index) => (
            <div key={item.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {item.total > 0 ? item.total : ""}
              </span>
              <div
                className={`w-full max-w-[28px] rounded-t-md ${index === evolution.length - 1 ? "bg-cyan-300" : "bg-cyan-600/70"}`}
                style={{ height: `${(item.total / max) * 72}%`, minHeight: item.total > 0 ? 6 : 0 }}
              />
              <span className="text-[10px] text-muted-foreground">
                {index % 2 === 0 || index === evolution.length - 1 ? item.date : ""}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string | undefined;
}) {
  return (
    <Card className="glass-panel">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-black">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
