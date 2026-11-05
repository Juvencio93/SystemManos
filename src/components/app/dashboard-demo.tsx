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
 * ESTADO: produzimos NOVOS objetos de dados (Insights + DispositivosHoje +
 * ConectadosAgoraDevices + atividade) e os entregamos ao dashboard, que
 * re-renderiza sozinho. Nenhuma prop nova no componente compartilhado, nenhuma
 * manipulação de DOM, nenhuma verificação interna: a simulação apenas produz
 * seus próprios dados e os exibe — como um SaaS em operação.
 *
 * MODELO — UMA única fonte de verdade (`LiveState`), tudo derivado dela:
 * - Tudo começa ZERADO. NADA de count-up rápido: os números sobem UM POR
 *   VEZ, devagar — 1 tick a cada 15s. O visitante que fica 2 minutos vê o
 *   número ir de 0 a ~8, como um lugar real acumulando movimento.
 * - Cada tick = +1 acesso. Esse +1 acesso se reflete em TODOS os lugares:
 *   - Gráfico "Movimento dos últimos 14 dias": a última barra (hoje) É o
 *     "Acessos hoje", sempre igual. Os outros 13 dias são histórico fixo.
 *   - Tabela "Dispositivos conectados hoje": o acesso vai para UM aparelho —
 *     ou um aparelho novo entra (com 1 acesso) ou um que já está lá soma +1.
 *     MÁXIMO 5 aparelhos distintos; a SOMA dos acessos da tabela é SEMPRE
 *     igual a "Acessos hoje". Nada de totais inflados.
 *   - "Base de clientes": ~70% dos acessos do dia — os clientes que
 *     aceitaram receber mensagens (opt-in): base = Math.round(acessos * 0.7).
 *     Com 0 acessos, 0; com 10 acessos, 7. "Sua base cresceu N esta semana"
 *     = base atual (N = base).
 *   - "Conectados agora": começa em 0, +1 a cada 2 ticks até 12, depois
 *     OSCILA ±1 entre 11 e 15. Sempre igual a celulares + computadores
 *     (~75% celulares / ~25% computadores).
 *   - "Sua rede em resumo": os acessos do resumo SÃO os "Acessos hoje"
 *     (nascem em 0 e sobem junto com o resto — nenhum valor fixo
 *     pré-preenchido); os conectados do resumo são o "Conectados agora"
 *     atual; o pico é o pico ao vivo (com 0 acessos, "—").
 *   - "Calor do Momento" e "Horário de pico": cada acesso gera 1 entrada de
 *     atividade na hora atual — o mapa e o pico derivam dos acessos reais da
 *     simulação. Com 0 acessos, o mapa fica vazio e o pico indefinido ("—").
 * - SEMPRE ZERADO AO CARREGAR: toda visita começa do zero, sem exceção
 *   — nenhum estado de visita anterior é restaurado. Tudo roda 100% no
 *   navegador: zero carga no servidor.
 * - TRAVAS SUAVES: acessos param em ~120, base em ~40 (tetos de segurança
 *   que uma visita realista não alcança em poucos minutos).
 * - A altura do container é travada (só cresce, nunca encolhe) via
 *   ResizeObserver, para que nenhuma variação interna mova a rolagem da página.
 * - ZERO .focus(), ZERO scrollIntoView(), ZERO comando de rolagem.
 * - Respeita prefers-reduced-motion: sem animação CSS (o fade-in das linhas
 *   só existe com `no-preference`); os ticks lentos continuam — são
 *   atualização de dados, não animação. Todo mundo nasce em 0, sem exceção.
 */

// Histórico fixo dos 13 dias anteriores ao dia de hoje. A última barra do
// gráfico (hoje) é a única que se move — ela É o "Acessos hoje".
const HISTORICAL_TOTALS: readonly number[] = [
  22, 28, 25, 31, 29, 35, 41, 33, 38, 44, 40, 47, 43,
];
// Ritmo: 1 acesso a cada 15 segundos. Quem fica 2 minutos vê 0→~8.
const INTERVAL_MS = 15000;

