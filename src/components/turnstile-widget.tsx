import { useEffect, useRef } from "react";

// Widget do Cloudflare Turnstile (anti-bot, item 12 da auditoria de
// segurança, 2026-11-12). O script oficial é carregado sob demanda e o
// widget é renderizado de forma explícita; o token gerado vai para o
// formulário pai, que o envia à server function — a conferência real
// acontece NO SERVIDOR (src/lib/turnstile.server.ts), nunca aqui.
//
// Sem VITE_TURNSTILE_SITE_KEY configurada o componente não renderiza
// nada e o envio segue sem token: o servidor ignora a verificação
// (fail-open) até o Gabriel configurar as chaves. Ver a PR da frente.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      size: "normal" | "compact";
      theme: "auto";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoad: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoad) {
    scriptLoad = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Não foi possível carregar a verificação anti-robô."));
      document.head.appendChild(script);
    });
  }
  return scriptLoad;
}

/** True quando a site key pública está configurada (widget ativo). */
export function isTurnstileEnabled(): boolean {
  try {
    return Boolean(import.meta.env["VITE_TURNSTILE_SITE_KEY"]);
  } catch {
    return false;
  }
}

type TurnstileWidgetProps = {
  /** Recebe o token quando gerado, e null quando expira ou falha. */
  onToken: (token: string | null) => void;
  compact?: boolean;
};

export function TurnstileWidget({ onToken, compact = false }: TurnstileWidgetProps) {
  const siteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          size: compact ? "compact" : "normal",
          theme: "auto",
        });
      })
      .catch(() => {
        // Sem o script, não há token: o envio segue e o servidor decide.
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Remoção best-effort na desmontagem.
        }
      }
    };
  }, [siteKey, compact]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" aria-label="Verificação anti-robô" />;
}
