import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useChatPresence } from "@/hooks/use-chat-presence";

export type ChatPresenceContextType = ReturnType<typeof useChatPresence>;

export const ChatPresenceContext = createContext<ChatPresenceContextType | null>(null);

export function ChatPresenceProvider({ children }: { children: ReactNode }) {
  const presence = useChatPresence();
  
  return (
    <ChatPresenceContext.Provider value={presence}>
      {children}
    </ChatPresenceContext.Provider>
  );
}

export const usePresence = () => {
  const context = useContext(ChatPresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a ChatPresenceProvider");
  }
  return context;
};
