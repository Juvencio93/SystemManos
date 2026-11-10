import { useState } from "react";
import { ChevronDown, Wifi } from "lucide-react";

/**
 * Réplica VISUAL estática do card "Wi-Fi dos visitantes" (wifi-visitantes-card.tsx)
 * para a landing: mesmos 6 campos da política RADIUS, com valores de exemplo.
 * Sem fetch, sem auth, sem edição — expande no hover (desktop, group-hover)
 * e no toque/clique (celular, estado `open`): no celular não existe hover,
 * então só o hover deixava o card fechado para sempre.
 */
const CAMPOS_DEMO = [
  { rotulo: "Tempo máximo por check-in", valor: "30 min" },
  { rotulo: "Inatividade máxima", valor: "5 min" },
  { rotulo: "Download por visitante", valor: "10 Mbps" },
  { rotulo: "Upload por visitante", valor: "3 Mbps" },
  { rotulo: "Limite de check-ins por aparelho", valor: "3" },
  { rotulo: "Bloqueio temporário após o limite", valor: "30 min" },
] as const;

export function WifiVisitantesDemo() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((value) => !value);

  return (
    <div
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[.08] bg-[#06141B] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_8px_32px_rgba(0,192,240,0.18)]"
    >
      {/* Cabeçalho — sempre visível */}
      <div className="flex items-center gap-3 p-5 text-left sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
          <Wifi className="size-5 text-cyan-400" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold text-white">
            Wi-Fi dos visitantes
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Demonstração
            </span>
          </h3>
          <p className="mt-1 truncate text-sm text-slate-400">
            30 min por check-in · 10↓/3↑ Mbps por visitante · 3 check-ins por
            aparelho
          </p>
        </div>
        <ChevronDown
          className={`ml-auto size-5 shrink-0 text-cyan-400 transition-transform duration-500 ${open ? "rotate-180" : "group-hover:rotate-180"}`}
          aria-hidden="true"
        />
      </div>

      {/* Dica — some quando expande */}
      <p
        className={`px-5 pb-5 text-xs text-slate-400 sm:px-6 ${open ? "hidden" : "group-hover:hidden"}`}
      >
        Toque ou passe o mouse para ver o painel completo
      </p>

      {/* Corpo expansível — abre no toque/clique OU no hover */}
      <div
        className={`grid transition-[grid-template-rows] duration-500 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr] group-hover:grid-rows-[1fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[.07] px-5 py-5 sm:px-6">
            <p className="text-sm font-medium text-white">
              Política do Wi-Fi para visitantes
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              É assim que o painel mostra as regras: aplicadas a cada novo
              check-in, a sessão encerra ao atingir o tempo máximo ou o período
              sem tráfego.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS_DEMO.map(({ rotulo, valor }) => (
                <div key={rotulo} className="grid gap-1.5">
                  <p className="text-[13px] font-medium text-slate-300">
                    {rotulo}
                  </p>
                  <div className="flex h-11 items-center rounded-md border border-white/10 bg-white/[.04] px-3 text-sm font-semibold text-white">
                    {valor}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs italic text-slate-400">
              Demonstração com valores de exemplo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
