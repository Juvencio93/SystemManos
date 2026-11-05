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
 * ConectadosAgoraDevices) e os entregamos ao dashboard, que re-renderiza
 * sozinho. Nenhuma prop nova no componente compartilhado, nenhuma
 * manipulação de DOM, nenhuma verificação interna: a simulação apenas produz
 * seus próprios dados e os exibe — como um SaaS em operação.
 *
 * Regras da simulação:
 * - Tudo começa ZERADO. Quando o painel entra na tela (IntersectionObserver
 *   com threshold baixo + checagem imediata com getBoundingClientRect), os
 *   números contam de 0 até os valores-base (~1,5s, ease-out, leve stagger
 *   entre os cards) e as linhas da tabela entram uma a uma.
 * - Depois do count-up, um único setInterval de 7,5s mantém a simulação ao
 *   vivo; cleanup no unmount.
 * - ZERO .focus(), ZERO scrollIntoView(), ZERO comando de rolagem.
 * - Respeita prefers-reduced-motion (sem animação; ficam os valores finais).
 * - CACHE LOCAL: o estado é salvo em localStorage a cada tick (chave
 *   "manos:live-demo", com o dia). Ao carregar, se houver cache válido DO
 *   MESMO DIA, a simulação retoma de onde parou — sem recomeçar do zero e
 *   sem count-up. Cache de outro dia é descartado. Tudo roda 100% no
 *   navegador: zero carga no servidor. Falha de localStorage nunca quebra
 *   a página (try/catch em volta de tudo).
 * - CALIBRAGEM (operação real, não números explodindo):
 *   - "Acessos hoje" e "Base de clientes": +1 por tick, com TRAVA SUAVE em
 *     base+40 (param em 87 e 358). A última barra do gráfico é o "Acessos
 *     hoje" e acompanha o card. "Sua base cresceu N esta semana" deriva da
 *     base: 11 + (base − 318).
 *   - "Conectados agora": OSCILA entre 11 e 15 (±1 aleatório por tick) —
 *     gente entra e sai; os sub-contadores "N celulares / N computadores"
 *     acompanham o tipo do dispositivo da vez e a soma é sempre coerente.
 *   - Tabela: cada modelo ENVELHECE (−1 acesso por tick, piso 1) e a linha
 *     nova entra com 4–6 acessos; o teto de 8 modelos descarta o mais antigo
 *     de menor total. Nenhum total passa de ~14 (e cai para a faixa 4–8) —
 *     nada cresce sem limite. A linha nova aparece no top 5 desde o tick 1.
 * - A altura do container é travada (só cresce, nunca encolhe) via
 *   ResizeObserver, para que nenhuma variação interna mova a rolagem da página.
 */

function buildMockChart(): { date: string; total: number }[] {
  // 14 dias de exemplo — valores modestos e fictícios. A última barra é o
  // dia de hoje e vale o mesmo que "Acessos hoje" (BASE_ACESSOS).
  const totals = [22, 28, 25, 31, 29, 35, 41, 33, 38, 44, 40, 47, 43, BASE_ACESSOS];
  return totals.map((total, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (totals.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), total };
  });
}

// Valores-base da demonstração — alvos do count-up e ponto de partida da
// simulação ao vivo. Fonte única de verdade: os mocks abaixo usam estas
// constantes, então o count-up nunca diverge dos dados exibidos.
const BASE_ACESSOS = 47;
const BASE_CONECTADOS = 12;
const BASE_CELULARES = 9;
const BASE_COMPUTADORES = 3;
const BASE_CLIENTES = 318;
const BASE_NOVOS = 11;
const BASE_SEMANA = 280;
const BASE_ANDROID = 20;
const BASE_IOS = 18;
const BASE_DESKTOP = 9;

const baseChart = buildMockChart();

