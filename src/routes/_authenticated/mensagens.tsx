import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, useLayoutEffect as useIsoLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createFileRoute } from "@tanstack/react-router";
import { 
  Send, 
  Volume2, 
  VolumeX, 
  Bell, 
  Timer,
  Search,
  MoreVertical,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Loader2,
  X,
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
import { usePresence } from "@/components/app/chat/ChatPresenceProvider";
import { deleteChatMessage, editChatMessage, getConversations, hideConversation, setConversationPinned } from "@/lib/chat.functions";
import { getChatContacts, getOrCreateConversation, participantKey, resolveNudgeTargetUserIds, markConversationAsRead, ChatContact } from "@/lib/chat-validation.functions";
import { getPresenceStatus } from "@/lib/chat-presence.functions";
import { callContactAttention } from "@/lib/chat-attention.functions";
import { withConversationLock } from "@/lib/chat-conversation-request-lock.ts";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useChatIntersection } from "@/hooks/use-chat-intersection";
import { isValidUuid } from "@/lib/uuid";
import { sendChatMessage } from "@/lib/send-chat-message";


import { ChatAttachment } from "@/components/app/chat/ChatAttachment";
import { ChatPresenceIndicator } from "@/components/app/chat/ChatPresenceIndicator";
import { ChatStatusSelector } from "@/components/app/chat/ChatStatusSelector";
import { ContactButton } from "@/components/app/chat/ContactButton";
import type { ChatMessage as Message } from "@/components/app/chat/chat-types";

import { getUserGreetingName } from "@/lib/name-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatProfileAvatar } from "@/components/app/chat/ChatProfileAvatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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



export const Route = createFileRoute("/_authenticated/mensagens")({
  component: MensagensPage,
});

