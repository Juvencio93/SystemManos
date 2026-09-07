import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapRoleToParticipantType, normalizeAppRole } from "./chat-validation.functions";

async function getOptionalSupabaseAdmin(supabase: any) {
  if (!process.env["TECH_SUPABASE_SERVICE_KEY"]) {
    return supabase;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveConversationRecipientIds({
  supabase,
  conversationId,
  currentUserId,
}: {
  supabase: any;
  conversationId: string;
  currentUserId: string;
}): Promise<string[]> {
  const { data: rpcRecipients, error: rpcError } = await supabase.rpc(
    "chat_get_recipient_ids",
    { p_conversation_id: conversationId },
  );

  if (!rpcError) {
    const ids = (Array.isArray(rpcRecipients) ? rpcRecipients : [])
      .filter(Boolean)
      .filter((id: string) => id !== currentUserId);
    if (ids.length > 0) return Array.from(new Set(ids));
  } else {
    console.warn("[chat] chat_get_recipient_ids unavailable, using compatibility fallback.", rpcError);
  }

  const serverSupabase = await getOptionalSupabaseAdmin(supabase);

  const { data: participants, error: participantsError } = await serverSupabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId);

  if (participantsError) {
    throw new Error(participantsError.message || "Não foi possível identificar o destinatário.");
  }

  const participantIds = (participants ?? [])
    .map((participant: any) => participant.profile_id)
    .filter(Boolean);

  const recipientIds = new Set<string>(
    participantIds.filter((profileId: string) => profileId !== currentUserId),
  );

  const isLegacySupportConversation =
    participantIds.length === 1 && participantIds[0] === currentUserId;

  if (isLegacySupportConversation) {
    // Legacy one-participant conversations must follow the current ownership
    // of the sender's company. Before reseller support existed these threads
    // were routed to every ADM; preserve that fallback only when no reseller
    // is linked to the company.
    const { data: senderRole } = await serverSupabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", currentUserId)
      .in("role", ["matriz", "filial"])
      .not("company_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (senderRole?.company_id) {
      const { data: company } = await serverSupabase
        .from("companies")
        .select("reseller_id")
        .eq("id", senderRole.company_id)
        .maybeSingle();

      if (company?.reseller_id) {
        const { data: reseller } = await serverSupabase
          .from("resellers")
          .select("user_id")
          .eq("id", company.reseller_id)
          .eq("status", "ativa")
          .maybeSingle();
        if (reseller?.user_id && reseller.user_id !== currentUserId) {
          recipientIds.add(reseller.user_id);
        }
        return Array.from(recipientIds);
      }
    }

    const { data: admins, error: adminsError } = await serverSupabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "adm");

    if (adminsError) {
      throw new Error(adminsError.message || "Não foi possível identificar o Suporte.");
    }

    (admins ?? []).forEach((admin: any) => {
      if (admin.user_id && admin.user_id !== currentUserId) {
        recipientIds.add(admin.user_id);
      }
    });
  }

  return Array.from(recipientIds);
}

