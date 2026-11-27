/**
 * Automações & Réguas de WhatsApp (Frente B, Item 3).
 *
 * 3 cards — um por regra automática — com os textos já prontos: a matriz,
 * a filial (ou o ADM, escolhendo a empresa na tela) liga, ajusta o tempo
 * e a mensagem e salva. As réguas ficam
 * guardadas e começam a rodar sozinhas quando o WhatsApp conectar.
 *
 * Antes era só um espaço vazio (standby desde 22/10, originais no
 * histórico da PR #103): a tela de disparos em massa não volta — esta
 * é a tela nova, só das réguas.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWhatsappAutomationRules,
  saveWhatsappAutomationRule,
} from "@/lib/whatsapp-automation.functions";
import {
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_AUTOMATION_TEMPLATES,
  type AutomationRuleType,
} from "@/lib/whatsapp-automation-rules";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Automações & Réguas | Manos Tech" },
      {
        name: "description",
        content:
          "Cupom de boas-vindas, pesquisa depois da visita e resgate de quem sumiu — mensagens automáticas no WhatsApp.",
      },
    ],
  }),
  component: WhatsappAutomationsPage,
});

type RuleDraft = {
  enabled: boolean;
  /** Tempo em minutos (no resgate, é o tempo sem visita). */
  delayMinutes: number;
  messageTemplate: string;
  googleReviewUrl: string;
  minVisits: number;
  cooldownDays: number;
  dirty: boolean;
};

type RuleCard = {
  type: AutomationRuleType;
  title: string;
  description: string;
  delayLabel: string;
  delayUnit: "minutes" | "days";
  showMinVisits: boolean;
  showGoogleLink: boolean;
  showCooldown: boolean;
};

const RULE_CARDS: RuleCard[] = [
  {
    type: "welcome_coupon",
    title: "Cupom de boas-vindas",
    description:
      "Enviada pouco depois da visita, com um cupom para trazer o cliente de volta.",
    delayLabel: "Enviar quantos minutos depois da visita",
    delayUnit: "minutes",
    showMinVisits: false,
    showGoogleLink: false,
    showCooldown: false,
  },
  {
    type: "post_visit_nps",
    title: "Pesquisa depois da visita",
    description:
      "Pergunta de 1 a 5 para saber como foi a visita. Quem responder 4 ou 5 recebe o link da avaliação no Google.",
    delayLabel: "Enviar quantos minutos depois da visita",
    delayUnit: "minutes",
    showMinVisits: true,
    showGoogleLink: true,
    showCooldown: false,
  },
  {
    type: "winback_inactive",
    title: "Resgate de quem sumiu",
    description: "Mensagem para quem não aparece há um tempo, convidando a voltar.",
    delayLabel: "Enviar depois de quantos dias sem visita",
    delayUnit: "days",
    showMinVisits: false,
    showGoogleLink: false,
    showCooldown: true,
  },
];

function defaultDraft(type: AutomationRuleType): RuleDraft {
  return {
    enabled: DEFAULT_AUTOMATION_RULES[type].enabled,
    delayMinutes: DEFAULT_AUTOMATION_RULES[type].delayMinutes,
    messageTemplate: DEFAULT_AUTOMATION_TEMPLATES[type],
    googleReviewUrl: "",
    minVisits: DEFAULT_AUTOMATION_RULES[type].minVisits,
    cooldownDays: DEFAULT_AUTOMATION_RULES[type].cooldownDays,
    dirty: false,
  };
}

