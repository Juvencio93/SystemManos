import { Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone, MousePointerClick, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insights } from "@/lib/insights.server";
import { formatDateBR } from "@/lib/utils";

/**
 * Campanha em destaque (capa da matriz e da filial): a campanha de portal
 * ativa no momento, com o resultado dela — acessos atribuidos e contatos
 * gerados. Sem campanha ativa, vira um convite para criar.
 */
export function CampanhaDestaqueCard({
  data,
  isLoading,
}: {
  data: Insights | undefined;
  isLoading: boolean;
}) {
  if (isLoading && !data) return null;
  if (!data) return null;
  const campanha = data.campanhaAtiva;

  if (!campanha) {
    return (
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" /> Campanha em destaque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-display text-2xl font-black tracking-tight">Nenhuma campanha no ar</p>
          <p className="max-w-xl text-sm text-muted-foreground">
            O portal é a sua vitrine: quem conecta no Wi-Fi vê a sua campanha antes de navegar.
            Crie uma campanha e transforme visitantes em contatos.
          </p>
          <Button size="sm" asChild>
            <Link to="/campanhas">
              Criar campanha <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const inicio = campanha.startedAt ? new Date(campanha.startedAt) : null;
  const fim = campanha.endedAt ? new Date(campanha.endedAt) : null;
  let periodo: string;
  let progresso: number | null = null;
  let diaRotulo: string | null = null;
  if (inicio && fim && fim.getTime() > inicio.getTime()) {
    const totalDias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86_400_000));
    const decorridos = Math.min(
      totalDias,
      Math.max(0, Math.round((Date.now() - inicio.getTime()) / 86_400_000)),
    );
    progresso = Math.round((decorridos / totalDias) * 100);
    diaRotulo = `dia ${decorridos} de ${totalDias}`;
    periodo = `de ${formatDateBR(campanha.startedAt as string)} a ${formatDateBR(campanha.endedAt as string)}`;
  } else if (inicio) {
    periodo = `no ar desde ${formatDateBR(campanha.startedAt as string)}`;
  } else {
    periodo = "período aberto";
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-5 text-primary" /> Campanha em destaque
        </CardTitle>
        <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">NO AR</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="truncate font-display text-2xl font-black tracking-tight">{campanha.name}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {periodo}
            {diaRotulo ? ` · ${diaRotulo}` : ""}
          </p>
          {progresso !== null ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progresso}%` }} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MousePointerClick className="size-4 text-primary" />
            <strong className="font-display text-lg font-black text-foreground">
              {campanha.acessos}
            </strong>
            acessos pelo portal
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserPlus className="size-4 text-primary" />
            <strong className="font-display text-lg font-black text-foreground">
              {campanha.contatos}
            </strong>
            novos contatos gerados
          </p>
        </div>

        <Button size="sm" variant="outline" asChild>
          <Link to="/marketing/$campaignId" params={{ campaignId: campanha.id }}>
            Ver campanha <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
