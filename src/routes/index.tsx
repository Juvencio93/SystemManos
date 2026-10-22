import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Building2,
  Check,
  ChartNoAxesCombined,
  CircleDollarSign,
  Megaphone,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  RadioTower,
  Wifi,
} from "lucide-react";
import logo from "@/assets/manos-tech-logo-institutional.png";
import { Church, Coffee, Dumbbell, Scissors, Stethoscope, Store, UtensilsCrossed } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LiveCrmPreview } from "@/components/marketing/live-crm-preview";
import { openPreSaleChat, PreSaleForm } from "@/components/app/pre-sale-form";

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
      { title: "ManosTech System | Wi-Fi para clientes com a sua marca" },
      {
        name: "description",
        content:
          "Ofereça Wi-Fi para clientes com um portal personalizado, regras de acesso, divulgação da sua marca e informações organizadas.",
      },
      {
        property: "og:title",
        content: "ManosTech System | Wi-Fi para clientes com a sua marca",
      },
      {
        property: "og:description",
        content:
          "Portal personalizado, regras de acesso e divulgação para o seu negócio. Conheça exemplos reais e solicite uma proposta.",
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

const SEGMENTOS = [
  { icon: Coffee, label: "Padarias e cafeterias" },
  { icon: UtensilsCrossed, label: "Bares e restaurantes" },
  { icon: Church, label: "Igrejas" },
  { icon: Scissors, label: "Salões e barbearias" },
  { icon: Store, label: "Lojas e comércios" },
  { icon: Stethoscope, label: "Clínicas e consultórios" },
  { icon: Dumbbell, label: "Academias" },
];

const FAQ_ITEMS = [
  {
    q: "Preciso trocar minha internet ou meu roteador?",
    a: "Não. O ManosTech funciona com a internet que o seu negócio já tem. A gente instala um equipamento próprio que organiza a rede dos clientes, separado da sua rede interna — a sua internet continua a mesma.",
  },
  {
    q: "Quem instala? Preciso entender de tecnologia?",
    a: "A instalação é feita pela Manos Tech e o equipamento já sai configurado do seu jeito. Você acompanha tudo por um painel simples, feito pra quem não é da área — e o que precisar ajustar, pode pedir pra nossa equipe.",
  },
  {
    q: "Meu cliente precisa baixar algum aplicativo?",
    a: "Não precisa baixar nada. O cliente conecta no Wi-Fi do seu negócio, o portal abre sozinho na tela do celular, ele faz um cadastro rapidinho e já está navegando.",
  },
  {
    q: "O que o cliente vê quando conecta?",
    a: "A página do SEU negócio: sua logo, suas cores e os banners que você quiser mostrar — a promoção do dia, uma novidade do cardápio, um aviso importante. Depois do cadastro, a navegação é liberada com as regras que você definiu.",
  },
  {
    q: "Os contatos dos clientes ficam comigo?",
    a: "Ficam. Quem autoriza o contato no cadastro entra pra sua base no painel: você sabe quem são seus clientes e pode se relacionar com eles nas campanhas. Tudo dentro da LGPD — o cliente autoriza e pode sair quando quiser.",
  },
  {
    q: "E se der problema na rede?",
    a: "Sua rede é acompanhada o tempo todo: se algo sai do ar, nossa equipe é avisada automaticamente e age pra resolver — na maioria das vezes, antes de você perceber.",
  },
  {
    q: "Quanto custa?",
    a: "Os valores dependem do tamanho do negócio e do que você precisa, por isso são apresentados numa proposta, sem compromisso. Toque em \"Solicitar uma proposta\" que a gente conversa e monta a sua.",
  },
];

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
    body: "Gerencie matriz e filiais em uma plataforma centralizada.",
  },
  {
    icon: Bot,
    title: "Gerente Operacional IA",
    body: "Consulte a operação e as informações disponíveis no sistema.",
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

const walkthroughSlides = [
  {
    eyebrow: "01 · CRIAÇÃO DA CAMPANHA",
    title: "Veja a campanha sendo criada",
    description:
      "Acompanhe o formulário completo em vídeo: campos da campanha, identidade, banners, cores, estilos visuais e prévia do portal. Você pode pausar para observar cada detalhe.",
    image: "/marketing/campanha-configuracao.png",
    alt: "Tela real de edição da campanha da Padaria Efraim com nome, chamada e local de exibição.",
  },
  {
    eyebrow: "02 · DIVULGAÇÃO",
    title: "Adicione logo e banners",
    description:
      "Personalize o portal com a marca do negócio e banners para apresentar produtos, serviços ou promoções.",
    image: "/marketing/campanha-banner.png",
    alt: "Tela real da campanha da Padaria Efraim com um banner de oferta no carrossel.",
  },
  {
    eyebrow: "03 · APARÊNCIA",
    title: "Escolha as cores do portal",
    description:
      "Ajuste a cor principal e a cor de destaque. A prévia do portal acompanha essas escolhas antes de salvar a campanha.",
    image: "/marketing/campanha-cores.webp",
    alt: "Campos reais da aparência do portal com cor principal, cor de destaque e estilo visual.",
  },
  {
    eyebrow: "04 · ESTILO VISUAL",
    title: "Defina o estilo visual",
    description:
      "Escolha entre Moderno, Elegante, Minimalista e Vibrante. Você também pode posicionar o logo e ajustar o texto do botão de conexão.",
    image: "/marketing/campanha-estilos.webp",
    alt: "Campos reais de estilo visual, posicionamento do logo e texto do botão de conexão.",
  },
  {
    eyebrow: "05 · REGRAS DE ACESSO",
    title: "Defina como a rede será usada",
    description:
      "Configure tempo de sessão, inatividade, download e upload por visitante. Se ativar um limite de check-ins, também pode definir a espera para uma nova conexão.",
    image: "/marketing/politica-wifi.png",
    alt: "Tela real da política de Wi-Fi com campos de tempo, velocidade, limite de check-ins e bloqueio temporário.",
  },
  {
    eyebrow: "06 · EXPERIÊNCIA DO CLIENTE",
    title: "Seu portal entra em cena",
    description:
      "O visitante encontra a identidade e o banner do estabelecimento no portal antes de preencher o cadastro para acessar a rede.",
    image: "/marketing/portal-efraim.png",
    alt: "Portal Wi-Fi publicado da Padaria Efraim com identidade visual, banner e formulário de acesso.",
  },
];

function ProductWalkthrough() {
  const [activeSlide, setActiveSlide] = useState(0);
  const activeWalkthroughSlide = walkthroughSlides[activeSlide] ?? walkthroughSlides[0]!;
  const [inView, setInView] = useState(false);
  const visualRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
      threshold: 0.2,
    });
    observer.observe(visual);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (activeSlide === 0 && inView) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [activeSlide, inView]);

  useEffect(() => {
    if (activeSlide === 0 || !inView) return;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1 < walkthroughSlides.length ? current + 1 : 1));
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [activeSlide, inView]);

  const goToSlide = (index: number) => {
    const next = (index + walkthroughSlides.length) % walkthroughSlides.length;
    if (next === 0 && activeSlide !== 0 && videoRef.current) videoRef.current.currentTime = 0;
    setActiveSlide(next);
  };

  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-b border-white/[.07] bg-[#070D13]"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
            Por dentro da plataforma
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Veja como o Wi-Fi toma a forma do seu negócio
          </h2>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#0B1118] shadow-[0_24px_80px_rgba(0,0,0,.28)] lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
          <div className="min-w-0 border-b border-white/[.08] lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-white/[.08] px-4 py-3 text-xs text-slate-400">
              <span className="size-2 rounded-full bg-rose-400" />
              <span className="size-2 rounded-full bg-amber-300" />
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="ml-3 truncate">ManosTech System · demonstração real</span>
            </div>
            <div ref={visualRef} className="relative aspect-[989/580] bg-[#05080F]">
              <video
                ref={videoRef}
                src="/marketing/criacao-campanha.mp4"
                poster="/marketing/campanha-configuracao.png"
                aria-label="Vídeo da criação de campanha com rolagem pelos campos, cores e estilos visuais"
                controls
                muted
                playsInline
                preload="metadata"
                onEnded={() => setActiveSlide(1)}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${activeSlide === 0 ? "opacity-100" : "pointer-events-none opacity-0"}`}
                aria-hidden={activeSlide !== 0}
              />
              {walkthroughSlides.map((slide, index) => (
                <img
                  key={slide.image}
                  src={slide.image}
                  alt={slide.alt}
                  loading={index === 0 ? "eager" : "lazy"}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 motion-reduce:transition-none ${index === activeSlide && index !== 0 ? "opacity-100" : "pointer-events-none opacity-0"}`}
                  aria-hidden={index !== activeSlide || index === 0}
                />
              ))}
            </div>
            <p className="border-t border-white/[.08] px-4 py-2.5 text-[11px] leading-5 text-slate-400">
              Vídeo da campanha seguido de capturas reais em carrossel. Use as setas para avançar ou
              voltar. A disponibilidade de recursos depende do equipamento e do plano contratado.
            </p>
          </div>

          <div className="flex min-w-0 flex-col justify-between p-5 sm:p-7">
            <div>
              <p className="text-xs font-bold tracking-[.18em] text-cyan-400">
                {activeWalkthroughSlide.eyebrow}
              </p>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight sm:text-3xl">
                {activeWalkthroughSlide.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                {activeWalkthroughSlide.description}
              </p>
            </div>
            <div className="mt-8">
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="Etapas da apresentação"
              >
                {walkthroughSlides.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    onClick={() => goToSlide(index)}
                    aria-label={`Mostrar etapa ${index + 1}: ${slide.title}`}
                    aria-current={index === activeSlide ? "step" : undefined}
                    className={`h-2 min-w-0 flex-1 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 ${index === activeSlide ? "bg-cyan-400" : "bg-white/20 hover:bg-white/40"}`}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {String(activeSlide + 1).padStart(2, "0")} /{" "}
                  {String(walkthroughSlides.length).padStart(2, "0")}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => goToSlide(activeSlide - 1)}
                    aria-label="Etapa anterior"
                    className="grid size-10 place-items-center rounded-full border border-white/20 text-white transition hover:border-cyan-400/60 hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToSlide(activeSlide + 1)}
                    aria-label="Próxima etapa"
                    className="grid size-10 place-items-center rounded-full border border-white/20 text-white transition hover:border-cyan-400/60 hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScaledPortalFrame({
  src,
  title,
  viewportWidth,
  viewportHeight,
  className,
}: {
  src: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  className: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [started, setStarted] = useState(false);

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
      <iframe
        title={title}
        src={started ? src : src.replace("autoplay=1", "autoplay=0")}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
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
    </div>
  );
}

