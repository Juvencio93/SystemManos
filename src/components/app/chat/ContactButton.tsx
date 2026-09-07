import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatProfileAvatar } from "@/components/app/chat/ChatProfileAvatar";
import { ChatPresenceIndicator } from "@/components/app/chat/ChatPresenceIndicator";
import type { ChatContact } from "@/lib/chat-validation.functions";

export function ContactButton({ contact, presenceStatus, onClick, isMatrix, isNested, isLoading }: { contact: ChatContact; presenceStatus: string; onClick: () => void; isMatrix?: boolean | undefined; isNested?: boolean | undefined; isLoading?: boolean | undefined }) {
  const isOnline = presenceStatus !== "offline";
  return (
    <button onClick={onClick} disabled={isLoading} className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all hover:bg-white/5 group", isNested && "pl-6", isLoading && "opacity-50 cursor-not-allowed")}>
      <div className="relative">
        {isLoading ? <div className="flex size-7 items-center justify-center rounded-full bg-primary/10"><Loader2 className="size-3 animate-spin text-primary" /></div> : <>
          <ChatProfileAvatar name={contact.displayName ?? "Contato"} imageUrl={contact.profileAvatarUrl ?? null} status={presenceStatus} className={cn("size-7", isMatrix && "ring-1 ring-primary/40")} />
          <ChatPresenceIndicator status={presenceStatus} className="absolute -bottom-0.5 -right-0.5 border-[#0F172A]" />
        </>}
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn("truncate text-[11px] font-medium block", isOnline ? "text-white" : "text-muted-foreground/60")}>{contact.displayName}</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">{contact.role === "adm" ? "Suporte" : contact.role === "revenda" ? "Revenda" : contact.role === "matriz" ? "Matriz" : "Filial"}</span>
      </div>
    </button>
  );
}