// Travas suaves (tetos de segurança, não metas).
const CAP_ACESSOS = 120;

// "Conectados agora": rampa até 12, depois oscila entre 11 e 15.
const CONECTADOS_RAMP = 12;
const CONECTADOS_MIN = 11;
const CONECTADOS_MAX = 15;

// Tabela: no máximo 5 aparelhos distintos.
const MAX_DEVICES = 5;

const TODAY = new Date().toISOString().slice(0, 10);

type LiveSistema = "iOS" | "Android" | "Computador";
type LiveModel = { modelo: string; sistema: LiveSistema };
type LiveDevice = { modelo: string; sistema: LiveSistema; total: number };
type LiveActivityEntry = {
  hour: number;
  opName: string;
  is_returning: boolean;
  visitor_id: string;
};

/**
 * ÚNICA fonte de verdade da simulação. Tudo o que o painel exibe deriva
 * daqui — nenhum número é guardado em dois lugares.
 */
type LiveState = {
  tick: number;
  acessos: number;
  base: number;
  conectados: number;
  celulares: number;
  computadores: number;
  devices: LiveDevice[];
  activity: LiveActivityEntry[];
  lastModelIdx: number;
};

const ZERO_LIVE: LiveState = {
  tick: 0,
  acessos: 0,
  base: 0,
  conectados: 0,
  celulares: 0,
  computadores: 0,
  devices: [],
  activity: [],
  lastModelIdx: -1,
};

// Campos do Insights que nunca mudam na simulação (histórico / estrutura).
const STATIC_INSIGHTS = {
  role: "matriz" as const,
  showFinance: false,
  periodDate: TODAY,
  visitantesOntem: 42,
  conexoesSemanaAnterior: 251,
  rankingUnidades: [] as Insights["rankingUnidades"],
  topCampanhaSemana: null,
  posicaoRede: null,
  campanhasHoje: [] as Insights["campanhasHoje"],
  campanhaAtiva: null,
  topCampanha: null,
  finance: null,
  empresasTotal: 1,
  filiaisTotal: 1,
  eventosTotal: 0,
  portaisAtivos: 1,
};

// Modelos em rotação (sem repetir o último sorteado).
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

const ROTATION_FALLBACK: LiveModel = {
  modelo: "Samsung Galaxy S24",
  sistema: "Android",
};

/* ================= Derivações (tudo calculado a partir do LiveState) ================= */

function buildChart(acessos: number): { date: string; total: number }[] {
  const totals = [...HISTORICAL_TOTALS, acessos];
  return totals.map((total, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (totals.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), total };
  });
}

const WEEKDAY_PT_BR: readonly string[] = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function weekdayPtBr(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return WEEKDAY_PT_BR[new Date(y, m - 1, d).getDay()] ?? "Sábado";
}

/** Melhor dia da semana = a maior barra do gráfico (desempate: o mais recente). */
function bestDay(
  chart: { date: string; total: number }[],
): { rotulo: string; total: number } | null {
  let best: { date: string; total: number } | null = null;
  for (const entry of chart) {
    if (best === null || entry.total >= best.total) best = entry;
  }
  if (best === null) return null;
  return { rotulo: weekdayPtBr(best.date), total: best.total };
}

/** Horário de pico = a hora com mais entradas de atividade. Sem atividade: "—". */
function peakFromActivity(
  activity: LiveActivityEntry[],
): { pico: string; total: number } {
  if (activity.length === 0) return { pico: "—", total: 0 };
  const counts = new Map<number, number>();
  for (const a of activity) {
    counts.set(a.hour, (counts.get(a.hour) ?? 0) + 1);
  }
  let bestHour = -1;
  let bestCount = 0;
  for (const [hour, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestHour = hour;
    }
  }
  return { pico: `${bestHour}h`, total: bestCount };
}