export const getConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const serverSupabase = await getOptionalSupabaseAdmin(supabase);

    // 1. Resolve roles and identities
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id")
      .eq("user_id", userId);

    const roles = (userRoles || []).map(r => ({ ...r, role: normalizeAppRole(r.role) }));
    const primaryRole = [...roles].sort((a, b) => {
      const priority = ["adm", "revenda", "matriz", "filial"];
      const roleA = a?.role || "";
      const roleB = b?.role || "";
      return priority.indexOf(roleA) - priority.indexOf(roleB);
    })[0];

    if (!primaryRole) return [];

    // 2. Fetch conversations with basic joins
    // A reseller owns the conversations of every company it registered. The
    // legacy null-company filter only covered the reseller's own Support
    // thread and accidentally hid its matrix/branch conversations.
    let resellerCompanyIds: string[] = [];
    if (primaryRole.role === "revenda") {
      const { data: reseller } = await serverSupabase
        .from("resellers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (reseller?.id) {
        const { data: ownedCompanies } = await serverSupabase
          .from("companies")
          .select("id")
          .eq("reseller_id", reseller.id);
        resellerCompanyIds = (ownedCompanies ?? [])
          .map((company: any) => company.id)
          .filter((id: unknown): id is string => Boolean(id));
      }
    }
    let query = supabase
      .from("conversations")
      .select(`
        *,
        company:companies(id, name, trade_name),
        conversation_participants (
          id,
          conversation_id,
          participant_type,
          profile_id,
          branch_id,
          branch:branches(id, name, trade_name)
        )
      `);

    // Filter by company scope if not ADM
    if (primaryRole.role !== 'adm') {
      if (primaryRole.role === "revenda") {
        query = resellerCompanyIds.length > 0
          ? query.or(`company_id.is.null,company_id.in.(${resellerCompanyIds.join(",")})`)
          : query.is("company_id", null);
      } else {
        if (!primaryRole.company_id) return [];
        query = query.eq("company_id", primaryRole.company_id);
      }
    }

    const { data: queriedConversations, error } = await query;
    
    if (error) {
      console.error("[getConversations] Supabase error:", error);
      throw error;
    }

    // Reseller conversations use company_id = null for the legacy Support
    // model. Scope them by participant membership as well, otherwise a
    // reseller would see unrelated null-company conversations (for example,
    // a branch conversation from another network) and could reuse the wrong
    // thread when starting a new Support chat.
    const rawConversations = primaryRole.role === "revenda"
      ? (queriedConversations ?? []).filter((conversation: any) =>
          (conversation.conversation_participants ?? []).some(
            (participant: any) => participant.profile_id === userId,
          ),
        )
      : (queriedConversations ?? []);

    // 2b. Fetch preferences and messages separately for the user
    const conversationIds = rawConversations.map(c => c.id);
    const { data: rawPreferences, error: prefError } = conversationIds.length > 0
      ? await supabase
          .from("conversation_user_preferences")
          .select("conversation_id, is_pinned, hidden_at, history_cleared_at")
          .eq("user_id", userId)
          .in("conversation_id", conversationIds)
      : { data: [], error: null };

    if (prefError) {
      console.error("[getConversations] Preferences error:", prefError);
    }

    const preferencesByConv = new Map(
      (rawPreferences ?? []).map(p => [p.conversation_id, p])
    );

    // 2c. Fetch messages with individual history clearing filter.
    // The conversations above are already scoped through the authenticated
    // client/RLS. If the server-only key is available, use the server client
    // for compatibility with stricter message/attachment policies. In
    // environments without TECH_SUPABASE_SERVICE_KEY, fall back to the
    // authenticated client instead of breaking the entire chat panel.
    const convDataWithMessages = await Promise.all((rawConversations ?? []).map(async (conv) => {
      const prefs = preferencesByConv.get(conv.id);
      const historyClearedAt = prefs?.history_cleared_at;

      let msgQuery = serverSupabase
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          sender_id,
          event,
          reply_to_message_id,
          edited_at,
          deleted_at,
          chat_attachments (*),
          sender_profile:profiles!messages_sender_id_fkey(id, display_name, full_name, chat_avatar_url),
          chat_message_receipts (
            delivered_at,
            read_at,
            recipient_profile_id
          )
        `)
        .eq("conversation_id", conv.id);

      if (historyClearedAt) {
        msgQuery = msgQuery.gt("created_at", historyClearedAt);
      }

      const { data: messages, error: messagesError } = await msgQuery.order('created_at', { ascending: true });
      if (messagesError) {
        console.error("[getConversations] Messages error:", {
          conversationId: conv.id,
          userId,
          error: messagesError,
        });
        throw new Error(messagesError.message || "Não foi possível carregar as mensagens da conversa.");
      }
      const replyIds = Array.from(new Set((messages || []).map((msg: any) => msg.reply_to_message_id).filter(Boolean)));
      let repliesById = new Map<string, any>();
      if (replyIds.length > 0) {
        const { data: replies } = await serverSupabase
          .from("messages")
          .select("id, content, sender_id, created_at, deleted_at")
          .in("id", replyIds);
        repliesById = new Map((replies || []).map((reply: any) => [reply.id, reply]));
      }
      const enrichedMessages = (messages || []).map((msg: any) => ({
        ...msg,
        reply_to: msg.reply_to_message_id ? repliesById.get(msg.reply_to_message_id) || null : null,
      }));
      return { ...conv, messages: enrichedMessages };
    }));


    // Resolve only the safe hierarchy projection exposed by the authenticated
    // chat RPC. This keeps the chat panel independent from a server service key.
    const { data: contactsPayload, error: contactsError } = await (supabase as any).rpc(
      "chat_get_contacts",
    );
    if (contactsError) {
      console.error("[getConversations] Contact enrichment error:", contactsError);
      throw new Error(contactsError.message || "Não foi possível identificar os contatos.");
    }

    const contactGroups = (contactsPayload || { matrices: [], others: [] }) as {
      matrices?: Array<any>;
      others?: Array<any>;
    };
    const resellerByUserId = new Map<string, any>();
    // The contacts RPC intentionally exposes only the organizational units.
    // Resellers are outside that hierarchy, so add them explicitly for the
    // owner ADM; otherwise reseller conversations cannot be opened from the
    // contact list even though their messages exist.
    if (primaryRole.role === "adm") {
      const { data: resellers } = await serverSupabase
        .from("resellers")
        .select("id, name, user_id")
        .not("user_id", "is", null)
        .order("name");
      const existingIds = new Set((contactGroups.others || []).map((contact: any) => contact.profileId));
      (resellers || []).forEach((reseller: any) => {
        if (reseller.user_id) resellerByUserId.set(reseller.user_id, reseller);
        if (reseller.user_id && reseller.user_id !== userId && !existingIds.has(reseller.user_id)) {
          contactGroups.others = [
            ...(contactGroups.others || []),
            { profileId: reseller.user_id, displayName: reseller.name || "Revenda", role: "revenda", companyId: null },
          ];
        }
      });
      // Resellers are not returned by the organizational contacts RPC. Load
      // their profile avatars explicitly so active conversations use the same
      // image already shown in the contacts list.
      const resellerProfileIds = (resellers || [])
        .map((reseller: any) => reseller.user_id)
        .filter((profileId: unknown): profileId is string => Boolean(profileId));
      if (resellerProfileIds.length) {
        const { data: resellerProfiles } = await serverSupabase
          .from("profiles")
          .select("id, chat_avatar_url")
          .in("id", resellerProfileIds);
        (resellerProfiles || []).forEach((profile: any) => {
          const reseller = resellerByUserId.get(profile.id);
          if (reseller) reseller.chat_avatar_url = profile.chat_avatar_url || null;
        });
      }
    }
    if (primaryRole.role === "revenda" && !(contactGroups.others || []).some((contact: any) => contact.role === "adm")) {
      const { data: support } = await serverSupabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "adm")
        .neq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (support?.user_id) {
        const { data: supportProfile } = await serverSupabase
          .from("profiles")
          .select("id, display_name, full_name, chat_avatar_url")
          .eq("id", support.user_id)
          .maybeSingle();
        contactGroups.others = [
          ...(contactGroups.others || []),
          {
            profileId: support.user_id,
            displayName: supportProfile?.display_name || supportProfile?.full_name || "Suporte",
            profileDisplayName: supportProfile?.display_name || supportProfile?.full_name || "Suporte",
            profileAvatarUrl: supportProfile?.chat_avatar_url || null,
            role: "adm",
            companyId: null,
          },
        ];
      }
    }
    // A matrix/branch owned by a reseller must use that reseller as its
    // technical support. Remove the platform ADM contact from this scoped
    // view so selecting "Suporte" can never route to the wrong account.
    if ((primaryRole.role === "matriz" || primaryRole.role === "filial") && primaryRole.company_id) {
      const { data: ownerCompany } = await serverSupabase
        .from("companies")
        .select("reseller_id")
        .eq("id", primaryRole.company_id)
        .maybeSingle();
      if (ownerCompany?.reseller_id) {
        contactGroups.others = (contactGroups.others || []).filter((contact: any) => contact.role !== "adm");
        const { data: technicalReseller } = await serverSupabase
          .from("resellers")
          .select("user_id, name")
          .eq("id", ownerCompany.reseller_id)
          .maybeSingle();
        if (technicalReseller?.user_id && technicalReseller.user_id !== userId) {
          const exists = (contactGroups.others || []).some((contact: any) => contact.profileId === technicalReseller.user_id);
          if (!exists) {
            contactGroups.others = [
              ...(contactGroups.others || []),
              { profileId: technicalReseller.user_id, displayName: "Suporte Técnico", profileDisplayName: technicalReseller.name || "Suporte Técnico", role: "revenda", companyId: primaryRole.company_id },
            ];
          }
        }
      }
    }
    const { data: contactAvatarData, error: contactAvatarError } = await (supabase as any).rpc(
      "chat_get_contact_avatar_urls",
    );
    if (contactAvatarError) {
      console.error("[getConversations] Contact avatar enrichment error:", contactAvatarError);
    }
    const contactAvatarUrls = (contactAvatarData || {}) as Record<string, string | null>;
    const chatContacts = [
      ...(contactGroups.matrices || []),
      ...(contactGroups.others || []),
    ].map((contact) => ({
      ...contact,
      profileAvatarUrl: contactAvatarUrls[contact.profileId] || contact.profileAvatarUrl || null,
    }));
    const contactsByProfileId = new Map(chatContacts.map(contact => [contact.profileId, contact]));
    // Use the enriched contact collection here. The raw RPC result does not
    // contain avatar URLs, which made legacy Support conversations fall back
    // to initials even when the contact list showed the uploaded photo.
    // The logical Support contact depends on the current network.  For a
    // company owned by a reseller, "Suporte Técnico" is the reseller (not
    // the platform ADM).  Legacy support conversations can contain only the
    // sender participant, so this contact is also the authoritative avatar
    // fallback for active-conversation rows.
    const supportContact = primaryRole.role === "adm"
      ? chatContacts.find(contact => contact.role === "adm")
      : primaryRole.role === "revenda"
        ? chatContacts.find(contact => contact.role === "adm")
        : chatContacts.find(contact => contact.role === "revenda") ||
          chatContacts.find(contact => contact.role === "adm");
    const supportProfile = supportContact
      ? {
          id: supportContact.profileId,
          display_name: supportContact.profileDisplayName || "Suporte",
          full_name: supportContact.profileDisplayName || "Suporte",
          chat_avatar_url: supportContact.profileAvatarUrl || null,
        }
      : null;

    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, chat_avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const profilesById = new Map<string, any>();
    const participantIds = [...new Set(convDataWithMessages.flatMap((conversation: any) =>
      (conversation.conversation_participants ?? []).map((p: any) => p.profile_id).filter(Boolean)))];
    if (ownProfile) profilesById.set(userId, ownProfile);
    chatContacts.forEach(contact => {
      profilesById.set(contact.profileId, {
        id: contact.profileId,
        display_name: contact.profileDisplayName || contact.displayName,
        full_name: contact.profileDisplayName || contact.displayName,
        chat_avatar_url: contact.profileAvatarUrl || null,
      });
    });
    const missingProfileIds = participantIds.filter((id) => !profilesById.has(id));
    if (missingProfileIds.length) {
      const { data: participantProfiles } = await serverSupabase
        .from("profiles")
        .select("id, display_name, full_name, chat_avatar_url")
        .in("id", missingProfileIds);
      (participantProfiles || []).forEach((profile: any) => {
        profilesById.set(profile.id, profile);
        const reseller = resellerByUserId.get(profile.id);
        if (reseller) reseller.chat_avatar_url = profile.chat_avatar_url || null;
      });
    }

    const rolesByUserId = new Map<string, ReturnType<typeof normalizeAppRole>>();
    rolesByUserId.set(userId, primaryRole.role);
    chatContacts.forEach(contact => rolesByUserId.set(contact.profileId, normalizeAppRole(contact.role)));
    // Support conversations use the legacy single-participant model. Resolve
    // those participant roles directly so a reseller is not mislabeled as a
    // Matriz in the ADM view.
    if (participantIds.length) {
      const { data: participantRoles } = await serverSupabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", participantIds);
      (participantRoles ?? []).forEach((row: any) => rolesByUserId.set(row.user_id, normalizeAppRole(row.role)));
    }

    const companiesById = new Map<string, any>();
    const branchesById = new Map<string, any>();
    chatContacts.forEach(contact => {
      if (contact.role === "matriz") {
        companiesById.set(contact.companyId, {
          id: contact.companyId,
          name: contact.displayName,
          trade_name: contact.displayName,
        });
      }
    });
    convDataWithMessages.forEach(conversation => {
      conversation.conversation_participants?.forEach(participant => {
        if (!participant.branch_id || !participant.profile_id) return;
        const contact = contactsByProfileId.get(participant.profile_id);
        if (!contact) return;
        branchesById.set(participant.branch_id, {
          id: participant.branch_id,
          name: contact.displayName,
          trade_name: contact.displayName,
        });
      });
    });


    // 4. Resolve display names and enrich
    const result = convDataWithMessages.map(conv => {
      // Identify message types based on event field (message_type column doesn't exist)
      const messages = (conv.messages || []).map((msg: any) => ({
        ...msg,
        message_type: msg?.event === 'nudge' ? 'attention' : 'text'
      }));

      const participants = (conv.conversation_participants ?? []).map(p => ({
        ...p,
        profile: p.profile_id ? profilesById.get(p.profile_id) : null,
        role: p.profile_id ? rolesByUserId.get(p.profile_id) : null,
        branch: p.branch_id ? branchesById.get(p.branch_id) || p.branch : p.branch
      }));

      // Legacy support threads may contain only the Matriz/Filial participant.
      // For a reseller-owned company that participant is not ADM support: it
      // is the technical-support thread of the owning reseller. Add the
      // reseller as the logical peer before resolving the conversation below.
      const conversationCompany = conv.company_id ? companiesById.get(conv.company_id) : null;
      if (conversationCompany?.reseller_id && participants.length === 1) {
        const owningReseller = [...resellerByUserId.values()].find(
          (reseller: any) => reseller.id === conversationCompany.reseller_id && reseller.user_id,
        );
        const onlyParticipant = participants[0];
        const onlyParticipantIsSelf = onlyParticipant?.profile_id === userId;
        if (owningReseller?.user_id && onlyParticipantIsSelf) {
          const resellerProfile = profilesById.get(owningReseller.user_id) || null;
          participants.push({
            profile_id: owningReseller.user_id,
            participant_type: "revenda",
            branch_id: null,
            profile: resellerProfile,
            role: { role: "revenda" },
            branch: null,
          } as any);
        }
      }

      const prefs = preferencesByConv.get(conv.id) || { is_pinned: false, hidden_at: null, history_cleared_at: null };
      
      // Determine logical contact (the one that is not me and not an ADM)
      const isSelfParticipant = (p: any) => {
        if (primaryRole.role === 'matriz') {
          return p.participant_type === 'matriz' && p.profile_id === userId;
        }
        if (primaryRole.role === 'filial') {
          return p.participant_type === 'filial' && p.branch_id === primaryRole.branch_id;
        }
        if (primaryRole.role === 'revenda') {
          return p.profile_id === userId || p.participant_type === 'matriz';
        }
        return false;
      };

      const isSupportConversation = 
        primaryRole.role !== 'adm' &&
        participants.length === 1 && 
        isSelfParticipant(participants[0]);

      // Determine logical contact
      const participantProfileIds = [...new Set((conv.conversation_participants || []).map((p: any) => p.profile_id).filter(Boolean))];
      const resellerParticipantId = primaryRole.role === "adm"
        ? participantProfileIds.find((id) => resellerByUserId.has(id))
        : undefined;
      const otherProfileId = resellerParticipantId || participantProfileIds.find(id => id !== userId) ||
        (primaryRole.role === "adm" ? participantProfileIds[0] : null) || null;
      const otherParticipant = otherProfileId ? participants.find(p => p.profile_id === otherProfileId) : null;

      let displayName = ""; 
      let contactType: "support" | "matriz" | "filial" = "support";
      let contactId = null;

      // Se for conversa de Suporte (baseada no modelo legado)
      if (isSupportConversation) {
        displayName = "Suporte";
        contactType = "support";
      } else if (otherParticipant) {
        const otherRole = otherParticipant.role || normalizeAppRole(otherParticipant.participant_type);
        
        if (otherRole === 'adm') {
          displayName = "Suporte";
          contactType = "support";
        } else if (otherRole === 'filial') {
          displayName = otherParticipant.branch?.trade_name || otherParticipant.branch?.name || otherParticipant.profile?.display_name || "";
          contactType = "filial";
          contactId = otherParticipant.branch_id;
        } else if (otherRole === 'revenda') {
          const reseller = otherParticipant?.profile_id ? resellerByUserId.get(otherParticipant.profile_id) : null;
          const resellerName = reseller?.name || otherParticipant.profile?.display_name || otherParticipant.profile?.full_name || "Revenda";
          displayName = primaryRole.role === "adm" ? `${resellerName} — Revenda` : "Suporte Técnico";
          contactType = "support";
        } else if (otherRole === 'matriz') {
          const company = (conv.company_id ? companiesById.get(conv.company_id) : null) || conv.company;
          displayName = company?.trade_name || company?.name || otherParticipant.profile?.display_name || "";
          contactType = "matriz";
          contactId = conv.company_id;
        }
      }

      if (!displayName && otherParticipant?.profile) {
        displayName = otherParticipant.profile.display_name || otherParticipant.profile.full_name || "Contato";
      }

      if (!displayName) {
        const otherRole = otherParticipant ? (otherParticipant.role || normalizeAppRole(otherParticipant.participant_type)) : null;
        displayName = otherRole === 'adm' ? "Suporte" : "Contato";
      }

      const contactProfileName = contactType === "support"
        ? otherParticipant?.profile?.display_name ||
          otherParticipant?.profile?.full_name ||
          supportProfile?.display_name ||
          supportProfile?.full_name ||
          "Suporte"
        : otherParticipant?.profile?.display_name ||
          otherParticipant?.profile?.full_name ||
          displayName;

      const contactProfileAvatarUrl = contactType === "support"
        ? (otherParticipant?.role === "revenda" ? resellerByUserId.get(otherParticipant.profile_id as string)?.chat_avatar_url : null) ||
          otherParticipant?.profile?.chat_avatar_url ||
          supportProfile?.chat_avatar_url ||
          null
        : otherParticipant?.profile?.chat_avatar_url || null;

      return {
        ...conv,
        messages,
        conversation_participants: participants,
        display_name: displayName,
        contact_profile_name: contactProfileName,
        contact_profile_avatar_url: contactProfileAvatarUrl,
        contact_type: contactType,
        contact_id: contactId,
        other_profile_id: otherProfileId,
        is_pinned: prefs.is_pinned,
        hidden_at: prefs.hidden_at
      };
    });


    // 5. Filter out hidden (unless new message arrived) and Sort
    const visible = result
      .filter(c => {
        if (!c.messages?.length) return false;
        const lastMsgAt = c.messages[c.messages.length - 1]?.created_at || c.last_message_at;
        return !c.hidden_at || (lastMsgAt && new Date(lastMsgAt) > new Date(c.hidden_at));
      })
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        const timeA = new Date(a.messages?.[a.messages.length - 1]?.created_at || a.last_message_at).getTime();
        const timeB = new Date(b.messages?.[b.messages.length - 1]?.created_at || b.last_message_at).getTime();
        return timeB - timeA;
      });
    // A legacy support conversation may have been created more than once.
    // Present one logical thread per contact while retaining the newest one.
    const uniqueByContact = new Map<string, (typeof visible)[number]>();
    visible.forEach((conversation) => {
      // A legacy support thread can have no `other_profile_id` (or can carry
      // different participant metadata after one side hides it). Build the
      // key from the actual non-self participant before falling back to the
      // conversation id; this prevents two active rows for the same contact.
      const participantIds = (conversation.conversation_participants ?? [])
        .map((p: any) => p.profile_id)
        .filter((id: string | null | undefined) => Boolean(id) && id !== userId)
        .sort();
      const key = conversation.other_profile_id
        ? `${conversation.contact_type}:${conversation.other_profile_id}`
        : participantIds.length
          ? `${conversation.contact_type}:${participantIds.join(",")}`
          : `${conversation.contact_type}:${conversation.contact_profile_name || conversation.display_name}`;
      if (!uniqueByContact.has(key)) uniqueByContact.set(key, conversation);
    });
    return [...uniqueByContact.values()];

  });

export const setConversationPinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    conversationId: z.string().uuid(),
    isPinned: z.boolean()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("conversation_user_preferences")
      .upsert({
        user_id: userId,
        conversation_id: data.conversationId,
        is_pinned: data.isPinned,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id,conversation_id"
      })
      .select()
      .single();
    
    if (error) {
      console.error("[chat:pin]", {
        conversationId: data.conversationId,
        userId,
        error,
      });
      throw error;
    }
    return { success: true };
  });

export const hideConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    conversationId: z.string().uuid()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: accessible, error: accessError } = await supabase.rpc("check_conversation_access", {
      _user_id: userId,
      _conversation_id: data.conversationId,
    });
    if (accessError || accessible !== true) throw new Error("Conversa não encontrada ou sem permissão.");
    const writer = await getOptionalSupabaseAdmin(supabase);
    const { error } = await writer
      .from("conversation_user_preferences")
      .upsert({
        user_id: userId,
        conversation_id: data.conversationId,
        is_pinned: false,
        hidden_at: new Date().toISOString(),
        history_cleared_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,conversation_id" });
      
    if (error) {
      console.error("[chat:hide]", {
        conversationId: data.conversationId,
        userId,
        error,
      });
      throw error;
    }
    return { success: true, hidden: true };
  });


export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    conversationId: z.string().uuid("conversationId precisa ser um UUID válido"),
    clientMessageId: z.string().uuid("clientMessageId é obrigatório para idempotência"),
    content: z.string().trim().optional().default(""),
    event: z.string().optional(),
    replyToMessageId: z.string().uuid().nullable().optional(),
    attachments: z.array(z.object({
      filePath: z.string(),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
    })).optional(),
  }).refine((data) => {
    const hasText = Boolean(data.content?.trim());
    const hasAttachments = Boolean(data.attachments && data.attachments.length > 0);
    const isEvent = Boolean(data.event);
    return hasText || hasAttachments || isEvent;
  }, {
    message: "A mensagem precisa ter texto, arquivo ou ser um evento.",
  }).parse(data))

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Idempotency check: look for existing message with this clientMessageId
    const { data: existingMessage } = await supabase
      .from("messages")
      .select(`
        *,
        chat_attachments (*),
        chat_message_receipts (
          delivered_at,
          read_at,
          recipient_profile_id
        )
      `)
      .eq("sender_id", userId)
      .eq("client_message_id" as any, data.clientMessageId)
      .maybeSingle();

    if (existingMessage) return existingMessage;

    let processedContent = (data.content || "").trim();
    if (processedContent.length > 0 && data.event !== 'nudge') {
      processedContent = processedContent.charAt(0).toUpperCase() + processedContent.slice(1);
    }

    // Resolve recipients before writing. This both validates the conversation
    // and supports legacy Support threads where the ADM is not stored as a
    // participant. Use the server client for the already-authenticated,
    // validated write when available; the client RLS policy otherwise blocks
    // that legitimate legacy case.
    const recipientIds = new Set<string>(
      await resolveConversationRecipientIds({ supabase, conversationId: data.conversationId, currentUserId: userId }),
    );
    const writeClient = await getOptionalSupabaseAdmin(supabase);

    // 1. Persist Message
    const { data: message, error } = await writeClient
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        content: processedContent || "",
        event: data.event || null,
        client_message_id: data.clientMessageId as any,
        reply_to_message_id: data.replyToMessageId || null,
      } as any)

      .select()
      .single();

    if (error) {
      console.error("[sendMessage] Supabase error:", error);
      throw new Error(error.message);
    }

    // 2. Resolve recipients through the authenticated hierarchy projection.
    // Keep a compatibility fallback for environments whose SQL function is
    // not synchronized yet, especially legacy Support conversations.
    if (recipientIds.size > 0) {
      const receiptInserts = Array.from(recipientIds).map(pid => ({
        message_id: message.id,
        recipient_profile_id: pid,
      }));
      const { error: receiptError } = await writeClient
        .from("chat_message_receipts")
        .insert(receiptInserts);
      if (receiptError) throw receiptError;
    }

    // 3. Handle attachments
    if (data.attachments && data.attachments.length > 0) {
      const attachmentInserts = data.attachments.map(attr => ({
        message_id: message.id,
        file_path: attr.filePath,
        file_name: attr.fileName,
        file_size: attr.fileSize,
        mime_type: attr.mimeType,
      }));
      await writeClient.from("chat_attachments").insert(attachmentInserts);
    }

    // 4. Update conversation metadata
    await writeClient.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", data.conversationId);
    // A new message reactivates the existing thread for every participant.
    // This never creates a second conversation and preserves each user's
    // history-cleared timestamp.
    await writeClient.from("conversation_user_preferences").update({ hidden_at: null, updated_at: new Date().toISOString() }).eq("conversation_id", data.conversationId);

    // 5. Broadcast via Realtime
    const targetUserIds = Array.from(recipientIds);
    if (targetUserIds.length > 0) {
      const broadcastPayload = {
        eventId: data.event === "nudge" ? message.id : crypto.randomUUID(),
        event: data.event || null,
        messageId: message.id,
        conversationId: data.conversationId,
        fromUserId: userId,
        content: message.content,
        sentAt: message.created_at,
        targetUserIds,
      };

      await Promise.all(targetUserIds.map(async (targetId) => {
        const channel = supabase.channel(`local:widget:messages:${targetId}`);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1500);
          channel.subscribe((status: string) => {
            if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              clearTimeout(timer);
              resolve();
            }
          });
        });
        await channel.send({ type: "broadcast", event: "chat:message", payload: broadcastPayload });
        void supabase.removeChannel(channel);
      }));
    }

    const { data: finalMessage } = await supabase
      .from("messages")
      .select(`
        *,
        chat_attachments (*),
        chat_message_receipts (
          delivered_at,
          read_at,
          recipient_profile_id
        )
      `)
      .eq("id", message.id)
      .single();
    return finalMessage || message;
  });

export const editChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        messageId: z.string().uuid(),
        content: z.string().trim().min(1).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("messages")
      .update({
        content: data.content,
        edited_at: new Date().toISOString(),
      } as any)
      .eq("id", data.messageId)
      .eq("sender_id", userId)
      .is("deleted_at" as any, null);

    if (error) throw error;
    return { success: true };
  });

export const deleteChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ messageId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("messages")
      .update({
        content: "",
        deleted_at: new Date().toISOString(),
        edited_at: new Date().toISOString(),
      } as any)
      .eq("id", data.messageId)
      .eq("sender_id", userId)
      .is("deleted_at" as any, null);

    if (error) throw error;
    return { success: true };
  });

export const updateMessageReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    messageIds: z.array(z.string().uuid()),
    status: z.enum(["delivered", "read"]),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const updateData = data.status === "read" ? { read_at: now, delivered_at: now } : { delivered_at: now };

    const { data: updatedReceipts, error } = await supabase
      .from("chat_message_receipts")
      .update(updateData as any)
      .in("message_id", data.messageIds)
      .eq("recipient_profile_id", userId)
      .is("read_at", null) // Only update if not already read
      .select("message_id, message:messages(sender_id, conversation_id)");

    if (error) throw error;

    // Broadcast status update back to senders
    if (updatedReceipts && updatedReceipts.length > 0) {
      for (const receipt of updatedReceipts) {
        const msg = (receipt as any).message;
        if (msg?.sender_id) {
          const channel = supabase.channel(`local:widget:receipts:${msg.sender_id}`);
          await channel.send({
            type: "broadcast",
            event: "chat:receipt_update",
            payload: {
              messageId: receipt.message_id,
              conversationId: msg.conversation_id,
              status: data.status,
              updatedAt: now,
            }
          });
          void supabase.removeChannel(channel);
        }
      }
    }

    return { success: true };
  });


