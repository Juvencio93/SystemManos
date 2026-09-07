import { useState, useEffect, useRef, useMemo, useContext, useCallback, useLayoutEffect, useLayoutEffect as useIsoLayoutEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Send, 
  Volume2, 
  VolumeX, 
  Search, 
  X, 
  MessagesSquare, 
  ChevronRight, 
  Paperclip, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Loader2,
  Pin,
  PinOff,
  Trash2,
  MoreVertical,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  ChevronDown,
  Reply,
  Pencil
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { ChatPresenceContext, usePresence } from "./ChatPresenceProvider";
import { deleteChatMessage, editChatMessage, getConversations, hideConversation, setConversationPinned } from "@/lib/chat.functions";
import { getChatContacts, getOrCreateConversation, participantKey, resolveNudgeTargetUserIds, markConversationAsRead, ChatContact } from "@/lib/chat-validation.functions";
import { getPresenceStatus, updateMyPresence } from "@/lib/chat-presence.functions";
import { callContactAttention } from "@/lib/chat-attention.functions";
import { withConversationLock } from "@/lib/chat-conversation-request-lock.ts";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useChatIntersection } from "@/hooks/use-chat-intersection";
import { isValidUuid } from "@/lib/uuid";
import { sendChatMessage } from "@/lib/send-chat-message";


import { ChatAttachment } from "./ChatAttachment";
import { ChatPresenceIndicator } from "./ChatPresenceIndicator";
import { ChatStatusSelector } from "./ChatStatusSelector";
import { ChatTrigger } from "./ChatTrigger";
import { ContactButton } from "./ContactButton";
import type { ChatConversation as Conversation, ChatMessage as Message } from "./chat-types";

import { getUserGreetingName } from "@/lib/name-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatProfileAvatar } from "./ChatProfileAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";



export function GlobalChatWidget() {
    return <ChatInner />;
}

function ChatInner() {
    const { data: access } = useAccess();
    const queryClient = useQueryClient();
    const presence = usePresence();
    const playSound = presence?.playChatSound || (() => {});
    const { isChatOpen: isOpen, setIsChatOpen: setIsOpen, pendingConversationId, setPendingConversationId, nudgeEventId, setNudgeEventId } = presence;
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
    const lastReadRequestKey = useRef<string | null>(null);


    const toggleOpen = useCallback((val: boolean) => setIsOpen(val), []);

    useEffect(() => {
        const handleAiOpenChange = (event: Event) => {
            const detail = (event as CustomEvent<{ isOpen?: boolean }>).detail;
            setIsAiAssistantOpen(Boolean(detail?.isOpen));
        };
        window.addEventListener("ai-assistant-open-change", handleAiOpenChange);
        return () => window.removeEventListener("ai-assistant-open-change", handleAiOpenChange);
    }, []);
    const role = access?.role;

    // Resolved identification for direct reading confirmation
    const currentProfileId = access?.userId;

    useEffect(() => {
        if (!access?.userId) return;

        const handleNewMessage = async (e: any) => {
            const { conversationId } = e.detail;
            
            // Invalidate to update unread counts and message lists
            queryClient.invalidateQueries({ queryKey: ["conversations"] });

            // If it's a new message for the active conversation, trigger visibility check
            if (conversationId === activeConversationId && isOpen) {
                requestAnimationFrame(() => {
                    const scrollArea = document.querySelector('.chat-messages-scroll-area');
                    const scrollViewport = scrollArea?.querySelector('[data-radix-scroll-area-viewport]');
                    if (scrollViewport) {
                        scrollViewport.dispatchEvent(new Event('scroll'));
                    }
                });
            }
        };

        const handleReceiptUpdate = (e: any) => {
            const data = e.detail;
            if (data?.conversationId && data?.messageId) {
                queryClient.setQueryData(["conversations"], (old: any[] | undefined) => {
                    if (!old) return old;
                    return old.map(conv => {
                        if (conv.id !== data.conversationId) return conv;
                        
                        const updatedMessages = (conv.messages || []).map((msg: any) => {
                            if (msg.id === data.messageId) {
                                return { 
                                    ...msg, 
                                    read_at: data.status === 'read' ? (data.updatedAt || new Date().toISOString()) : msg.read_at,
                                    delivered_at: data.updatedAt || new Date().toISOString()
                                };
                            }
                            return msg;
                        });

                        return {
                            ...conv,
                            messages: updatedMessages
                        };
                    });
                });
            }
            // Garantia final assíncrona
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
        };

        window.addEventListener('chat:new-message', handleNewMessage);
        window.addEventListener('chat:receipt-update', handleReceiptUpdate);
        return () => {
          window.removeEventListener('chat:new-message', handleNewMessage);
          window.removeEventListener('chat:receipt-update', handleReceiptUpdate);
        };

    }, [access?.userId, activeConversationId, isOpen, queryClient]);


    // Effect to handle incoming nudge from presence context
    useEffect(() => {
        if (pendingConversationId && isOpen && access?.userId) {
            setActiveConversationId(pendingConversationId);
            // Clear pending so we don't keep resetting if user manually changes
            setPendingConversationId(null);
            
            // Reading confirmation will be handled by the ChatPanel's mount effect for initial unread messages
        }
    }, [pendingConversationId, isOpen, access?.userId, setActiveConversationId, setPendingConversationId]);




    if (!access || !role) return null;

    return (
      <>
      <div 
        className={cn(
          "fixed z-[80] transition-all duration-500",
          "bottom-[calc(20px+env(safe-area-inset-bottom))]",
          isAiAssistantOpen ? "left-5 right-auto" : "right-5 left-auto"
        )}
        style={{
          width: '56px',
          height: '56px'
        }}
      >
        <ChatTrigger onClick={() => setIsOpen(!isOpen)} isOpen={isOpen}/>
      </div>

      {isOpen && (
        <div 
          className={cn(
            "fixed z-[70] flex flex-col w-[90vw] sm:w-[420px] shadow-elevated overflow-hidden transition-all duration-500",
            "bg-[#0F172A] border border-primary/20 rounded-3xl",
            "animate-in slide-in-from-bottom-5 fade-in",
            isAiAssistantOpen ? "left-5 right-auto" : "right-5 left-auto"
          )}
          style={{
            height: '600px',
            maxHeight: 'calc(100dvh - 20px - 56px - 12px - 20px - env(safe-area-inset-bottom))',
            bottom: 'calc(20px + 56px + 12px + env(safe-area-inset-bottom))'
          }}
        >
          <ChatPanel onClose={() => toggleOpen(false)} setIsOpen={toggleOpen} activeConversationId={activeConversationId} setActiveConversationId={setActiveConversationId}/>
        </div>
      )}
    </>
  );
}

