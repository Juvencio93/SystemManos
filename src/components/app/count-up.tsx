import { useEffect, useRef, useState } from "react";

/**
 * CountUp — anima um número de 0 até o valor alvo quando entra na viewport.
 *
 * Comportamento (igual ao observado em referências de mercado):
 * - Dispara uma única vez, quando o elemento entra na tela (IntersectionObserver)
 * - Duração ~1s com desaceleração no final (ease-out cúbico)
 * - Sufixo estático (ex: "+", "%", "h") — só a parte numérica anima
 * - Formatação pt-BR com ponto de milhar (toLocaleString)
 * - Respeita prefers-reduced-motion (pula direto para o valor final)
 */
export function CountUp({
  to,
  suffix = "",
  duration = 1000,
  className,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // ease-out cúbico: rápido no início, desacelera no final
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * to));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}
