import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  Beer,
  Croissant,
  Database,
  Gauge,
  Megaphone,
  MessageCircle,
  PartyPopper,
  RotateCcw,
  Store,
  Timer,
  UserPlus,
} from "lucide-react";
import logo from "@/assets/manos-tech-logo-institutional.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { openPreSaleChat, PreSaleForm } from "@/components/app/pre-sale-form";
import { DashboardDemo } from "@/components/app/dashboard-demo";
import { WifiVisitantesDemo } from "@/components/app/wifi-visitantes-demo";

const SOCIAL_IMAGE_URL = new URL(logo, "https://manostech-system.com.br").toString();

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);

    let frame = 0;
    const updateVisibility = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const bounds = node.getBoundingClientRect();
        const readingBandTop = window.innerHeight * 0.16;
        const readingBandBottom = window.innerHeight * 0.84;
        setVisible(bounds.bottom > readingBandTop && bounds.top < readingBandBottom);
      });
    };

    updateVisibility();
    // Capture scroll events from the document and nested scroll containers too.
    document.addEventListener("scroll", updateVisibility, { passive: true, capture: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      document.removeEventListener("scroll", updateVisibility, true);
      window.removeEventListener("resize", updateVisibility);
      motionPreference.removeEventListener("change", updateMotionPreference);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`${reducedMotion ? "transition-none" : "transition-[opacity,transform] duration-500 ease-out"} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seu Wi-Fi agora é seu melhor vendedor | ManosTech System" },
      {
        name: "description",
        content:
          "Com a ManosTech System, o Wi-Fi do seu estabelecimento deixa de ser apenas um serviço gratuito e passa a ser uma ferramenta de relacionamento e vendas.",
      },
      {
        property: "og:title",
        content: "Seu Wi-Fi agora é seu melhor vendedor | ManosTech System",
      },
      {
        property: "og:description",
        content:
          "Conheça melhor quem visita seu negócio, transforme acessos em oportunidades e use essas informações para criar campanhas, fortalecer o relacionamento e trazer seus clientes de volta.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: SOCIAL_IMAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SOCIAL_IMAGE_URL },
      { name: "theme-color", content: "#05080F" },
    ],
  }),
  component: SalesHomePage,
});

const FAQ_ITEMS = [
  {
    q: "Preciso entender de tecnologia para usar?",
    a: "Não. A ManosTech foi desenvolvida para ser utilizada por quem administra o negócio, e a implantação é acompanhada pela equipe.",
  },
  {
    q: "O cliente vai ter dificuldade para se conectar?",
    a: "A experiência foi pensada para ser simples: o cliente acessa o Wi-Fi, encontra o portal personalizado do estabelecimento e segue para a internet.",
  },
  {
    q: "Posso usar a ManosTech em várias lojas?",
    a: "Sim. Para negócios com mais de uma unidade, a plataforma permite centralizar a operação e acompanhar as informações de forma organizada.",
  },
  {
    q: "Preciso investir em anúncios para me comunicar com meus clientes?",
    a: "Não necessariamente. A ManosTech permite utilizar a própria base construída através do Wi-Fi para ações de relacionamento. Anúncios pagos podem ser utilizados como uma estratégia complementar.",
  },
  {
    q: "E a privacidade dos clientes?",
    a: "A coleta e o tratamento dos dados devem seguir as regras e finalidades informadas ao usuário, respeitando a legislação aplicável e os direitos dos titulares. Consulte a Política de Privacidade para conhecer os detalhes.",
  },
  {
    q: "O que posso fazer com os contatos gerados?",
    a: "Você pode utilizar a base para criar ações de relacionamento e campanhas para pessoas que já tiveram contato com o seu estabelecimento.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "O cliente se conecta",
    body: "Ao entrar no Wi-Fi, o cliente encontra um portal personalizado com a identidade do seu negócio.",
  },
  {
    num: "02",
    title: "Você conhece melhor seu público",
    body: "As conexões ajudam seu estabelecimento a construir uma base de contatos e entender melhor quem está passando pelo seu negócio.",
  },
  {
    num: "03",
    title: "Você cria relacionamento",
    body: "Com essa base, você pode criar campanhas e se comunicar com pessoas que já tiveram contato com sua marca.",
  },
  {
    num: "04",
    title: "Seu Wi-Fi continua trabalhando",
    body: "Em vez de cada visita terminar quando o cliente sai pela porta, você passa a ter uma oportunidade de continuar o relacionamento.",
  },
];

const SEGMENTOS = [
  {
    Icon: Beer,
    title: "Bares",
    body: "Happy hour lotado com campanha no Wi-Fi.",
  },
  {
    Icon: Croissant,
    title: "Padarias",
    body: "Cliente do café da manhã vira cliente do almoço.",
  },
  {
    Icon: PartyPopper,
    title: "Eventos",
    body: "Milhares de conexões, milhares de leads.",
  },
  {
    Icon: Store,
    title: "Lojas",
    body: "Quem entra na loja entra na sua base.",
  },
];

const SOLUCOES = [
  {
    Icon: UserPlus,
    title: "Captura de leads",
    body: "Todo visitante vira contato na sua base, automaticamente.",
  },
  {
    Icon: Megaphone,
    title: "Campanhas",
    body: "Banners e ofertas direto na tela de conexão do cliente.",
  },
  {
    Icon: Database,
    title: "CRM",
    body: "Organize contatos e acompanhe quem voltou ou sumiu.",
  },
  {
    Icon: MessageCircle,
    title: "Disparos WhatsApp",
    body: "Fale com sua base direto no WhatsApp, com 1 clique.",
  },
];

/*
 * Posters estáticos da primeira tela do portal — HTML/CSS puro, sem rede.
 * Cobrem a espera do iframe: aparecem junto com a página e somem (fade)
 * quando o iframe termina de carregar. Copiam a estrutura visual real do
 * portal (portal.$slug.tsx + portal-layouts.tsx), com os dados de cada
 * negócio de demonstração. A foto do banner só chega com o iframe — no
 * poster ela é um bloco em gradiente no lugar da imagem.
 */

function PortalPosterBarao() {
  const cardShadow =
    "0 1px 2px rgba(15,23,42,.06), 0 4px 10px -2px rgba(15,23,42,.06), 0 24px 44px -22px rgba(15,23,42,.28)";
  return (
    <div
      className="flex min-h-full flex-col px-[4%] py-5"
      style={{
        background:
          "radial-gradient(900px 420px at 50% -12%, #0891b222, transparent 70%), linear-gradient(180deg, #e8ecf3 0%, #f1f4f9 60%)",
      }}
    >
      {/* Identidade: inicial da marca, nome, localização e chamada. */}
      <div className="rounded-[28px] border border-[#d6dce7] bg-white p-5" style={{ boxShadow: cardShadow }}>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="font-display text-[30px] font-black leading-none tracking-tight" style={{ color: "#000000" }}>
            B
          </span>
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[#0f172a]">Boteco do Barão</h1>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748b]">
            <span className="size-1.5 rounded-full" style={{ background: "#000000" }} aria-hidden />
            Camboriú - SC
          </p>
          <p className="text-[14px] leading-relaxed text-[#0f172a]">Sejam bem-vindos.</p>
        </div>
      </div>

      {/* Banner. */}
      <div className="mt-4 overflow-hidden rounded-[28px] border border-[#d6dce7] bg-white p-2.5" style={{ boxShadow: cardShadow }}>
        <div
          className="h-[140px] rounded-[24px]"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,.28), transparent 55%), linear-gradient(135deg, #92400e 0%, #b45309 45%, #7c2d12 100%)",
          }}
        />
      </div>

      {/* Formulário: cabeçalho, campos, LGPD e botão. */}
      <div className="mt-4 rounded-[28px] border border-[#d6dce7] bg-white p-5" style={{ boxShadow: cardShadow }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[19px] font-bold leading-tight tracking-tight text-[#0f172a]">Conecte-se</p>
            <p className="mt-0.5 text-[13px] text-[#64748b]">Rápido, sem senha.</p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ background: "#0000001a", color: "#000000" }}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden />1 min
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <p className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f172a]">Nome completo *</p>
            <div className="mt-1.5 flex h-11 items-center rounded-2xl border border-[#d6dce7] bg-[#f4f6fa] px-4 text-[15px] text-[#94a3b8]">
              Ex: João Silva
            </div>
          </div>
          <div>
            <p className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f172a]">WhatsApp *</p>
            <div className="mt-1.5 flex items-stretch gap-2">
              <div className="flex h-11 w-[116px] shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-[#d6dce7] bg-[#f4f6fa] text-[12px] font-medium text-[#0f172a]">
                🇧🇷 +55
              </div>
              <div className="flex h-11 flex-1 items-center rounded-2xl border border-[#d6dce7] bg-[#f4f6fa] px-4 text-[15px] text-[#94a3b8]">
                (00) 00000-0000
              </div>
            </div>
          </div>
          <div>
            <p className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f172a]">Cidade *</p>
            <div className="mt-1.5 flex h-11 items-center rounded-2xl border border-[#d6dce7] bg-[#f4f6fa] px-4 text-[15px] text-[#94a3b8]">
              Sua cidade atual
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-1 rounded-2xl border border-[#d6dce7] bg-[#f4f6fa] p-3">
          <p className="text-xs font-semibold leading-snug text-[#0f172a]">
            <span className="font-bold uppercase tracking-wider" style={{ color: "#000000" }}>LGPD</span>
            {" — Lei Geral de Proteção de Dados"}
          </p>
          <p className="text-[11px] leading-relaxed text-[#64748b]">
            Seus dados são usados só para liberar e proteger este Wi-Fi. Ofertas são opcionais — e você pode parar quando quiser.
          </p>
          <p className="text-[11px] text-[#64748b] underline decoration-dotted underline-offset-2">Ver detalhes da privacidade</p>
        </div>
        <div
          className="mt-4 flex h-14 items-center justify-center rounded-[18px] text-[15px] font-semibold text-white"
          style={{
            background: "#000000",
            boxShadow: "0 14px 26px -10px #000000b3, inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 0 rgba(0,0,0,.14)",
          }}
        >
          Conectar ao Wi-Fi grátis
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center space-y-1 pb-2 text-center opacity-60">
        <p className="text-[9px] font-medium uppercase tracking-widest text-[#64748b]">Navegação segura e criptografada</p>
        <p className="text-[10px] text-[#64748b]">
          Tecnologia <span className="font-semibold">Manos Tech</span>
        </p>
      </div>
    </div>
  );
}

function PosterOrnament() {
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #3f3f46)" }} />
      <span className="size-1.5 rotate-45" style={{ background: "#3f3f46" }} />
      <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, #3f3f46)" }} />
    </div>
  );
}

function PortalPosterEfraim() {
  return (
    <div
      className="flex min-h-full flex-col items-center px-12 py-8"
      style={{
        background:
          "radial-gradient(820px 380px at 50% -14%, #0891b21f, transparent 70%), linear-gradient(180deg, #08080a 0%, #0b0b0d 62%)",
      }}
    >
      <header className="w-full max-w-[1120px] space-y-5 text-center">
        <PosterOrnament />
        <div className="space-y-2">
          <span className="font-display text-[30px] font-black leading-none" style={{ color: "#fff70f" }}>
            E
          </span>
          <h1
            className="text-[40px] font-medium leading-tight tracking-[0.01em] text-[#fafafa]"
            style={{ fontFamily: "var(--font-elegant-title)" }}
          >
            EFRAIM PADARIA E CONFEITARIA LTDA
          </h1>
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.42em] text-[#a1a1aa]">
            <span className="size-1.5 rounded-full" style={{ background: "#fff70f" }} aria-hidden />
            Joinville - SC
          </p>
        </div>
        <PosterOrnament />
      </header>

      <div className="mt-8 grid w-full max-w-[1120px] grid-cols-[1.1fr_.9fr] items-start gap-16">
        <div className="p-2.5" style={{ border: "1px solid #3f3f46" }}>
          <div className="p-1.5" style={{ border: "1px solid #3f3f4680" }}>
            <div
              className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-[3px] text-center"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(201,162,39,.28), transparent 60%), linear-gradient(135deg, #1c1917 0%, #44403c 55%, #292524 100%)",
              }}
            >
              <p
                className="text-[30px] font-medium leading-tight text-[#fafaf9]"
                style={{ fontFamily: "var(--font-elegant-title)" }}
              >
                Festival de Cucas
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#d6d3d1]">Toda quarta-feira · R$ 14,99</p>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] p-2" style={{ border: "1px solid #3f3f46aa" }}>
          <div className="px-9 py-7">
            <div className="mb-6 space-y-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.42em]" style={{ color: "#fff70f" }}>
                Acesso exclusivo
              </p>
              <p
                className="text-[28px] font-medium leading-tight text-[#fafafa]"
                style={{ fontFamily: "var(--font-elegant-title)" }}
              >
                Cadastro de cortesia
              </p>
              <div className="mx-auto h-px w-16 bg-[#3f3f46]" aria-hidden />
            </div>
            <div className="space-y-3">
              <div>
                <p className="ml-1 text-[10px] font-medium uppercase tracking-[0.3em] text-[#a1a1aa]">Nome completo *</p>
                <div className="mt-1.5 flex h-11 items-center rounded-[4px] border border-[#3f3f46] bg-transparent px-4 text-[14px] tracking-wide text-[#71717a]">
                  Ex: João Silva
                </div>
              </div>
              <div>
                <p className="ml-1 text-[10px] font-medium uppercase tracking-[0.3em] text-[#a1a1aa]">WhatsApp *</p>
                <div className="mt-1.5 flex h-11 items-center rounded-[4px] border border-[#3f3f46] bg-transparent px-4 text-[14px] tracking-wide text-[#71717a]">
                  (00) 00000-0000
                </div>
              </div>
              <div>
                <p className="ml-1 text-[10px] font-medium uppercase tracking-[0.3em] text-[#a1a1aa]">Cidade *</p>
                <div className="mt-1.5 flex h-11 items-center rounded-[4px] border border-[#3f3f46] bg-transparent px-4 text-[14px] tracking-wide text-[#71717a]">
                  Sua cidade atual
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2 px-1 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.32em]" style={{ color: "#fff70f" }}>
                Privacidade e consentimento
              </p>
              <p className="text-[11px] font-light leading-[1.85] tracking-[0.01em] text-[#a1a1aa]">
                Seus dados são usados só para liberar e proteger este Wi-Fi. Ofertas são opcionais — e você pode parar quando quiser.
              </p>
            </div>
            <div
              className="mt-5 flex h-14 items-center justify-center rounded-[4px] border text-[11px] font-medium uppercase tracking-[0.24em]"
              style={{
                borderColor: "#fff70f",
                color: "#fff70f",
                background: "linear-gradient(0deg, #fff70f1f, #fff70f0d)",
              }}
            >
              Conectar
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center space-y-1 pb-2 text-center opacity-60">
        <p className="text-[9px] font-medium uppercase tracking-widest text-[#a1a1aa]">Navegação segura e criptografada</p>
        <p className="text-[10px] text-[#a1a1aa]">
          Tecnologia <span className="font-semibold">Manos Tech</span>
        </p>
      </div>
    </div>
  );
}

function ScaledPortalFrame({
  src,
  title,
  viewportWidth,
  viewportHeight,
  className,
  poster,
  eager = false,
}: {
  src: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  className: string;
  // Poster estático da primeira tela do portal (HTML/CSS puro, sem rede):
  // aparece junto com a página e some quando o iframe carrega.
  poster: ReactNode;
  // Hero (acima da dobra): nasce iniciado e carrega direto com
  // autoplay=1 — um único carregamento, sem a troca de src.
  eager?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [started, setStarted] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = frameRef.current;
    if (!container) return;
    const updateScale = () => setScale(Math.min(container.clientWidth / viewportWidth, 1));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewportWidth]);

  useEffect(() => {
    const container = frameRef.current;
    if (!container || started) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      // A phone viewport is taller than the browser viewport, so a higher
      // threshold could prevent its demo from ever starting.
      { threshold: 0 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [started]);

  return (
    <div ref={frameRef} className={`relative overflow-hidden bg-[#05080F] ${className}`}>
      {started ? (
        <iframe
          title={title}
          src={src}
          // O iframe só monta quando a demonstração entra na tela (ou
          // nasce montado no hero, com eager): UM único carregamento,
          // direto com autoplay=1. Antes ele nascia com autoplay=0 e
          // recarregava com autoplay=1 na chegada — 2 consultas ao
          // banco por visita. Enquanto não monta, só o poster aparece.
          onLoad={() => setLoaded(true)}
          allow="autoplay; encrypted-media; picture-in-picture"
          // Sem allow-same-origin cruzado o Storage/CDN servindo o .mp4 do
          // banner pode ser recusado por CORS/mídia dentro do frame. Os dois
          // tokens juntos mantêm o documento na origem e permitem o vídeo.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
          tabIndex={-1}
          className="absolute left-0 top-0 border-0 bg-[#05080F]"
          style={{
            width: viewportWidth,
            height: viewportHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 z-10 overflow-hidden transition-opacity duration-500 ${loaded ? "opacity-0" : "opacity-100"}`}
        style={{
          width: viewportWidth,
          height: viewportHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {poster}
      </div>
    </div>
  );
}

function NotebookCheckinDemo() {
  const [replay, setReplay] = useState(0);
  return (
    <div className="mx-auto w-full max-w-[820px] px-2">
      <div className="overflow-hidden rounded-t-[1rem] border border-b-0 border-white/10 bg-[#14171b] p-1.5 shadow-[0_24px_55px_rgba(0,0,0,.45)] sm:p-2">
        <div className="mx-auto mb-1.5 size-1 rounded-full bg-white/20" aria-hidden="true" />
        <div className="overflow-hidden rounded-[0.4rem] border border-white/[.06]">
          <div className="flex h-8 items-center justify-center border-b border-white/[.06] bg-[#0f1114] px-2.5">
            <span className="text-[9px] tracking-wide text-slate-500">manostech-system.com.br</span>
          </div>
          <ScaledPortalFrame
            src={`/portal/demo-efraim?autoplay=1&replay=${replay}`}
            title="Portal real da Padaria Efraim"
            viewportWidth={1366}
            viewportHeight={768}
            className="aspect-video"
            poster={<PortalPosterEfraim />}
          />
        </div>
      </div>
      <div className="relative mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-[0.7rem] border-x border-b border-white/[0.08] bg-[#23262b] shadow-[0_14px_28px_rgba(0,0,0,.35)]">
        <div className="mx-auto h-1.5 w-24 rounded-b-md bg-[#101214]" />
      </div>
      <button type="button" onClick={() => setReplay((value) => value + 1)} className="mt-4 w-full text-center text-xs font-semibold text-emerald-200 hover:text-white">↻ Reproduzir check-in fictício</button>
    </div>
  );
}

function MobileBotecoDemo({ loop = false }: { loop?: boolean }) {
  const [replay, setReplay] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!loop) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loop]);

  useEffect(() => {
    if (!loop || !inView) return;
    // O demo leva ~14s para completar; 22s dá uma pausa confortável na tela final.
    const timer = window.setInterval(() => setReplay((value) => value + 1), 22000);
    return () => window.clearInterval(timer);
  }, [loop, inView]);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-[340px] px-2">
      <div className="relative rounded-[2.9rem] border border-[#3a3d42] bg-[#17181a] p-[3px] shadow-[0_20px_50px_rgba(0,0,0,.5)] ring-1 ring-white/[0.06]">
        <span className="absolute -left-[2px] top-28 h-14 w-[3px] rounded-l bg-[#2a2d31]" aria-hidden="true" />
        <span className="absolute -right-[2px] top-36 h-20 w-[3px] rounded-r bg-[#2a2d31]" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 flex h-[16px] w-[68px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2" aria-hidden="true">
          <span className="size-[6px] rounded-full bg-[#16202b] ring-1 ring-white/10" aria-hidden="true" />
        </div>
        <ScaledPortalFrame
          src={`/portal/demo-barao?autoplay=1&replay=${replay}`}
          title="Portal real do Boteco do Barão"
          viewportWidth={390}
          viewportHeight={844}
          className="aspect-[390/844] rounded-[2.6rem]"
          poster={<PortalPosterBarao />}
          eager
        />
        <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-20 h-1 w-[80px] -translate-x-1/2 rounded-full bg-white/60" aria-hidden="true" />
      </div>
      {!loop ? (
        <button type="button" onClick={() => setReplay((value) => value + 1)} className="mt-4 w-full text-center text-xs font-semibold text-emerald-200 hover:text-white">↻ Reproduzir check-in fictício</button>
      ) : null}
    </div>
  );
}

function SalesHomePage() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    let frame = 0;
    const updateVisibility = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setShowBackToTop(window.scrollY > 600);
      });
    };

    updateVisibility();
    document.addEventListener("scroll", updateVisibility, { passive: true, capture: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      document.removeEventListener("scroll", updateVisibility, true);
      window.removeEventListener("resize", updateVisibility);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#05080F] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/[.08] bg-[#05080F]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link to="/" aria-label="ManosTech System — início" className="flex items-center gap-3">
            <img src={logo} alt="Manos Tech" className="h-11 w-11 rounded-full object-contain" />
            <span className="font-display text-base font-bold tracking-tight sm:text-lg">
              ManosTech <span className="hidden text-cyan-400 sm:inline">System</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6">
            <Link
              to="/auth"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold transition hover:border-cyan-400 hover:bg-cyan-400 hover:text-slate-950 focus-visible:border-cyan-400 focus-visible:bg-cyan-400 focus-visible:text-slate-950 active:border-cyan-400 active:bg-cyan-400 active:text-slate-950"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(0,194,204,.06),transparent_42%),radial-gradient(ellipse_at_95%_25%,rgba(25,98,190,.05),transparent_36%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <ScrollReveal className="h-full">
            <div>
              <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Seu <span className="text-cyan-400">Wi-Fi</span> agora é seu melhor{" "}
                <span className="text-cyan-400">vendedor</span>.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Com a <strong>ManosTech System</strong>, o Wi-Fi do seu estabelecimento deixa de
                ser apenas um serviço gratuito e passa a ser uma{" "}
                <strong>ferramenta de relacionamento e vendas</strong>.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Conheça melhor quem visita seu negócio, transforme acessos em oportunidades e use
                essas informações para{" "}
                <strong>
                  criar campanhas, fortalecer o relacionamento e trazer seus clientes de volta
                </strong>
                .
              </p>
              <p className="mt-8 max-w-2xl text-lg font-bold leading-7 sm:text-xl">
                Mais do que oferecer Wi-Fi. Transforme cada acesso em uma nova oportunidade de
                venda.
              </p>
              <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={openPreSaleChat}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-400"
                >
                  Quero transformar meu Wi-Fi em vendas <ArrowRight className="size-4" />
                </button>
                <a
                  href="#portais"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 font-semibold text-white transition hover:border-white/35"
                >
                  Ver um portal de verdade <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </ScrollReveal>

          <div className="h-full">
            <ScrollReveal className="h-full" delay={120}><MobileBotecoDemo loop /></ScrollReveal>
          </div>
        </div>
      </section>

      <section id="solucoes" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              Soluções
            </p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que o seu Wi-Fi pode fazer
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Cada solução trabalha sozinha — juntas, transformam visitantes em clientes.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUCOES.map(({ Icon, title, body }, index) => (
              <ScrollReveal key={title} className="h-full" delay={(index % 4) * 80}>
                <article className="h-full rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 sm:p-6">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 text-cyan-400" aria-hidden="true">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                  <a
                    href="#como-funciona"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    Ver como funciona <ArrowRight className="size-3.5" aria-hidden="true" />
                  </a>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="portais" className="scroll-mt-20 border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              Portal real
            </p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Veja o que seu cliente encontra ao se conectar.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Portal real. Não uma imagem de demonstração.
            </p>
          </ScrollReveal>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
            <ScrollReveal className="min-w-0">
              <NotebookCheckinDemo />
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <h3 className="text-xl font-bold">Portal personalizado para cada negócio.</h3>
              <p className="mt-3 leading-7 text-slate-400">
                Seu cliente acessa o Wi-Fi e encontra uma experiência criada para a sua marca.
              </p>
              <h3 className="mt-8 text-xl font-bold">Sua marca em movimento.</h3>
              <p className="mt-3 leading-7 text-slate-400">
                Vídeo de até 10 segundos com reprodução automática dentro do portal — antes da
                navegação começar.
              </p>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[.06] px-4 py-1.5 text-xs font-bold uppercase tracking-[.15em] text-cyan-200">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Vídeo automático · até 10s
              </p>
              <div className="mt-6">
                <a
                  href="https://manostech-system.com.br/portal/j788xmylocks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Abrir portal real <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Painel</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              E você acompanha tudo pelo seu painel.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
              Com a ManosTech, as conexões do seu Wi-Fi deixam de ser apenas acessos à
              internet.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Você passa a ter informações que ajudam a entender melhor o relacionamento dos
              clientes com o seu estabelecimento.
            </p>
            <p className="mt-8 max-w-2xl text-lg font-bold leading-7 sm:text-xl">
              Menos achismo. Mais informação para tomar decisões.
            </p>
          </ScrollReveal>
          <div className="mt-12">
            <DashboardDemo />
          </div>
          <p className="mt-6 text-center text-xs italic text-slate-500">
            Demonstração com dados de exemplo.
          </p>
        </div>
      </section>

      <section id="controle" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              Controle
            </p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Você controla o Wi-Fi dos seus visitantes.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
              No seu painel, você define as regras do Wi-Fi para visitantes — sem
              precisar chamar ninguém.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <ScrollReveal className="h-full">
              <article className="h-full rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 sm:p-6">
                <Gauge className="size-7 text-cyan-400" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">Velocidade por visitante</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Defina a velocidade de download e upload que cada visitante usa —
                  o suficiente para navegar bem, sem sobrecarregar a sua internet.
                </p>
              </article>
            </ScrollReveal>
            <ScrollReveal className="h-full" delay={90}>
              <article className="h-full rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 sm:p-6">
                <Timer className="size-7 text-cyan-400" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">Tempo de conexão</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Escolha quanto tempo dura cada check-in e quanto tempo parado
                  encerra a sessão automaticamente.
                </p>
              </article>
            </ScrollReveal>
            <ScrollReveal className="h-full" delay={180}>
              <article className="h-full rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 sm:p-6">
                <RotateCcw className="size-7 text-cyan-400" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">Limite de reconexões</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Defina quantas vezes o mesmo aparelho pode se conectar e por
                  quanto tempo ele fica bloqueado depois do limite.
                </p>
              </article>
            </ScrollReveal>
          </div>
          <div className="mt-4">
            <ScrollReveal>
              <WifiVisitantesDemo />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              O que acontece?
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Como a ManosTech funciona?
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {STEPS.map(({ num, title, body }, index) => (
              <ScrollReveal key={title} className="h-full" delay={(index % 2) * 90}>
                <article className="h-full rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 sm:p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-500">
                    {num}
                  </p>
                  <h3 className="mt-1 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              Para quem é
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Feito para o seu tipo de negócio
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEGMENTOS.map(({ Icon, title, body }, index) => (
              <ScrollReveal key={title} className="h-full" delay={(index % 4) * 80}>
                <article className="h-full rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 sm:p-6">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 text-cyan-400" aria-hidden="true">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-20">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
                Perguntas frequentes
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Dúvidas comuns
              </h2>
            </div>
            <Accordion type="single" collapsible className="mt-10">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`} className="border-white/[.08]">
                  <AccordionTrigger className="text-left text-base font-semibold text-slate-100 hover:text-cyan-400">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-7 text-slate-300">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: FAQ_ITEMS.map((f) => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a },
                  })),
                }),
              }}
            />
          </ScrollReveal>
        </div>
      </section>



      <section className="border-t border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Seu cliente já está entrando pela porta.
            </h2>
            <p className="mt-3 text-xl font-bold leading-8 sm:text-2xl">
              Agora faça o Wi-Fi trabalhar para trazer esse cliente de volta.
            </p>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
              Transforme o Wi-Fi do seu estabelecimento em uma ferramenta de relacionamento,
              inteligência e vendas.
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={openPreSaleChat}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Quero transformar meu Wi-Fi em vendas <ArrowRight className="size-4" />
              </button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {showBackToTop ? (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            })
          }
          aria-label="Subir ao topo"
          title="Subir ao topo"
          className="fixed bottom-5 left-5 z-[150] grid size-14 place-items-center rounded-full border border-cyan-200/25 bg-[#0B1118] text-cyan-100 shadow-[0_12px_40px_rgba(0,0,0,.38)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-400 hover:text-slate-950 focus-visible:border-cyan-400 focus-visible:bg-cyan-400 focus-visible:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 active:border-cyan-400 active:bg-cyan-400 active:text-slate-950 sm:bottom-6 sm:left-6"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      ) : null}

      <PreSaleForm />

      <ScrollReveal>
        <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="size-8 rounded-full object-contain" />
            <span>© {new Date().getFullYear()} Manos Tech Solução em Marketing</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a className="transition hover:text-slate-300" href="mailto:contato@manostech-system.com.br">
              contato@manostech-system.com.br
            </a>
            <Link className="transition hover:text-slate-300" to="/auth">
              Entrar no sistema
            </Link>
          </div>
        </footer>
      </ScrollReveal>
    </main>
  );
}