function MobileCheckinDemo() {
  const [replay, setReplay] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[340px] px-2">
      <div className="relative rounded-[2.7rem] border-[3px] border-slate-400/80 bg-gradient-to-br from-slate-600 via-slate-900 to-slate-500 p-[5px] shadow-[0_32px_75px_rgba(0,0,0,.58),0_0_35px_rgba(34,211,238,.04)]">
        <span className="absolute -left-[5px] top-28 h-14 w-[3px] rounded-l bg-slate-500" aria-hidden="true" />
        <span className="absolute -right-[5px] top-36 h-20 w-[3px] rounded-r bg-slate-500" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 h-[18px] w-[82px] -translate-x-1/2 rounded-full border border-white/[.06] bg-[#03060b] shadow-md" aria-hidden="true" />
        <ScaledPortalFrame
          src={`/portal/demo-efraim?autoplay=1&replay=${replay}`}
          title="Portal real da Padaria Efraim"
          viewportWidth={390}
          viewportHeight={844}
          className="aspect-[390/844] rounded-[2.2rem]"
        />
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 h-1 w-[90px] -translate-x-1/2 rounded-full bg-white/75 shadow-sm" aria-hidden="true" />
      </div>
      <button type="button" onClick={() => setReplay((value) => value + 1)} className="mt-4 w-full text-center text-xs font-semibold text-cyan-200 hover:text-white">↻ Reproduzir check-in fictício</button>
    </div>
  );
}