function MensagensPage() {

  const { data: access } = useAccess();
  const queryClient = useQueryClient();
  const { onlineUsers, onlinePresences, isMuted, toggleMute, playChatSound, globalChannelName, currentStatus, manualStatus } = usePresence();
  
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draftContact, setDraftContact] = useState<ChatContact | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [conversationToHide, setConversationToHide] = useState<string | null>(null);

  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [nudgeCooldowns, setNudgeCooldowns] = useState<Record<string, number>>({});
  const [isAttentionShaking, setIsAttentionShaking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Record<string, any[]>>({});
  const [failedMessageIds, setFailedMessageIds] = useState<Set<string>>(new Set());
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
  
  // Proteção contra clique duplo e race condition
  const loadingContacts: Record<string, boolean> = {};


  const { data: contactsResponse, isLoading: isLoadingContacts } = useQuery<{ matrices: ChatContact[], others: ChatContact[] }>({
    queryKey: ["chat-contacts"],
    queryFn: async () => {
      const result = await getChatContacts();
      return result as any;
    },
    enabled: !!access?.userId,
  });

  const contacts = contactsResponse;

  const contactsByMatrix = useMemo(() => {
    if (!contactsResponse?.matrices) return new Map<string, ChatContact[]>();
    const grouped = new Map<string, ChatContact[]>();
    
    contactsResponse.matrices.forEach(contact => {
      const groupKey = contact.role === 'matriz' ? contact.companyId : (contact.parentMatrixCompanyId || contact.companyId);
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      
      if (contact.role === 'matriz') {
        grouped.get(groupKey)?.unshift(contact);
      } else {
        grouped.get(groupKey)?.push(contact);
      }
    });
    return grouped;
  }, [contactsResponse]);


  const otherContacts = contactsResponse?.others || [];
  const contactAvatarByProfileId = useMemo(() => {
    const map = new Map<string, string>();
    [...(contactsResponse?.matrices || []), ...(contactsResponse?.others || [])].forEach((contact) => {
      if (contact.profileId && contact.profileAvatarUrl) map.set(contact.profileId, contact.profileAvatarUrl);
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(),
    enabled: !!access?.userId && !!access?.role,
    // Realtime mantém a lista atualizada; polling moderado evita requests
    // agressivos e é pausado quando a aba fica em segundo plano.
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

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

  const storedActiveConversation = conversations.find(c => c.id === activeConversationId);
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


  // Centralized message listener via presence hook event
  useEffect(() => {
    if (!access?.userId) return;

    const handleNewMessage = async (e: any) => {
      const { conversationId } = e.detail;
      
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      // If it's a new message for the active conversation, trigger visibility check
      if (conversationId === activeConversationId) {
        requestAnimationFrame(() => {
          const scrollViewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
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
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };

    window.addEventListener('chat:new-message', handleNewMessage);
    window.addEventListener('chat:receipt-update', handleReceiptUpdate);
    return () => {
      window.removeEventListener('chat:new-message', handleNewMessage);
      window.removeEventListener('chat:receipt-update', handleReceiptUpdate);
    };
  }, [access?.userId, activeConversationId, queryClient]);





  // Realtime for Nudge (Broadcast)
  useEffect(() => {
    if (!access?.userId) return;

    const nudgeChannelName = `local:nudge:${access.userId}`;
    const nudgeChannel = supabase.channel(nudgeChannelName);
    const nudgeEventIds = new Set<string>();
    
    nudgeChannel.on('broadcast', { event: 'chat:nudge' }, async (payload: any) => {
      const data = payload.payload;
      if (!data?.eventId || !isValidUuid(data.conversationId)) return;
      if (nudgeEventIds.has(data.eventId)) return;
      nudgeEventIds.add(data.eventId);

      const isSender = data.senderUserId === access?.userId;
      const isRecipient = 
        data.targetUserIds?.includes(access?.userId) ||
        (data.targetRole === "adm" && access?.role === "adm") ||
        (data.targetRole === "matriz" && access?.role === "matriz" && data.targetCompanyId === access?.companyId) ||
        (data.targetRole === "filial" && access?.role === "filial" && data.targetBranchId === access?.branchId);

      if (!isSender && !isRecipient) return;

      if (isRecipient && activeConversationId !== data.conversationId) {
        setActiveConversationId(data.conversationId);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }

      playChatSound("attention");
      setIsAttentionShaking(true);
      setTimeout(() => setIsAttentionShaking(false), 550);
      
      if (nudgeEventIds.size > 100) {
        const firstVal = nudgeEventIds.values().next().value;
        if (firstVal) nudgeEventIds.delete(firstVal);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(nudgeChannel);
    };
  }, [access?.userId, access?.role, access?.companyId, access?.branchId, playChatSound, activeConversationId, conversations, queryClient]);

  // Join sound effect
  useEffect(() => {
    const handleJoin = () => playChatSound("online");
    window.addEventListener("chat:user-joined", handleJoin);
    return () => window.removeEventListener("chat:user-joined", handleJoin);
  }, [playChatSound]);

  const refetchConversations = useCallback(async () => {
    const result = await queryClient.fetchQuery({
      queryKey: ["conversations"],
      queryFn: async () => {
        const result = await getConversations();
        return result as any;
      },
    });
    return result as any[] || [];
  }, [queryClient]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        toast.error("O arquivo excede o limite máximo de 20 MB.");
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Envie somente imagens (PNG, JPG, JPEG, WEBP, GIF) ou arquivos PDF.");
        return;
      }
      setPendingFile(file);
    };

    const handleSendMessage = async (e?: React.FormEvent, retryData?: any) => {
      if (e) e.preventDefault();
      
      let conversationId = activeConversationId;
      const content = retryData ? retryData.content : messageText.trim();
      const attachments = retryData ? retryData.attachments : (pendingFile ? [] : []); // attachments will be handled below if new

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
      if ((!content && !hasAttachments) || isSending || isUploading || isAttentionShaking) return;

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
          // Mark optimistic as failed
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
        
        // Remove from optimistic on success (real message will come via query invalidation)
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




  const handleNudge = async () => {
    if (!activeConversationId || nudgeCooldowns[activeConversationId] || !activeConversation || !access?.userId) return;

    try {
      const targetConversationId = await ensureConversation();
      const clientMessageId = crypto.randomUUID();
      const result = await callContactAttention({
        data: {
          conversationId: targetConversationId!,
          clientMessageId,
        }
      });


      if (result.messageId) {
        // 2. Local Feedback & Cooldown only after successful persistence
        playChatSound("attention");
        setIsAttentionShaking(true);
        setTimeout(() => setIsAttentionShaking(false), 550);

        const cooldownEnd = Date.now() + 300000;
        setNudgeCooldowns(prev => ({ ...prev, [targetConversationId]: cooldownEnd }));
        
        // Refetch to show the persisted nudge
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }

    } catch (error: any) {
      console.error("callContactAttention failed", error);
      toast.error(error?.message ?? "Não foi possível chamar a atenção.");
    }
  };

  // Cooldown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNudgeCooldowns(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([id, end]) => {
          if (now >= end) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCooldown = (endTime: number) => {
    const secondsLeft = Math.ceil((endTime - Date.now()) / 1000);
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Reading confirmation when opening a conversation
  useEffect(() => {
    // Contacts without messages remain local drafts. Do not call UUID-only
    // server functions before the first message creates the conversation.
    if (!isValidUuid(activeConversationId) || !access?.userId || isLoading) return;
    
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
        markConversationAsRead({ data: { conversationId: activeConversationId } })
            .catch(err => {
                console.error("[Mensagens] AUDIT CLIENT ERROR", err);
                lastReadRequestKey.current = null;
            });
    }
  }, [activeConversationId, access?.userId, isLoading]);

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

  // Cleanup typing when switching conversations or unmounting
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

  // Mark conversation as read and manage initial scroll
  useEffect(() => {
    if (!isValidUuid(activeConversationId) || !access?.userId || isLoading) return;

    const readRequestKey = `${activeConversationId}-${Date.now()}`;
    if (lastReadRequestKey.current !== readRequestKey) {
        lastReadRequestKey.current = readRequestKey;
        
        // Confirm directly as read all incoming messages in this conversation
        markConversationAsRead({ data: { conversationId: activeConversationId } })
            .then((result: any) => {
                console.log("[MensagensPage] AUDIT CLIENT SUCCESS", {
                    conversationId: activeConversationId,
                    readCount: result.readMessageIds?.length,
                    remaining: result.remainingUnreadCount
                });

                // Synchronous optimistic update to ["conversations"]
                queryClient.setQueryData(["conversations"], (oldData: any[]) => {
                    if (!oldData) return oldData;
                    return oldData.map(conv => {
                        if (conv.id !== activeConversationId) return conv;
                        
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
                console.error("[MensagensPage] AUDIT CLIENT ERROR", {
                    conversationId: activeConversationId,
                    error: err
                });
                lastReadRequestKey.current = null; // allow retry
            });
    }

    // Initial scroll
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [activeConversationId, isLoading]);

  // Clean up read request key when closing conversation
  useEffect(() => {
    if (!activeConversationId) {
      lastReadRequestKey.current = null;
    }
  }, [activeConversationId]);


  // Force scroll re-check when switching tabs or conversation
  useLayoutEffect(() => {
    if (activeConversationId) {
      const scrollViewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        // Trigger a scroll event to wake up the observer
        scrollViewport.dispatchEvent(new Event('scroll'));
      }
    }
  }, [activeConversationId]);

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

  const handleSelectContact = (contact: ChatContact) => {
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
    if (!contact) return "offline";
    if (contact.role === "adm") {
      const directStatus = getProfilePresenceStatus(contact.profileId);
      return directStatus !== "offline" ? directStatus : getAdminPresenceStatus();
    }
    return getProfilePresenceStatus(contact.profileId);
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
    <div className="flex h-[calc(100vh-12rem)] gap-4 overflow-hidden">
      {/* Sidebar - Conversations List */}
      <Card className="flex w-80 flex-col overflow-hidden bg-card/40 backdrop-blur-sm">
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-display font-semibold leading-none">Mensagens</h2>
            <ChatStatusSelector showLabel />
          </div>
          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? "Ativar sons" : "Mudar sons"}>
            {isMuted ? <VolumeX className="size-4 text-muted-foreground" /> : <Volume2 className="size-4 text-primary" />}
          </Button>
        </div>
        
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Buscar conversa..." className="pl-8 bg-background/50" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-2">
            {/* NOVO CONTATO BUTTON */}
            <div className="px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 border-dashed border-primary/30 hover:border-primary/50 text-[10px] uppercase font-bold tracking-widest h-9">
                    <Plus className="size-3.5" />
                    Iniciar nova conversa
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 max-h-[400px] overflow-hidden flex flex-col p-0 bg-[#0F172A] border-white/10">
                  <div className="p-3 border-b border-white/5 bg-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary block mb-2">Hierarquia da Plataforma</span>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar contatos..." className="pl-9 h-9 bg-white/5 border-white/10 text-xs rounded-xl"/>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 max-h-[300px]">
                    <div className="p-2 space-y-4">
                      {contacts?.others && contacts.others.length > 0 && (
                        <div className="space-y-1">
                          {contacts.others.map((contact) => (
                            <ContactButton 
                              key={contact.profileId} 
                              contact={contact} 
                              presenceStatus={getContactPresenceStatus(contact)}
                              onClick={() => handleSelectContact(contact)}
                              isLoading={loadingContacts[`profile:${contact.profileId}`]}
                            />
                          ))}
                        </div>
                      )}

                      {access?.role === "adm" ? (
                        <div className="space-y-4">
                          {contacts?.matrices.filter(m => m.role === 'matriz').map((matrix) => {
                            const branches = contacts.matrices.filter(
                              b => b.role === 'filial' && (b as any).parentMatrixCompanyId === matrix.companyId
                            );
                            return (
                              <div key={matrix.profileId} className="space-y-1">
                                <ContactButton 
                                  contact={matrix} 
                                  presenceStatus={getContactPresenceStatus(matrix)}
                                  onClick={() => handleSelectContact(matrix)} 
                                  isMatrix
                                  isLoading={loadingContacts[`profile:${matrix.profileId}`]}
                                />
                                {branches.length > 0 && (
                                  <div className="ml-2 pl-2 border-l border-white/5 space-y-1">
                                    {branches.map(branch => (
                                      <ContactButton 
                                        key={branch.profileId}
                                        contact={branch} 
                                        presenceStatus={getContactPresenceStatus(branch)}
                                        onClick={() => handleSelectContact(branch)} 
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
                        <>
                          {contacts?.matrices && contacts.matrices.filter(m => m.role === 'matriz').length > 0 && (
                            <div className="space-y-2">
                               <span className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-1">Matriz</span>
                               {contacts.matrices.filter(m => m.role === 'matriz').map((matrix) => (
                                  <ContactButton 
                                    key={matrix.profileId}
                                    contact={matrix} 
                                    presenceStatus={getContactPresenceStatus(matrix)}
                                    onClick={() => handleSelectContact(matrix)} 
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
                                     onClick={() => handleSelectContact(branch)} 
                                     isLoading={loadingContacts[`profile:${branch.profileId}`]}
                                   />
                                ))}
                             </div>
                          )}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col gap-1">
            {conversations.map((conv: any) => {
              const otherProfileId = conv.other_profile_id;
              const name = conv.display_name || "Contato";
              
              const isSupport = conv.contact_type === "support";
              const presenceStatus = otherProfileId
                ? getProfilePresenceStatus(otherProfileId)
                : isSupport
                  ? getAdminPresenceStatus()
                  : "offline";


              // DEBUG LOG
              if (activeConversationId === conv.id) {
                console.log(`[ChatDebug] conversationId: ${conv.id}, currentProfileId: ${access?.userId}, otherProfileId: ${otherProfileId}, displayName: ${name}, contactType: ${conv.contact_type}`);
              }

              const lastMessage = conv.messages?.[conv.messages.length - 1];
              const unreadCount = conv.messages?.filter((m: any) => {
                const isMe = m.sender_id === access?.userId;
                if (isMe) return false;
                const receipt = m.chat_message_receipts?.find(
                  (r: any) => r.recipient_profile_id === access?.userId
                );
                return receipt && !receipt.read_at;
              }).length || 0;
              const isLoadingThis = loadingContacts[`${conv.contact_type}:${conv.contact_id}`];

              return (
                <div key={conv.id} className="group relative flex items-center">
                  <button
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      // REMOVED: Automatic clearing of hidden_at when clicking
                      const targetKey = `${conv.contact_type}:${conv.contact_id}`;
                      handleSelectContact({ id: conv.contact_id, type: conv.contact_type, name: name } as any);
                    }}
                    disabled={isLoadingThis}
                    className={`flex-1 flex items-center gap-3 rounded-lg p-3 text-left transition-colors min-w-0 ${
                      activeConversationId === conv.id ? "bg-primary/10" : "hover:bg-white/5"
                    } ${isLoadingThis ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="relative">
                      {isLoadingThis ? (
                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                          <Loader2 className="size-4 animate-spin text-primary" />
                        </div>
                      ) : (
                        <ChatProfileAvatar
                          name={name}
                          imageUrl={getConversationAvatar(conv)}
                          status={presenceStatus}
                          className="size-10"
                        />
                      )}
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
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium pr-2">
                          {name.length > 30 ? name.substring(0, 27) + "..." : name}
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          {lastMessage && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(lastMessage.created_at), "HH:mm")}
                            </span>
                          )}
                          {unreadCount > 0 && (
                            <span className="flex size-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="truncate text-xs text-muted-foreground pr-6">
                        {lastMessage?.event === 'nudge' ? (lastMessage?.content || "🫨") : (lastMessage?.content || "Nenhuma mensagem")}
                      </p>
                    </div>
                  </button>

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-8"
                          aria-label="Opções da conversa"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="start" 
                        side="left" 
                        sideOffset={6}
                        className="z-[100]"
                      >
                        <DropdownMenuItem onSelect={async (e) => {
                          e.preventDefault();
                          // The onSelect event already handles closing the menu, 
                          // but we preventDefault to handle the mutation manually
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
                        }}>
                          {conv.is_pinned ? (
                            <>
                              <PinOff className="mr-2 size-4" />
                              <span>📌 Desafixar conversa</span>
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 size-4" />
                              <span>📌 Fixar conversa</span>
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-500 focus:text-red-500"
                          onSelect={(e) => {
                            e.preventDefault();
                            setConversationToHide(conv.id);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          <span>🗑️ Excluir da minha lista</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>


      </Card>

      {/* Main - Chat Window */}
      <Card className={`flex flex-1 flex-col overflow-hidden bg-card/40 backdrop-blur-sm transition-transform ${isAttentionShaking ? "attention-shake" : ""}`}>
        {activeConversation ? (
          <>
            <div className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChatProfileAvatar
                  name={(activeConversation as any).contact_profile_name || (activeConversation as any).display_name || "Contato"}
                  imageUrl={getConversationAvatar(activeConversation)}
                  status={(activeConversation as any).other_profile_id
                    ? getProfilePresenceStatus((activeConversation as any).other_profile_id)
                    : (activeConversation as any).contact_type === "support"
                      ? getAdminPresenceStatus()
                      : "offline"}
                  className="size-10"
                />
                <div>
                  <h3 className="text-sm font-semibold truncate max-w-[200px] md:max-w-md">
                    {getHeaderLabel(activeConversation)}
                  </h3>
                  {(activeConversation as any).contact_type === "support" ? (
                    <div className="text-[10px] font-black tracking-widest text-primary/60 -mt-1 uppercase">
                      SUPORTE
                    </div>
                  ) : (activeConversation as any).contact_type === "matriz" ? (
                    <div className="text-[10px] font-black tracking-widest text-primary/60 -mt-1 uppercase">
                      MATRIZ
                    </div>
                  ) : (
                    <div className="text-[10px] font-black tracking-widest text-primary/60 -mt-1 uppercase">
                      FILIAL
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {typingUsers.size > 0 ? (
                      <span className="text-[10px] text-primary font-medium animate-pulse flex items-center gap-0.5" aria-live="polite">
                        Digitando
                        <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                      </span>
                    ) : (
                      <>
                        <ChatPresenceIndicator 
                          status={(activeConversation as any).other_profile_id
                            ? getProfilePresenceStatus((activeConversation as any).other_profile_id)
                            : (activeConversation as any).contact_type === "support"
                              ? getAdminPresenceStatus()
                              : "offline"}
                          size={6}
                        />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {getProfilePresenceStatus((activeConversation as any).other_profile_id) === "busy"
                            ? "Ocupado"
                            : getProfilePresenceStatus((activeConversation as any).other_profile_id) === "away"
                              ? "Ausente"
                              : isProfileOnline((activeConversation as any).other_profile_id) ? "Online agora" : "Offline"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="size-4" />
              </Button>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <ScrollArea className="h-full p-4 chat-messages-scroll-area" ref={scrollRef}>
                <div className="flex flex-col gap-4 min-h-full">
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
                          className={cn("group/message rounded-xl transition-all duration-200", isReplyTarget && "bg-primary/10 ring-1 ring-primary/70 px-2 py-1 shadow-[0_0_18px_rgba(0,220,220,0.18)]")}
                          onClick={() => canInteract && setActionMessageId((current) => current === msg.id ? null : msg.id)}
                        >
                          {showDateDivider && (
                            <div className="my-4 flex items-center gap-3">
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
                              className="flex items-center gap-4 my-6 opacity-60"
                            >
                              <div className="h-[1px] flex-1 bg-primary/20" />
                              <span className="text-[10px] font-bold tracking-widest uppercase text-primary whitespace-nowrap">
                                Novas mensagens
                              </span>
                              <div className="h-[1px] flex-1 bg-primary/20" />
                            </div>
                          )}
                          <div
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            data-message-id={msg.id}
                            data-unread={(() => {
                              const isMe = msg.sender_id === access?.userId;
                              if (isMe) return "false";
                              const receipt = msg.chat_message_receipts?.find(
                                (r: any) => r.recipient_profile_id === access?.userId
                              );
                              return receipt && !receipt.read_at ? "true" : "false";
                            })()}
                            data-received={!isMe ? "true" : "false"}
                          >


                        {msg.event === 'nudge' ? (
                          <div className="attention-message">
                            <span 
                              className="text-4xl leading-none select-none py-1 block" 
                              role="img" 
                              aria-label="Chamada de atenção"
                            >
                              {msg.content || "🫨"}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm relative group/msg ${
                              isMe
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-muted text-foreground rounded-tl-none"
                            } ${isReplyTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} transition-all`}
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
                                  isMe={isMe} 
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
                        <div className={`mt-1 flex items-center gap-1.5 justify-end text-[10px] opacity-70`}>
                          <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                          {isMe && !msg.isOptimistic && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center">
                                    {(msg.read_at || msg.chat_message_receipts?.some((r: any) => r.read_at)) ? (
                                      <CheckCheck className="size-3 text-cyan-400" />
                                    ) : (msg.delivered_at || msg.chat_message_receipts?.some((r: any) => r.delivered_at)) ? (
                                      <CheckCheck className="size-3" />
                                    ) : (
                                      <Check className="size-3" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {msg.read_at ? "Lida" : msg.delivered_at ? "Entregue" : "Enviada"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isMe && msg.isOptimistic && (
                            failedMessageIds.has(msg.id) ? (
                              <div className="flex items-center gap-1 text-red-400">
                                <AlertCircle className="size-3" />
                                <button 
                                  onClick={() => handleSendMessage(undefined, msg)}
                                  className="underline font-bold"
                                >
                                  Tentar novamente
                                </button>
                              </div>
                            ) : (
                              <Clock className="size-3 animate-pulse" />
                            )
                          )}
                        </div>
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
                    <span>{newMessagesCount} {newMessagesCount === 1 ? 'nova mensagem' : 'novas mensagens'}</span>
                  )}
                </button>
              )}
            </div>



            <form onSubmit={handleSendMessage} className="border-t p-4 flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={activeConversationId ? !!nudgeCooldowns[activeConversationId] : true}
                      onClick={handleNudge}
                      className="text-primary hover:bg-primary/10"
                    >
                      {activeConversationId && nudgeCooldowns[activeConversationId] ? (
                        <Timer className="size-4 animate-pulse" />
                      ) : (
                        <span className="text-[22px]">🫨</span>
                      )}

                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {activeConversationId && nudgeCooldowns[activeConversationId] 
                      ? `Aguarde ${formatCooldown(nudgeCooldowns[activeConversationId])}`
                      : "Chamar atenção"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>


              <div className="flex flex-col w-full gap-2">
                {(replyingTo || editingMessage) && (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {editingMessage ? "Editando mensagem" : "Respondendo"}
                      </p>
                      <p className="truncate text-xs text-foreground/70">
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
                  <Input
                    placeholder="Digite sua mensagem..."
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
                    className="flex-1 bg-background/50"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,.pdf"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-muted-foreground hover:bg-white/5"
                  >
                    <Paperclip className="size-5" />
                  </Button>
                  <Button type="submit" size="icon" disabled={(!messageText.trim() && !pendingFile) || isSending || isUploading}>
                    {isSending || isUploading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bell className="size-8 text-primary opacity-50" />
            </div>
            <h3 className="text-lg font-display font-semibold mb-2">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Escolha um contato ao lado para iniciar um bate-papo ou chamar a atenção de alguém.
            </p>
          </div>
        )}
      </Card>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake {
          animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
          animation-iteration-count: 3;
        }
      `}} />
      <AlertDialog open={!!conversationToHide} onOpenChange={(open) => !open && setConversationToHide(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Excluir da minha lista</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover esta conversa da sua lista? As mensagens continuarão preservadas e a conversa poderá reaparecer quando houver uma nova mensagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600"
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


