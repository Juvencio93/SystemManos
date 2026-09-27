import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MonitorSmartphone, Repeat, Users, Wifi } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/marketing/$campaignId")({
  head: () => ({
    meta: [
      { title: "Dashboard do marketing | Manos Tech" },
      {
        name: "description",
        content:
          "Desempenho completo de um marketing: conectados agora, dispositivos, recorrência e leads captados.",
      },
      { property: "og:title", content: "Dashboard do marketing | Manos Tech" },
      {
        property: "og:description",
        content:
          "Desempenho completo de um marketing: conectados agora, dispositivos, recorrência e leads captados.",
      },
    ],
  }),
  component: MarketingDashboard,
});

type Conn = {
  id: string;
  created_at: string;
  device_type: string | null;
  is_returning: boolean;
  period_date: string;
  visitor_id: string | null;
  visitors: {
    full_name: string;
    email: string | null;
    phone_e164: string;
    city: string | null;
    connections_count: number;
  } | null;
};

function bucket(device: string | null) {
  const raw = (device ?? "").toLowerCase();
  if (raw.includes("android")) return "Android";
  if (raw.includes("ios")) return "iOS";
  if (raw.includes("desktop")) return "Desktop";
  return "Outros";
}

function MarketingDashboard() {
  const { campaignId } = Route.useParams();

  const query = useQuery({
    queryKey: ["marketing", campaignId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [campaign, connections] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id, name, description, status, started_at, branch_id, event_id")
          .eq("id", campaignId)
          .maybeSingle(),
        supabase
          .from("connections")
          .select(
            "id, created_at, device_type, is_returning, period_date, visitor_id, visitors(full_name, email, phone_e164, city, connections_count)",
          )
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false })
          .limit(3000),
      ]);
      if (campaign.error) throw campaign.error;
      if (connections.error) throw connections.error;
      return {
        campaign: campaign.data,
        rows: (connections.data ?? []) as unknown as Conn[],
      };
    },
  });

  const rows = query.data?.rows ?? [];
  const nowMs = Date.now();
  const online = rows.filter(
    (r) => nowMs - new Date(r.created_at).getTime() <= 15 * 60 * 1000,
  ).length;
  const uniques = new Set(rows.map((r) => r.visitor_id).filter(Boolean)).size;
  const recurring = rows.filter((r) => r.is_returning).length;
  const devices = rows.reduce<Record<string, number>>((acc, row) => {
    const key = bucket(row.device_type);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const cards = [
    { label: "Conectados agora", value: online, icon: Wifi, hint: "Últimos 15 minutos" },
    { label: "Total de acessos", value: rows.length, icon: Users, hint: "Histórico de conexões" },
    {
      label: "Visitantes únicos",
      value: uniques,
      icon: Repeat,
      hint: `${recurring} ${recurring === 1 ? "acesso recorrente" : "acessos recorrentes"}`,
    },
    {
      label: "Dispositivos",
      value: Object.entries(devices).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
      icon: MonitorSmartphone,
      hint:
        Object.entries(devices)
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ") || "Sem dados",
    },
  ];

  return (
    <div>
      <PageHeader
        title={query.data?.campaign?.name ?? "Marketing"}
        subtitle={
          query.data?.campaign?.description ?? "Dashboard completo do marketing selecionado."
        }
        action={
          <div className="flex items-center gap-2">
            {query.data?.campaign ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                {String(query.data.campaign.status)}
              </Badge>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="font-display text-3xl font-semibold">{card.value}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Leads captados neste marketing</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitante</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Acessos do número</TableHead>
                <TableHead className="text-right">Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 300).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.visitors?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.visitors?.phone_e164}
                    {row.visitors?.email ? (
                      <span className="block text-xs">{row.visitors.email}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.visitors?.city ?? "—"}
                  </TableCell>
                  <TableCell>{row.visitors?.connections_count ?? 0}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum acesso registrado neste marketing ainda.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
