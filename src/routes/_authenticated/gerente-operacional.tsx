import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getLatestOperationalAnalysis,
  getOperationalAlerts,
  updateAlertStatus,
  refreshOperationalAnalysis,
  type OperationMetric,
} from "@/lib/operational.functions";

import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Info,
  Building2,
  Phone,
  MessageSquare,
  ExternalLink,
  MapPin,
  Home,
  RefreshCw,
} from "lucide-react";
import { OperationalUnitCard } from "@/components/app/operational/OperationalUnitCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { useState, useEffect } from "react";
import { normalizeOperationalStatus } from "@/lib/operational-status.utils";
import { getCompanyDisplayName, getBranchDisplayName } from "@/lib/name-utils";

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

export const Route = createFileRoute("/_authenticated/gerente-operacional")({
  beforeLoad: async ({ context }) => {
    const ctx = context as {
      supabase: import("@supabase/supabase-js").SupabaseClient<
        import("@/integrations/supabase/types").Database
      >;
      user: { id: string };
    };
    const { data: roleData, error } = await ctx.supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    if (error) {
      console.error("[Gerente Operacional Auth Error]", {
        userId: ctx.user.id,
        error: error.message,
        code: error.code,
      });
      throw redirect({ to: "/dashboard" });
    }

    const role = String(roleData?.role ?? "")
      .trim()
      .toLowerCase();

    if (role !== "adm" && role !== "matriz" && role !== "revenda") {
      throw redirect({ to: "/dashboard" });
    }

    return {
      role,
      companyId: roleData?.company_id ?? null,
    };
  },
  component: OperationalManagerPage,
});

function getPriorityText(item: unknown): string | null {
  if (typeof item === "string") {
    const text = item.trim();
    return text || null;
  }
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    const prioridade = record["prioridade"];
    if (typeof prioridade === "string") {
      const text = prioridade.trim();
      return text || null;
    }
  }
  return null;
}

function getHighlightText(item: unknown): string | null {
  if (typeof item === "string") {
    const text = item.trim();
    return text || null;
  }
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    const destaque = record["destaque"];
    if (typeof destaque === "string") {
      const text = destaque.trim();
      return text || null;
    }
  }
  return null;
}

