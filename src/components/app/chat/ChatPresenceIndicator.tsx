import { cn } from "@/lib/utils";

interface ChatPresenceIndicatorProps {
  status: 'online' | 'offline' | 'unknown' | string;
  className?: string;
  size?: number;
}

export function ChatPresenceIndicator({ 
  status, 
  className,
  size = 8
}: ChatPresenceIndicatorProps) {
  if (status === 'unknown') return null;

  const isOnline = status === 'online';
  const isAway = status === 'away';
  const isBusy = status === 'busy';

  return (
    <span
      className={cn(
        "rounded-full border border-[#0F172A] transition-all duration-300",
        isOnline 
          ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" 
          : isAway
            ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
            : isBusy
              ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              : "bg-zinc-600",
        className
      )}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        flexShrink: 0
      }}
      role="status"
      aria-label={isOnline ? "Online" : isAway ? "Ausente" : isBusy ? "Ocupado" : "Offline"}
      title={isOnline ? "Online" : isAway ? "Ausente" : isBusy ? "Ocupado" : "Offline"}
    />
  );
}