function deviceSums(devices: LiveDevice[]): {
  android: number;
  ios: number;
  desktop: number;
} {
  let android = 0;
  let ios = 0;
  let desktop = 0;
  for (const d of devices) {
    if (d.sistema === "Android") android += d.total;
    else if (d.sistema === "iOS") ios += d.total;
    else desktop += d.total;
  }
  return { android, ios, desktop };
}

function insightsFromLive(live: LiveState): Insights {
  const chart = buildChart(live.acessos);
  const peak = peakFromActivity(live.activity);
  const sums = deviceSums(live.devices);
  return {
    ...STATIC_INSIGHTS,
    visitantesHoje: live.acessos,
    conectadosAgora: live.conectados,
    // Total de conexões acumulado (base histórica + acessos de hoje).
    totalConexoes: 1240 + live.acessos,
    // Resumo da semana = acessos de hoje (nasce 0, sobe junto com o resto).
    conexoesSemana: live.acessos,
    recorrentesSemana: live.activity.filter((a) => a.is_returning).length,
    leadsBase: live.base,
    leadsEmpresa: live.base,
    // "Sua base cresceu N esta semana" = o quanto a base cresceu desde o zero.
    leadsNovosSemana: live.base,
    melhorDiaSemana: bestDay(chart),
    horarioPico: peak.pico,
    horarioPicoTotal: peak.total,
    devices: { android: sums.android, ios: sums.ios, desktop: sums.desktop, outros: 0 },
    chart,
  };
}

function devicesFromLive(live: LiveState): DispositivosHoje {
  const sums = deviceSums(live.devices);
  const list = (sistema: LiveSistema) =>
    live.devices
      .filter((d) => d.sistema === sistema)
      .map(({ modelo, total }) => ({ modelo, total }));
  return {
    periodDate: TODAY,
    total: live.acessos,
    celular: sums.android + sums.ios,
    computador: sums.desktop,
    outros: 0,
    android: sums.android,
    ios: sums.ios,
    modelosAndroid: list("Android"),
    modelosIos: list("iOS"),
    modelosComputador: list("Computador"),
  };
}

/* ================= Redutor do tick (o coração da simulação) ================= */

function addConnection(
  celulares: number,
  computadores: number,
): { celulares: number; computadores: number } {
  // ~75% celulares / ~25% computadores.
  return Math.random() < 0.75
    ? { celulares: celulares + 1, computadores }
    : { celulares, computadores: computadores + 1 };
}

function removeConnection(
  celulares: number,
  computadores: number,
): { celulares: number; computadores: number } {
  const total = celulares + computadores;
  if (total <= 0) return { celulares, computadores };
  // Remove ponderado pela quantidade atual — mantém a proporção ~75/25.
  return Math.random() * total < celulares
    ? { celulares: celulares - 1, computadores }
    : { celulares, computadores: computadores - 1 };
}

type ConectadosSplit = {
  conectados: number;
  celulares: number;
  computadores: number;
};

/** Oscila ±1 entre 11 e 15 (gente entra e sai). Retorna o split coerente. */
function oscillateConectados(s: ConectadosSplit): ConectadosSplit {
  const delta = Math.random() < 0.5 ? -1 : 1;
  const next = Math.min(
    CONECTADOS_MAX,
    Math.max(CONECTADOS_MIN, s.conectados + delta),
  );
  const eff = next - s.conectados;
  if (eff === 1) {
    const r = addConnection(s.celulares, s.computadores);
    return { conectados: next, ...r };
  }
  if (eff === -1) {
    const r = removeConnection(s.celulares, s.computadores);
    return { conectados: next, ...r };
  }
  return { ...s, conectados: next };
}

