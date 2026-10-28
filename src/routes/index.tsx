import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";
import logo from "@/assets/manos-tech-logo-institutional.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

const FUNNEL = [
  { label: "ACESSO", value: "Wi-Fi" },
  { label: "CONTATO", value: "Base própria" },
  { label: "RELACIONAMENTO", value: "Campanhas" },
  { label: "VENDA", value: "Novas oportunidades" },
];

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
        <div className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
          <ScrollReveal>
            <div>
              <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Seu Wi-Fi agora é seu melhor vendedor.
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
                  href="https://manostech-system.com.br/portal/6us8mzhk8ffh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 font-semibold text-white transition hover:border-white/35"
                >
                  Ver um portal de verdade <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <h2 className="max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Seu Wi-Fi pode fazer muito mais do que entregar internet.
            </h2>
            <p className="mt-8 text-xl font-bold leading-8 sm:text-2xl">
              Transforme acessos em contatos.
              <br />
              Contatos em relacionamento.
              <br />
              Relacionamento em novas vendas.
            </p>
            <p className="mt-8 max-w-2xl text-base leading-7 text-slate-300">
              A ManosTech transforma o Wi-Fi do seu estabelecimento em um ponto de contato com
              seus clientes.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Enquanto eles navegam, você constrói uma base própria para conhecer melhor seu
              público e criar novas oportunidades de relacionamento.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <h2 className="max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Pare de deixar seus clientes saírem sem deixar uma conexão com o seu negócio.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
              A <strong>ManosTech System</strong> transforma o Wi-Fi do seu estabelecimento em
              uma ferramenta para conhecer melhor quem visita seu negócio, construir uma base de
              contatos e criar oportunidades para trazer seus clientes de volta.
            </p>
            <p className="mt-8 max-w-2xl text-lg font-bold leading-7 sm:text-xl">
              Você já oferece o Wi-Fi. Agora ele pode trabalhar pelo seu negócio.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              O que acontece com o cliente depois que ele usa seu Wi-Fi?
            </h2>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">Hoje</p>
                <p className="mt-4 text-lg font-bold leading-7">
                  Cliente entra → usa o Wi-Fi → vai embora.
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Você não sabe necessariamente quem esteve ali, não mantém um relacionamento e
                  precisa começar a próxima campanha praticamente do zero.
                </p>
              </article>
              <article className="rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">
                  Com a ManosTech
                </p>
                <p className="mt-4 text-lg font-bold leading-7">
                  Cliente entra → conecta → você constrói um contato → pode se relacionar depois.
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  O Wi-Fi deixa de ser apenas um serviço e passa a fazer parte da estratégia
                  comercial do seu negócio.
                </p>
              </article>
            </div>
            <p className="mt-10 text-lg font-bold leading-7 sm:text-xl">
              Menos divulgação no escuro. Mais relacionamento com quem já conhece sua marca.
            </p>
          </ScrollReveal>
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
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Pare de tomar decisões no escuro.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
              Com a ManosTech, as conexões do seu Wi-Fi deixam de ser apenas acessos à internet.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Você passa a ter informações que ajudam a entender melhor o relacionamento dos
              clientes com o seu estabelecimento e a criar ações mais direcionadas.
            </p>
            <p className="mt-8 max-w-2xl text-lg font-bold leading-7 sm:text-xl">
              Menos achismo. Mais informação para tomar decisões.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-20">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
                Dúvidas frequentes
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Perguntas de quem está conhecendo agora
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

      <section className="border-y border-white/[.07] bg-[#070D13]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {FUNNEL.map((step, index) => (
                <div key={step.label} className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                  {index > 0 ? (
                    <ArrowRight
                      className="mx-auto size-5 shrink-0 rotate-90 text-cyan-400 lg:rotate-0"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="flex-1 rounded-2xl border border-cyan-400/25 bg-cyan-400/[.05] p-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">
                      {step.label}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">{step.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <ScrollReveal>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              Os concorrentes falam muito sobre:{" "}
              <strong>“Olha quantos recursos temos.”</strong>
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              A ManosTech fala:{" "}
              <strong>
                “Olha o que acontece com seu negócio quando você começa a conhecer quem passa
                por ele.”
              </strong>
            </p>
            <div className="mt-10 rounded-2xl border border-white/[.08] bg-[#0B1118] p-5 sm:p-6">
              <p className="text-lg font-bold leading-7 sm:text-xl">
                “Caramba. Eu já tenho gente entrando na minha loja todos os dias. Por que estou
                deixando essas pessoas irem embora sem construir nenhum relacionamento?”
              </p>
            </div>
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
