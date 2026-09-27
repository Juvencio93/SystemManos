import { useState, useEffect, useRef, useCallback } from "react";

interface UseChatScrollProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  messageCount: number;
}

export function useChatScroll({ scrollRef, messagesEndRef, messageCount }: UseChatScrollProps) {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const lastMessageCountRef = useRef(messageCount);

  const checkScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Handle Radix ScrollArea internal viewport if present
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]') || container;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    
    // Consider "near bottom" if within 80px of the end
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsNearBottom(isAtBottom);

    if (isAtBottom) {
      setNewMessagesCount(0);
    }
  }, [scrollRef]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]') || container;
    viewport.addEventListener("scroll", checkScroll);
    return () => viewport.removeEventListener("scroll", checkScroll);
  }, [checkScroll, scrollRef]);

  // Handle new messages
  useEffect(() => {
    if (messageCount > lastMessageCountRef.current) {
      if (isNearBottom) {
        // Auto-scroll if user is already at bottom
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        setNewMessagesCount(0);
      } else {
        // Increment new messages counter if user is reading history
        setNewMessagesCount(prev => prev + (messageCount - lastMessageCountRef.current));
      }
    }
    lastMessageCountRef.current = messageCount;
  }, [messageCount, isNearBottom, messagesEndRef]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setNewMessagesCount(0);
    setIsNearBottom(true);
  }, [messagesEndRef]);

  return {
    isNearBottom,
    newMessagesCount,
    scrollToBottom,
    checkScroll
  };
}