/** Rampa até 12 (+1 a cada 2 ticks) e depois oscila entre 11 e 15. */
function stepConectados(
  s: ConectadosSplit,
  tick: number,
): ConectadosSplit {
  if (s.conectados < CONECTADOS_RAMP) {
    if (tick % 2 === 0) {
      const r = addConnection(s.celulares, s.computadores);
      return { conectados: s.conectados + 1, ...r };
    }
    return { ...s };
  }
  return oscillateConectados(s);
}

/**
 * Um acesso vai para UM aparelho: enquanto houver menos de 5 aparelhos
 * distintos, um aparelho novo entra (com 1 acesso); com 5 aparelhos, o
 * acesso soma +1 num aparelho que já está lá. A soma dos totais da tabela
 * é SEMPRE igual a "Acessos hoje" — nada entra, nada some, nada infla.
 * O modelo novo nunca repete o último sorteado NEM um modelo que já está
 * na tabela (a chave da linha é `${sistema}-${modelo}` — duplicata quebraria
 * a renderização).
 */
function nextDevices(
  pool: LiveDevice[],
  lastIdx: number,
): { devices: LiveDevice[]; lastModelIdx: number } {
  if (pool.length < MAX_DEVICES) {
    const inPool = new Set(pool.map((d) => `${d.sistema}|${d.modelo}`));
    let idx = Math.floor(Math.random() * ROTATION.length);
    let guard = 0;
    while (
      (idx === lastIdx ||
        inPool.has(
          `${ROTATION[idx]?.sistema ?? ""}|${ROTATION[idx]?.modelo ?? ""}`,
        )) &&
      guard < 50
    ) {
      idx = Math.floor(Math.random() * ROTATION.length);
      guard += 1;
    }
    const pick = ROTATION[idx] ?? ROTATION_FALLBACK;
    // Se por acaso o sorteio não achou modelo livre (pool quase cheio de
    // todos os modelos da rotação), soma +1 num aparelho existente.
    if (inPool.has(`${pick.sistema}|${pick.modelo}`)) {
      const i = Math.floor(Math.random() * pool.length);
      return {
        devices: pool.map((d, j) =>
          j === i ? { ...d, total: d.total + 1 } : d,
        ),
        lastModelIdx: lastIdx,
      };
    }
    return {
      devices: [...pool, { modelo: pick.modelo, sistema: pick.sistema, total: 1 }],
      lastModelIdx: idx,
    };
  }
  const i = Math.floor(Math.random() * pool.length);
  const devices = pool.map((d, j) =>
    j === i ? { ...d, total: d.total + 1 } : d,
  );
  return { devices, lastModelIdx: lastIdx };
}

/**
 * Um tick = +1 acesso, e esse +1 se espalha por TODOS os lugares coerentes:
 * tabela (+1 num aparelho), atividade (+1 entrada na hora atual), base
 * (~70% dos acessos, opt-in), conectados (rampa/oscilação). O gráfico, o
 * resumo da semana, o "cresceu N" e o pico derivam desses valores — nunca
 * são guardados à parte.
 */
