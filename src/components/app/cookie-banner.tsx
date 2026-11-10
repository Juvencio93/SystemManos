import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "manos:cookie-notice";

/**
 * Aviso de cookies das páginas públicas. A plataforma usa só cookies
 * necessários (login e Wi-Fi), então não há categorias para aceitar ou
 * recusar — o aviso informa e aponta para a política completa. Some depois
 * de dispensado e não volta a aparecer no mesmo navegador.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "seen") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "seen");
    } catch {
      // Navegador sem acesso ao armazenamento: só esconde o aviso.
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-6 text-slate-300">
          Usamos apenas cookies necessários para o login e o Wi-Fi funcionar. Não usamos cookies
          de análise nem de publicidade.{" "}
          <Link to="/cookies" className="text-cyan-300 underline underline-offset-2">
            Ver política de cookies
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
