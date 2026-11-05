import { useEffect } from "react";

/**
 * Simulação "live demo" ISOLADA da landing pública.
 *
 * Vive SOMENTE na landing (importado apenas por `dashboard-demo.tsx`) e
 * funciona por manipulação do DOM já renderizado — NUNCA toca no componente
 * compartilhado `ClientDashboardRedesign` (o painel real do cliente).
 *
 * Comportamento:
 * - Um único IntersectionObserver (threshold 0.3) inicia a simulação quando
 *   a seção do painel entra no viewport; dispara uma única vez.
 * - Um único setInterval de 7,5s: +1 em "Acessos hoje", +1 em "Sua base de
 *   clientes", uma nova linha no topo da tabela "Dispositivos conectados
 *   hoje" (prepend) que também soma +1 em "Conectados agora".
 * - Novas linhas têm 4 colunas: Tipo (Celular/Computador) | Sistema
 *   (Android/iOS/Windows) | Modelo em ciano #00e5ff e negrito | +acessos.
 * - Fade-in nas linhas novas; limite de 8 linhas visíveis (a mais antiga
 *   sai com fade-out).
 * - Um MutationObserver reaplica o estado ao vivo caso o React re-renderize
 *   o dashboard (refetch de 60s/180s) e reverta as mutações de DOM.
 * - ZERO .focus(), ZERO scrollIntoView(), ZERO comando de rolagem.
 * - Respeita prefers-reduced-motion (sem animação e sem timers).
 */

const ROTATION: readonly string[] = [
  "Samsung Galaxy S24",
  "iPhone 16 Pro",
  "Xiaomi Poco X6",
  "Galaxy A54",
  "Moto G84",
  "iPhone 13",
  "Dell Inspiron",
  "Redmi Note 13",
  "iPad Air",
];

const INTERVAL_MS = 7500;
const MAX_ROWS = 8;

type Bound = {
  acessos: Text | null;
  conectados: Text | null;
  base: Text | null;
  celulares: Text | null;
  computadores: Text | null;
  tbody: HTMLTableSectionElement | null;
};

type LiveState = {
  acessos: number;
  conectados: number;
  base: number;
  celulares: number;
  computadores: number;
  lastModelIdx: number;
  liveRows: HTMLTableRowElement[];
};

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

