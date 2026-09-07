import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateMessageReceipt } from "@/lib/chat.functions";

interface UseChatIntersectionProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeConversationId: string | null;
  enabled: boolean;
}

export function useChatIntersection({ containerRef, activeConversationId, enabled }: UseChatIntersectionProps) {
  const queryClient = useQueryClient();
  const pendingReadIds = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(async () => {
    if (pendingReadIds.current.size === 0) return;

    const idsToUpdate = Array.from(pendingReadIds.current);
    pendingReadIds.current.clear();

    try {
      console.log("[useChatIntersection] AUDIT BATCH START", { ids: idsToUpdate });
      await updateMessageReceipt({ data: { messageIds: idsToUpdate, status: "read" } });
      console.log("[useChatIntersection] AUDIT BATCH SUCCESS", { ids: idsToUpdate });
      // Invalidate queries to update local state immediately after server confirmation
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {
      console.error("[useChatIntersection] AUDIT BATCH ERROR", { ids: idsToUpdate, error: err });
    }
  }, [queryClient]);

  const scheduleBatch = useCallback(() => {
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    
    // Process if batch is large enough or after a short delay
    // We only process via observer for messages that arrive while the conversation is ALREADY open
    if (pendingReadIds.current.size >= 5) {
      processBatch();
    } else {
      batchTimeoutRef.current = setTimeout(processBatch, 500);
    }
  }, [processBatch]);

  useEffect(() => {
    if (!enabled || !containerRef.current || !activeConversationId) return;

    // ScrollArea component in the template uses an internal viewport element for scrolling
    // We need to target that element as the root of the IntersectionObserver
    const scrollViewport = containerRef.current.querySelector('[data-radix-scroll-area-viewport]') || containerRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        let hasNewVisible = false;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const messageId = entry.target.getAttribute("data-message-id");
            const isUnread = entry.target.getAttribute("data-unread") === "true";
            const isReceived = entry.target.getAttribute("data-received") === "true";

            if (messageId && isUnread && isReceived) {
              pendingReadIds.current.add(messageId);
              hasNewVisible = true;
            }
          }
        });

        if (hasNewVisible) {
          scheduleBatch();
        }
      },
      {
        root: scrollViewport,
        threshold: 0.6,
      }
    );

    // Function to observe currently unread received messages
    const observeUnread = () => {
      const unreadMessages = scrollViewport.querySelectorAll('[data-unread="true"][data-received="true"]');
      unreadMessages.forEach((msg) => observer.observe(msg));
    };

    // Use requestAnimationFrame to ensure DOM is ready and handle initial visibility
    const rafId = requestAnimationFrame(observeUnread);

    // Also re-check when children might change (new messages arrive)
    const mutationObserver = new MutationObserver(() => {
      observeUnread();
    });
    
    mutationObserver.observe(scrollViewport, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      cancelAnimationFrame(rafId);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    };
  }, [containerRef, activeConversationId, enabled, scheduleBatch]);

  return {
    markImmediately: processBatch
  };
}