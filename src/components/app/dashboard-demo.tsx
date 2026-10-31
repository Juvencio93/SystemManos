import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientDashboardRedesign } from "./dashboard/ClientDashboardRedesign";
import type { Insights } from "@/lib/insights.server";
import type { DispositivosHoje } from "@/lib/device.functions";
import type { RealtimeActivityResponse } from "@/lib/realtime.functions";

/**
 * Demonstração pública do painel do cliente para a landing page.
 *
 * Renderiza o componente REAL `ClientDashboardRedesign` com dados de exemplo
 * claramente fictícios, sem exigir autenticação. Os dados são pré-carregados
 * no cache de um QueryClient isolado (aninhado), de modo que as sub-consultas
 * internas (dispositivos, atividade em tempo real) nunca disparam fetch real.
 *
 * Regra editorial: nenhum número aqui representa medição real.
 */

function buildMockChart(): { date: string; total: number }[] {
  // 14 dias de exemplo — valores modestos e fictícios.
  const totals = [22, 28, 25, 31, 29, 35, 41, 33, 38, 44, 40, 47, 43, 47];
  return totals.map((total, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (totals.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), total };
  });
}

const mockInsights: Insights = {
  role: "matriz",
  showFinance: false,
  periodDate: new Date().toISOString().slice(0, 10),
  leadsBase: 318,
  visitantesHoje: 47,
  visitantesOntem: 42,
  conectadosAgora: 12,
  totalConexoes: 1240,
  conexoesSemana: 280,
  conexoesSemanaAnterior: 251,
  recorrentesSemana: 96,
  leadsEmpresa: 318,
  leadsNovosSemana: 11,
  rankingUnidades: [],
  topCampanhaSemana: null,
  melhorDiaSemana: { rotulo: "Sábado", total: 47 },
  posicaoRede: null,
  horarioPico: "19h",
  horarioPicoTotal: 32,
  devices: { android: 20, ios: 18, desktop: 9, outros: 0 },
  campanhasHoje: [],
  campanhaAtiva: null,
  topCampanha: null,
  chart: buildMockChart(),
  finance: null,
  empresasTotal: 1,
  filiaisTotal: 1,
  eventosTotal: 0,
  portaisAtivos: 1,
};

const mockDispositivosHoje: DispositivosHoje = {
  periodDate: new Date().toISOString().slice(0, 10),
  total: 47,
  celular: 38,
  computador: 9,
  outros: 0,
  android: 20,
  ios: 18,
  modelosAndroid: [
    { modelo: "Galaxy A54", total: 11 },
    { modelo: "Moto G84", total: 8 },
    { modelo: "Galaxy A34", total: 1 },
  ],
  modelosIos: [
    { modelo: "iPhone 13", total: 14 },
    { modelo: "iPhone 11", total: 4 },
  ],
  modelosComputador: [{ modelo: "Dell Inspiron", total: 6 }],
};

const mockConectadosAgora = { celular: 9, computador: 3 };

function buildMockActivity(): RealtimeActivityResponse {
  // Distribuição de exemplo ao longo do dia, com pico às 19h.
  const perHour: Record<number, number> = {
    7: 2, 8: 4, 9: 3, 10: 5, 11: 6, 12: 8, 13: 7, 14: 5,
    15: 6, 16: 7, 17: 9, 18: 11, 19: 14, 20: 10, 21: 6, 22: 3,
  };
  const activity: RealtimeActivityResponse["activity"] = [];
  let n = 0;
  for (const [hourStr, count] of Object.entries(perHour)) {
    const hour = Number(hourStr);
    for (let i = 0; i < count; i++) {
      n += 1;
      activity.push({
        hour,
        opName: "Loja demo",
        is_returning: n % 3 === 0,
        visitor_id: `demo-visitor-${n}`,
      });
    }
  }
  return { activity, lastUpdate: new Date().toISOString() };
}

export function DashboardDemo() {
  const [queryClient] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          gcTime: Infinity,
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });
    // Pré-carrega as consultas internas do ClientDashboardRedesign.
    qc.setQueryData(["conectados-agora-devices"], mockConectadosAgora);
    qc.setQueryData(["dispositivos-hoje"], mockDispositivosHoje);
    // useAccess() retorna null na landing pública → chave com undefineds.
    qc.setQueryData(
      ["realtime-activity", undefined, undefined, undefined],
      buildMockActivity(),
    );
    return qc;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ClientDashboardRedesign data={mockInsights} isLoading={false} />
    </QueryClientProvider>
  );
}
