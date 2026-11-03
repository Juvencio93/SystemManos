import { useRef, useState } from "react";
import { Play } from "lucide-react";

export function CampaignVideoCard({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const start = () => {
    setActive(true);
    window.requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => undefined);
    });
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-white/[.08] bg-[#080F16] shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] ${className}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {active ? (
          <video
            ref={videoRef}
            className="size-full object-cover"
            src="/marketing/criacao-campanha.mp4"
            poster="/marketing/campanha-banner.png"
            controls
            playsInline
            preload="none"
            aria-label="Demonstração da criação de campanha na ManosTech"
          />
        ) : (
          <button
            type="button"
            onClick={start}
            className="relative block size-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            aria-label="Reproduzir vídeo de criação de campanha"
          >
            <img
              src="/marketing/campanha-banner.png"
              alt="Prévia da criação de campanha na ManosTech"
              loading="lazy"
              decoding="async"
              className="size-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-[#05080F] via-[#05080F]/30 to-transparent" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition group-hover:scale-105 group-hover:bg-cyan-400 group-hover:text-slate-950">
                <Play className="size-6 translate-x-px" aria-hidden="true" />
              </span>
            </span>
            <span className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-cyan-100">
                Criação de campanha
              </span>
              <span className="text-[11px] font-semibold text-slate-300">Vídeo sob demanda</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
