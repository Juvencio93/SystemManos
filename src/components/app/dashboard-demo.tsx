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
 * - CALIBRAGEM (operação real, não números explodindo):
 *   - "Acessos hoje" e "Base de clientes": +1 por tick (acumulado do dia).
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

      // Cards principais: "Acessos hoje" e "Base de clientes" +1 (acumulado
      // do dia — isso é realista); "Conectados agora" oscila.
      setLiveInsights((prev) => ({
        ...prev,
        visitantesHoje: prev.visitantesHoje + 1,
        leadsBase: prev.leadsBase + 1,
        leadsEmpresa: prev.leadsEmpresa + 1,
        conectadosAgora: nextConectados,
        conexoesSemana: prev.conexoesSemana + 1,
      }));

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