function ChatPanel({ onClose, setIsOpen, activeConversationId, setActiveConversationId }: { onClose: () => void, setIsOpen: (val: boolean) => void, activeConversationId: string | null, setActiveConversationId: (id: string | null) => void }) {
    const { data: access } = useAccess();
    const queryClient = useQueryClient();
    const presence = useContext(ChatPresenceContext);
    if (!presence) throw new Error("ChatPanel must be used within ChatPresenceProvider");
    const { onlineUsers, onlinePresences, isMuted, toggleMute, playChatSound, audioEnabled, nudgeEventId, setNudgeEventId, globalChannelName, currentStatus, manualStatus } = presence;
    const [messageText, setMessageText] = useState("");
    const [replyingTo, setReplyingTo] = useState<any | null>(null);
    const [editingMessage, setEditingMessage] = useState<any | null>(null);
    const [draftContact, setDraftContact] = useState<ChatContact | null>(null);
    const [expandedMatrices, setExpandedMatrices] = useState<Set<string>>(new Set());
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [isAttentionShaking, setIsAttentionShaking] = useState(false);

    const widgetRef = useRef<HTMLDivElement>(null);
    const processedNudgeEvents = useRef(new Set<string>());
    const [isUploading, setIsUploading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isCreatingConversation, setIsCreatingConversation] = useState(false);
    
    // Proteção contra clique duplo e race condition
    const loadingContacts: Record<string, boolean> = {};
    const activeRequestsRef = useRef<Record<string, Promise<any>>>({}); // Deprecated in favor of global withConversationLock

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [conversationToHide, setConversationToHide] = useState<string | null>(null);
    const [optimisticMessages, setOptimisticMessages] = useState<Record<string, any[]>>({});
    const [failedMessageIds, setFailedMessageIds] = useState<Set<string>>(new Set());

    useEffect(() => {
      const onPlayerTrack = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== "PLAYERMANOS_NOW_PLAYING") return;
        void updateMyPresence({
          data: {
            status: data.stopped ? "offline" : "online",
            nowPlaying: typeof data.nowPlaying === "string" && data.nowPlaying.trim() ? data.nowPlaying.trim() : null,
          },
        });
      };
      window.addEventListener("message", onPlayerTrack);
      return () => window.removeEventListener("message", onPlayerTrack);
    }, []);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sessionUnreadBoundary, setSessionUnreadBoundary] = useState<string | null>(null);
    const [actionMessageId, setActionMessageId] = useState<string | null>(null);

    useEffect(() => {
      if (!replyingTo?.id) return;
      requestAnimationFrame(() => {
        document.querySelector(`[data-message-id="${replyingTo.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }, [replyingTo?.id]);
    const lastReadRequestKey = useRef<string | null>(null);



    const { data: conversations = [], isLoading: isLoadingConvs } = useQuery<Conversation[]>({
        queryKey: ["conversations"],
        queryFn: async () => {
            const result = await getConversations();
            return result as any;
        },
        enabled: !!access?.userId && !!access?.role,
        // Realtime atualiza mensagens/conversas imediatamente; este polling
        // é apenas uma salvaguarda leve para eventos perdidos.
        refetchInterval: 10000,
        refetchIntervalInBackground: false,
    });

    const { data: contactsResponse, isLoading: isLoadingContacts } = useQuery<{ matrices: ChatContact[], others: ChatContact[] }>({
        queryKey: [
            "chat-contacts",
            access?.userId,
            access?.role,
            access?.companyId,
            access?.branchId,
        ],
        queryFn: async () => {
            const result = await getChatContacts();
            return result as any;
        },
        // The widget can mount before its authenticated session has finished
        // hydrating. Waiting for the resolved access scope prevents an early
        // unauthorized request from being cached as an empty list.
        enabled: !!access?.userId && !!access?.role,
    });

    const contacts = contactsResponse;

    const contactsByMatrix = useMemo(() => {
        if (!contactsResponse?.matrices) return new Map<string, ChatContact[]>();
        const grouped = new Map<string, ChatContact[]>();
        
        // Assegurar que Matrizes apareçam como topo da hierarquia no agrupamento
        contactsResponse.matrices.forEach(contact => {
            const groupKey = contact.role === 'matriz' ? contact.companyId : (contact.parentMatrixCompanyId || contact.companyId);
            if (!grouped.has(groupKey)) grouped.set(groupKey, []);
            
            // Colocar Matriz no início da lista do grupo
            if (contact.role === 'matriz') {
              grouped.get(groupKey)?.unshift(contact);
            } else {
              grouped.get(groupKey)?.push(contact);
            }
        });
        return grouped;
    }, [contactsResponse]);


    const otherContacts = contactsResponse?.others || [];

    // Conversations loaded from legacy support threads may not contain the
    // recipient profile in their participant rows. Reuse the already
    // enriched contact list so the active row/header still shows the avatar.
    const contactAvatarByProfileId = useMemo(() => {
      const map = new Map<string, string>();
      [...(contactsResponse?.matrices || []), ...(contactsResponse?.others || [])].forEach((contact) => {
        if (contact.profileId && contact.profileAvatarUrl) {
          map.set(contact.profileId, contact.profileAvatarUrl);
        }
      });
      return map;
    }, [contactsResponse]);

    const getConversationAvatar = useCallback((conversation: any) => {
      if (conversation?.contact_profile_avatar_url) return conversation.contact_profile_avatar_url;
      if (conversation?.other_profile_id) return contactAvatarByProfileId.get(conversation.other_profile_id) || null;
      if (conversation?.contact_type === "support") {
        const supportContacts = [...(contactsResponse?.matrices || []), ...(contactsResponse?.others || [])];
        const preferredRole = access?.role === "revenda" ? "adm" : "revenda";
        return supportContacts.find((contact) => contact.role === preferredRole)?.profileAvatarUrl ||
          supportContacts.find((contact) => contact.role === "adm" || contact.role === "revenda")?.profileAvatarUrl || null;
      }
      return null;
    }, [access?.role, contactAvatarByProfileId, contactsResponse]);

    const trackedPresenceProfileIds = useMemo(() => {
      const ids = new Set<string>();
      contactsResponse?.matrices?.forEach((contact) => contact.profileId && ids.add(contact.profileId));
      contactsResponse?.others?.forEach((contact) => contact.profileId && ids.add(contact.profileId));
      conversations.forEach((conversation: any) => {
        if (conversation.other_profile_id) ids.add(conversation.other_profile_id);
      });
      return Array.from(ids);
    }, [contactsResponse, conversations]);

    const { data: persistedPresences = [] } = useQuery({
      queryKey: ["chat-presence-status", trackedPresenceProfileIds],
      queryFn: async () => getPresenceStatus({ data: { profileIds: trackedPresenceProfileIds } }),
      enabled: trackedPresenceProfileIds.length > 0,
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
    });

    const getPersistedPresenceStatus = useCallback((profileId: string | null) => {
      if (!profileId) return "offline";
      const presence = (persistedPresences as any[]).find((item) => item.profile_id === profileId);
      if (!presence?.status || !presence?.last_seen_at) return "offline";
      const lastSeenAt = new Date(presence.last_seen_at).getTime();
      if (Number.isNaN(lastSeenAt) || Date.now() - lastSeenAt > 2 * 60 * 1000) return "offline";
      return presence.status;
    }, [persistedPresences]);

    const getNowPlaying = useCallback((profileId: string | null) => {
      if (!profileId) return null;
      const presence = (persistedPresences as any[]).find((item) => item.profile_id === profileId);
      if (!presence?.now_playing || presence.status === "offline" || !presence.last_seen_at) return null;
      const lastSeenAt = new Date(presence.last_seen_at).getTime();
      if (Number.isNaN(lastSeenAt) || Date.now() - lastSeenAt > 2 * 60 * 1000) return null;
      return presence.now_playing;
    }, [persistedPresences]);


    const storedActiveConversation = conversations.find((c) => c.id === activeConversationId);
    const draftConversation = draftContact && (
        activeConversationId === `draft:${draftContact.profileId}` ||
        (isValidUuid(activeConversationId) && !storedActiveConversation)
      )
      ? {
          id: activeConversationId,
          display_name: draftContact.displayName,
          contact_profile_name: draftContact.profileDisplayName || draftContact.displayName,
          contact_profile_avatar_url: draftContact.profileAvatarUrl || null,
          contact_type: draftContact.role === "adm" ? "support" : draftContact.role,
          contact_id: draftContact.companyId,
          other_profile_id: draftContact.profileId,
          conversation_participants: [],
          messages: [],
        }
      : undefined;
    const activeConversation = storedActiveConversation || draftConversation;
    const messages = activeConversation?.messages || [];

    const compactOrganizationName = (name: string) => {
      const words = name
        .trim()
        .split(/\s+/)
        .map(word => word.replace(/^[,.;:]+|[,.;:]+$/g, ""))
        .filter(Boolean);
      if (words.length <= 2) return words.join(" ");
      return `${words[0]} ${words[words.length - 1]}`;
    };

    const getHeaderLabel = (conversation: any) => {
      if (conversation?.contact_type === "support") {
        const supportName = conversation?.contact_profile_name;
        return supportName && supportName !== "Suporte"
          ? `${supportName} - Suporte`
          : "Suporte";
      }
      const person = conversation?.contact_profile_name;
      const organization = conversation?.display_name
        ? compactOrganizationName(conversation.display_name)
        : "";
      const roleLabel = conversation?.contact_type === "filial" ? "Filial" : conversation?.contact_type === "revenda" ? "Suporte Técnico" : "Matriz";
      if (person && organization && person !== organization) {
        return `${person} — ${organization} (${roleLabel})`;
      }
      return `${person || organization || "Contato"} (${roleLabel})`;
    };

    const getDayKey = (value?: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return format(date, "yyyy-MM-dd");
    };

    const getDateDividerLabel = (value?: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const diffDays = Math.round((startOfToday - startOfDate) / 86400000);
      if (diffDays === 0) return "Hoje";
      if (diffDays === 1) return "Ontem";
      if (diffDays === 2) return "Anteontem";
      return format(date, "dd/MM/yyyy");
    };

    const { isNearBottom, newMessagesCount, scrollToBottom } = useChatScroll({
        scrollRef,
        messagesEndRef,
        messageCount: messages.length + (optimisticMessages[activeConversationId!]?.length || 0),
    });

    useChatIntersection({
        containerRef: scrollRef,
        activeConversationId,
        enabled: isValidUuid(activeConversationId)
    });

    // Reading confirmation when opening a conversation
    useEffect(() => {
        // A selected contact uses a local `draft:<profileId>` identifier until
        // the first message creates the persisted conversation. Server
        // functions must only receive the real UUID returned by Supabase.
        if (!isValidUuid(activeConversationId) || !access?.userId || isLoadingConvs) return;
        
        // Calculate unread incoming messages using receipts
        const unreadIncomingMessages = messages.filter((m: any) => {
          const isMe = m.sender_id === access.userId;
          if (isMe) return false;
          const receipt = m.chat_message_receipts?.find(
            (r: any) => r.recipient_profile_id === access.userId
          );
          return receipt && !receipt.read_at;
        });
        
        const firstUnreadId = unreadIncomingMessages[0]?.id || null;

        // 1. First save: set the visual boundary for "Novas mensagens" divider
        setSessionUnreadBoundary(firstUnreadId);

        // 2. Avoid repeated calls: Use a key based on the current opening state
        const readRequestKey = `${access.userId}:${activeConversationId}:${firstUnreadId}`;
        
        if (lastReadRequestKey.current !== readRequestKey) {
            lastReadRequestKey.current = readRequestKey;
            
            // Confirm directly as read all incoming messages in this conversation
            markConversationAsRead({ data: { conversationId: activeConversationId } })
                .then((result: any) => {
                    console.log("[ChatPanel] AUDIT CLIENT SUCCESS", {
                        conversationId: activeConversationId,
                        readCount: result.readMessageIds?.length,
                        remaining: result.remainingUnreadCount
                    });

                    // Synchronous optimistic update to ["conversations"]
                    queryClient.setQueryData(["conversations"], (oldData: any[]) => {
                        if (!oldData) return oldData;
                        return oldData.map(conv => {
                            if (conv.id !== activeConversationId) return conv;
                            
                            // 1. Update unreadCount
                            // 2. Update read_at for current messages
                            const updatedMessages = (conv.messages || []).map((msg: any) => {
                                if (result.readMessageIds?.includes(msg.id)) {
                                    return { ...msg, read_at: result.readAt || new Date().toISOString() };
                                }
                                return msg;
                            });

                            return {
                                ...conv,
                                unreadCount: result.remainingUnreadCount,
                                messages: updatedMessages
                            };
                        });
                    });

                    // Final synchronization refetch
                    queryClient.invalidateQueries({ queryKey: ["conversations"] });
                })
                .catch(err => {
                    console.error("[ChatPanel] AUDIT CLIENT ERROR", {
                        conversationId: activeConversationId,
                        error: err
                    });
                    lastReadRequestKey.current = null; // allow retry
                });
        }

        // Initial scroll
        const timeoutId = setTimeout(() => {
          if (firstUnreadId) {
            const element = document.querySelector(`[data-message-id="${firstUnreadId}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
          } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
          }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [activeConversationId, isLoadingConvs]);

    // Clean up read request key when closing conversation
    useEffect(() => {
      if (!activeConversationId) {
        lastReadRequestKey.current = null;
      }
    }, [activeConversationId]);


    // Force scroll re-check when switching conversation
    useLayoutEffect(() => {
        if (activeConversationId) {
            const scrollViewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollViewport) {
                // Trigger a scroll event to wake up the observer
                scrollViewport.dispatchEvent(new Event('scroll'));
            }
        }
    }, [activeConversationId]);


    // Mark as read when conversation is opened is now handled by IntersectionObserver
    // We can remove the automatic mark-as-read on mount.



    const triggerAttentionShake = useCallback(() => {
      setIsAttentionShaking(false);
      
      requestAnimationFrame(() => {
        setIsAttentionShaking(true);
      });

      if (navigator.vibrate) {
        navigator.vibrate([70, 40, 70]);
      }

      setTimeout(() => {
        setIsAttentionShaking(false);
      }, 550);
    }, []);

    // Effect to trigger shake when a nudge event ID changes
    useEffect(() => {
        if (nudgeEventId) {
            triggerAttentionShake();
            const timer = setTimeout(() => setNudgeEventId(null), 1000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [nudgeEventId, setNudgeEventId, triggerAttentionShake]);
    
    // Typing indicator logic
    const lastTypingSent = useRef<number>(0);
    const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        if (!access?.userId || !globalChannelName) return;

        const channel = supabase.channel(globalChannelName);
        typingChannelRef.current = channel;
        
        const handleTyping = (payload: any) => {
            const { conversationId, senderProfileId, isTyping } = payload.payload;
            
            if (senderProfileId === access.userId) return;
            if (conversationId !== activeConversationId) return;

            setTypingUsers(prev => {
                const next = new Set(prev);
                if (isTyping) {
                    next.add(senderProfileId);
                } else {
                    next.delete(senderProfileId);
                }
                return next;
            });

            // Local expiration (4 seconds)
            if (isTyping) {
                if (typingTimeoutRef.current[senderProfileId]) {
                    clearTimeout(typingTimeoutRef.current[senderProfileId]);
                }
                typingTimeoutRef.current[senderProfileId] = setTimeout(() => {
                    setTypingUsers(prev => {
                        const next = new Set(prev);
                        next.delete(senderProfileId);
                        return next;
                    });
                }, 4000);
            }
        };

        channel.on('broadcast', { event: 'typing' }, handleTyping).subscribe();

        return () => {
            Object.values(typingTimeoutRef.current).forEach(clearTimeout);
            if (typingChannelRef.current === channel) {
                typingChannelRef.current = null;
            }
            supabase.removeChannel(channel);
        };
    }, [access?.userId, activeConversationId, globalChannelName]);

    const sendTypingBroadcast = useCallback((isTyping: boolean) => {
        if (!isValidUuid(activeConversationId) || !access?.userId || !globalChannelName) return;
        const channel = typingChannelRef.current;
        if (!channel) return;
        
        const now = Date.now();
        if (isTyping && now - lastTypingSent.current < 2000) return;
        
        lastTypingSent.current = now;
        channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
                conversationId: activeConversationId,
                senderProfileId: access.userId,
                isTyping
            }
        });
    }, [activeConversationId, access?.userId, globalChannelName]);

    // Cleanup typing when switching conversations or closing
    useEffect(() => {
        if (!activeConversationId) {
            setTypingUsers(new Set());
        }
        return () => {
            if (activeConversationId) {
                sendTypingBroadcast(false);
            }
        };
    }, [activeConversationId, sendTypingBroadcast]);

    useEffect(() => {
        // No additional global isOpen logic needed as cleanup is handled by unmount/activeConversationId change
    }, [sendTypingBroadcast]);



    const refetchConversations = useCallback(async () => {
        const result = await queryClient.fetchQuery({
            queryKey: ["conversations"],
            queryFn: async () => {
                const result = await getConversations();
                return result as any;
            },
        });
        return result as Conversation[] || [];
    }, [queryClient]);

    // Removed local nudge listener in favor of GlobalChatPresenceProvider listener


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            toast.error("O arquivo excede o limite máximo de 20 MB.");
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Envie somente imagens ou arquivos PDF.");
            return;
        }
        setPendingFile(file);
    };

    const handleSendMessage = async (e?: React.FormEvent, retryData?: any) => {
        if (e) e.preventDefault();
        
        let conversationId = activeConversationId;
        const content = retryData ? retryData.content : messageText.trim();
        const attachments = retryData ? retryData.attachments : (pendingFile ? [] : []);

        if (editingMessage && !retryData) {
            if (!content) return;
            try {
                await editChatMessage({ data: { messageId: editingMessage.id, content } });
                setEditingMessage(null);
                setMessageText("");
                await refetchConversations();
                toast.success("Mensagem editada.");
            } catch (err: any) {
                toast.error(err?.message || "Erro ao editar mensagem");
            }
            return;
        }

        const hasAttachments = Boolean(pendingFile) || (attachments && attachments.length > 0);
        if ((!content && !hasAttachments) || isAttentionShaking || isUploading || isSending) return;

        try {
            conversationId = await ensureConversation();
        } catch (err: any) {
            toast.error(err?.message || "Erro ao iniciar conversa");
            return;
        }

        const clientMessageId = retryData?.clientMessageId || crypto.randomUUID();

        // Optimistic Update
        const optimisticMsg = {
          id: clientMessageId,
          sender_id: access?.userId,
          content,
          created_at: new Date().toISOString(),
          status: 'sending',
          clientMessageId,
          attachments: retryData?.attachments || []
        };

        setOptimisticMessages(prev => ({
          ...prev,
          [conversationId!]: [...(prev[conversationId!] || []), optimisticMsg]
        }));
        setFailedMessageIds(prev => {
          const next = new Set(prev);
          next.delete(clientMessageId);
          return next;
        });

        let uploadedAttachments = retryData?.attachments || [];
        if (pendingFile) {
            setIsUploading(true);
            try {
                const sanitizedName = pendingFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const fileName = `${crypto.randomUUID()}-${sanitizedName}`;
                const filePath = `chat/${conversationId}/${access?.userId}/${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('chat_attachments')
                    .upload(filePath, pendingFile);
                
                if (uploadError) throw uploadError;
                
                uploadedAttachments = [{
                    filePath,
                    fileName: pendingFile.name,
                    fileSize: pendingFile.size,
                    mimeType: pendingFile.type
                }];
            } catch (err) {
                console.error("[Chat Upload Error]", err);
                toast.error("Erro ao fazer upload do arquivo");
                setIsUploading(false);
                setFailedMessageIds(prev => new Set(prev).add(clientMessageId));
                return;
            }
            setIsUploading(false);
        }

        try {
            setIsSending(true);
            await sendChatMessage({
                conversationId: conversationId!,
                clientMessageId,
                content: content,
                replyToMessageId: replyingTo?.id || null,
                attachments: uploadedAttachments
            });

            if (!retryData) {
              setMessageText("");
              setReplyingTo(null);
              setPendingFile(null);
            }
            
            // Remove from optimistic on success
            setOptimisticMessages(prev => ({
              ...prev,
              [conversationId!]: (prev[conversationId!] || []).filter(m => m.id !== clientMessageId)
            }));
            const refreshedConversations = await refetchConversations();
            if (refreshedConversations.some((conversation: any) => conversation.id === conversationId)) {
              setDraftContact(null);
            }
        } catch (err: any) {
            setFailedMessageIds(prev => new Set(prev).add(clientMessageId));
            toast.error(err?.message || "Erro ao enviar mensagem");
            console.error(err);
        } finally {
            setIsSending(false);
        }
    };


    const handleSendAttention = async () => {
        if (!activeConversation || !access?.userId) return;

        if (!activeConversationId) return;

        let conversationId: string;
        try {
            conversationId = await ensureConversation();
        } catch (err: any) {
            toast.error(err?.message || "Erro ao iniciar conversa");
            return;
        }

        const lastNudgeKey = `last_nudge_${conversationId}`;
        const lastNudgeTime = localStorage.getItem(lastNudgeKey);
        const now = Date.now();
        if (lastNudgeTime && now - parseInt(lastNudgeTime) < 5 * 60 * 1000) {
            toast.error("Aguarde 5 minutos para chamar a atenção novamente.");
            return;
        }

        try {
          setIsUploading(true);
          const clientMessageId = crypto.randomUUID();
          const result = await callContactAttention({ 
            data: { 
              conversationId,
              clientMessageId 
            } 
          });


          if (result.messageId) {
            // Local Feedback
            localStorage.setItem(lastNudgeKey, now.toString());
            void playChatSound("attention");
            triggerAttentionShake();
            
            await queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        } catch (error: any) {
          console.error("callContactAttention failed", error);
          toast.error(error?.message ?? "Não foi possível chamar a atenção.");
        } finally {
          setIsUploading(false);
        }
    };

    const resolvePresenceStatus = useCallback((presences: any[]) => {
      const statuses = presences.map((presence: any) => presence?.status || "online");
      if (statuses.includes("busy")) return "busy";
      if (statuses.includes("away")) return "away";
      if (statuses.includes("online")) return "online";
      return "offline";
    }, []);

    const getProfilePresenceStatus = useCallback((profileId: string | null) => {
      if (!profileId) return "offline";
      const realtimeStatus = resolvePresenceStatus(onlinePresences.filter((p: any) => p.userId === profileId));
      if (realtimeStatus !== "offline") return realtimeStatus;
      return getPersistedPresenceStatus(profileId);
    }, [onlinePresences, resolvePresenceStatus, getPersistedPresenceStatus]);

    const getAdminPresenceStatus = useCallback(() => {
      return resolvePresenceStatus(
        onlinePresences.filter((presence: any) => presence.role === "adm" && presence.status !== "offline")
      );
    }, [onlinePresences, resolvePresenceStatus]);

    const isProfileOnline = useCallback((profileId: string | null) => {
      return getProfilePresenceStatus(profileId) !== "offline";
    }, [getProfilePresenceStatus]);

    const getContactPresenceStatus = (contact: ChatContact) => {
      if (contact.role === "adm") {
        const directStatus = getProfilePresenceStatus(contact.profileId);
        return directStatus !== "offline" ? directStatus : getAdminPresenceStatus();
      }
      return getProfilePresenceStatus(contact.profileId);
    };


    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeConversation?.messages]);

    const ensureConversation = async () => {
        if (isValidUuid(activeConversationId)) return activeConversationId!;
        if (!draftContact) throw new Error("Selecione um contato válido.");

        const targetKey = `profile:${draftContact.profileId}`;
        const { conversationId } = await withConversationLock(targetKey, () =>
            getOrCreateConversation({
                data: { recipientProfileId: draftContact.profileId }
            })
        );

        if (!isValidUuid(conversationId)) {
            throw new Error("A conversa não retornou um identificador válido.");
        }

        setActiveConversationId(conversationId);
        return conversationId;
    };

    const selectContact = (contact: ChatContact) => {
        const existingConversation = conversations.find((conversation: any) => {
            if (conversation.other_profile_id === contact.profileId) return true;
            if (contact.role !== "adm" || conversation.contact_type !== "support") return false;
            return (conversation.conversation_participants ?? []).some(
                (participant: any) => participant.profile_id === access?.userId,
            );
        });

        setDraftContact(existingConversation ? null : contact);
        setActiveConversationId(
            existingConversation?.id || `draft:${contact.profileId}`
        );
        setIsOpen(true);
    };

    const getReplyPreview = (message: any) => {
      const reply = message?.reply_to;
      if (!reply) return null;
      if (reply.deleted_at) return "Mensagem apagada";
      return reply.content || "Arquivo";
    };

    const handleEditMessage = (message: any) => {
      if (!message?.id || message.deleted_at) return;
      setReplyingTo(null);
      setEditingMessage(message);
      setMessageText(message.content || "");
    };

    const handleDeleteMessage = async (message: any) => {
      if (!isValidUuid(message?.id) || message.deleted_at) return;
      try {
        await deleteChatMessage({ data: { messageId: message.id } });
        await refetchConversations();
        toast.success("Mensagem apagada.");
      } catch (err: any) {
        toast.error(err?.message || "Não foi possível apagar.");
      }
    };

    const cancelMessageMode = () => {
      setReplyingTo(null);
      setEditingMessage(null);
      setMessageText("");
    };


  return (
    <div ref={widgetRef} className={cn("flex flex-col h-full bg-[#0F172A]", isAttentionShaking && "attention-shake")}>
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center">
              <MessagesSquare className="size-5 text-primary"/>
            </div>
            <div>
              <h3 className="text-white text-sm font-display font-black leading-none tracking-tight">Mensagens Internas</h3>
              <div className="flex items-center gap-2 mt-1">
                <ChatStatusSelector showLabel />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!audioEnabled && (
              <span className="text-[10px] text-amber-500 font-bold animate-pulse mr-1">Ativar sons</span>
            )}
            <Button variant="ghost" size="icon" onClick={toggleMute} className="size-8 text-muted-foreground hover:text-white">
              {isMuted ? <VolumeX className="size-4"/> : <Volume2 className="size-4"/>}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="size-8 text-muted-foreground hover:text-white hover:bg-white/5">
              <X className="size-5"/>
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {(!activeConversation || !activeConversationId) ? (
            <div className="flex-1 flex flex-col bg-black/20">
               <div className="p-3 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/>
                  <Input placeholder="Buscar contatos..." className="pl-9 h-9 bg-white/5 border-white/10 text-xs rounded-xl"/>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-4">
                  {isLoadingContacts ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Carregando hierarquia...</div>
                  ) : (
                    <>
                      {/* OTHERS (Suporte) */}
                      {contacts?.others && contacts.others.length > 0 && (
                        <div className="space-y-1">
                          {contacts.others.map((contact) => (
                            <ContactButton 
                              key={contact.profileId} 
                              contact={contact} 
                              presenceStatus={getContactPresenceStatus(contact)}
                              onClick={() => selectContact(contact)}
                              isLoading={loadingContacts[`profile:${contact.profileId}`]}
                            />
                          ))}
                        </div>
                      )}

                      {/* MATRIZES & FILIAIS */}
                      {access?.role === "adm" ? (
                        // ADM View: Group Branches under their Matrices
                        <div className="space-y-4">
                          {contacts?.matrices.filter(m => m.role === 'matriz').map((matrix) => {
                            const branches = contacts.matrices.filter(
                              b => b.role === 'filial' && (b as any).parentMatrixCompanyId === matrix.companyId
                            );
                            return (
                              <div key={matrix.profileId} className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <ContactButton
                                    contact={matrix}
                                    presenceStatus={getContactPresenceStatus(matrix)}
                                    onClick={() => selectContact(matrix)}
                                    isMatrix
                                    isLoading={loadingContacts[`profile:${matrix.profileId}`]}
                                  />
                                  {branches.length > 0 && (
                                    <button
                                      type="button"
                                      aria-label={expandedMatrices.has(matrix.companyId) ? "Ocultar filiais" : "Mostrar filiais"}
                                      onClick={() => setExpandedMatrices((current) => {
                                        const next = new Set(current);
                                        if (next.has(matrix.companyId)) next.delete(matrix.companyId);
                                        else next.add(matrix.companyId);
                                        return next;
                                      })}
                                      className="shrink-0 rounded-md p-1 text-muted-foreground/60 hover:bg-white/5 hover:text-white"
                                    >
                                      <ChevronDown className={cn("size-3 transition-transform", expandedMatrices.has(matrix.companyId) && "rotate-180")} />
                                    </button>
                                  )}
                                </div>
                                {branches.length > 0 && expandedMatrices.has(matrix.companyId) && (
                                  <div className="ml-2 pl-2 border-l border-white/5 space-y-1">
                                    {branches.map(branch => (
                                      <ContactButton 
                                        key={branch.profileId}
                                        contact={branch} 
                                        presenceStatus={getContactPresenceStatus(branch)}
                                        onClick={() => selectContact(branch)} 
                                        isNested
                                        isLoading={loadingContacts[`profile:${branch.profileId}`]}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Matriz/Filial View: Flat lists
                        <>
                          {contacts?.matrices && contacts.matrices.filter(m => m.role === 'matriz').length > 0 && (
                            <div className="space-y-2">
                               <span className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-1">Matriz</span>
                               {contacts.matrices.filter(m => m.role === 'matriz').map((matrix) => (
                                  <ContactButton 
                                    key={matrix.profileId}
                                    contact={matrix} 
                                    presenceStatus={getContactPresenceStatus(matrix)}
                                    onClick={() => selectContact(matrix)} 
                                    isMatrix
                                    isLoading={loadingContacts[`profile:${matrix.profileId}`]}
                                  />
                               ))}
                            </div>
                          )}

                          {contacts?.matrices && contacts.matrices.filter(m => m.role === 'filial').length > 0 && (
                             <div className="space-y-2 mt-4">
                                <span className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-1">Filiais</span>
                                {contacts.matrices.filter(m => m.role === 'filial').map((branch) => (
                                   <ContactButton 
                                     key={branch.profileId}
                                     contact={branch} 
                                     presenceStatus={getContactPresenceStatus(branch)}
                                     onClick={() => selectContact(branch)} 
                                     isLoading={loadingContacts[`profile:${branch.profileId}`]}
                                   />
                                ))}
                             </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  <div className="pt-4 border-t border-white/5">
                    <span className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-2">Conversas Ativas</span>
                    {isLoadingConvs ? (
                      <div className="p-4 text-center text-[10px] text-muted-foreground">Carregando conversas...</div>
                    ) : conversations.length === 0 ? (
                      <div className="p-4 text-center text-[10px] text-muted-foreground">Nenhuma conversa ativa.</div>
                    ) : (
                      conversations.map((conv: any) => {
                        const name = conv.display_name || "Contato";
                        const isSupport = conv.contact_type === "support";
                        
                        const otherProfileId = conv.other_profile_id;
                        const presenceStatus = otherProfileId
                          ? getProfilePresenceStatus(otherProfileId)
                          : isSupport
                            ? getAdminPresenceStatus()
                            : "offline";
                        const nowPlaying = getNowPlaying(otherProfileId);
                        const lastMessage = conv.messages?.[conv.messages.length - 1];
                        const unreadCount = conv.messages?.filter((m: any) => {
                          const isMe = m.sender_id === access?.userId;
                          if (isMe) return false;
                          const receipt = m.chat_message_receipts?.find(
                            (r: any) => r.recipient_profile_id === access?.userId
                          );
                          return receipt && !receipt.read_at;
                        }).length || 0;

                        return (
                          <div key={conv.id} className="group relative flex items-center">
                            <button 
                              onClick={() => setActiveConversationId(conv.id)} 
                              className={cn(
                                "flex-1 flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-white/5 group min-w-0",
                                activeConversationId === conv.id && "bg-primary/10"
                              )}
                            >
                              <div className="relative">
                                <ChatProfileAvatar
                                  name={name}
                                  imageUrl={getConversationAvatar(conv)}
                                  status={presenceStatus}
                                  className="size-8"
                                />
                                <ChatPresenceIndicator 
                                  status={presenceStatus}
                                  className="absolute bottom-0 right-0 border-[#0F172A]"
                                />
                                {conv.is_pinned && (
                                  <div className="absolute -top-1 -left-1 bg-primary rounded-full p-0.5 shadow-sm">
                                    <Pin className="size-2 text-primary-foreground fill-current" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="truncate text-xs font-bold text-white group-hover:text-primary transition-colors pr-2">
                                    {name.length > 25 ? name.substring(0, 22) + "..." : name}
                                  </span>
                                  <div className="flex flex-col items-end gap-0.5">
                                    {lastMessage && <span className="text-[8px] text-muted-foreground whitespace-nowrap">{format(new Date(lastMessage.created_at), "HH:mm")}</span>}
                                    {unreadCount > 0 && (
                                      <span className="flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[7px] font-bold text-white">
                                        {unreadCount}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className={cn("relative min-w-0 max-w-full overflow-hidden whitespace-nowrap pr-6 text-[10px]", nowPlaying ? "text-primary" : "text-muted-foreground/70")}>
                                  <span className={nowPlaying ? "chat-now-playing" : "truncate inline-block max-w-full align-bottom"}>
                                    {nowPlaying ? `▶ ${nowPlaying}` : lastMessage?.event === 'nudge' ? (lastMessage?.content || "🫨") : (lastMessage?.content || "Nenhuma mensagem")}
                                  </span>
                                </p>
                              </div>
                            </button>

                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="size-7 hover:bg-white/10"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="size-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  side="left" 
                                  align="start" 
                                  sideOffset={6}
                                  className="w-32 bg-[#0F172A] border-white/10 z-[100]"
                                >
                                  <DropdownMenuItem 
                                    className="text-[10px] py-1.5"
                                    onSelect={async (e) => {
                                      e.preventDefault();
                                      try {
                                        await setConversationPinned({ 
                                          data: {
                                            conversationId: conv.id, 
                                            isPinned: !conv.is_pinned 
                                          }
                                        });
                                        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
                                        toast.success(conv.is_pinned ? "Conversa desafixada" : "Conversa fixada");
                                      } catch (err) {
                                        toast.error("Erro ao alterar fixação");
                                      }
                                    }}
                                  >
                                    {conv.is_pinned ? (
                                      <>
                                        <PinOff className="mr-2 size-3" />
                                        <span>📌 Desafixar conversa</span>
                                      </>
                                    ) : (
                                      <>
                                        <Pin className="mr-2 size-3" />
                                        <span>📌 Fixar conversa</span>
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-[10px] py-1.5 text-red-500 focus:text-red-500"
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setConversationToHide(conv.id);
                                    }}
                                  >
                                    <Trash2 className="mr-2 size-3" />
                                    <span>🗑️ Excluir da minha lista</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })

                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-gradient-to-b from-transparent to-black/30">
              <div className="flex items-center justify-between p-2 border-b border-white/5 bg-white/5">
                <Button variant="ghost" size="icon" onClick={() => setActiveConversationId(null)} className="size-8 text-muted-foreground">
                  <X className="size-4" />
                </Button>
                <div className="flex-1 px-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <ChatProfileAvatar
                      name={(activeConversation as any).contact_profile_name || (activeConversation as any).display_name || "Contato"}
                      imageUrl={getConversationAvatar(activeConversation)}
                      status={(activeConversation as any).other_profile_id
                        ? getProfilePresenceStatus((activeConversation as any).other_profile_id)
                        : (activeConversation as any).contact_type === "support"
                          ? getAdminPresenceStatus()
                          : "offline"}
                      className="size-8"
                    />
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">
                      {getHeaderLabel(activeConversation)}
                    </span>
                    <ChatPresenceIndicator 
                      status={(activeConversation as any).other_profile_id
                        ? getProfilePresenceStatus((activeConversation as any).other_profile_id)
                        : (activeConversation as any).contact_type === "support"
                          ? getAdminPresenceStatus()
                          : "offline"}
                      size={6}
                    />
                  </div>
                  {typingUsers.size > 0 ? (
                    <span className="text-[9px] font-medium text-primary animate-pulse flex items-center justify-center gap-0.5" aria-live="polite">
                      Digitando
                      <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                    </span>
                  ) : (
                    (activeConversation as any).contact_type === "support" ? (
                      <span className="text-[9px] font-black tracking-widest text-primary/60 block -mt-0.5 uppercase">
                        SUPORTE
                      </span>
                    ) : (activeConversation as any).contact_type === "matriz" && (
                      <span className="text-[9px] font-black tracking-widest text-primary/60 block -mt-0.5 uppercase">
                        MATRIZ
                      </span>
                    )
                  )}
                  {getNowPlaying((activeConversation as any).other_profile_id) && (
                    <span className="mt-1 block max-w-[240px] truncate text-[10px] text-primary" title={getNowPlaying((activeConversation as any).other_profile_id) || undefined}>
                      ▶ {getNowPlaying((activeConversation as any).other_profile_id)}
                    </span>
                  )}
                </div>
                <div className="size-8" />
              </div>

              <div className="flex-1 relative overflow-hidden">
                <ScrollArea className="h-full p-4 chat-messages-scroll-area" ref={scrollRef}>
                  <div className="space-y-4 min-h-full">
                    {(() => {
                      const combined = [
                        ...(activeConversation?.messages || []),
                        ...(optimisticMessages[activeConversationId!] || []).map(m => ({ ...m, isOptimistic: true }))
                      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                      return combined.map((msg: any, index: number) => {
                        const isMe = msg.sender_id === access?.userId;
                        const isFirstUnread = msg.id === sessionUnreadBoundary;
                        const canInteract = isValidUuid(msg.id) && !msg.isOptimistic && msg.event !== "nudge";
                        const replyPreview = getReplyPreview(msg);
                        const previousMessage = combined[index - 1];
                        const showDateDivider = getDayKey(previousMessage?.created_at) !== getDayKey(msg.created_at);
                        const actionsVisible = actionMessageId === msg.id;
                        const isReplyTarget = replyingTo?.id === msg.id;

                        return (
                          <div
                            key={msg.id}
                            className={cn("group/message flex flex-col mb-3 rounded-xl transition-all duration-200", isMe ? "items-end" : "items-start", isReplyTarget && "bg-primary/10 ring-1 ring-primary/70 px-2 py-1 shadow-[0_0_18px_rgba(0,220,220,0.18)]")}
                            onClick={() => canInteract && setActionMessageId((current) => current === msg.id ? null : msg.id)}
                          >
                            {showDateDivider && (
                              <div className="my-4 flex w-full items-center gap-3">
                                <div className="h-px flex-1 bg-white/10" />
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                  {getDateDividerLabel(msg.created_at)}
                                </span>
                                <div className="h-px flex-1 bg-white/10" />
                              </div>
                            )}
                            {isFirstUnread && (
                              <div 
                                role="separator" 
                                aria-label="Novas mensagens" 
                                className="flex items-center gap-4 my-6 opacity-60 w-full"
                              >
                                <div className="h-[1px] flex-1 bg-primary/20" />
                                <span className="text-[10px] font-bold tracking-widest uppercase text-primary whitespace-nowrap">
                                  Novas mensagens
                                </span>
                                <div className="h-[1px] flex-1 bg-primary/20" />
                              </div>
                            )}
                            {msg.event === 'nudge' ? (
                              <div className="attention-message">
                                <span className="text-4xl leading-none select-none py-1 block" role="img" aria-label="Chamada de atenção">
                                  {msg.content || "🫨"}
                                </span>
                              </div>
                            ) : (
                              <div 
                                className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm transition-all", isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white/10 text-white rounded-tl-none", isReplyTarget && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                                data-message-id={msg.id}
                                data-unread={(() => {
                                  const isMe = msg.sender_id === access?.userId;
                                  if (isMe) return "false";
                                  const receipt = msg.chat_message_receipts?.find(
                                    (r: any) => r.recipient_profile_id === access?.userId
                                  );
                                  return receipt && !receipt.read_at ? "true" : "false";
                                })()}
                                data-received={msg.sender_id !== access?.userId ? "true" : "false"}
                              >
                                {replyPreview && (
                                  <button
                                    type="button"
                                    className={cn(
                                      "mb-2 w-full rounded-lg border-l-2 px-2 py-1 text-left text-[10px] opacity-90",
                                      isMe ? "border-white/50 bg-black/10" : "border-primary/70 bg-black/20"
                                    )}
                                    onClick={() => setReplyingTo(msg.reply_to)}
                                  >
                                    <span className="block font-black uppercase tracking-widest opacity-70">Respondendo</span>
                                    <span className="line-clamp-2">{replyPreview}</span>
                                  </button>
                                )}
                                {msg.deleted_at ? (
                                  <p className="text-xs italic opacity-60">Mensagem apagada</p>
                                ) : msg.content && (
                                  <p className={cn(
                                    "whitespace-pre-wrap leading-relaxed break-words",
                                    /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\s\u200d])+$/g.test(msg.content) && "text-[32px] leading-tight text-center block w-full"
                                  )}>
                                    {msg.content}
                                  </p>
                                )}
                                {!msg.deleted_at && msg.chat_attachments?.map((attr: any) => {
                                  const isEmojiOnly = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\s\u200d])+$/g.test(msg.content);
                                  if (isEmojiOnly && !attr.file_path) return null;
                                  
                                  return (
                                    <ChatAttachment 
                                      key={attr.id} 
                                      attachment={attr} 
                                      isMe={msg.sender_id === access?.userId} 
                                    />
                                  );
                                })}
                                {msg.edited_at && !msg.deleted_at && (
                                  <span className="mt-1 block text-[9px] opacity-60">editada</span>
                                )}
                              </div>
                            )}
                            {canInteract && !msg.deleted_at && (
                              <div
                                className={cn(
                                  "mt-1 flex flex-wrap items-center gap-1 px-1 transition",
                                  actionsVisible ? "opacity-100" : "opacity-0 pointer-events-none group-hover/message:pointer-events-auto group-hover/message:opacity-100",
                                  isMe ? "justify-end" : "justify-start"
                                )}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button type="button" onClick={(event) => { event.stopPropagation(); setReplyingTo(msg); setActionMessageId(null); }} className="rounded-full px-2 py-0.5 text-[10px] hover:bg-white/10">
                                  <Reply className="mr-1 inline size-3" />
                                  Responder
                                </button>
                                {isMe && (
                                  <>
                                    <button type="button" onClick={() => handleEditMessage(msg)} className="rounded-full px-2 py-0.5 text-[10px] hover:bg-white/10">
                                      <Pencil className="mr-1 inline size-3" />
                                      Editar
                                    </button>
                                    <button type="button" onClick={() => handleDeleteMessage(msg)} className="rounded-full px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10">
                                      <Trash2 className="mr-1 inline size-3" />
                                      Apagar
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                              <span className="text-[9px] text-muted-foreground opacity-50">
                                {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ""}
                              </span>
                              {isMe && !msg.isOptimistic && (
                                <div className="flex items-center">
                                  {(msg.read_at || msg.chat_message_receipts?.some((r: any) => r.read_at)) ? (
                                    <CheckCheck className="size-2.5 text-cyan-400" />
                                  ) : (msg.delivered_at || msg.chat_message_receipts?.some((r: any) => r.delivered_at)) ? (
                                    <CheckCheck className="size-2.5 opacity-50 text-white" />
                                  ) : (
                                    <Check className="size-2.5 opacity-50 text-white" />
                                  )}
                                </div>
                              )}
                              {isMe && msg.isOptimistic && (
                                failedMessageIds.has(msg.id) ? (
                                  <button 
                                    onClick={() => handleSendMessage(undefined, msg)}
                                    className="text-red-400 text-[9px] underline font-bold"
                                  >
                                    Tentar
                                  </button>
                                ) : (
                                  <Clock className="size-2.5 animate-pulse opacity-50" />
                                )
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                    <div ref={messagesEndRef} className="h-0 w-0" />
                  </div>
                </ScrollArea>

                {/* Scroll to bottom button */}
                {!isNearBottom && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    aria-label="Ir para mensagens recentes"
                    aria-live="polite"
                    className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-glow animate-in fade-in slide-in-from-bottom-2 duration-300 hover:scale-105 active:scale-95"
                  >
                    <ChevronDown className="size-4" />
                    {newMessagesCount > 0 && (
                      <span>{newMessagesCount}</span>
                    )}
                  </button>
                )}
              </div>



              <div className="p-3 bg-black/40 border-t border-white/5">
                <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                   {(replyingTo || editingMessage) && (
                     <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                       <div className="min-w-0 flex-1">
                         <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                           {editingMessage ? "Editando mensagem" : "Respondendo"}
                         </p>
                         <p className="truncate text-xs text-white/70">
                           {editingMessage ? editingMessage.content : (replyingTo?.deleted_at ? "Mensagem apagada" : replyingTo?.content || "Arquivo")}
                         </p>
                       </div>
                       <Button type="button" variant="ghost" size="icon" onClick={cancelMessageMode} className="size-6 text-muted-foreground hover:bg-primary/20">
                         <X className="size-3" />
                       </Button>
                     </div>
                   )}
                   {pendingFile && (
                     <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-xl border border-primary/20">
                        {pendingFile.type.startsWith('image/') ? <ImageIcon className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
                        <span className="text-[10px] text-primary font-medium flex-1 truncate">{pendingFile.name}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setPendingFile(null)} className="size-5 hover:bg-primary/20 text-primary">
                          <X className="size-3" />
                        </Button>
                     </div>
                   )}
                    <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" onClick={handleSendAttention} disabled={isSending || isUploading} className="size-9 shrink-0 hover:bg-primary/10 rounded-xl flex items-center justify-center">
                            <span className="text-[22px]">🫨</span>
                          </Button>

                        </TooltipTrigger>
                        <TooltipContent>Enviar chamada de atenção</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="size-9 shrink-0 text-muted-foreground hover:bg-white/5 rounded-xl">
                      <Paperclip className="size-5" />
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
                    
                    <Input 
                      value={messageText} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setMessageText(val);
                        if (val.trim()) {
                            sendTypingBroadcast(true);
                        } else {
                            sendTypingBroadcast(false);
                        }
                      }}
                      onBlur={() => sendTypingBroadcast(false)}
                      placeholder="Sua mensagem..." 
                      className="flex-1 h-9 bg-white/5 border-white/10 text-xs rounded-xl"
                    />
                    <Button type="submit" size="icon" disabled={(!messageText.trim() && !pendingFile) || isSending || isUploading} className="size-9 shrink-0 rounded-xl">
                      {isSending || isUploading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                   </div>
                </form>
              </div>
            </div>
          )}
        </div>
      <AlertDialog open={!!conversationToHide} onOpenChange={(open) => !open && setConversationToHide(null)}>
        <AlertDialogContent className="bg-[#0F172A] border-white/10 text-white max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-black uppercase tracking-tight">Apagar conversa da lista?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              Esta ação ocultará a conversa da sua lista. Ela reaparecerá automaticamente se você receber uma nova mensagem deste contato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-[10px] uppercase font-bold tracking-widest">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600 text-[10px] uppercase font-bold tracking-widest"
              onClick={async () => {
                if (!conversationToHide) return;
                try {
                  await hideConversation({ data: { conversationId: conversationToHide } });
                  if (activeConversationId === conversationToHide) setActiveConversationId(null);
                  queryClient.invalidateQueries({ queryKey: ["conversations"] });
                  toast.success("Conversa removida da lista");
                } catch (err) {
                  toast.error("Erro ao ocultar conversa");
                } finally {
                  setConversationToHide(null);
                }
              }}
            >
              🗑️ Excluir da minha lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

