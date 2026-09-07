import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { Download, FileBarChart } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { getBranchDisplayName } from "@/lib/name-utils";
import { formatDateTimeBR } from "@/lib/utils/date-utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios por marketing | Manos Tech" },
      {
        name: "description",
        content:
          "Relatório diario dos dados captados no Wi-Fi, separado por marketing, com exportação em CSV.",
      },
      { property: "og:title", content: "Relatórios por marketing | Manos Tech" },
      {
        property: "og:description",
        content:
          "Relatório diario dos dados captados no Wi-Fi, separado por marketing, com exportação em CSV.",
      },
    ],
  }),
  component: ReportsPage,
});

function spToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Row = {
  id: string;
  created_at: string;
  device_type: string | null;
  is_returning: boolean;
  campaign_id: string | null;
  branch_id: string | null;
  visitor_id: string | null;
  campaigns: { name: string } | null;
  branches: {
    id: string;
    name: string;
    trade_name: string | null;
    legal_name: string | null;
  } | null;
  visitors: {
    full_name: string | null;
    email: string | null;
    phone_e164: string | null;
    city: string | null;
    connections_count: number;
  } | null;
};

function ReportsPage() {
  const [date, setDate] = useState(spToday());
  const navigate = useNavigate();

  const handleCardClick = useCallback(
    (id: string) => {
      if (id !== "sem-campanha") {
        navigate({ to: "/marketing/$campaignId", params: { campaignId: id } });
      }
    },
    [navigate],
  );

  const report = useQuery({
    queryKey: ["report", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select(
          "id, created_at, device_type, is_returning, campaign_id, branch_id, visitor_id, campaigns(name), visitors(full_name, email, phone_e164, city, connections_count), branches(id, name, trade_name, legal_name)",
        )
        .eq("period_date", date)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: Row[] }>();
    for (const row of report.data ?? []) {
      const key = row.campaign_id ?? "sem-campanha";
      const branchName = row.branches
        ? getBranchDisplayName(
            row.branches as unknown as Database["public"]["Tables"]["branches"]["Row"],
          )
        : "Matriz";
      const entry = map.get(key) ?? {
        name: `${row.campaigns?.name ?? "Sem marketing"} (${branchName})`,
        rows: [],
      };

      entry.rows.push(row);
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);
  }, [report.data]);

  function exportCsv(name: string, rows: Row[]) {
    const header = [
      "Marketing",
      "Nome",
      "E-mail",
      "Telefone",
      "Cidade",
      "Conexões do número",
      "Tipo",
      "Dispositivo",
      "Horário",
    ];
    const lines = rows.map((row) =>
      [
        name,
        row.visitors?.full_name ?? "",
        row.visitors?.email ?? "",
        row.visitors?.phone_e164 ? `="${row.visitors.phone_e164}"` : "",
        row.visitors?.city ?? "",
        String(row.visitors?.connections_count ?? ""),
        row.is_returning ? "recorrente" : "novo",
        row.device_type ?? "",
        formatDateTimeBR(row.created_at),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["\uFEFF" + [header.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatório-${name.replace(/\W+/g, "-").toLowerCase()}-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title={<span className="font-display font-black tracking-tight">Relatórios</span>}
        subtitle={<span className="text-base opacity-80">Acompanhe o desempenho das suas campanhas em tempo real.</span>}
        action={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="date" className="text-xs text-muted-foreground">
                Período operacional
              </Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        }
      />

      <div className="space-y-6">
        {groups.map(([id, group]) => (
          <Card
            key={id}
            className={`glass-panel rounded-3xl transition-all duration-300 ${
              id !== "sem-campanha" ? "cursor-pointer hover:bg-white/5 hover:-translate-y-1 hover:shadow-glow hover:border-primary/50" : ""
            }`}
            onClick={() => handleCardClick(id)}
          >
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileBarChart className="size-4 text-primary" /> {group.name}
                <Badge variant="outline">
                  {group.rows.length} {group.rows.length === 1 ? "acesso" : "acessos"}
                </Badge>
                <Badge variant="outline">
                  {
                    new Set(
                      group.rows.map((r) => r.visitor_id).filter((id): id is string => Boolean(id)),
                    ).size
                  }{" "}
                  {new Set(
                    group.rows.map((r) => r.visitor_id).filter((id): id is string => Boolean(id)),
                  ).size === 1
                    ? "visitante único"
                    : "visitantes únicos"}
                </Badge>
              </CardTitle>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {id !== "sem-campanha" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/marketing/$campaignId" params={{ campaignId: id }}>
                      Dashboard completo
                    </Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportCsv(group.name, group.rows)}
                >
                  <Download className="size-4" /> CSV
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}

        {!report.isLoading && groups.length === 0 ? (
          <Card className="glass-panel">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum dado captado neste período operacional.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
