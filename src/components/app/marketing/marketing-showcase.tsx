import { ScrollReveal } from "./scroll-reveal";

type ShowcaseItem = {
  src: string;
  alt: string;
  label: string;
  caption: string;
  span: string;
};

const SHOWCASE: ShowcaseItem[] = [
  {
    src: "/marketing/portal-efraim.png",
    alt: "Portal personalizado da Padaria Efraim",
    label: "Portal personalizado",
    caption: "A identidade do seu negócio já na primeira tela.",
    span: "sm:col-span-2 lg:col-span-2",
  },
  {
    src: "/marketing/campanha-estilos.webp",
    alt: "Estilos visuais disponíveis para campanhas",
    label: "Estilos de campanha",
    caption: "Modelos prontos para comunicar sem esforço.",
    span: "",
  },
  {
    src: "/marketing/campanha-cores.webp",
    alt: "Paleta de cores configurável das campanhas",
    label: "Cores da sua marca",
    caption: "Cada campanha alinhada à sua identidade.",
    span: "",
  },
  {
    src: "/marketing/politica-wifi.png",
    alt: "Tela de política de uso do Wi-Fi para visitantes",
    label: "Wi-Fi com regras claras",
    caption: "Transparência no momento da conexão.",
    span: "sm:col-span-2 lg:col-span-2",
  },
];

export function MarketingShowcase() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SHOWCASE.map((item, index) => (
        <ScrollReveal
          key={item.src}
          delay={index * 80}
          direction={index % 2 === 0 ? "up" : "zoom"}
          className={`h-full ${item.span}`}
        >
          <figure className="group relative h-full overflow-hidden rounded-3xl border border-white/[.08] bg-[#0B1118] p-2 transition-colors duration-300 hover:border-cyan-400/40">
            <div className="overflow-hidden rounded-2xl bg-[#05080F]">
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                decoding="async"
                className="aspect-[16/10] size-full object-cover object-top opacity-90 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            </div>
            <figcaption className="px-3 pb-2 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300">
                {item.label}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">{item.caption}</p>
            </figcaption>
          </figure>
        </ScrollReveal>
      ))}
    </div>
  );
}