function WhatsappAutomationsPage() {
  const { data: access, isLoading: accessLoading } = useAccess();
  const queryClient = useQueryClient();
  const fetchRules = useServerFn(getWhatsappAutomationRules);
  const saveRuleFn = useServerFn(saveWhatsappAutomationRule);
  const isAdm = access?.role === "adm";
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const companies = useQuery({
    queryKey: ["companies-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, trade_name, legal_name, logo_url")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdm,
  });

  const [drafts, setDrafts] = useState<Record<AutomationRuleType, RuleDraft>>({
    welcome_coupon: defaultDraft("welcome_coupon"),
    post_visit_nps: defaultDraft("post_visit_nps"),
    winback_inactive: defaultDraft("winback_inactive"),
  });

  const rulesQuery = useQuery({
    queryKey: ["whatsapp-automation-rules", isAdm ? selectedCompanyId : "propria"],
    queryFn: () =>
      isAdm
        ? fetchRules({ data: { companyId: selectedCompanyId } })
        : fetchRules(),
    enabled:
      access?.role === "matriz" ||
      access?.role === "filial" ||
      (isAdm && selectedCompanyId.length > 0),
    retry: false,
  });

  // Aplica o que já está salvo — só nos cards que o usuário não editou,
  // para um retorno da lista não apagar o que ele está digitando.
  useEffect(() => {
    const saved = rulesQuery.data?.rules;
    if (!saved) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const rule of saved) {
        const type = rule.ruleType as AutomationRuleType;
        if (!next[type] || next[type].dirty) continue;
        next[type] = {
          enabled: rule.enabled,
          delayMinutes: rule.delayMinutes,
          messageTemplate: rule.messageTemplate,
          googleReviewUrl: rule.googleReviewUrl ?? "",
          minVisits: rule.minVisits,
          cooldownDays: rule.cooldownDays,
          dirty: false,
        };
      }
      return next;
    });
  }, [rulesQuery.data]);

  // ADM trocou de empresa: os rascunhos voltam ao padrão até carregar as
  // réguas da empresa escolhida.
  useEffect(() => {
    if (!isAdm) return;
    setDrafts({
      welcome_coupon: defaultDraft("welcome_coupon"),
      post_visit_nps: defaultDraft("post_visit_nps"),
      winback_inactive: defaultDraft("winback_inactive"),
    });
  }, [selectedCompanyId, isAdm]);

  const saveMutation = useMutation({
    mutationFn: async (type: AutomationRuleType) => {
      const draft = drafts[type];
      return saveRuleFn({
        data: {
          ...(isAdm ? { companyId: selectedCompanyId } : {}),
          ruleType: type,
          enabled: draft.enabled,
          delayMinutes: draft.delayMinutes,
          messageTemplate: draft.messageTemplate,
          googleReviewUrl: draft.googleReviewUrl.trim() || null,
          minVisits: draft.minVisits,
          cooldownDays: draft.cooldownDays,
        },
      });
    },
    onSuccess: (_data, type) => {
      setDrafts((current) => ({
        ...current,
        [type]: { ...current[type], dirty: false },
      }));
      toast.success("Régua salva.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automation-rules"] });
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a régua.",
        { duration: 7000 },
      );
    },
  });

  const updateDraft = (type: AutomationRuleType, changes: Partial<RuleDraft>) =>
    setDrafts((current) => ({
      ...current,
      [type]: { ...current[type], ...changes, dirty: true },
    }));

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (access?.role !== "matriz" && access?.role !== "filial" && !isAdm) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/60 p-6 text-center">
        <MessageCircle className="mx-auto mb-3 size-6 text-muted-foreground" />
        <h1 className="font-display text-lg font-semibold">Automações &amp; Réguas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          As mensagens automáticas de WhatsApp são configuradas pela matriz ou pela filial da
          empresa.
        </p>
      </div>
    );
  }

  const data = rulesQuery.data;
  const instancia = data?.instancia ?? null;
  const conectado = instancia?.status === "conectada";

  return (
    <div>
      <PageHeader
        title={<span className="font-display font-black tracking-tight">WhatsApp</span>}
        subtitle={
          <span className="text-base opacity-80">
            Mensagens automáticas para quem visita: cupom de boas-vindas, pesquisa depois da
            visita e resgate de quem sumiu.
          </span>
        }
      />

      {isAdm ? (
        <div className="mb-6 max-w-md space-y-2">
          <Label>Empresa</Label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a empresa" />
            </SelectTrigger>
            <SelectContent>
              {(companies.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.trade_name || c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {isAdm && selectedCompanyId.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/60 p-6 text-center">
          <MessageCircle className="mx-auto mb-3 size-6 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Escolha uma empresa</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha acima a empresa para ver e configurar as mensagens automáticas dela.
          </p>
        </div>
      ) : rulesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rulesQuery.isError || data?.migrationRequired ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/60 p-6 text-center">
          <WifiOff className="mx-auto mb-3 size-6 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">As réguas ainda não estão prontas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Não foi possível carregar as mensagens automáticas. Tente novamente ou fale com o
            suporte.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => rulesQuery.refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          {conectado ? (
            <div
              role="status"
              className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm"
            >
              <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
              <p>
                WhatsApp conectado
                {instancia.numero ? (
                  <>
                    {" "}
                    · <span className="font-medium">{instancia.numero}</span>
                  </>
                ) : null}
                . As réguas ligadas já estão valendo.
              </p>
            </div>
          ) : (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm"
            >
              <WifiOff className="mt-0.5 size-5 shrink-0 text-amber-400" />
              <p>
                <span className="font-medium">O WhatsApp ainda não está conectado.</span> Pode
                deixar tudo pronto por aqui: as réguas ficam salvas e começam a rodar sozinhas
                assim que o WhatsApp conectar.
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {RULE_CARDS.map((card) => {
              const draft = drafts[card.type];
              const saving =
                saveMutation.isPending && saveMutation.variables === card.type;
              const delayValue =
                card.delayUnit === "days"
                  ? Math.round(draft.delayMinutes / 1440)
                  : draft.delayMinutes;
              return (
                <Card key={card.type} className="flex flex-col">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{card.title}</CardTitle>
                      <Badge variant={draft.enabled ? "default" : "secondary"}>
                        {draft.enabled ? "Ligada" : "Desligada"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <Label htmlFor={`enabled-${card.type}`} className="text-sm font-medium">
                        {draft.enabled ? "Enviando" : "Parada"}
                      </Label>
                      <Switch
                        id={`enabled-${card.type}`}
                        checked={draft.enabled}
                        onCheckedChange={(checked) =>
                          updateDraft(card.type, { enabled: checked })
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`delay-${card.type}`}>{card.delayLabel}</Label>
                      <Input
                        id={`delay-${card.type}`}
                        type="number"
                        min={card.delayUnit === "days" ? 1 : 0}
                        max={card.delayUnit === "days" ? 365 : 525600}
                        value={delayValue}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!Number.isFinite(value) || value < 0) return;
                          updateDraft(card.type, {
                            delayMinutes:
                              card.delayUnit === "days" ? value * 1440 : value,
                          });
                        }}
                      />
                      {card.type === "winback_inactive" ? (
                        <p className="text-xs text-muted-foreground">
                          Quem ficar esse tempo sem visitar recebe a mensagem.
                        </p>
                      ) : null}
                    </div>

                    {card.showMinVisits ? (
                      <div className="space-y-2">
                        <Label htmlFor={`min-visits-${card.type}`}>
                          Só para quem já visitou pelo menos
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`min-visits-${card.type}`}
                            type="number"
                            min={1}
                            max={100}
                            className="w-24"
                            value={draft.minVisits}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (!Number.isFinite(value) || value < 1) return;
                              updateDraft(card.type, { minVisits: value });
                            }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {draft.minVisits === 1 ? "vez" : "vezes"}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {card.showGoogleLink ? (
                      <div className="space-y-2">
                        <Label htmlFor={`google-link-${card.type}`}>
                          Link da avaliação no Google
                        </Label>
                        <Input
                          id={`google-link-${card.type}`}
                          type="url"
                          placeholder="https://g.page/sua-empresa/review"
                          value={draft.googleReviewUrl}
                          onChange={(e) =>
                            updateDraft(card.type, { googleReviewUrl: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Enviado para quem responder 4 ou 5 na pesquisa.
                        </p>
                      </div>
                    ) : null}

                    {card.showCooldown ? (
                      <div className="space-y-2">
                        <Label htmlFor={`cooldown-${card.type}`}>
                          Esperar quantos dias antes de mandar de novo
                        </Label>
                        <Input
                          id={`cooldown-${card.type}`}
                          type="number"
                          min={1}
                          max={365}
                          value={draft.cooldownDays}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (!Number.isFinite(value) || value < 1) return;
                            updateDraft(card.type, { cooldownDays: value });
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor={`template-${card.type}`}>Mensagem</Label>
                      <Textarea
                        id={`template-${card.type}`}
                        rows={6}
                        maxLength={2000}
                        value={draft.messageTemplate}
                        onChange={(e) =>
                          updateDraft(card.type, { messageTemplate: e.target.value })
                        }
                      />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {"{nome}"} vira o nome do cliente e {"{empresa}"} o nome da empresa na
                          hora do envio.
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {draft.messageTemplate.length}/2000
                        </span>
                      </div>
                    </div>

                    <Button
                      className="mt-auto w-full"
                      disabled={!draft.dirty || saving}
                      onClick={() => saveMutation.mutate(card.type)}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Salvando...
                        </>
                      ) : (
                        "Salvar esta régua"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
