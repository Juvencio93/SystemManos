import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";

type CrmSummary = { total: number; interested: number; converted: number; pending: number; updatedAt: string };

function isCrmSummary(value: unknown): value is CrmSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<CrmSummary>;
  return (
    Number.isSafeInteger(summary.total) &&
    Number.isSafeInteger(summary.interested) &&
    Number.isSafeInteger(summary.converted) &&
    Number.isSafeInteger(summary.pending) &&
    (summary.total ?? -1) >= 0 &&
    (summary.interested ?? -1) >= 0 &&
    (summary.converted ?? -1) >= 0 &&
    (summary.pending ?? -1) >= 0 &&
    typeof summary.updatedAt === "string" &&
    !Number.isNaN(Date.parse(summary.updatedAt))
  );
}

export function LiveCrmPreview() {
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/public/marketing-crm-summary");
        if (!response.ok) throw new Error("Indicadores indisponíveis");
        const data: unknown = await response.json();
        if (!isCrmSummary(data)) throw new Error("Resposta inválida");
        if (active) {
          setSummary(data);
          setState("ready");
        }
      } catch {
        if (active) {
          setSummary(null);
          setState("error");
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const updatedTime = summary
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(summary.updatedAt))
    : null;

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-[#0b1220] p-5 shadow-2xl shadow-black/40 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300">
              <UsersRound className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">CRM de Leads Wi-Fi</p>
              <p className="text-xs text-slate-400">Do acesso ao relacionamento</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
            {state === "ready" ? "Dados atualizados" : state === "loading" ? "Atualizando" : "Indisponível"}
          </span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3" aria-live="polite">
          {[
            { label: "Leads encontrados", value: summary?.total, accent: "text-cyan-300" },
            { label: "Interessados", value: summary?.interested, accent: "text-amber-300" },
            { label: "Convertidos", value: summary?.converted, accent: "text-emerald-300" },
            { label: "Aguardando contato", value: summary?.pending, accent: "text-blue-300" },
          ].map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-2xl border border-white/[.08] bg-gradient-to-br from-white/[.05] to-white/[.015] p-4 sm:p-5">
              <p className="text-[11px] font-medium leading-4 text-slate-400">{metric.label}</p>
              <p className={`mt-3 font-display text-4xl font-bold leading-none ${metric.accent}`}>
                {metric.value ?? "—"}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[11px] leading-5 text-slate-500">
          {updatedTime
            ? `Indicadores do CRM da Padaria Efraim, atualizados às ${updatedTime}. Dados pessoais não aparecem nesta prévia.`
            : state === "loading"
              ? "Consultando os indicadores da operação piloto…"
              : "Não foi possível consultar os indicadores agora. Tente novamente em instantes."}
        </p>
      </div>
    </div>
  );
}
