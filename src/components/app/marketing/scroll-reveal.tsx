import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealDirection = "up" | "down" | "left" | "right" | "zoom";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const HIDDEN_TRANSFORM: Record<RevealDirection, string> = {
  up: "translate3d(0, 28px, 0)",
  down: "translate3d(0, -24px, 0)",
  left: "translate3d(-32px, 0, 0)",
  right: "translate3d(32px, 0, 0)",
  zoom: "scale(.94)",
};

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  duration = 700,
  once = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: RevealDirection;
  duration?: number;
  once?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Start visible so content is never hidden when JS or observers are unavailable.
  const [visible, setVisible] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    setAnimate(true);
    const bounds = node.getBoundingClientRect();
    const alreadyInView = bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0;
    if (alreadyInView) {
      setVisible(true);
      setAnimate(false);
      return;
    }

    setVisible(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={
        animate
          ? {
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : HIDDEN_TRANSFORM[direction],
              transition: `opacity ${duration}ms cubic-bezier(.22,.8,.28,1) ${delay}ms, transform ${duration}ms cubic-bezier(.22,.8,.28,1) ${delay}ms`,
              willChange: visible ? "auto" : "opacity, transform",
            }
          : undefined
      }
    >
      {children}
    </Tag>
  );
}

export function RevealGroup({
  children,
  className = "",
  step = 90,
  direction = "up",
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
  direction?: RevealDirection;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <ScrollReveal key={index} delay={index * step} direction={direction}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
