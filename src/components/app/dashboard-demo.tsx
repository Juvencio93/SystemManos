import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientDashboardRedesign } from "./dashboard/ClientDashboardRedesign";
import type { Insights } from "@/lib/insights.server";
import type {
  ConectadosAgoraDevices,
  DispositivosHoje,
} from "@/lib/device.functions";
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
 *
 * Simulação "live demo" — SÓ existe aqui, na landing. É uma simulação por
 * ESTADO: a cada 7,5s produzimos NOVOS objetos de dados (Insights +
 * DispositivosHoje + ConectadosAgoraDevices) e os entregamos ao dashboard,
 * que re-renderiza sozinho. Nenhuma prop nova no componente compartilhado,
 * nenhuma manipulação de DOM, nenhuma verificação interna: a simulação apenas
 * produz seus próprios dados e os exibe — como um SaaS em operação.
 *
 * Regras da simulação:
 * - Só começa quando o painel entra na tela (IntersectionObserver com
 *   threshold baixo + checagem imediata com getBoundingClientRect).
 * - Um único setInterval de 7,5s; cleanup no unmount.
 * - ZERO .focus(), ZERO scrollIntoView(), ZERO comando de rolagem.
 * - Respeita prefers-reduced-motion (sem timers; ficam os valores iniciais).
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

const mockConectadosAgora: ConectadosAgoraDevices = { celular: 9, computador: 3 };

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

/* ================= Simulação live demo (estado, não DOM) ================= */

const INTERVAL_MS = 7500;
const MAX_MODELS = 8;

type LiveSistema = "iOS" | "Android" | "Computador";
type LiveModel = { modelo: string; sistema: LiveSistema };

// Modelos em rotação (sem repetir o último sorteado). Inclui os que já estão
// na tabela inicial — se o sorteado já estiver na lista, seu total é elevado
// e ele volta ao topo (nunca há duas linhas com a mesma chave).
const ROTATION: readonly LiveModel[] = [
  { modelo: "Samsung Galaxy S24", sistema: "Android" },
  { modelo: "iPhone 16 Pro", sistema: "iOS" },
  { modelo: "Xiaomi Poco X6", sistema: "Android" },
  { modelo: "Galaxy S23", sistema: "Android" },
  { modelo: "iPhone 15", sistema: "iOS" },
  { modelo: "Redmi Note 13", sistema: "Android" },
  { modelo: "iPad Air", sistema: "iOS" },
  { modelo: "Moto G54", sistema: "Android" },
  { modelo: "Galaxy A35", sistema: "Android" },
  { modelo: "iPhone 12", sistema: "iOS" },
  { modelo: "Xiaomi 13T", sistema: "Android" },
  { modelo: "Galaxy Z Flip 5", sistema: "Android" },
  { modelo: "Galaxy A54", sistema: "Android" },
  { modelo: "Moto G84", sistema: "Android" },
  { modelo: "iPhone 13", sistema: "iOS" },
  { modelo: "Dell Inspiron", sistema: "Computador" },
  { modelo: "Lenovo IdeaPad", sistema: "Computador" },
];

const ROTATION_FALLBACK: LiveModel = { modelo: "Samsung Galaxy S24", sistema: "Android" };

/**
 * Produz o próximo estado de DispositivosHoje com um modelo novo no topo.
 *
 * O dashboard ordena as linhas por total (decrescente) e exibe as 5 maiores,
 * então o modelo novo entra com total acima do máximo atual (+1 a +3) para
 * aparecer no topo da tabela. Os contadores (total/celular/computador/
 * android/ios) sobem só +1 — um aparelho novo, um acesso novo. Modelos além
 * do limite são descartados pelo menor total (são também os mais antigos,
 * pois cada modelo novo supera o máximo anterior).
 */
