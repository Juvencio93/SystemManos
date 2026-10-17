import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  ChartNoAxesCombined,
  CircleDollarSign,
  Megaphone,
  MessageCircle,
  RadioTower,
  Wifi,
} from "lucide-react";
import logo from "@/assets/manos-tech-logo-institutional.png";
import { PreSaleForm } from "@/components/app/pre-sale-form";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ManosTech System | Wi-Fi para clientes com gestão inteligente" },
      {
        name: "description",
        content:
          "Ofereça Wi-Fi para clientes com portal de acesso, controle da rede e informações organizadas para o seu negócio.",
      },
      {
        property: "og:title",
        content: "ManosTech System | Wi-Fi para clientes com gestão inteligente",
      },
      {
        property: "og:description",
        content:
          "Portal de Wi-Fi, divulgação da sua marca e gestão dos acessos em uma plataforma para o seu negócio.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SalesHomePage,
});

const features = [
  {
    icon: Wifi,
    title: "Portal de Wi-Fi com a sua marca",
    body: "Apresente a identidade do negócio e campanhas no acesso à rede para clientes.",
  },
  {
    icon: RadioTower,
    title: "Regras para os acessos",
    body: "Acompanhe e configure parâmetros como tempo e velocidade conforme o equipamento e o plano contratado.",
  },
  {
    icon: Megaphone,
    title: "Divulgação no portal",
    body: "Use banners para destacar produtos, serviços e promoções antes da conexão.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Informações organizadas",
    body: "Consulte relatórios e dados de acesso para apoiar o relacionamento com seus clientes.",
  },
  {
    icon: Building2,
    title: "Visão da operação",
    body: "Gerencie matriz, filiais e equipamentos MikroTik em uma plataforma centralizada.",
  },
  {
    icon: Bot,
    title: "Gerente Operacional IA",
    body: "Faça perguntas sobre a operação e consulte informações disponíveis no sistema.",
  },
];

const commercialTerms = [
  {
    icon: CircleDollarSign,
    title: "Ativação uma única vez",
    body: "O início da operação tem uma taxa de ativação, apresentada na proposta comercial.",
  },
  {
    icon: Check,
    title: "Mensal, sem fidelidade",
    body: "Você paga a mensalidade do plano contratado, sem prazo mínimo de permanência.",
  },
  {
    icon: RadioTower,
    title: "Equipamentos em comodato",
    body: "Quando previsto na proposta, os equipamentos necessários são cedidos em comodato para uso durante a prestação do serviço.",
  },
];

function ScaledPortalFrame({
  src,
  title,
  viewportWidth,
  viewportHeight,
  scrollY = 0,
  className,
}: {
  src: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  scrollY?: number;
  className: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = frameRef.current;
    if (!container) return;
    const updateScale = () =>
      setScale(Math.min(container.clientWidth / viewportWidth, 1));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewportWidth]);

  return (
    <div ref={frameRef} className={`relative overflow-hidden bg-[#070b13] ${className}`}>
      <iframe
        title={title}
        src={src}
        loading="lazy"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 border-0 bg-[#070b13] transition-transform duration-700 ease-in-out"
        style={{
          width: viewportWidth,
          height: viewportHeight,
          transform: `scale(${scale}) translateY(-${scrollY}px)`,
          transformOrigin: "top left",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 z-10" aria-hidden="true" />
    </div>
  );
}

function MobileCheckinDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setStep((current) => (current >= 8 ? 0 : current + 1));
    }, 3400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="relative rounded-[2.45rem] border-[7px] border-slate-700 bg-[#03060b] p-1.5 shadow-[0_28px_70px_rgba(0,0,0,.55)]">
        <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black" />
        <ScaledPortalFrame
          src="https://manostech-system.com.br/portal/6us8mzhk8ffh"
          title="Portal real da Padaria Efraim"
          viewportWidth={390}
          viewportHeight={1300}
          scrollY={[0, 0, 220, 480, 760, 980, 760, 420, 0][step] ?? 0}
          className="aspect-[390/844] rounded-[1.85rem]"
        />
      </div>
      <div className="mx-auto mt-3 h-2 w-24 rounded-full bg-slate-700" />
    </div>
  );
}

