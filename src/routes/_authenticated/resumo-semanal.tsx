import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, Megaphone, Printer, Trophy } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/hooks/use-access";
import { getInsights } from "@/lib/insights.functions";
import type { Insights } from "@/lib/insights.server";

export const Route = createFileRoute("/_authenticated/resumo-semanal")({
  component: ResumoSemanalPage,
});

function deltaTexto(atual: number, anterior: number) {
  if (anterior <= 0) return atual > 0 ? "primeira semana com movimento" : "sem movimento";
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs semana anterior`;
}

function ResumoSemanalPage() {
  const { data: access } = useAccess();
  const fetchInsights = useServerFn(getInsights);
  const insights = useQuery({
    queryKey: ["insights"],
    queryFn: () => fetchInsights(),
    enabled: Boolean(access?.userId),
  });
  const data = insights.data as Insights | undefined;

  if (access && access.role !== "matriz") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Resumo da semana" subtitle="Relatório semanal da sua rede Wi-Fi." />
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            O resumo semanal é um relatório da conta <strong className="text-foreground">Matriz</strong> — ele consolida
            todas as unidades da rede.
          </CardContent>
        </Card>
      </div>
    );
  }

  const ultimos7 = data?.chart.slice(-7) ?? [];
  const maxDia = Math.max(1, ...ultimos7.map((c) => c.total));
  const primeiroDia = ultimos7[0];
  const ultimoDia = ultimos7[ultimos7.length - 1];
  const periodo = primeiroDia && ultimoDia ? `de ${primeiroDia.date} a ${ultimoDia.date}` : "";
  const melhorUnidade = data?.rankingUnidades.find((u) => u.acessosSemana > 0);
  const hojeBR = data
    ? `${data.periodDate.slice(8, 10)}/${data.periodDate.slice(5, 7)}/${data.periodDate.slice(0, 4)}`
    : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="print-hide">
        <PageHeader
          title="Resumo da semana"
          subtitle="Uma página com a sua marca — pra mostrar pro sócio ou mandar pra equipe."
          action={
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="size-4" /> Voltar
                </Link>
              </Button>
              <Button onClick={() => window.print()} disabled={!data}>
                <Printer className="size-4" /> Imprimir / salvar PDF
              </Button>
            </div>
          }
        />
      </div>

      {insights.isLoading || !data ? (
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      ) : (
        <div className="print-report rounded-2xl bg-white p-8 text-zinc-900 shadow-xl">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
            <div>
              {access?.logoUrl ? (
                <img src={access.logoUrl} alt={access.companyName ?? "Empresa"} className="max-h-14 w-auto object-contain" />
              ) : (
                <p className="font-display text-2xl font-black tracking-tight">{access?.companyName ?? "Minha empresa"}</p>
              )}
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Rede Wi-Fi · Relatório semanal</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-black">Resumo da semana</p>
              <p className="text-sm text-zinc-500">{periodo}</p>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-6 py-6 md:grid-cols-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Acessos na semana</p>
              <p className="mt-1 font-display text-3xl font-black">{data.conexoesSemana}</p>
              <p className="text-xs font-medium text-cyan-700">{deltaTexto(data.conexoesSemana, data.conexoesSemanaAnterior)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Clientes novos</p>
              <p className="mt-1 font-display text-3xl font-black">+{data.leadsNovosSemana}</p>
              <p className="text-xs font-medium text-zinc-500">entraram na sua base</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Base de clientes</p>
              <p className="mt-1 font-display text-3xl font-black">{data.leadsEmpresa}</p>
              <p className="text-xs font-medium text-zinc-500">contatos capturados</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Horário de pico</p>
              <p className="mt-1 font-display text-3xl font-black">{data.horarioPico}</p>
              <p className="text-xs font-medium text-zinc-500">momento mais movimentado</p>
            </div>
          </section>

          <section className="border-t border-zinc-200 py-6">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Acessos por dia</p>
            <div className="flex h-32 items-end gap-2">
              {ultimos7.map((c, i) => (
                <div key={c.date + i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-600">{c.total > 0 ? c.total : ""}</span>
                  <div
                    className={`w-full rounded-t-md ${i === ultimos7.length - 1 ? "bg-cyan-600" : "bg-cyan-600/35"}`}
                    style={{ height: `${Math.max(3, (c.total / maxDia) * 100)}%` }}
                  />
                  <span className="text-[11px] text-zinc-500">{c.date}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2.5 border-t border-zinc-200 py-6 text-sm">
            {data.melhorDiaSemana && (
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-cyan-700" />
                Melhor dia: <strong>{data.melhorDiaSemana.rotulo}</strong> — {data.melhorDiaSemana.total} acessos
              </p>
            )}
            {melhorUnidade && (
              <p className="flex items-center gap-2">
                <Trophy className="size-4 shrink-0 text-amber-500" />
                Unidade destaque: <strong>{melhorUnidade.nome}</strong> — {melhorUnidade.acessosSemana} acessos na semana
              </p>
            )}
            {data.topCampanhaSemana && (
              <p className="flex items-center gap-2">
                <Megaphone className="size-4 shrink-0 text-cyan-700" />
                Campanha destaque: <strong>{data.topCampanhaSemana.name}</strong> — {data.topCampanhaSemana.total} acessos na semana
              </p>
            )}
          </section>

          <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-400">
            Relatório gerado pelo ManosTech System · {hojeBR}
          </footer>
        </div>
      )}
    </div>
  );
}