function parseNum(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const n = Number.parseInt(text.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function firstTextNode(el: Element | null): Text | null {
  if (el === null) return null;
  for (const node of Array.from(el.childNodes)) {
    if (
      node.nodeType === Node.TEXT_NODE &&
      node.textContent !== null &&
      node.textContent.trim() !== ""
    ) {
      return node as Text;
    }
  }
  return null;
}

/** Encontra o elemento cujo textContent aparado é exatamente o rótulo. */
function findByExactText(root: ParentNode, label: string): Element | null {
  const all = root.querySelectorAll("*");
  for (const el of Array.from(all)) {
    if (el.textContent !== null && el.textContent.trim() === label) return el;
  }
  return null;
}

/** Sobe do título até o ancestral que contém o <p class="font-display"> do número. */
function findNumberText(titleEl: Element | null): Text | null {
  let el: Element | null = titleEl;
  while (el !== null) {
    const p = el.querySelector("p.font-display");
    if (p !== null) return firstTextNode(p);
    el = el.parentElement;
  }
  return null;
}

/** Encontra o tbody da tabela cujo título é `label`. */
function findTbody(root: ParentNode, label: string): HTMLTableSectionElement | null {
  const titleEl = findByExactText(root, label);
  let el: Element | null = titleEl;
  while (el !== null) {
    const tbody = el.querySelector("tbody");
    if (tbody !== null) return tbody;
    el = el.parentElement;
  }
  return null;
}

/** Encontra os nós de texto dos sub-contadores ("9 celulares" / "3 computadores"). */
function findSubCounters(titleEl: Element | null): {
  celulares: Text | null;
  computadores: Text | null;
} {
  let celulares: Text | null = null;
  let computadores: Text | null = null;
  let el: Element | null = titleEl;
  while (el !== null && (celulares === null || computadores === null)) {
    const ps = el.querySelectorAll("p");
    for (const p of Array.from(ps)) {
      const text = p.textContent ?? "";
      if (celulares === null && text.includes("celulares")) celulares = firstTextNode(p);
      if (computadores === null && text.includes("computadores"))
        computadores = firstTextNode(p);
    }
    el = el.parentElement;
  }
  return { celulares, computadores };
}

function bind(root: ParentNode): Bound {
  const acessosTitle = findByExactText(root, "Acessos hoje");
  const conectadosTitle = findByExactText(root, "Conectados agora");
  const baseTitle = findByExactText(root, "Sua base de clientes");
  const sub = findSubCounters(conectadosTitle);
  return {
    acessos: findNumberText(acessosTitle),
    conectados: findNumberText(conectadosTitle),
    base: findNumberText(baseTitle),
    celulares: sub.celulares,
    computadores: sub.computadores,
    tbody: findTbody(root, "Dispositivos conectados hoje"),
  };
}

function setNumber(node: Text | null, value: number): void {
  if (node === null) return;
  const text = fmt(value);
  if (node.data !== text) node.data = text;
}

function setSubCount(node: Text | null, value: number, word: string): void {
  if (node === null) return;
  const text = ` ${value} ${word}`;
  if (node.data !== text) node.data = text;
}

function nextModel(lastIdx: number): { modelo: string; idx: number } {
  let idx = Math.floor(Math.random() * ROTATION.length);
  let guard = 0;
  while (idx === lastIdx && guard < 10) {
    idx = Math.floor(Math.random() * ROTATION.length);
    guard += 1;
  }
  const modelo = ROTATION[idx] ?? ROTATION[0] ?? "iPhone 13";
  return { modelo, idx };
}

function buildRow(modelo: string, sistema: string, tipo: string, total: number): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = "border-b border-white/5 last:border-0";
  tr.setAttribute("data-live-row", "1");
  tr.style.opacity = "0";
  tr.style.transition = "opacity 0.6s ease";
  // 4 colunas idênticas ao design original da tabela. O modelo vai em ciano
  // via style inline (a classe arbitrária text-[#00e5ff] pode não existir no
  // CSS gerado pelo Tailwind).
  tr.innerHTML =
    `<td class="py-2.5 pr-2"><span class="flex items-center gap-2 font-medium">${tipo}</span></td>` +
    `<td class="py-2.5 pr-2"><span class="flex items-center gap-1.5 text-muted-foreground">${sistema}</span></td>` +
    `<td class="py-2.5 pr-2 font-bold" style="color:#00e5ff">${modelo}</td>` +
    `<td class="py-2.5 text-right"><span class="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">+${total}</span></td>`;
  return tr;
}

export function useLandingLiveDemo(rootRef: {
  readonly current: HTMLDivElement | null;
}): void {
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    let intervalId: number | null = null;
    let mutationObserver: MutationObserver | null = null;
    let started = false;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting === true && !started) {
          started = true;
          io.disconnect();
          start();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(root);

    function start(): void {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Re-lê o ref aqui: o narrowing do early return do effect não vale
      // dentro deste closure — e `function` declarations são hoistadas, então
      // o narrowing também não valeria dentro de reapply(). Por isso o tipo
      // explícito (sem null) após o guard.
      const rootElRaw = rootRef.current;
      if (rootElRaw === null) return;
      const rootEl: HTMLDivElement = rootElRaw;

      const bound: Bound = bind(rootEl);
      const state: LiveState = {
        acessos: parseNum(bound.acessos?.data) ?? 47,
        conectados: parseNum(bound.conectados?.data) ?? 12,
        base: parseNum(bound.base?.data) ?? 318,
        celulares: parseNum(bound.celulares?.data) ?? 9,
        computadores: parseNum(bound.computadores?.data) ?? 3,
        lastModelIdx: -1,
        liveRows: [],
      };

      function enforceLimit(): void {
        const tbody = bound.tbody;
        if (tbody === null) return;
        if (tbody.rows.length > MAX_ROWS) {
          const last = tbody.rows[tbody.rows.length - 1];
          if (last === undefined) return;
          // Tira do rastreamento ANTES de remover do DOM, senão o
          // MutationObserver a ressuscitaria.
          state.liveRows = state.liveRows.filter((r) => r !== last);
          last.style.transition = "opacity 0.35s ease";
          last.style.opacity = "0";
          const el: HTMLTableRowElement = last;
          window.setTimeout(() => {
            el.remove();
          }, 350);
        }
      }

      function reapply(): void {
        // Se o React trocou os nós (re-render), re-vincula e reaplica tudo.
        if (
          (bound.acessos !== null && !bound.acessos.isConnected) ||
          (bound.tbody !== null && !bound.tbody.isConnected)
        ) {
          const fresh = bind(rootEl);
          bound.acessos = fresh.acessos;
          bound.conectados = fresh.conectados;
          bound.base = fresh.base;
          bound.celulares = fresh.celulares;
          bound.computadores = fresh.computadores;
          bound.tbody = fresh.tbody;
        }
        setNumber(bound.acessos, state.acessos);
        setNumber(bound.conectados, state.conectados);
        setNumber(bound.base, state.base);
        setSubCount(bound.celulares, state.celulares, "celulares");
        setSubCount(bound.computadores, state.computadores, "computadores");
        const tbody = bound.tbody;
        if (tbody !== null && state.liveRows.length > 0) {
          const present = new Set(Array.from(tbody.children));
          // Re-insere as que faltam, da mais antiga para a mais nova
          // (prepend inverte a ordem, então o resultado fica newest-first).
          for (let i = state.liveRows.length - 1; i >= 0; i--) {
            const row = state.liveRows[i];
            if (row !== undefined && !present.has(row)) {
              row.style.opacity = "1";
              tbody.prepend(row);
            }
          }
          enforceLimit();
        }
      }

      function tick(): void {
        state.acessos += 1;
        state.base += 1;
        setNumber(bound.acessos, state.acessos);
        setNumber(bound.base, state.base);

        const { modelo, idx } = nextModel(state.lastModelIdx);
        state.lastModelIdx = idx;
        const isPc = modelo.includes("Dell");
        const tipo = isPc ? "Computador" : "Celular";
        const sistema = isPc ? "Windows" : Math.random() < 0.5 ? "Android" : "iOS";
        const total = 1 + Math.floor(Math.random() * 3);

        const tr = buildRow(modelo, sistema, tipo, total);
        if (bound.tbody !== null) {
          bound.tbody.prepend(tr);
          state.liveRows.unshift(tr);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              tr.style.opacity = "1";
            });
          });
          enforceLimit();
        }

        state.conectados += 1;
        setNumber(bound.conectados, state.conectados);
        if (isPc) {
          state.computadores += 1;
          setSubCount(bound.computadores, state.computadores, "computadores");
        } else {
          state.celulares += 1;
          setSubCount(bound.celulares, state.celulares, "celulares");
        }
      }

      if ("MutationObserver" in window) {
        mutationObserver = new MutationObserver(() => {
          reapply();
        });
        mutationObserver.observe(rootEl, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      intervalId = window.setInterval(tick, INTERVAL_MS);
    }

    return () => {
      io.disconnect();
      if (intervalId !== null) window.clearInterval(intervalId);
      mutationObserver?.disconnect();
    };
  }, [rootRef]);
}