function NotebookCheckinDemo() {
  const [replay, setReplay] = useState(0);
  return (
    <div className="mx-auto w-full max-w-[820px] px-2">
      <div className="overflow-hidden rounded-t-[1.25rem] border-[4px] border-b-0 border-slate-500/90 bg-[#05080F] p-2 shadow-[0_30px_70px_rgba(0,0,0,.48),0_0_35px_rgba(34,211,238,.03)] sm:p-3">
        <div className="mx-auto mb-2 size-1.5 rounded-full bg-slate-500" aria-hidden="true" />
        <div className="overflow-hidden rounded-md border border-white/[.08]">
          <div className="flex h-7 items-center gap-1.5 border-b border-white/[.08] bg-[#131920] px-2.5">
            <span className="size-1.5 rounded-full bg-rose-400/90" />
            <span className="size-1.5 rounded-full bg-amber-300/90" />
            <span className="size-1.5 rounded-full bg-emerald-400/90" />
            <span className="mx-auto w-2/5 rounded-full border border-white/[.06] bg-white/[.04] py-0.5 text-center text-[8px] text-slate-500">manostech-system.com.br</span>
          </div>
          <ScaledPortalFrame
            src={`/portal/demo-barao?autoplay=1&replay=${replay}`}
            title="Portal real do Boteco do Barão"
            viewportWidth={1366}
            viewportHeight={768}
            className="aspect-video"
          />
        </div>
      </div>
      <div className="relative mx-auto h-6 w-[106%] -translate-x-[2.8%] rounded-b-[1.1rem] border-x border-b border-slate-500 bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 shadow-[0_18px_35px_rgba(0,0,0,.4)]">
        <div className="mx-auto h-2 w-28 rounded-b-lg border-x border-b border-slate-700/70 bg-slate-500/80" />
      </div>
      <button type="button" onClick={() => setReplay((value) => value + 1)} className="mt-4 w-full text-center text-xs font-semibold text-emerald-200 hover:text-white">↻ Reproduzir check-in fictício</button>
    </div>
  );
}