function nextLive(prev: LiveState): LiveState {
  // Trava de segurança: acessos parados em ~120. "Conectados agora"
  // continua oscilando (gente entra e sai), mas nada mais acumula.
  if (prev.acessos >= CAP_ACESSOS) {
    const split = oscillateConectados(prev);
    return {
      ...prev,
      tick: prev.tick + 1,
      conectados: split.conectados,
      celulares: split.celulares,
      computadores: split.computadores,
    };
  }
  const tick = prev.tick + 1;
  const acessos = prev.acessos + 1;
  // Base = ~70% dos acessos do dia (clientes que aceitaram receber
  // mensagens — opt-in). Derivada dos acessos, nunca contador separado.
  const base = Math.round(acessos * 0.7);
  const split = stepConectados(prev, tick);
  const { devices, lastModelIdx } = nextDevices(prev.devices, prev.lastModelIdx);
  const hour = new Date().getHours();
  const activity: LiveActivityEntry[] = [
    ...prev.activity,
    {
      hour,
      opName: "Loja demo",
      is_returning: acessos % 3 === 0,
      visitor_id: `demo-visitor-${acessos}`,
    },
  ];
  return {
    tick,
    acessos,
    base,
    conectados: split.conectados,
    celulares: split.celulares,
    computadores: split.computadores,
    devices,
    activity,
    lastModelIdx,
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
  // Tudo começa ZERADO (SSR/pré-render seguro: nenhum acesso a window aqui).
  // Os números sobem um por vez, a cada 15s, quando o painel entra na tela.
  const [liveInsights, setLiveInsights] = useState<Insights>(() =>
    insightsFromLive(ZERO_LIVE),
  );
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
    // Pré-carrega as consultas internas do ClientDashboardRedesign — zeradas
    // até os ticks começarem.
    qc.setQueryData(["conectados-agora-devices"], { celular: 0, computador: 0 });
    qc.setQueryData(["dispositivos-hoje"], devicesFromLive(ZERO_LIVE));
    // useAccess() retorna null na landing pública → chave com undefineds.
    qc.setQueryData(["realtime-activity", undefined, undefined, undefined], {
      activity: [],
      lastUpdate: new Date().toISOString(),
    } satisfies RealtimeActivityResponse);
    return qc;
  });

  // Fonte da verdade da simulação: UM ref com o LiveState. Se algum refetch
  // (180s) reescrever o cache das queries, o próximo tick repõe o estado ao
  // vivo a partir daqui.
  const liveRef = useRef<LiveState>(ZERO_LIVE);

  // Trava de altura do painel (anti-pulo de rolagem): a altura mínima do
  // container só cresce, nunca encolhe. Se qualquer conteúdo interno
  // encolher por um instante (ex: a tabela trocando de 5 linhas pela
  // mensagem "nenhum dispositivo" num refetch), a página não se move —
  // o container mantém a altura e nada acima/abaixo dele desloca.
  // min-height nunca corta conteúdo: se o painel precisar crescer, cresce.
  const [panelMinHeight, setPanelMinHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = panelRef.current;
    if (el === null) return;
    const measure = () => {
      const h = el.offsetHeight;
      setPanelMinHeight((prev) => (prev === undefined ? h : Math.max(prev, h)));
    };
    measure();
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (el === null) return;

    let intervalId: number | undefined;
    let observer: IntersectionObserver | undefined;
    let started = false;

    // Aplica um LiveState em TODOS os lugares (cards + tabela + calor + pico):
    // deriva Insights + queries a partir da única fonte de verdade.
    const applyLive = (live: LiveState) => {
      liveRef.current = live;
      setLiveInsights(insightsFromLive(live));
      queryClient.setQueryData(["dispositivos-hoje"], devicesFromLive(live));
      queryClient.setQueryData(["conectados-agora-devices"], {
        celular: live.celulares,
        computador: live.computadores,
      } satisfies ConectadosAgoraDevices);
      queryClient.setQueryData(
        ["realtime-activity", undefined, undefined, undefined],
        {
          activity: live.activity,
          lastUpdate: new Date().toISOString(),
        } satisfies RealtimeActivityResponse,
      );
    };

    // Sempre zerado ao carregar: nada de visita anterior é restaurado.
    // (O estado inicial já é ZERO_LIVE; os ticks começam só quando o painel
    // entra na tela. Sem snapshot, sem exceção — nem com redução de movimento.)

    const tick = () => {
      const next = nextLive(liveRef.current);
      applyLive(next);
    };

    const startLive = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(tick, INTERVAL_MS);
    };

    const start = () => {
      if (started) return;
      started = true;
      observer?.disconnect();
      startLive();
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
      <div
        ref={panelRef}
        className="live-demo-panel"
        style={panelMinHeight !== undefined ? { minHeight: panelMinHeight } : undefined}
      >
        <ClientDashboardRedesign data={liveInsights} isLoading={false} />
      </div>
    </QueryClientProvider>
  );
}
