import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useServerFn } from "@tanstack/react-start";
import { updateMyPresence } from "@/lib/chat-presence.functions";

const SOUNDS = {
  message: "/sounds/mensagem.mp3",
  online: "/sounds/online.mp3",
  attention: "/sounds/chamando-atencao.mp3",
};

const AWAY_TIMEOUT = 5 * 60 * 1000; // 5 minutos em ms

export function useChatPresence() {
  const { data: access } = useAccess();
  const updatePresenceFn = useServerFn(updateMyPresence);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [onlinePresences, setOnlinePresences] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('online');
  const [manualStatus, setManualStatus] = useState<'online' | 'away' | 'busy' | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chat-manual-status");
      return (saved as any) || null;
    }
    return null;
  });
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("chat-sound-muted") === "true";
    }
    return false;
  });
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [nudgeEventId, setNudgeEventId] = useState<string | null>(null);

  const onlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const messageAudioRef = useRef<HTMLAudioElement | null>(null);
  const attentionAudioRef = useRef<HTMLAudioElement | null>(null);

  const processedEvents = useRef(new Set<string>());
  const sessionIdRef = useRef(crypto.randomUUID());
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const currentStatusRef = useRef(currentStatus);
  const manualStatusRef = useRef(manualStatus);
  
  const accessRef = useRef(access);
  useEffect(() => {
    accessRef.current = access;
  }, [access]);

  useEffect(() => {
    currentStatusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(() => {
    manualStatusRef.current = manualStatus;
  }, [manualStatus]);

  useEffect(() => {
    onlineAudioRef.current = new Audio(SOUNDS.online);
    onlineAudioRef.current.preload = "auto";
    messageAudioRef.current = new Audio(SOUNDS.message);
    messageAudioRef.current.preload = "auto";
    attentionAudioRef.current = new Audio(SOUNDS.attention);
    attentionAudioRef.current.preload = "auto";

    const unlockAudio = () => {
      [onlineAudioRef, messageAudioRef, attentionAudioRef].forEach(ref => {
        if (ref.current) {
          ref.current.play().then(() => {
            ref.current?.pause();
            if (ref.current) ref.current.currentTime = 0;
          }).catch(() => {});
        }
      });
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };

    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem("chat-sound-muted", String(newMuted));
  };

  const playChatSound = async (type: "online" | "message" | "attention") => {
    if (isMuted) return;
    const audio =
      type === "online"
        ? onlineAudioRef.current
        : type === "message"
          ? messageAudioRef.current
          : attentionAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      await audio.play();
      setAudioEnabled(true);
    } catch (error) {
      console.error(`[Chat Audio] Falha ao tocar ${type}:`, error);
      setAudioEnabled(false);
    }
  };

  useEffect(() => {
    if (!access?.userId) return;

    const { userId, role, companyId, branchId } = access;
    const sessionId = sessionIdRef.current;

    // --- Presence Channel ---
    const channel = supabase.channel('presence:global', {
      config: {
        presence: { key: userId },
      },
    });
    presenceChannelRef.current = channel;

    const updateStatus = async (newStatus: 'online' | 'away' | 'busy' | 'offline') => {
      // Prioridade: Offline > Manual Status > Automatic Status
      let statusToApply = newStatus;
      const activeManualStatus = manualStatusRef.current;
      
      if (newStatus !== 'offline' && activeManualStatus) {
        statusToApply = activeManualStatus;
      }

      if (currentStatusRef.current === statusToApply) return;
      
      try {
        await updatePresenceFn({ data: { status: statusToApply as any } });
        setCurrentStatus(statusToApply);
      } catch (err) {
        console.error('[Presence] Failed to update status:', err);
      }
    };

    const resetActivityTimer = () => {
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      
      // Se tiver status manual, não faz transição automática
      if (manualStatusRef.current === 'busy' || manualStatusRef.current === 'away') return;
      
      if (currentStatusRef.current === 'away') {
        void updateStatus('online');
      }

      activityTimeoutRef.current = setTimeout(() => {
        void updateStatus('away');
      }, AWAY_TIMEOUT);
    };

    // BroadcastChannel for cross-tab activity synchronization
    broadcastChannelRef.current = new BroadcastChannel('chat_user_activity');
    broadcastChannelRef.current.onmessage = (event) => {
      if (event.data === 'USER_ACTIVITY') {
        // Activity detected in another tab
        resetActivityTimer();
      } else if (typeof event.data === 'object' && event.data.type === 'STATUS_CHANGE') {
        setManualStatus(event.data.status);
        localStorage.setItem("chat-manual-status", event.data.status || "");
      }
    };

    const handleUserActivity = () => {
      resetActivityTimer();
      broadcastChannelRef.current?.postMessage('USER_ACTIVITY');
    };

    // Activity Listeners
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(ev => window.addEventListener(ev, handleUserActivity));

    const handleSync = async () => {
      const state = channel.presenceState();
      const parsed = Object.entries(state).flatMap(([presenceKey, entries]: [string, any]) =>
        (entries ?? []).map((entry: any) => ({
          userId: entry.userId ?? presenceKey,
          role: String(entry.role ?? "").toLowerCase() === "admin" ? "adm" : String(entry.role ?? "").toLowerCase(),
          companyId: entry.companyId ?? null,
          branchId: entry.branchId ?? null,
          sessionId: entry.sessionId ?? null,
          status: entry.status ?? "online",
        }))
      );
      
      const uniqueUsers = new Set(parsed.map((p: any) => p.userId).filter(Boolean));
      setOnlinePresences(parsed);
      setOnlineUsers(uniqueUsers);
    };

    const handleJoin = async (payload: any) => {
      const userPresences = payload.newPresences;
      if (userPresences.some((p: any) => p.userId === userId)) {
        await updateStatus('online');
        resetActivityTimer();
      } else if (userPresences.some((p: any) => p.userId)) {
        window.dispatchEvent(new CustomEvent("chat:user-joined", {
          detail: { presences: userPresences },
        }));
      }
    };

    const handleLeave = async (payload: any) => {
      const state = channel.presenceState();
      if (!state[userId] || state[userId].length === 0) {
        await updateStatus('offline');
        if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      }
    };

    channel
      .on("presence", { event: "sync" }, handleSync)
      .on("presence", { event: "join" }, handleJoin)
      .on("presence", { event: "leave" }, handleLeave)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            sessionId,
            role,
            companyId: companyId ?? null,
            branchId: branchId ?? null,
            status: manualStatusRef.current || currentStatusRef.current || "online",
            onlineAt: new Date().toISOString(),
          });
        }
      });

    // --- Personal Nudge Listener ---
    const nudgeChannel = supabase.channel(`local:widget:nudge:${userId}`);
    nudgeChannel
      .on('broadcast', { event: 'chat:nudge' }, async (payload) => {
        const data = (payload as any)['payload'];
        if (!data?.eventId || !data.conversationId || processedEvents.current.has(data.eventId)) return;
        processedEvents.current.add(data.eventId);
        if (data.fromUserId === userId) return;

        void playChatSound("attention");
        setIsChatOpen(true);
        setPendingConversationId(data.conversationId);
        setNudgeEventId(data.eventId);

        if (processedEvents.current.size > 200) {
          const first = processedEvents.current.values().next().value;
          if (first) processedEvents.current.delete(first);
        }
      })
      .subscribe();

    // --- Personal Messages Listener ---
    const msgChannel = supabase.channel(`local:widget:messages:${userId}`);
    msgChannel
      .on('broadcast', { event: 'chat:message' }, async (payload) => {
        const data = (payload as any)['payload'];
        if (!data?.messageId || !data?.conversationId || !data?.fromUserId || data.fromUserId === userId) return;
        if (processedEvents.current.has(data.eventId || data.messageId)) return;
        processedEvents.current.add(data.eventId || data.messageId);

        const isNudgeMessage = data.event === "nudge";

        try {
          await playChatSound(isNudgeMessage ? "attention" : "message");
        } catch (audioErr) {
          console.warn("[chat] Não foi possível tocar o som do chat.", audioErr);
        }

        if (isNudgeMessage) {
          setIsChatOpen(true);
          setPendingConversationId(data.conversationId);
          setNudgeEventId(data.eventId || data.messageId);
        }
        
        window.dispatchEvent(new CustomEvent('chat:new-message', { 
          detail: { conversationId: data.conversationId, messageId: data.messageId } 
        }));

        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          new Notification("Nova mensagem interna", {
            body: "Você recebeu uma nova mensagem no bate-papo.",
            tag: `chat-${data.conversationId}`,
          });
        }

        if (processedEvents.current.size > 200) {
          const first = processedEvents.current.values().next().value;
          if (first) processedEvents.current.delete(first);
        }
      })
      .subscribe();

    // --- Message Status (Receipts) Listener ---
    const receiptChannel = supabase.channel(`local:widget:receipts:${userId}`);
    receiptChannel
      .on('broadcast', { event: 'chat:receipt_update' }, (payload) => {
        const data = (payload as any)['payload'];
        if (!data?.messageId) return;
        window.dispatchEvent(new CustomEvent('chat:receipt-update', { detail: data }));
      })
      .subscribe();

    return () => {
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      activityEvents.forEach(ev => window.removeEventListener(ev, handleUserActivity));
      broadcastChannelRef.current?.close();

      void channel.untrack();
      void supabase.removeChannel(channel);
      if (presenceChannelRef.current === channel) {
        presenceChannelRef.current = null;
      }
      void supabase.removeChannel(nudgeChannel);
      void supabase.removeChannel(msgChannel);
      void supabase.removeChannel(receiptChannel);
    };
  }, [access?.userId, access?.role, access?.companyId, access?.branchId]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const requestPermission = () => {
      Notification.requestPermission().catch(() => undefined);
      window.removeEventListener("pointerdown", requestPermission);
      window.removeEventListener("keydown", requestPermission);
    };

    window.addEventListener("pointerdown", requestPermission, { once: true });
    window.addEventListener("keydown", requestPermission, { once: true });

    return () => {
      window.removeEventListener("pointerdown", requestPermission);
      window.removeEventListener("keydown", requestPermission);
    };
  }, []);

  const setStatusManual = (status: 'online' | 'away' | 'busy' | null) => {
    manualStatusRef.current = status;
    setManualStatus(status);
    if (status) {
      localStorage.setItem("chat-manual-status", status);
    } else {
      localStorage.removeItem("chat-manual-status");
    }
    broadcastChannelRef.current?.postMessage({ type: 'STATUS_CHANGE', status });
    
    // Trigger immediate update if connected
    if (access?.userId) {
      const statusToApply = status || 'online';
      currentStatusRef.current = statusToApply;
      void updatePresenceFn({ data: { status: statusToApply as any } });
      setCurrentStatus(statusToApply);
      void presenceChannelRef.current?.track({
        userId: access.userId,
        sessionId: sessionIdRef.current,
        role: access.role,
        companyId: access.companyId ?? null,
        branchId: access.branchId ?? null,
        status: statusToApply,
        onlineAt: new Date().toISOString(),
      });
    }
  };

  return {
    onlineUsers,
    onlinePresences,
    currentStatus,
    manualStatus,
    setStatusManual,
    isMuted,
    audioEnabled,
    toggleMute,
    playChatSound,
    isChatOpen,
    setIsChatOpen,
    pendingConversationId,
    setPendingConversationId,
    nudgeEventId,
    setNudgeEventId,
    receiptUpdate: null,
    globalChannelName: access?.userId ? 'chat:typing:global' : null,
  };
}