function SalesHomePage() {
  const crmCardRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    let frame = 0;
    const updateVisibility = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const crmCard = crmCardRef.current;
        setShowBackToTop(Boolean(crmCard && crmCard.getBoundingClientRect().bottom <= 0));
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
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-200">
              <Wifi className="size-3.5" /> WI-FI PARA CLIENTES, COM A SUA MARCA
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              O cliente se conecta.{" "}
              <span className="text-cyan-400">
                Sua marca aparece.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Ofereça Wi-Fi por um portal personalizado, apresente suas ofertas e defina as regras
              de acesso. Acompanhe as conexões no sistema e organize os contatos que autorizarem o
              relacionamento com seu negócio.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openPreSaleChat}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Solicitar uma proposta <ArrowRight className="size-4" />
              </button>
              <a
                href="#portais"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 font-semibold text-white transition hover:border-white/35"
              >
                Ver portais reais <ArrowRight className="size-4" />
              </a>
            </div>
            <ul
              className="mt-6 flex max-w-xl flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-300"
              aria-label="Recursos principais"
            >
              {["Portal com sua marca", "Regras de acesso", "Banners de divulgação"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          </ScrollReveal>

          <div ref={crmCardRef} className="h-full">
            <ScrollReveal className="h-full" delay={120}><LiveCrmPreview /></ScrollReveal>
          </div>
        </div>
      </section>

      <section aria-label="Tipos de negócio atendidos" className="border-b border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-slate-400">
            Feito para negócios que recebem clientes todos os dias
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {SEGMENTOS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.02] px-3.5 py-2 text-sm font-medium text-slate-200"
              >
                <Icon className="size-4 text-cyan-400" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
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

      <section id="portais" className="scroll-mt-20 border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              Exemplos publicados
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Um portal com a identidade de cada negócio
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Acompanhe o preenchimento fictício nos portais reais da Padaria Efraim e do Boteco do
              Barão, da oferta ao redirecionamento para o Instagram. A demonstração não envia cadastros.
            </p>
          </ScrollReveal>
          <div className="mt-12 grid items-end gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-14">
            <ScrollReveal className="mx-auto w-full max-w-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.17em] text-cyan-400">
                    Modelo 01
                  </p>
                  <h3 className="mt-1 text-base font-semibold">Padaria Efraim · celular</h3>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[.06] px-3 py-1 text-[9px] font-semibold text-cyan-100">
                  Portal real
                </span>
              </div>
              <MobileCheckinDemo />
              <p className="mt-4 text-center text-sm leading-6 text-slate-400">
                Marca e oferta da padaria aparecem junto ao acesso ao Wi-Fi.
              </p>
              <a
                href="https://manostech-system.com.br/portal/6us8mzhk8ffh"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-auto mt-3 flex min-h-11 w-fit items-center gap-2 rounded-full border border-cyan-400/30 px-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Abrir portal da Padaria Efraim <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </ScrollReveal>
            <ScrollReveal className="min-w-0" delay={120}>
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
              <p className="mt-4 text-center text-sm leading-6 text-slate-400">
                Identidade visual, banners e cadastro adaptados à tela maior.
              </p>
              <a
                href="https://manostech-system.com.br/portal/j788xmylocks"
                target="_blank"
                rel="noopener noreferrer"
                className="mx-auto mt-3 flex min-h-11 w-fit items-center gap-2 rounded-full border border-emerald-300/30 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                Abrir portal do Boteco do Barão <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <ScrollReveal><ProductWalkthrough /></ScrollReveal>

      <section className="border-b border-white/[.07] bg-white/[.015]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Veja funcionando</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              O portal do seu negócio, em menos de 1 minuto
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              É assim que o seu cliente enxerga o Wi-Fi: a sua marca na tela, um cadastro rapidinho
              e a navegação liberada. Aperte o play e veja o caminho inteiro.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[300px]">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/[.08] bg-black shadow-[0_24px_60px_rgba(0,0,0,.4)]">
              <video className="aspect-[9/16] w-full" controls preload="none" poster="/marketing/divulgacao-poster.jpg" playsInline>
                <source src="/marketing/divulgacao.mp4" type="video/mp4" />
              </video>
            </div>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
              Vídeo de divulgação do ManosTech System.
            </p>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-y border-white/[.07] bg-white/[.015]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              A plataforma
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Mais organização para o Wi-Fi do seu negócio
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Recursos para administrar o portal e acompanhar a operação, com configuração alinhada
              ao equipamento instalado e ao plano contratado.
            </p>
          </ScrollReveal>
          <div
            className="mt-10 grid auto-rows-fr gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}
          >
            {features.map(({ icon: Icon, title, body }, index) => (
              <ScrollReveal key={title} className="h-full" delay={(index % 3) * 90}>
              <article
                className="group h-full min-w-0 overflow-hidden rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-cyan-400/[.04] hover:shadow-[0_14px_40px_rgba(34,211,238,.03)] focus-within:-translate-y-1 focus-within:border-cyan-400/50 active:scale-[.99] sm:p-6"
              >
                <span className="grid size-11 place-items-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[.07] text-cyan-400 transition-all duration-300 group-hover:border-cyan-400/40 group-hover:bg-cyan-400/15 group-hover:shadow-[0_0_22px_rgba(34,211,238,.10)]">
                  <Icon className="size-5 transition-transform duration-300 group-hover:scale-110" />
                </span>
                <h3 className="mt-5 break-words font-semibold">{title}</h3>
                <p className="mt-2 break-words text-sm leading-6 text-slate-400">{body}</p>
              </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/[.07] bg-[#070D13]">
        <ScrollReveal>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Como seria no seu estabelecimento?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Conte como funciona seu espaço para definirmos o portal, as regras de acesso e os
              equipamentos previstos na proposta.
            </p>
          </div>

        </div>
        </ScrollReveal>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <ScrollReveal>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              Contratação simples
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Um modelo mensal, sem fidelidade
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Primeiro entendemos seu espaço, a rede existente e quantas áreas precisam de
              cobertura. Com isso, definimos a ativação, a mensalidade e os equipamentos previstos
              na proposta.
            </p>

          </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
            {commercialTerms.map(({ icon: Icon, title, body }, index) => (
              <article
                key={title}
                className="group flex min-w-0 gap-4 rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/45 hover:bg-cyan-400/[.035] hover:shadow-[0_12px_30px_rgba(34,211,238,.05)] focus-within:-translate-y-1 focus-within:border-cyan-400/45 active:scale-[.99] sm:p-6"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[.07] text-cyan-400 transition-all duration-300 group-hover:border-cyan-400/40 group-hover:bg-cyan-400/15 group-hover:shadow-[0_0_22px_rgba(34,211,238,.10)]">
                  <Icon className="size-5 transition-transform duration-300 group-hover:scale-110" />
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
            <article className="group flex min-w-0 gap-4 rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/45 hover:bg-cyan-400/[.035] hover:shadow-[0_12px_30px_rgba(34,211,238,.05)] focus-within:-translate-y-1 focus-within:border-cyan-400/45 active:scale-[.99] sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[.07] text-cyan-400 transition-all duration-300 group-hover:border-cyan-400/40 group-hover:bg-cyan-400/15 group-hover:shadow-[0_0_22px_rgba(34,211,238,.10)]">
                <CircleDollarSign className="size-5 transition-transform duration-300 group-hover:scale-110" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-500">
                  04
                </p>
                <h3 className="mt-1 break-words font-semibold">Valores apresentados na proposta</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  A ativação e a mensalidade são informadas após entendermos a necessidade da
                  operação.
                </p>
              </div>
            </article>
          </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-20 border-b border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Dúvidas frequentes</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Perguntas de quem está conhecendo agora
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Sem termo técnico: o que todo dono de negócio pergunta antes de colocar o ManosTech no
              seu Wi-Fi.
            </p>
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
        </div>
      </section>

      <PreSaleForm />

      <ScrollReveal>
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
      </ScrollReveal>
    </main>
  );
}

