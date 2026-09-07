import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatPresenceIndicator } from "./ChatPresenceIndicator";
import { usePresence } from "./ChatPresenceProvider";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface ChatStatusSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function ChatStatusSelector({ className, showLabel = false }: ChatStatusSelectorProps) {
  const { manualStatus, currentStatus, setStatusManual } = usePresence();
  
  // O status visível é o manual se existir, senão o automático (currentStatus)
  const activeStatus = manualStatus || currentStatus;

  const options = [
    { id: 'online', label: 'Online', color: 'bg-green-500' },
    { id: 'away', label: 'Ausente', color: 'bg-amber-500' },
    { id: 'busy', label: 'Ocupado', color: 'bg-red-500' },
  ] as const;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button 
          className={cn(
            "flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors outline-none",
            className
          )}
        >
          <ChatPresenceIndicator status={activeStatus} size={10} />
          {showLabel && (
            <span className="text-xs font-medium text-zinc-400">
              {options.find(o => o.id === activeStatus)?.label || 'Online'}
            </span>
          )}
          <ChevronDown className="size-3 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        side="bottom"
        sideOffset={8}
        className="bg-[#1E293B] border-white/10 text-white min-w-[140px] z-[9999]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => setStatusManual(option.id)}
            className={cn(
              "flex items-center gap-3 cursor-pointer focus:bg-white/5 focus:text-white py-2",
              activeStatus === option.id && "bg-white/5"
            )}
          >
            <ChatPresenceIndicator status={option.id} size={10} />
            <span className="text-sm">{option.label}</span>
          </DropdownMenuItem>
        ))}
        {manualStatus && (
          <>
            <div className="h-px bg-white/10 my-1" />
            <DropdownMenuItem
              onClick={() => setStatusManual(null)}
              className="text-xs text-zinc-500 cursor-pointer focus:bg-white/5 focus:text-zinc-400 py-1 justify-center"
            >
              Resetar para automático
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