function OperationalManagerPage() {
  const router = useRouter();
  const fetchAnalysis = useServerFn(getLatestOperationalAnalysis);
  const fetchAlerts = useServerFn(getOperationalAlerts);
  const updateAlert = useServerFn(updateAlertStatus);
  const refreshAnalysis = useServerFn(refreshOperationalAnalysis);
  const { data: access } = useAccess();
  const queryClient = useQueryClient();

  const isAdmin = access?.role === "adm";
  const canRefresh = isAdmin || access?.role === "revenda";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshComplete, setRefreshComplete] = useState(false);

  const {
    data: analysis,
    isLoading: loadingAnalysis,
    error: analysisError,
  } = useQuery({
    queryKey: ["operational-analysis-full"],
    queryFn: async () => {
      console.log("[GerenteOperacional] Fetching analysis...");
      const res = await fetchAnalysis();
      return res;
    },
    enabled: !!access?.role && (access.role === "adm" || access.role === "matriz" || access.role === "revenda"),
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ["operational-alerts-full"],
    queryFn: () => fetchAlerts(),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!isAdmin || !alerts?.length) return;
    const critical = alerts.filter((alert: any) => alert.level === "critico");
    if (critical.length > 0) {
      toast.error(`${critical.length} alerta${critical.length === 1 ? "" : "s"} crítico${critical.length === 1 ? "" : "s"} aguardando atenção`, {
        description: "Abra a Análise Operacional para ver as empresas afetadas e as ações recomendadas.",
        duration: 7000,
      });
    }
  }, [alerts, isAdmin]);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setRefreshComplete(false);

    try {
      const result = (await refreshAnalysis()) as {
        success: boolean;
        message: string;
        analysis?: unknown;
      };
      console.log("[GerenteOperacional] Refresh Result:", result);

      if (result?.success) {
        await queryClient.invalidateQueries({
          queryKey: ["operational-analysis-full"],
          exact: true,
        });

        const refreshed = await queryClient.fetchQuery({
          queryKey: ["operational-analysis-full"],
          queryFn: async () => fetchAnalysis(),
        });

        await Promise.all([isAdmin ? refetchAlerts() : Promise.resolve(), router.invalidate()]);

        const finalAnalysis = refreshed;
        const finalCompaniesCount = finalAnalysis?.indicators?.["totalCompanies"];
        const finalUnitsCount = finalAnalysis?.indicators?.["totalUnits"];

        if (isAdmin && Number(finalCompaniesCount || 0) >= 2 && Number(finalUnitsCount || 0) >= 3) {
          const companiesMsg = `${finalCompaniesCount} empresas e `;
          const unitsMsg = `${finalUnitsCount} unidades `;
          toast.success(`${companiesMsg}${unitsMsg}atualizadas com sucesso.`);
        } else {
          toast.success("Análise da sua rede atualizada com sucesso.");
        }

        setRefreshComplete(true);
        setTimeout(() => setRefreshComplete(false), 3000);
      } else {
        toast.error(result?.message || "Erro ao atualizar análise");
      }
    } catch (e: unknown) {
      console.error("[GerenteOperacional] Refresh error:", e);
      const msg = e instanceof Error ? e.message : "Falha na comunicação com o servidor";
      toast.error(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusUpdate = async (alertId: string, status: "contatado" | "resolvido") => {
    try {
      await updateAlert({ data: { alertId, status } });
      toast.success("Status atualizado!");
      refetchAlerts();
    } catch (e: unknown) {
      toast.error("Erro ao atualizar status");
    }
  };

  interface OperationalAnalysis {
    status?: string;
    indicators?: Record<string, number>;
    summaryIa?: string;
    updatedAt?: string;
    createdAt?: string;
    operations?: OperationMetric[];
    organizations?: Array<{
      companyId: string;
      companyName?: string;
      diagnosis?: string;
      recommendation?: string;
      matrix: { status: string };
      branches: Array<{ status: string }>;
    }>;
  }

  const typedAnalysis = analysis as unknown as OperationalAnalysis;

  if (loadingAnalysis)
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Carregando análise...</p>
      </div>
    );

  if (
    analysisError ||
    !typedAnalysis ||
    typedAnalysis.status === "invalido" ||
    typedAnalysis.status === "erro" ||
    typedAnalysis.status === "nao_disponivel"
  ) {
    const isError =
      !!analysisError || typedAnalysis?.status === "invalido" || typedAnalysis?.status === "erro";
    const isNotAvailable = typedAnalysis?.status === "nao_disponivel";

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className={cn("rounded-full p-4", isError ? "bg-red-500/10" : "bg-blue-500/10")}>
          {isError ? (
            <AlertTriangle className="size-8 text-red-500" />
          ) : (
            <Info className="size-8 text-blue-500 animate-pulse" />
          )}
        </div>
        <h2 className="text-xl font-bold">
          {isError ? "Falha na análise operacional" : isNotAvailable ? "Análise diária indisponível" : "Gerando análise inicial..."}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {isError
            ? analysisError instanceof Error
              ? analysisError.message
              : "Erro ao carregar dados."
            : isNotAvailable 
              ? (typedAnalysis as any).message || "A análise diária ainda não foi gerada. A próxima atualização automática ocorrerá às 06:00."
              : "Estamos preparando os dados da sua operação. Isso leva apenas alguns segundos."}
        </p>
        {!isError && !isNotAvailable && (
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
            Atualizar página
          </Button>
        )}
      </div>
    );
  }

  const operationsRaw = typedAnalysis.operations || [];

  const groupedOperations = operationsRaw.reduce(
    (acc, op) => {
      if (op && op.companyId) {
        const companyEntry = acc[op.companyId];
        if (!companyEntry) {
          acc[op.companyId] = {
            name: op.companyName,
            ops: [op],
          };
        } else {
          companyEntry.ops.push(op);
        }
      }
      return acc;
    },
    {} as Record<string, { name: string; ops: OperationMetric[] }>,
  );

  const sortedCompanyEntries = Object.entries(groupedOperations).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  const openAlerts = alerts || [];

  const isMatrizView = access?.role === "matriz";
  const isResellerView = access?.role === "revenda";
  const matrixConnections = operationsRaw.reduce((sum, op) => sum + (op.metrics?.connections7d || 0), 0);
  const matrixCriticalUnits = operationsRaw.filter((op) => normalizeOperationalStatus(op.status) === "critico").length;
  const matrixAttentionUnits = operationsRaw.filter((op) => normalizeOperationalStatus(op.status) === "atencao").length;
  const bestUnit = [...operationsRaw].sort((a, b) => b.metrics.connections7d - a.metrics.connections7d)[0];
  const resellerCompanies = new Set(operationsRaw.map((op) => op.companyId)).size;
  const resellerConnections = matrixConnections;
  const resellerCritical = operationsRaw.filter((op) => normalizeOperationalStatus(op.status) === "critico").length;
  const resellerAttention = operationsRaw.filter((op) => normalizeOperationalStatus(op.status) === "atencao").length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 1. CABEÇALHO COMPACTO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card p-6 rounded-2xl border border-border">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-black tracking-tight text-white">Gerente Operacional IA</h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-bold h-5"
            >
              Beta
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            {isMatrizView
              ? "Acompanhamento diário da sua Matriz e Filiais."
              : "Análise diária das Matrizes e Filiais da plataforma."}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground/80">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
              Última atualização:{" "}
              {new Date(
                typedAnalysis.updatedAt || typedAnalysis.createdAt || new Date().toISOString(),
              ).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
              Próxima atualização: amanhã às 06:00
            </span>
            {canRefresh && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-medium ml-2",
                      isRefreshing && "opacity-50 cursor-not-allowed",
                    )}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Atualizando..." : "Atualizar agora"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Atualizar informações?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os dados das empresas e filiais serão sincronizados agora.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRefresh}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* INDICADORES COMPACTOS */}
        <div className="grid grid-cols-3 sm:flex items-center gap-3 sm:gap-6 bg-background/40 p-3 sm:p-4 rounded-xl border border-border/40">
          {isAdmin && (
            <>
              <div className="flex flex-col items-center px-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">
                  Empresas
                </span>
                <span className="text-base font-bold text-white leading-none">
                  {typedAnalysis.indicators?.["totalCompanies"] || 0}
                </span>
              </div>
              <div className="flex flex-col items-center px-2 border-l border-border/20">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">
                  Unidades
                </span>
                <span className="text-base font-bold text-white leading-none">
                  {typedAnalysis.indicators?.["totalUnits"] || 0}
                </span>
              </div>
            </>
          )}
          <div className="flex flex-col items-center px-2 border-l border-border/20">
            <span className="text-[9px] uppercase font-bold text-red-500 tracking-wider mb-0.5">
              Crítico
            </span>
            <span className="text-base font-bold text-red-500 leading-none">
              {typedAnalysis.indicators?.["critico"] || 0}
            </span>
          </div>
          <div className="hidden sm:flex flex-col items-center px-2 border-l border-border/20">
            <span className="text-[9px] uppercase font-bold text-yellow-500 tracking-wider mb-0.5">
              Atenção
            </span>
            <span className="text-base font-bold text-yellow-500 leading-none">
              {typedAnalysis.indicators?.["atencao"] || 0}
            </span>
          </div>
          <div className="hidden sm:flex flex-col items-center px-2 border-l border-border/20">
            <span className="text-[9px] uppercase font-bold text-blue-400 tracking-wider mb-0.5">
              Observação
            </span>
            <span className="text-base font-bold text-blue-400 leading-none">
              {typedAnalysis.indicators?.["observacao"] || 0}
            </span>
          </div>
          <div className="hidden sm:flex flex-col items-center px-2 border-l border-border/20">
            <span className="text-[9px] uppercase font-bold text-green-500 tracking-wider mb-0.5">
              Destaque
            </span>
            <span className="text-base font-bold text-green-500 leading-none">
              {typedAnalysis.indicators?.["destaque"] || 0}
            </span>
          </div>
        </div>
      </div>

      {isMatrizView && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Visão da sua Matriz</h2>
                <p className="mt-1 text-xs text-muted-foreground">Resumo da Matriz e das filiais cadastradas.</p>
              </div>
              {bestUnit && <Badge variant="secondary" className="text-[10px]">Melhor fluxo: {bestUnit.branchName}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/40 bg-background/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Unidades</p><p className="text-xl font-bold text-white">{operationsRaw.length}</p></div>
              <div className="rounded-lg border border-border/40 bg-background/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Conexões 7d</p><p className="text-xl font-bold text-white">{matrixConnections}</p></div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"><p className="text-[10px] uppercase text-red-400">Críticas</p><p className="text-xl font-bold text-red-400">{matrixCriticalUnits}</p></div>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3"><p className="text-[10px] uppercase text-yellow-400">Atenção</p><p className="text-xl font-bold text-yellow-400">{matrixAttentionUnits}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {isResellerView && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Visão da sua rede</h2>
              <p className="mt-1 text-xs text-muted-foreground">Acompanhamento dos clientes e unidades vinculados à sua revenda.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/40 bg-background/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Empresas</p><p className="text-xl font-bold text-white">{resellerCompanies}</p></div>
              <div className="rounded-lg border border-border/40 bg-background/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Conexões 7d</p><p className="text-xl font-bold text-white">{resellerConnections}</p></div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"><p className="text-[10px] uppercase text-red-400">Críticas</p><p className="text-xl font-bold text-red-400">{resellerCritical}</p></div>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3"><p className="text-[10px] uppercase text-yellow-400">Atenção</p><p className="text-xl font-bold text-yellow-400">{resellerAttention}</p></div>
            </div>
            {bestUnit && <p className="mt-4 text-xs text-muted-foreground">🏆 Melhor fluxo atual: <strong className="text-white">{bestUnit.companyName}</strong> — {bestUnit.branchName}, com <strong className="text-white">{bestUnit.metrics.connections7d} conexões</strong> nos últimos 7 dias.</p>}
          </CardContent>
        </Card>
      )}

      {/* 2. RESUMO EXECUTIVO COMPACTO */}
      {typedAnalysis.summaryIa && (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-primary/10 px-5 py-3 flex items-center border-b border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <MessageSquare className="size-4" />
                <h2 className="text-xs font-bold uppercase tracking-wider">
                  Resumo Executivo do Gerente
                </h2>
              </div>
            </div>

            <div className="divide-y divide-primary/10">
              {typedAnalysis.organizations
                ?.sort((a, b) => {
                  const getScore = (org: {
                    matrix: { status: string };
                    branches: Array<{ status: string }>;
                  }) => {
                    if (
                      org.matrix.status === "critico" ||
                      org.branches.some((b) => b.status === "critico")
                    )
                      return 4;
                    if (
                      org.matrix.status === "atencao" ||
                      org.branches.some((b) => b.status === "atencao")
                    )
                      return 3;
                    if (
                      org.matrix.status === "observacao" ||
                      org.branches.some((b) => b.status === "observacao")
                    )
                      return 2;
                    return 1;
                  };
                  return getScore(b) - getScore(a);
                })
                .map((org) => {
                  const isCritical =
                    org.matrix.status === "critico" ||
                    org.branches.some((b) => b.status === "critico");
                  const isAttention =
                    org.matrix.status === "atencao" ||
                    org.branches.some((b) => b.status === "atencao");
                  const isObservation =
                    org.matrix.status === "observacao" ||
                    org.branches.some((b) => b.status === "observacao");

                  return (
                    <div
                      key={org.companyId || "org-resumo"}
                      className={cn(
                        "p-4 flex flex-col md:flex-row md:items-center gap-4 transition-colors",
                        isCritical && "bg-red-500/5",
                        isAttention && "bg-yellow-500/5",
                      )}
                    >
                      <div className="md:w-1/4 flex items-center gap-3">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            isCritical
                              ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                              : isAttention
                                ? "bg-yellow-500"
                                : isObservation
                                  ? "bg-blue-400"
                                  : "bg-green-500",
                          )}
                        />
                        <span
                          className="text-sm font-bold text-white break-words"
                          title={org.companyName || ""}
                        >
                          {org.companyName || "Empresa"}
                        </span>
                      </div>

                      <div className="flex-1 space-y-1 py-1 overflow-hidden">
                        <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          <SafeMarkdown content={org.diagnosis || ""} />
                        </div>
                      </div>

                      <div className="md:w-1/3 bg-background/40 p-3 rounded-lg border border-border/40 shrink-0 overflow-hidden">
                        <div className="text-xs font-medium text-white/90 leading-relaxed whitespace-pre-wrap">
                          <SafeMarkdown content={org.recommendation || ""} />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. SEÇÕES DAS EMPRESAS E CARTÕES DAS UNIDADES */}
      <div className="space-y-10">
        {sortedCompanyEntries.map(([companyId, company]) => (
          <div key={companyId} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-white tracking-tight">{company.name}</h2>
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold">
                {company.ops.length} {company.ops.length === 1 ? "Unidade" : "Unidades"}
              </Badge>
            </div>

            <div
              className={cn(
                "grid gap-4",
                company.ops.length === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2",
              )}
            >
              {company.ops
                .sort((a, b) => {
                  if (a.branchId === null && b.branchId !== null) return -1;
                  if (a.branchId !== null && b.branchId === null) return 1;
                  return (a.branchName || "").localeCompare(b.branchName || "");
                })
                .map((op) => {
                  const alert = (
                    openAlerts as Array<{
                      id: string;
                      company_id: string;
                      branch_id: string | null;
                      status: string;
                    }>
                  ).find(
                    (a) =>
                      a.company_id === op.companyId &&
                      a.branch_id === op.branchId &&
                      a.status !== "resolvido",
                  );
                  return (
                    <OperationalUnitCard
                      key={`${op.companyId}-${op.branchId}`}
                      unitName={
                        op.branchId
                          ? getBranchDisplayName({
                              name: op.branchName || "Sem nome",
                              trade_name: op.branchTradeName || op.branchName || "Sem nome",
                              legal_name: op.branchLegalName || null,
                            } as import("@/lib/name-utils").Branch)
                          : getCompanyDisplayName({
                              name: op.companyName || "Sem nome",
                              trade_name: op.companyTradeName || op.companyName || "Sem nome",
                              legal_name: op.companyLegalName || null,
                            } as import("@/lib/name-utils").Company)
                      }
                      unitType={op.branchId ? "filial" : "matriz"}
                      status={op.status}
                      isNew={op.metrics.isNew}
                      reason={op.reason}
                      connections7d={op.metrics.connections7d}
                      phone={op.metrics.phone}
                      companyId={op.companyId}
                      branchId={op.branchId}
                      isAdminView={isAdmin}
                      onAction={(action) => {
                        if (action === "whatsapp" && alert) {
                          handleStatusUpdate(alert.id, "contatado");
                        }
                      }}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