const mockInsights: Insights = {
  role: "matriz",
  showFinance: false,
  periodDate: new Date().toISOString().slice(0, 10),
  leadsBase: BASE_CLIENTES,
  visitantesHoje: BASE_ACESSOS,
  visitantesOntem: 42,
  conectadosAgora: BASE_CONECTADOS,
  totalConexoes: 1240,
  conexoesSemana: BASE_SEMANA,
  conexoesSemanaAnterior: 251,
  recorrentesSemana: 96,
  leadsEmpresa: BASE_CLIENTES,
  leadsNovosSemana: BASE_NOVOS,
  rankingUnidades: [],
  topCampanhaSemana: null,
  melhorDiaSemana: { rotulo: "Sábado", total: BASE_ACESSOS },
  posicaoRede: null,
  horarioPico: "19h",
  horarioPicoTotal: 32,
  devices: { android: BASE_ANDROID, ios: BASE_IOS, desktop: BASE_DESKTOP, outros: 0 },
  campanhasHoje: [],
  campanhaAtiva: null,
  topCampanha: null,
  chart: baseChart,
  finance: null,
  empresasTotal: 1,
  filiaisTotal: 1,
  eventosTotal: 0,
  portaisAtivos: 1,
};

const mockDispositivosHoje: DispositivosHoje = {
  periodDate: new Date().toISOString().slice(0, 10),
  total: BASE_ACESSOS,
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

const mockConectadosAgora: ConectadosAgoraDevices = {
  celular: BASE_CELULARES,
  computador: BASE_COMPUTADORES,
};

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

// Calibragem da tabela (operação real):
// - Todo modelo ENVELHECE: perde 1 acesso por tick, com piso 1 — o aparelho
//   vai "saindo da rede" aos poucos em vez de acumular acessos para sempre.
// - A linha nova entra com 4–6 acessos: o menor valor que a mantém visível
//   no top 5 (o componente ordena por total decrescente e exibe só as 5
//   maiores) sem inflar nada. Entrar com 1–3 a deixaria invisível por
//   minutos e faria o pool colapsar para 2–3 linhas; 4–6 mantém a tabela
//   cheia (5 linhas) com totais modestos e limitados (máx. inicial 14,
//   caindo para a faixa 4–8 — nunca acima de ~20, nunca crescendo sem fim).
// - O teto de 8 modelos descarta o de menor total (mais antigo entre os
//   empates), então o pool nunca esvazia nem enche demais.
const NEW_MODEL_TOTAL_MIN = 4;
const NEW_MODEL_TOTAL_MAX = 6;

// "Conectados agora" oscila entre 11 e 15 — gente entra e sai do local.
const CONECTADOS_MIN = 11;
const CONECTADOS_MAX = 15;

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
 * Modelo de envelhecimento (nada infla sem limite):
 * 1. Cada modelo existente perde 1 acesso (piso 1 — não some por
 *    envelhecimento; sai só pelo teto de 8, o mais antigo de menor total).
 * 2. O modelo sorteado entra com 4–6 acessos (se já estava na lista, sai e
 *    volta novo — "reconectou"). Como o dashboard exibe o top 5 por total,
 *    esse valor o mantém visível desde o primeiro tick.
 * 3. O pool é cortado em 8 pelo menor total (mais antigo entre os empates).
 * Os contadores (total/celular/computador/android/ios) sobem só +1 — um
 * aparelho novo, um acesso novo no acumulado do dia.
 */
function nextLiveDevices(prev: DispositivosHoje, pick: LiveModel): DispositivosHoje {
  const all: { modelo: string; sistema: LiveSistema; total: number }[] = [
    ...prev.modelosIos.map((m) => ({ ...m, sistema: "iOS" as LiveSistema })),
    ...prev.modelosAndroid.map((m) => ({ ...m, sistema: "Android" as LiveSistema })),
    ...prev.modelosComputador.map((m) => ({ ...m, sistema: "Computador" as LiveSistema })),
  ];

  // 1. Envelhecimento: −1 acesso por modelo, com piso 1.
  for (const m of all) m.total = Math.max(1, m.total - 1);

  // 2. Modelo novo no topo (ou reconectado, se já estava na lista).
  const at = all.findIndex((m) => m.modelo === pick.modelo && m.sistema === pick.sistema);
  if (at >= 0) all.splice(at, 1);
  const total =
    NEW_MODEL_TOTAL_MIN +
    Math.floor(Math.random() * (NEW_MODEL_TOTAL_MAX - NEW_MODEL_TOTAL_MIN + 1));
  all.unshift({ modelo: pick.modelo, sistema: pick.sistema, total });

  // 3. Teto de 8: descarta os de menor total (mais antigos entre os empates).
  const kept = [...all].sort((a, b) => b.total - a.total).slice(0, MAX_MODELS);

  const toList = (sistema: LiveSistema) =>
    kept
      .filter((m) => m.sistema === sistema)
      .map(({ modelo, total: t }) => ({ modelo, total: t }));

  const isPc = pick.sistema === "Computador";
  const isIos = pick.sistema === "iOS";
  return {
    ...prev,
    // Contadores do dia, com a mesma trava suave (base+40) dos cards.
    total: Math.min(prev.total + 1, CAP_DEV_TOTAL),
    celular: Math.min(prev.celular + (isPc ? 0 : 1), CAP_DEV_CELULAR),
    computador: Math.min(prev.computador + (isPc ? 1 : 0), CAP_DEV_COMPUTADOR),
    android: Math.min(prev.android + (isPc || isIos ? 0 : 1), CAP_DEV_ANDROID),
    ios: Math.min(prev.ios + (isIos ? 1 : 0), CAP_DEV_IOS),
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

/* ============ Count-up do zero + cache local (localStorage) ============ */

// Tudo começa ZERADO: quando o usuário rola até o painel, os números contam
// de 0 até os valores-base (~1,5s, ease-out, leve stagger entre os cards) e
// as linhas da tabela entram uma a uma. Depois do count-up, a simulação ao
// vivo continua (oscilação 11–15, +1/7,5s, envelhecimento de linhas).
//
// Cache no aparelho do usuário: o estado da simulação é salvo em
// localStorage a cada tick (nunca a cada frame do count-up) e, ao carregar a
// página, se houver cache válido DO MESMO DIA, a simulação retoma de onde
// parou — sem recomeçar do zero e sem count-up. Cache de outro dia é
// descartado. Tudo roda 100% no navegador: zero carga no servidor.
// Qualquer falha de localStorage (ex.: modo privado) é engolida — a página
// nunca quebra por causa do cache.
const CACHE_KEY = "manos:live-demo";
const COUNTUP_MS = 1500;

// Travas suaves: os acumulados param em base+40 e nunca explodem.
const CAP_ACESSOS = BASE_ACESSOS + 40; // 87
const CAP_BASE = BASE_CLIENTES + 40; // 358
const CAP_SEMANA = BASE_SEMANA + 40; // 320
const CAP_DEV_TOTAL = BASE_ACESSOS + 40;
const CAP_DEV_CELULAR = mockDispositivosHoje.celular + 40;
const CAP_DEV_COMPUTADOR = mockDispositivosHoje.computador + 40;
const CAP_DEV_ANDROID = BASE_ANDROID + 40;
const CAP_DEV_IOS = BASE_IOS + 40;

// Estado zerado (o que o usuário vê antes de rolar até o painel).
const zeroChart = baseChart.map((d, i, arr) =>
  i === arr.length - 1 ? { ...d, total: 0 } : d,
);
const zeroInsights: Insights = {
  ...mockInsights,
  visitantesHoje: 0,
  conectadosAgora: 0,
  leadsBase: 0,
  leadsEmpresa: 0,
  leadsNovosSemana: 0,
  totalConexoes: 0,
  conexoesSemana: 0,
  recorrentesSemana: 0,
  melhorDiaSemana: { rotulo: "Sábado", total: 0 },
  horarioPicoTotal: 0,
  devices: { android: 0, ios: 0, desktop: 0, outros: 0 },
  chart: zeroChart,
};
const zeroDispositivosHoje: DispositivosHoje = {
  ...mockDispositivosHoje,
  total: 0,
  celular: 0,
  computador: 0,
  outros: 0,
  android: 0,
  ios: 0,
  modelosAndroid: [],
  modelosIos: [],
  modelosComputador: [],
};
const zeroConectadosAgora: ConectadosAgoraDevices = { celular: 0, computador: 0 };

// Linhas iniciais da tabela, reveladas uma a uma durante o count-up.
const INITIAL_MODELS: readonly { modelo: string; sistema: LiveSistema; total: number }[] = [
  { modelo: "iPhone 13", sistema: "iOS", total: 14 },
  { modelo: "Galaxy A54", sistema: "Android", total: 11 },
  { modelo: "Moto G84", sistema: "Android", total: 8 },
  { modelo: "Dell Inspiron", sistema: "Computador", total: 6 },
  { modelo: "iPhone 11", sistema: "iOS", total: 4 },
];
const REVEAL_MS = [300, 550, 800, 1050, 1300];

type LiveDemoCache = {
  day: string;
  visitantesHoje: number;
  leadsBase: number;
  conexoesSemana: number;
  chartLastTotal: number;
  conectadosAgora: number;
  celulares: number;
  computadores: number;
  devices: DispositivosHoje;
};

function todayKey(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function readCache(): LiveDemoCache | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const c = parsed as Partial<LiveDemoCache>;
    if (c.day !== todayKey()) return null;
    if (
      typeof c.visitantesHoje !== "number" ||
      typeof c.leadsBase !== "number" ||
      typeof c.conexoesSemana !== "number" ||
      typeof c.chartLastTotal !== "number" ||
      typeof c.conectadosAgora !== "number" ||
      typeof c.celulares !== "number" ||
      typeof c.computadores !== "number" ||
      typeof c.devices !== "object" ||
      c.devices === null ||
      !Array.isArray(c.devices.modelosAndroid) ||
      !Array.isArray(c.devices.modelosIos) ||
      !Array.isArray(c.devices.modelosComputador)
    ) {
      return null;
    }
    return c as LiveDemoCache;
  } catch {
    return null;
  }
}

function writeCache(
  ins: Insights,
  dev: DispositivosHoje,
  ag: ConectadosAgoraDevices,
): void {
  try {
    const payload: LiveDemoCache = {
      day: todayKey(),
      visitantesHoje: ins.visitantesHoje,
      leadsBase: ins.leadsBase,
      conexoesSemana: ins.conexoesSemana,
      chartLastTotal: ins.chart[ins.chart.length - 1]?.total ?? ins.visitantesHoje,
      conectadosAgora: ins.conectadosAgora,
      celulares: ag.celular,
      computadores: ag.computador,
      devices: dev,
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível — a simulação continua sem cache.
  }
}

export function DashboardDemo() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Tudo começa ZERADO (SSR/pré-render seguro: nenhum acesso a window aqui).
  // O cache do dia (se houver) é restaurado no effect; sem cache, o count-up
  // anima de 0 até os valores-base quando o painel entra na tela.
  const [liveInsights, setLiveInsights] = useState<Insights>(zeroInsights);
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
    // até o count-up (ou até o cache do dia ser restaurado no effect).
    qc.setQueryData(["conectados-agora-devices"], zeroConectadosAgora);
    qc.setQueryData(["dispositivos-hoje"], zeroDispositivosHoje);
    // useAccess() retorna null na landing pública → chave com undefineds.
    qc.setQueryData(
      ["realtime-activity", undefined, undefined, undefined],
      buildMockActivity(),
    );
    return qc;
  });

  // Fonte da verdade da simulação: refs. Se algum refetch (180s) reescrever
  // o cache das queries, o próximo tick repõe o estado ao vivo a partir daqui.
  const liveDevicesRef = useRef<DispositivosHoje>(zeroDispositivosHoje);
  const liveAgoraRef = useRef<ConectadosAgoraDevices>(zeroConectadosAgora);
  const liveInsightsRef = useRef<Insights>(zeroInsights);
  const lastModelIdxRef = useRef(-1);

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
    let rafId: number | undefined;
    let started = false;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Valores finais direto, sem animação (fim do count-up e reduced-motion).
    const applyBase = () => {
      liveInsightsRef.current = mockInsights;
      setLiveInsights(mockInsights);
      liveDevicesRef.current = mockDispositivosHoje;
      queryClient.setQueryData(["dispositivos-hoje"], mockDispositivosHoje);
      liveAgoraRef.current = mockConectadosAgora;
      queryClient.setQueryData(["conectados-agora-devices"], mockConectadosAgora);
    };

    // Retoma o cache do mesmo dia (se houver): valores do dia, sem count-up.
    // "leadsNovosSemana" deriva da base (11 + base − 318).
    const applyRestored = (c: LiveDemoCache) => {
      const acessos = Math.min(c.visitantesHoje, CAP_ACESSOS);
      const base = Math.min(c.leadsBase, CAP_BASE);
      const semana = Math.min(c.conexoesSemana, CAP_SEMANA);
      const chartLast = Math.min(c.chartLastTotal, CAP_ACESSOS);
      const conectados = Math.min(
        CONECTADOS_MAX,
        Math.max(CONECTADOS_MIN, c.conectadosAgora),
      );
      const next: Insights = {
        ...mockInsights,
        visitantesHoje: acessos,
        leadsBase: base,
        leadsEmpresa: base,
        leadsNovosSemana: BASE_NOVOS + (base - BASE_CLIENTES),
        conexoesSemana: semana,
        conectadosAgora: conectados,
        chart: baseChart.map((d, i, arr) =>
          i === arr.length - 1 ? { ...d, total: chartLast } : d,
        ),
      };
      liveInsightsRef.current = next;
      setLiveInsights(next);
      liveDevicesRef.current = c.devices;
      queryClient.setQueryData(["dispositivos-hoje"], c.devices);
      liveAgoraRef.current = { celular: c.celulares, computador: c.computadores };
      queryClient.setQueryData(["conectados-agora-devices"], liveAgoraRef.current);
    };

    // Cache do dia (se houver) — lido uma vez na montagem. Sem cache (ou
    // cache de outro dia): fica zerado até o count-up.
    const cached = readCache();
    if (cached !== null) {
      applyRestored(cached);
    } else if (reduced) {
      applyBase();
    }

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
      const isPc = pick.sistema === "Computador";

      // "Conectados agora" OSCILA entre 11 e 15: ±1 aleatório, travado no
      // intervalo — gente entra e sai do estabelecimento, não acumula.
      const agoraTotal = liveAgoraRef.current.celular + liveAgoraRef.current.computador;
      const delta = Math.random() < 0.5 ? -1 : 1;
      const nextConectados = Math.min(
        CONECTADOS_MAX,
        Math.max(CONECTADOS_MIN, agoraTotal + delta),
      );
      const effDelta = nextConectados - agoraTotal;

      // Cards principais — com TRAVA SUAVE (base+40): os acumulados param
      // em 87 (acessos) e 358 (base) e nunca explodem. A última barra do
      // gráfico é o "Acessos hoje" e acompanha o card. "Sua base cresceu N
      // esta semana" deriva da base: 11 + (base − 318).
      const prev = liveInsightsRef.current;
      const nextAcessos = Math.min(prev.visitantesHoje + 1, CAP_ACESSOS);
      const nextBase = Math.min(prev.leadsBase + 1, CAP_BASE);
      const nextSemana = Math.min(prev.conexoesSemana + 1, CAP_SEMANA);
      const next: Insights = {
        ...prev,
        visitantesHoje: nextAcessos,
        leadsBase: nextBase,
        leadsEmpresa: nextBase,
        leadsNovosSemana: BASE_NOVOS + (nextBase - BASE_CLIENTES),
        conexoesSemana: nextSemana,
        conectadosAgora: nextConectados,
        chart: prev.chart.map((d, i, arr) =>
          i === arr.length - 1 ? { ...d, total: nextAcessos } : d,
        ),
      };
      liveInsightsRef.current = next;
      setLiveInsights(next);

      // Tabela de dispositivos: linha nova no topo + contadores.
      liveDevicesRef.current = nextLiveDevices(liveDevicesRef.current, pick);
      queryClient.setQueryData(["dispositivos-hoje"], liveDevicesRef.current);

      // Sub-contadores "N celulares / N computadores": a variação efetiva
      // (±1 ou 0, se travou no limite) vai para o tipo do dispositivo da
      // vez; o outro absorve a diferença para a soma continuar coerente
      // com o total oscilado (celulares + computadores === conectadosAgora).
      const agora = liveAgoraRef.current;
      let celular = agora.celular;
      let computador = agora.computador;
      if (isPc) {
        computador = Math.max(0, Math.min(nextConectados, computador + effDelta));
        celular = nextConectados - computador;
      } else {
        celular = Math.max(0, Math.min(nextConectados, celular + effDelta));
        computador = nextConectados - celular;
      }
      liveAgoraRef.current = { celular, computador };
      queryClient.setQueryData(["conectados-agora-devices"], liveAgoraRef.current);

      // Persiste o estado no aparelho do usuário (cache do dia).
      writeCache(liveInsightsRef.current, liveDevicesRef.current, liveAgoraRef.current);
    };

    // Count-up de 0 até os valores-base (~1,5s, ease-out, leve stagger entre
    // os grupos: acessos → conectados → base → semana). A tabela revela as
    // linhas iniciais uma a uma; os contadores acompanham o progresso.
    const runCountUp = (onDone: () => void) => {
      const t0 = performance.now();
      const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
      const prog = (now: number, delay: number) => {
        const p = (now - t0 - delay) / (COUNTUP_MS - delay);
        return easeOut(Math.min(1, Math.max(0, p)));
      };
      const frame = (now: number) => {
        const elapsed = now - t0;
        if (elapsed >= COUNTUP_MS) {
          applyBase();
          writeCache(
            liveInsightsRef.current,
            liveDevicesRef.current,
            liveAgoraRef.current,
          );
          onDone();
          return;
        }
        const pA = prog(now, 0);
        const pC = prog(now, 150);
        const pB = prog(now, 300);
        const pS = prog(now, 450);
        const acessos = Math.round(BASE_ACESSOS * pA);
        const conectados = Math.round(BASE_CONECTADOS * pC);
        const base = Math.round(BASE_CLIENTES * pB);
        const semana = Math.round(BASE_SEMANA * pS);
        const next: Insights = {
          ...mockInsights,
          visitantesHoje: acessos,
          conectadosAgora: conectados,
          leadsBase: base,
          leadsEmpresa: base,
          leadsNovosSemana: Math.round(BASE_NOVOS * pB),
          conexoesSemana: semana,
          totalConexoes: Math.round(1240 * pS),
          recorrentesSemana: Math.round(96 * pS),
          melhorDiaSemana: { rotulo: "Sábado", total: Math.round(BASE_ACESSOS * pS) },
          horarioPicoTotal: Math.round(32 * pS),
          devices: {
            android: Math.round(BASE_ANDROID * pS),
            ios: Math.round(BASE_IOS * pS),
            desktop: Math.round(BASE_DESKTOP * pS),
            outros: 0,
          },
          chart: baseChart.map((d, i, arr) =>
            i === arr.length - 1 ? { ...d, total: acessos } : d,
          ),
        };
        liveInsightsRef.current = next;
        setLiveInsights(next);

        // Tabela: linhas entram uma a uma (fade-in do CSS); os contadores
        // acompanham o progresso do count-up.
        const revealed = INITIAL_MODELS.slice(
          0,
          REVEAL_MS.filter((t) => elapsed >= t).length,
        );
        const dev: DispositivosHoje = {
          ...mockDispositivosHoje,
          total: Math.round(BASE_ACESSOS * pA),
          celular: Math.round(38 * pA),
          computador: Math.round(9 * pA),
          android: Math.round(BASE_ANDROID * pA),
          ios: Math.round(BASE_IOS * pA),
          modelosIos: revealed
            .filter((m) => m.sistema === "iOS")
            .map(({ modelo, total: t }) => ({ modelo, total: t })),
          modelosAndroid: revealed
            .filter((m) => m.sistema === "Android")
            .map(({ modelo, total: t }) => ({ modelo, total: t })),
          modelosComputador: revealed
            .filter((m) => m.sistema === "Computador")
            .map(({ modelo, total: t }) => ({ modelo, total: t })),
        };
        liveDevicesRef.current = dev;
        queryClient.setQueryData(["dispositivos-hoje"], dev);

        const ag: ConectadosAgoraDevices = {
          celular: Math.round(BASE_CELULARES * pC),
          computador: Math.round(BASE_COMPUTADORES * pC),
        };
        liveAgoraRef.current = ag;
        queryClient.setQueryData(["conectados-agora-devices"], ag);

        rafId = requestAnimationFrame(frame);
      };
      rafId = requestAnimationFrame(frame);
    };

    const startLive = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(tick, INTERVAL_MS);
    };

    const start = () => {
      if (started) return;
      started = true;
      observer?.disconnect();
      if (reduced) return; // valores finais já aplicados, sem timers
      if (cached !== null) {
        startLive();
        return;
      }
      runCountUp(() => startLive());
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
      if (rafId !== undefined) cancelAnimationFrame(rafId);
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