function NotebookCheckinDemo() {
  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-t-2xl border-[7px] border-b-0 border-slate-700 bg-[#070b13] p-3 shadow-[0_24px_65px_rgba(0,0,0,.42)] sm:p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-rose-400" />
          <span className="size-1.5 rounded-full bg-amber-300" />
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <div className="ml-3 h-4 flex-1 rounded-full bg-white/[.05]" />
        </div>
        <ScaledPortalFrame
          src="https://manostech-system.com.br/portal/j788xmylocks"
          title="Portal real do Boteco do Barão"
          viewportWidth={1366}
          viewportHeight={768}
          className="aspect-video rounded-xl border border-white/10"
        />
      </div>
      <div className="relative mx-auto h-4 w-[108%] -translate-x-[3.7%] rounded-b-xl border-x border-b border-slate-500 bg-gradient-to-b from-slate-500 to-slate-700 shadow-lg">
        <div className="mx-auto h-1.5 w-20 rounded-b-md bg-slate-600" />
      </div>
    </div>
  );
}

function SalesHomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050912] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050912]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link to="/" aria-label="ManosTech System — início" className="flex items-center gap-3">
            <img src={logo} alt="Manos Tech" className="h-11 w-11 rounded-full object-contain" />
            <span className="font-display text-base font-bold tracking-tight sm:text-lg">
              ManosTech <span className="text-cyan-300">System</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-7">
            <a
              href="#recursos"
              className="hidden text-sm text-slate-300 transition hover:text-white sm:inline"
            >
              Recursos
            </a>
            <a
              href="#planos"
              className="hidden text-sm text-slate-300 transition hover:text-white sm:inline"
            >
              Como contratar
            </a>
            <Link
              to="/auth"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold transition hover:border-cyan-300/60 hover:text-cyan-200"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(0,194,204,.15),transparent_42%),radial-gradient(ellipse_at_95%_25%,rgba(25,98,190,.16),transparent_36%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-200">
              <Wifi className="size-3.5" /> WI-FI PARA CLIENTES, COM GESTÃO
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Transforme o Wi-Fi do seu negócio em uma experiência{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                mais inteligente.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Ofereça acesso à internet para seus clientes por um portal personalizado e acompanhe
              sua operação em uma plataforma simples de administrar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#contato"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-300"
              >
                Solicitar uma proposta <ArrowRight className="size-4" />
              </a>
              <a
                href="#recursos"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 font-semibold text-white transition hover:border-white/35"
              >
                Conhecer os recursos <ArrowRight className="size-4" />
              </a>
            </div>
            <p className="mt-4 max-w-xl text-xs leading-5 text-slate-500">
              Na conversa inicial, entendemos seu espaço, sua rede e a quantidade de pontos para
              preparar uma proposta adequada.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
            <div className="relative rounded-[1.75rem] border border-white/10 bg-[#0b1220]/90 p-5 shadow-2xl shadow-black/40 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300">
                    <Wifi className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Sua operação Wi-Fi</p>
                    <p className="text-xs text-slate-400">Portal, acessos e divulgação</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  Em um só lugar
                </span>
              </div>
              <div
                aria-label="Prévia ilustrativa do painel operacional"
                className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#070c15]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <p className="text-xs font-semibold">Visão geral da operação</p>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-2.5 py-1 text-[10px] text-emerald-300">
                    Painel
                  </span>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-3">
                  {[
                    ["Acessos no período", "—"],
                    ["Visitantes únicos", "—"],
                    ["Novos contatos", "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/[.07] bg-white/[.025] p-3 sm:block"
                    >
                      <p className="text-[10px] leading-4 text-slate-400">{label}</p>
                      <p className="text-sm font-semibold sm:mt-1">{value}</p>
                    </div>
                  ))}
                </div>
                <div
                  aria-hidden="true"
                  className="mx-3 mb-3 flex h-16 items-end gap-2 rounded-xl border border-white/[.06] bg-white/[.02] p-2"
                >
                  {[28, 45, 38, 67, 52, 82, 62].map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-cyan-400 opacity-85"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <p className="mx-3 mb-3 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2.5 text-[10px] leading-4 text-slate-500">
                  Prévia ilustrativa da plataforma; os dados variam conforme a operação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[.07] bg-[#080e18]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">
              Veja como pode ficar
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Um portal que se adapta à tela
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Veja os portais reais da Padaria Efraim e do Boteco do Barão em formatos de celular e notebook.
            </p>
          </div>
          <div className="mt-12 grid items-end gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-14">
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300">
                    Modelo 01
                  </p>
                  <h3 className="mt-1 text-base font-semibold">Padaria Efraim · celular</h3>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1 text-[9px] font-semibold text-cyan-100">
                  Portal real
                </span>
              </div>
              <MobileCheckinDemo />
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                Portal publicado em modo de demonstração.
              </p>
            </div>
            <div className="min-w-0">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.17em] text-emerald-300">
                    Modelo 02
                  </p>
                  <h3 className="mt-1 text-base font-semibold">Boteco do Barão · notebook</h3>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[.06] px-3 py-1 text-[9px] font-semibold text-emerald-100">
                  Portal real
                </span>
              </div>
              <NotebookCheckinDemo />
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                Prévia do portal publicado com identidade visual, carrossel e cadastro.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-y border-white/[.07] bg-white/[.015]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">
              A plataforma
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Mais organização para o Wi-Fi do seu negócio
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Recursos para administrar o portal e acompanhar a operação, com configuração alinhada
              ao equipamento instalado e ao plano contratado.
            </p>
          </div>
          <div
            className="mt-10 grid auto-rows-fr gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}
          >
            {features.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="group h-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0a101c] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/50 hover:bg-cyan-300/[.04] hover:shadow-[0_14px_40px_rgba(34,211,238,.12)] focus-within:-translate-y-1 focus-within:border-cyan-300/50 active:scale-[.99] sm:p-6"
              >
                <span className="grid size-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300 transition-all duration-300 group-hover:border-cyan-300/40 group-hover:bg-cyan-300/15 group-hover:shadow-[0_0_22px_rgba(34,211,238,.18)]">
                  <Icon className="size-5 transition-transform duration-300 group-hover:scale-110" />
                </span>
                <h3 className="mt-5 break-words font-semibold">{title}</h3>
                <p className="mt-2 break-words text-sm leading-6 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">
              Contratação simples
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Um modelo mensal, sem fidelidade
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Primeiro entendemos seu espaço, a rede existente e quantas áreas precisam de cobertura.
              Com isso, definimos a ativação, a mensalidade e os equipamentos previstos na proposta.
            </p>
            <a
              href="#contato"
              className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Falar com a Manos Tech <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
            {commercialTerms.map(({ icon: Icon, title, body }, index) => (
              <article
                key={title}
                className="flex gap-4 rounded-2xl border border-white/10 bg-[#0a101c] p-5 sm:p-6"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-500">
                    0{index + 1}
                  </p>
                  <h3 className="mt-1 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              </article>
            ))}
            <article className="flex min-w-0 gap-4 rounded-2xl border border-white/10 bg-[#0a101c] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/45 hover:bg-cyan-300/[.035] hover:shadow-[0_12px_30px_rgba(34,211,238,.1)] sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300">
                <CircleDollarSign className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-500">
                  04
                </p>
                <h3 className="mt-1 break-words font-semibold">Valores apresentados na proposta</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  A ativação e a mensalidade são informadas após entendermos a necessidade da operação.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <PreSaleForm />

      <section className="border-y border-white/[.07] bg-[#080e18]">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300">
              <MessageCircle className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Vamos entender sua operação?</h2>
              <p className="mt-1 text-sm text-slate-400">
                Converse com a equipe e solicite uma proposta.
              </p>
            </div>
          </div>
          <a
            href="#contato"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan-300/30 px-6 font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
          >
            Solicitar proposta <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="size-8 rounded-full object-contain" />
          <span>© {new Date().getFullYear()} Manos Tech Solução em Marketing</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a className="transition hover:text-slate-300" href="mailto:manostech.suporte@gmail.com">
            manostech.suporte@gmail.com
          </a>
          <Link className="transition hover:text-slate-300" to="/auth">
            Entrar no sistema
          </Link>
        </div>
      </footer>
    </main>
  );
}

