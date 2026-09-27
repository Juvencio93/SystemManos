import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Retorna a data atual no fuso America/Sao_Paulo (sem horas)
 */
export function getTodayBR() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(now).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(year, month - 1, day);
}

/**
 * Calcula a diferença em dias entre duas datas YYYY-MM-DD no fuso BR
 */
export function getDiffDaysBR(dueDateStr: string) {
  if (!dueDateStr) return 0;

  const today = getTodayBR();

  // Parse YYYY-MM-DD
  const parts = dueDateStr.split("-").map(Number);
  if (parts.length !== 3) return 0;
  const [year, month, day] = parts as [number, number, number];
  const due = new Date(year, month - 1, day);

  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Formata data YYYY-MM-DD para DD/MM/YYYY sem conversão de fuso
 */
export function formatDateBR(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...options
  }).format(date);
}

export function getStatusInfo(status: string, dueDateStr: string) {
  const diff = getDiffDaysBR(dueDateStr);

  if (status === "pago") {
    return {
      label: "Pago",
      color: "text-green-500 border-green-500/30 bg-green-500/10",
      badge: "bg-green-500",
    };
  }

  if (diff < 0) {
    return {
      label: "Pagamento em atraso",
      color: "text-destructive border-destructive/30 bg-destructive/10",
      badge: "bg-destructive",
    };
  }

  if (diff === 0) {
    return {
      label: "Vence hoje",
      color: "text-amber-500 border-amber-500/30 bg-amber-500/10",
      badge: "bg-amber-500",
    };
  }

  if (diff >= 1 && diff <= 7) {
    return {
      label: `Vence em ${diff} ${diff === 1 ? "dia" : "dias"}`,
      labelShort: "Pagamento próximo",
      color: "text-amber-500 border-amber-500/30 bg-amber-500/10",
      badge: "bg-amber-500",
    };
  }

  // Agendada / Em dia
  return {
    label: "Assinatura em dia",
    labelHistory: "Agendada",
    color: "text-green-500 border-green-500/30 bg-green-500/10",
    colorHistory: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    badge: "bg-green-500",
    badgeHistory: "bg-blue-400",
  };
}
