import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { getConversations } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";

type TriggerConversation = {
  messages?: Array<{
    sender_id: string;
    chat_message_receipts?: Array<{
      recipient_profile_id: string;
      read_at?: string | null;
    }>;
  }>;
};

export function ChatTrigger({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  const { data: access } = useAccess();
  const { data: conversations = [] } = useQuery<TriggerConversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => (await getConversations()) as TriggerConversation[],
    enabled: Boolean(access?.userId && access?.role),
    refetchInterval: 10_000,
  });

  const hasUnread = useMemo(
    () => conversations.some((conversation) =>
      conversation.messages?.some((message) => {
        if (message.sender_id === access?.userId) return false;
        return message.chat_message_receipts?.some(
          (receipt) => receipt.recipient_profile_id === access?.userId && !receipt.read_at,
        );
      }),
    ),
    [conversations, access?.userId],
  );

  return (
    <button type="button" onClick={onClick} aria-label={isOpen ? "Fechar bate-papo" : "Abrir bate-papo"} title={isOpen ? "Fechar bate-papo" : "Abrir bate-papo"} className="group relative flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary shadow-glow transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] active:scale-95">
      <div className="relative size-6">
        <MessageCircle className={cn("absolute inset-0 size-6 text-primary-foreground transition-all duration-300", isOpen ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
        <X className={cn("absolute inset-0 size-6 text-primary-foreground transition-all duration-300", isOpen ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0")} />
      </div>
      {hasUnread && !isOpen ? <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-[#0F172A] bg-red-500 text-[10px] font-bold text-white">!</span> : null}
    </button>
  );
}