function nextLiveDevices(prev: DispositivosHoje, pick: LiveModel): DispositivosHoje {
  const all: { modelo: string; sistema: LiveSistema; total: number }[] = [
    ...prev.modelosIos.map((m) => ({ ...m, sistema: "iOS" as LiveSistema })),
    ...prev.modelosAndroid.map((m) => ({ ...m, sistema: "Android" as LiveSistema })),
    ...prev.modelosComputador.map((m) => ({ ...m, sistema: "Computador" as LiveSistema })),
  ];
  const maxTotal = all.reduce((acc, m) => Math.max(acc, m.total), 0);
  const total = maxTotal + 1 + Math.floor(Math.random() * 3);

  const existing = all.find((m) => m.modelo === pick.modelo && m.sistema === pick.sistema);
  if (existing) {
    existing.total = total;
  } else {
    all.unshift({ modelo: pick.modelo, sistema: pick.sistema, total });
  }
  const kept = [...all].sort((a, b) => b.total - a.total).slice(0, MAX_MODELS);

  const toList = (sistema: LiveSistema) =>
    kept
      .filter((m) => m.sistema === sistema)
      .map(({ modelo, total: t }) => ({ modelo, total: t }));

  const isPc = pick.sistema === "Computador";
  const isIos = pick.sistema === "iOS";
  return {
    ...prev,
    total: prev.total + 1,
    celular: prev.celular + (isPc ? 0 : 1),
    computador: prev.computador + (isPc ? 1 : 0),
    android: prev.android + (isPc || isIos ? 0 : 1),
    ios: prev.ios + (isIos ? 1 : 0),
    modelosIos: toList("iOS"),
    modelosAndroid: toList("Android"),
    modelosComputador: toList("Computador"),
  };
}

// Fade-in das linhas da tabela do painel. As linhas existentes têm chave
// estável e não remontam, então só a linha nova anima ao entrar. Escopado ao
// container da demo para não tocar nenhuma outra tabela da landing.
const LIVE_DEMO_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .live-demo-panel tbody tr { animation: live-demo-row-in 0.6s ease both; }
}
@keyframes live-demo-row-in { from { opacity: 0; } to { opacity: 1; } }
`;

export function DashboardDemo() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [liveInsights, setLiveInsights] = useState<Insights>(mockInsights);
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

  // Fonte da verdade da simulação: refs. Se algum refetch (180s) reescrever
  // o cache das queries, o próximo tick repõe o estado ao vivo a partir daqui.
  const liveDevicesRef = useRef<DispositivosHoje>(mockDispositivosHoje);
  const liveAgoraRef = useRef<ConectadosAgoraDevices>(mockConectadosAgora);
  const lastModelIdxRef = useRef(-1);

  useEffect(() => {
    const el = panelRef.current;
    if (el === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let intervalId: number | undefined;
    let observer: IntersectionObserver | undefined;
    let started = false;

    const tick = () => {
      // Sorteia o próximo modelo sem repetir o último.
      let idx = Math.floor(Math.random() * ROTATION.length);
      let guard = 0;
      while (idx === lastModelIdxRef.current && guard < 10) {
        idx = Math.floor(Math.random() * ROTATION.length);
        guard += 1;
      }
      lastModelIdxRef.current = idx;
      const pick = ROTATION[idx] ?? ROTATION_FALLBACK;

      // Cards principais: +1 em cada contador.
      setLiveInsights((prev) => ({
        ...prev,
        visitantesHoje: prev.visitantesHoje + 1,
        leadsBase: prev.leadsBase + 1,
        leadsEmpresa: prev.leadsEmpresa + 1,
        conectadosAgora: prev.conectadosAgora + 1,
        conexoesSemana: prev.conexoesSemana + 1,
      }));

      // Tabela de dispositivos: linha nova no topo + contadores.
      liveDevicesRef.current = nextLiveDevices(liveDevicesRef.current, pick);
      queryClient.setQueryData(["dispositivos-hoje"], liveDevicesRef.current);

      // Sub-contadores "N celulares / N computadores" acompanham o tipo.
      const isPc = pick.sistema === "Computador";
      liveAgoraRef.current = {
        celular: liveAgoraRef.current.celular + (isPc ? 0 : 1),
        computador: liveAgoraRef.current.computador + (isPc ? 1 : 0),
      };
      queryClient.setQueryData(["conectados-agora-devices"], liveAgoraRef.current);
    };

    const start = () => {
      if (started) return;
      started = true;
      observer?.disconnect();
      intervalId = window.setInterval(tick, INTERVAL_MS);
    };

    // Checagem imediata: painel já visível na montagem → começa direto.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      start();
    } else if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) start();
        },
        { threshold: 0.05 },
      );
      observer.observe(el);
    } else {
      start();
    }

    return () => {
      observer?.disconnect();
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <style>{LIVE_DEMO_CSS}</style>
      <div ref={panelRef} className="live-demo-panel">
        <ClientDashboardRedesign data={liveInsights} isLoading={false} />
      </div>
    </QueryClientProvider>
  );
}
