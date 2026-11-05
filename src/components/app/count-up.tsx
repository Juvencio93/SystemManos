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
 * - Live: se `to` mudar depois da animação inicial, faz um tween suave
 *   do valor exibido até o novo alvo (~400ms), sem reiniciar do zero.
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
  const valueRef = useRef(0);
  const started = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const tween = (from: number, target: number, dur: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - start) / dur, 1);
        // ease-out cúbico: rápido no início, desacelera no final
        const eased = 1 - Math.pow(1 - progress, 3);
        const v = Math.round(from + (target - from) * eased);
        valueRef.current = v;
        setValue(v);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      valueRef.current = to;
      setValue(to);
      started.current = true;
      return;
    }

    // Live: alvo mudou depois da animação inicial — tween suave até o novo valor.
    if (started.current) {
      if (valueRef.current !== to) tween(valueRef.current, to, 400);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();
        tween(0, to, duration);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}
