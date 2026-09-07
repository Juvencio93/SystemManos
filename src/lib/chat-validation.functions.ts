import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export function normalizeAppRole(role: string | null | undefined): "adm" | "matriz" | "filial" | "revenda" | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === "admin" || r === "administrator" || r === "adm") return "adm";
  if (r === "matriz") return "matriz";
  if (r === "filial") return "filial";
  if (r === "revenda" || r === "reseller") return "revenda";
  return null;
}

/**
 * Contrato canônico para alvos de chat
 */
export type ChatContact = {
  profileId: string;
  companyId: string;
  displayName: string;
  role: "adm" | "matriz" | "filial" | "revenda";
  parentMatrixCompanyId?: string | null;
  profileDisplayName?: string | null;
  profileAvatarUrl?: string | null;
};


export type ConversationResult = {
  conversationId: string;
  created: boolean;
};

interface Participant {
  participant_type: string;
  profile_id?: string | null;
  branch_id?: string | null;
}

/**
 * Identidade canônica para comparação de participantes.
 * Retorna uma chave única ordenada: "type:id,type:id"
 * 
 * ATENÇÃO: Mantém compatibilidade com o modelo de "Suporte" que possui 
 * apenas o usuário não-ADM como único participante no banco.
 */
export function participantIdentity(participants: Participant[]): string {
  if (!participants || participants.length === 0) return "";
  
  // Se houver apenas um participante, e ele não for ADM, 
  // no banco isso representa uma conversa de Suporte.
  if (participants.length === 1) {
    const p = participants[0];
    if (p) {
      if (p.participant_type === "matriz") {
        return `matriz:${p.profile_id || ""}`;
      }
      if (p.participant_type === "revenda") {
        return `revenda:${p.profile_id || ""}`;
      }
      if (p.participant_type === "filial") {
        return `filial:${p.branch_id || ""}`;
      }
    }
  }


  return participants
    .map((p) => {
      if (!p) return null;
      if (p.participant_type === "matriz") {
        return `matriz:${p.profile_id || ""}`;
      }
      if (p.participant_type === "revenda") {
        return `revenda:${p.profile_id || ""}`;
      }
      if (p.participant_type === "filial") {
        return `filial:${p.branch_id || ""}`;
      }
      if (p.participant_type === "support") {
        return `support:${p.profile_id || ""}`;
      }
      return null;
    })

    .filter((k): k is string => k !== null)
    .sort()
    .join(",");
}

/**
 * Identidade canônica para um único participante
 */
export function participantKey(participant: {
  participant_type?: string;
  profile_id?: string | null;
  branch_id?: string | null;
}) {
  const type = participant?.participant_type;

  if (type === "matriz") {
    return participant.profile_id ? `matriz:${participant.profile_id}` : null;
  }
  if (type === "revenda") {
    return participant.profile_id ? `revenda:${participant.profile_id}` : null;
  }
  if (type === "filial") {
    return participant.branch_id ? `filial:${participant.branch_id}` : null;
  }
  return null;
}

export function mapRoleToParticipantType(role: string): "matriz" | "filial" | "revenda" {
  const normalized = normalizeAppRole(role);
  if (normalized === "filial") return "filial";
  if (normalized === "revenda") return "revenda";
  return "matriz";
}



interface ContactsResponse {
  matrices: ChatContact[];
  others: ChatContact[];
}

/**
 * Resolve os contatos disponíveis para o usuário atual seguindo as regras de hierarquia:
 * - ADM: vê todas as Matrizes e suas Filiais ativas.
 * - Matriz: vê Suporte e suas próprias Filiais.
 * - Filial: vê Suporte, sua Matriz e Filiais irmãs.
 */
export const getChatContactsLegacy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContactsResponse> => {
    const { supabase, userId } = context;

    const { data: userRoleRow } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!userRoleRow) return { matrices: [], others: [] };

    const role = normalizeAppRole(userRoleRow.role);
    const companyId = userRoleRow.company_id;
    const branchId = userRoleRow.branch_id;

    if (!role) return { matrices: [], others: [] };

    // Cross-company hierarchy resolution is server-only. The authenticated
    // client intentionally cannot read sibling branches because of RLS.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const contacts: ContactsResponse = {
      matrices: [],
      others: [],
    };

    // ADM/Support Identity
    const { data: adms } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, company_id")
      .eq("role", "adm")
      .order("user_id", { ascending: true })
      .limit(1);
    
    if (!adms?.[0]?.user_id) {
      console.error("[Chat Hierarchy Error] Support (ADM) profile not found");
    }

    const supportContact: ChatContact | null = adms?.[0]?.user_id ? {
      profileId: adms[0].user_id,
      companyId: adms[0].company_id || "support_context",
      displayName: "Suporte",
      role: "adm",
    } : null;


    if (role === "adm") {
      const { data: allCompanies } = await supabaseAdmin
        .from("companies")
        .select(`
          id, 
          name, 
          trade_name, 
          user_roles (
            user_id,
            role
          )
        `)
        .order("trade_name", { ascending: true });

      const { data: allBranches } = await supabaseAdmin
        .from("branches")
        .select(`
          id, 
          company_id,
          name, 
          trade_name,
          is_headquarters,
          active,
          user_roles (
            user_id,
            role
          )
        `)
        .order("trade_name", { ascending: true });

      if (allCompanies) {
        // Map to ensure Matrix deduplication
        const matrixMap = new Map<string, ChatContact>();
        
        allCompanies.forEach((c) => {
          const matrizUser = c.user_roles?.find((r: any) => normalizeAppRole(r.role) === "matriz");
          const name = (c.trade_name || c.name) as string;
          
          if (matrizUser?.user_id && matrizUser.user_id !== userId && name) {
            matrixMap.set(c.id, {
              profileId: matrizUser.user_id,
              companyId: c.id,
              displayName: name,
              role: "matriz",
              parentMatrixCompanyId: null,
            });
          }
        });

        // Add matrices to result
        contacts.matrices = Array.from(matrixMap.values());

        // Process branches
        allBranches?.forEach((b) => {
          if (b.is_headquarters || !b.active) return;
          const branchUser = b.user_roles?.find((r: any) => normalizeAppRole(r.role) === "filial");
          const branchName = (b.trade_name || b.name) as string;
          
          if (branchUser?.user_id && branchUser.user_id !== userId && branchName) {
            contacts.matrices.push({
              profileId: branchUser.user_id,
              companyId: b.id,
              displayName: branchName,
              role: "filial",
              parentMatrixCompanyId: b.company_id,
            });
          }
        });
      }


    } else if (role === "matriz") {
      if (supportContact) contacts.others.push(supportContact);

      if (companyId) {
        const { data: branches } = await supabaseAdmin
          .from("branches")
          .select("id, name, trade_name, user_roles!inner(user_id, role)")
          .eq("company_id", companyId)
          .eq("is_headquarters", false)
          .eq("active", true)
          .eq("user_roles.role", "filial")
          .order("trade_name", { ascending: true });

        if (branches) {
          branches.forEach((b: any) => {
            const pId = b.user_roles?.[0]?.user_id;
            const name = (b.trade_name || b.name) as string;
            if (pId && name) {
              contacts.matrices.push({
                profileId: pId,
                companyId: companyId,
                displayName: name,
                role: "filial",
                parentMatrixCompanyId: companyId,
              });
            } else if (pId && !name) {
               console.error("[Chat Hierarchy Error] Branch without name:", { companyId, branchId: b.id, role: "filial", resolvedProfileId: pId });
            }
          });
        }
      }
    } else if (role === "filial") {
      if (supportContact) contacts.others.push(supportContact);

      if (companyId) {
        const { data: matrizRole } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, companies(id, name, trade_name)")
          .eq("company_id", companyId)
          .eq("role", "matriz")
          .maybeSingle();

        if (matrizRole) {
          const c = (matrizRole as any).companies;
          const name = (c?.trade_name || c?.name) as string;
          if (matrizRole.user_id && name) {
            contacts.matrices.push({
              profileId: matrizRole.user_id,
              companyId: c.id,
              displayName: name,
              role: "matriz",
              parentMatrixCompanyId: null,
            });
          } else if (matrizRole.user_id && !name) {
             console.error("[Chat Hierarchy Error] Matrix without name:", { companyId, role: "matriz", resolvedProfileId: matrizRole.user_id });
          }
        }

        const { data: otherBranches } = await supabaseAdmin
          .from("branches")
          .select("id, name, trade_name, user_roles!inner(user_id, role)")
          .eq("company_id", companyId)
          .eq("active", true)
          .eq("is_headquarters", false)
          .neq("id", branchId || "")
          .eq("user_roles.role", "filial")
          .order("trade_name", { ascending: true });

        if (otherBranches) {
          otherBranches.forEach((b: any) => {
            const pId = b.user_roles?.[0]?.user_id;
            const name = (b.trade_name || b.name) as string;
            if (pId && name) {
              contacts.matrices.push({
                profileId: pId,
                companyId: companyId,
                displayName: name,
                role: "filial",
                parentMatrixCompanyId: companyId,
              });
            } else if (pId && !name) {
               console.error("[Chat Hierarchy Error] Sister branch without name:", { companyId, branchId: b.id, role: "filial", resolvedProfileId: pId });
            }
          });
        }
      }
    }

    const contactProfileIds = [...new Set(
      [...contacts.matrices, ...contacts.others].map(contact => contact.profileId)
    )];
    const { data: contactProfiles } = contactProfileIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, full_name")
          .in("id", contactProfileIds)
      : { data: [] };
    const contactProfileNames = new Map(
      (contactProfiles ?? []).map(profile => [
        profile.id,
        {
          displayName: profile.display_name || profile.full_name || null,
          avatarUrl: null,
        },
      ])
    );

    contacts.matrices = contacts.matrices.map(contact => ({
      ...contact,
      profileDisplayName: contactProfileNames.get(contact.profileId)?.displayName || null,
      profileAvatarUrl: contactProfileNames.get(contact.profileId)?.avatarUrl || null,
    }));
    contacts.others = contacts.others.map(contact => ({
      ...contact,
      profileDisplayName: contactProfileNames.get(contact.profileId)?.displayName ||
        (contact.role === "adm" ? "Suporte" : null),
      profileAvatarUrl: contactProfileNames.get(contact.profileId)?.avatarUrl || null,
    }));

    return contacts;
  });

export const getChatContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContactsResponse> => {
    const { data, error } = await (context.supabase as any).rpc("chat_get_contacts");

    if (error) {
      console.error("[getChatContacts] Secure RPC error:", error);
      throw new Error(error.message || "Não foi possível carregar os contatos do chat.");
    }

    const result = (data as ContactsResponse | null) ?? { matrices: [], others: [] };
    const { data: viewerRole } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (String(viewerRole?.role ?? "").toLowerCase() === "adm") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: resellers } = await supabaseAdmin.from("resellers").select("id, name, user_id").not("user_id", "is", null).order("name");
      const resellerIds = new Set((resellers ?? []).map((reseller: any) => reseller.user_id).filter(Boolean));
      result.matrices = result.matrices.filter((contact) => !resellerIds.has(contact.profileId));
      result.others = result.others.filter((contact) => !resellerIds.has(contact.profileId));
      (resellers ?? []).forEach((reseller: any) => {
        if (reseller.user_id && reseller.user_id !== context.userId) {
          result.others.push({ profileId: reseller.user_id, companyId: "support_context", displayName: reseller.name || "Revenda", role: "revenda" });
        }
      });
    }
    // A reseller manages its own network. The legacy chat RPC only returns
    // the Support contact, so resolve the reseller's matrices and branches
    // server-side and append one contact per organizational unit.
    if (normalizeAppRole(viewerRole?.role) === "revenda") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: reseller } = await supabaseAdmin
        .from("resellers")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (reseller?.id) {
        const { data: companies } = await supabaseAdmin
          .from("companies")
          .select("id, name, trade_name")
          .eq("reseller_id", reseller.id)
          .eq("status", "ativa")
          .order("trade_name", { ascending: true });
        const companyIds = (companies ?? []).map((company: any) => company.id).filter(Boolean);
        if (companyIds.length) {
          const { data: matrixRoles } = await supabaseAdmin
            .from("user_roles")
            .select("user_id, company_id")
            .in("company_id", companyIds)
            .eq("role", "matriz");
          const matrixByCompany = new Map((matrixRoles ?? []).map((row: any) => [row.company_id, row.user_id]));
          const existingIds = new Set([...result.matrices, ...result.others].map((contact) => contact.profileId));
          for (const company of companies ?? []) {
            const profileId = matrixByCompany.get(company.id);
            if (!profileId || profileId === context.userId || existingIds.has(profileId)) continue;
            result.matrices.push({
              profileId,
              companyId: company.id,
              displayName: company.trade_name || company.name,
              role: "matriz",
              parentMatrixCompanyId: null,
            });
            existingIds.add(profileId);
          }

          const { data: branches } = await supabaseAdmin
            .from("branches")
            .select("id, company_id, name, trade_name, user_roles!inner(user_id, role)")
            .in("company_id", companyIds)
            .eq("active", true)
            .eq("is_headquarters", false)
            .eq("user_roles.role", "filial")
            .order("trade_name", { ascending: true });
          for (const branch of branches ?? []) {
            const profileId = (branch as any).user_roles?.[0]?.user_id;
            if (!profileId || profileId === context.userId || existingIds.has(profileId)) continue;
            result.matrices.push({
              profileId,
              companyId: branch.company_id,
              displayName: branch.trade_name || branch.name,
              role: "filial",
              parentMatrixCompanyId: branch.company_id,
            });
            existingIds.add(profileId);
          }
        }
      }
    }
    // The legacy RPC predates reseller accounts. Add the ADM/Support contact
    // for a reseller here until the database function is replaced by its
    // reseller-aware version.
    if (!result.others.some((contact) => contact.role === "adm")) {
      const { data: role } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (String(role?.role ?? "").toLowerCase() === "revenda") {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: support } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, company_id")
          .eq("role", "adm")
          .order("user_id", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (support?.user_id && support.user_id !== context.userId) {
          result.others.push({
            profileId: support.user_id,
            companyId: support.company_id || "support_context",
            displayName: "Suporte",
            role: "adm",
          });
        }
      }
    }
    // Networks owned by a reseller see that reseller as their technical support.
    const { data: ownRole } = await context.supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (["matriz", "filial"].includes(String(ownRole?.role ?? "").toLowerCase()) && ownRole?.company_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: company } = await supabaseAdmin.from("companies").select("reseller_id").eq("id", ownRole.company_id).maybeSingle();
      if (company?.reseller_id) {
        const { data: reseller } = await supabaseAdmin.from("resellers").select("user_id").eq("id", company.reseller_id).maybeSingle();
        if (reseller?.user_id && reseller.user_id !== context.userId && !result.others.some((c) => c.profileId === reseller.user_id)) {
          result.others = result.others.filter((c) => c.role !== "adm");
          result.others.push({ profileId: reseller.user_id, companyId: ownRole.company_id, displayName: "Suporte Técnico", role: "revenda" });
        }
      }
    }
    const { data: avatarData, error: avatarError } = await (context.supabase as any).rpc(
      "chat_get_contact_avatar_urls",
    );

    if (avatarError) {
      console.error("[getChatContacts] Avatar resolver error:", avatarError);
    }

    const avatarUrls = (avatarData || {}) as Record<string, string | null>;
    const contactIds = [...result.matrices, ...result.others].map((contact) => contact.profileId).filter(Boolean);
    if (contactIds.length) {
      // Some cross-network contacts (ADM <-> Revenda) are intentionally not
      // readable through the user's profile RLS policy. Resolve only the
      // public chat avatar through the server client in that case.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profileAvatars } = await supabaseAdmin
        .from("profiles")
        .select("id, chat_avatar_url")
        .in("id", contactIds);
      (profileAvatars ?? []).forEach((profile: any) => {
        if (profile.chat_avatar_url && !avatarUrls[profile.id]) avatarUrls[profile.id] = profile.chat_avatar_url;
      });
    }
    const withAvatars = (contacts: ChatContact[]) =>
      contacts.map((contact) => ({
        ...contact,
        profileAvatarUrl: avatarUrls[contact.profileId] || null,
      }));

    return {
      matrices: Array.isArray(result?.matrices) ? withAvatars(result.matrices) : [],
      others: Array.isArray(result?.others) ? withAvatars(result.others) : [],
    };
  });

export const resolveChatContacts = getChatContacts;


export const getOrCreateConversationLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        recipientProfileId: z.string().uuid(),
      })
      .parse(data),

  )
  .handler(async ({ data, context }): Promise<ConversationResult> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Resolve Auth User Context (SERVER-SIDE)
      const { data: userRoleRow } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, company_id, role, branch_id, reseller_id")
        .eq("user_id", userId)
        .maybeSingle();


      if (!userRoleRow) throw new Error("Usuário não autorizado.");
      const userRole = normalizeAppRole(userRoleRow.role);

      // 2. Resolve Recipient Context (SERVER-SIDE)
      const { data: recipientRoleRow } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role, company_id, branch_id, reseller_id")
        .eq("user_id", data.recipientProfileId)
        .maybeSingle();

      if (!recipientRoleRow) throw new Error("Destinatário inválido.");
      const recipientRole = normalizeAppRole(recipientRoleRow.role);

      if (!userRole || !recipientRole) {
        throw new Error("Perfil de acesso inválido.");
      }
      if (data.recipientProfileId === userId) {
        throw new Error("Não é possível iniciar uma conversa consigo mesmo.");
      }
      if ((userRole === "matriz" && !userRoleRow.company_id) ||
          (userRole === "filial" && (!userRoleRow.company_id || !userRoleRow.branch_id))) {
        throw new Error("Vínculo empresarial do usuário está incompleto.");
      }

      // A linked branch must still be active and belong to the recorded company.
      if (recipientRole === "filial") {
        if (!recipientRoleRow.branch_id || !recipientRoleRow.company_id) {
          throw new Error("Vínculo da filial destinatária está incompleto.");
        }
        const { data: activeRecipientBranch } = await supabaseAdmin
          .from("branches")
          .select("id")
          .eq("id", recipientRoleRow.branch_id)
          .eq("company_id", recipientRoleRow.company_id)
          .eq("active", true)
          .eq("is_headquarters", false)
          .maybeSingle();
        if (!activeRecipientBranch) {
          throw new Error("Filial destinatária não está ativa.");
        }
      }

      // 3. VALIDATE HIERARCHY (BUSINESS RULES)
      let isAllowed = false;

      if (userRole === "adm") {
        // ADM pode falar com qualquer Matriz, Filial ou Revenda.
        isAllowed = recipientRole === "matriz" || recipientRole === "filial" || recipientRole === "revenda";
      } else if (userRole === "matriz") {
        // Matriz pode falar com o ADM, suas Filiais ou a Revenda
        // responsável pela própria rede (Suporte Técnico).
        const isSupport = recipientRole === "adm";
        const isOwnBranch = recipientRole === "filial" && recipientRoleRow.company_id === userRoleRow.company_id;
        let isTechnicalSupport = false;
        if (recipientRole === "revenda" && userRoleRow.company_id) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("reseller_id")
            .eq("id", userRoleRow.company_id)
            .maybeSingle();
          isTechnicalSupport = !!company?.reseller_id && company.reseller_id === recipientRoleRow.reseller_id;
        }
        isAllowed = isSupport || isOwnBranch || isTechnicalSupport;
      } else if (userRole === "filial") {
        // Filial pode falar com o ADM, sua Matriz, Filiais irmãs ou a
        // Revenda responsável pela própria rede (Suporte Técnico).
        const isSupport = recipientRole === "adm";
        const isOwnMatriz = recipientRole === "matriz" && recipientRoleRow.company_id === userRoleRow.company_id;
        const isSisterBranch =
          recipientRole === "filial" &&
          !!recipientRoleRow.branch_id &&
          recipientRoleRow.company_id === userRoleRow.company_id &&
          recipientRoleRow.branch_id !== userRoleRow.branch_id;
        let isTechnicalSupport = false;
        if (recipientRole === "revenda" && userRoleRow.company_id) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("reseller_id")
            .eq("id", userRoleRow.company_id)
            .maybeSingle();
          isTechnicalSupport = !!company?.reseller_id && company.reseller_id === recipientRoleRow.reseller_id;
        }
        isAllowed = isSupport || isOwnMatriz || isSisterBranch || isTechnicalSupport;
      } else if (userRole === "revenda") {
        // A Revenda conversa com o Suporte e com as unidades da sua própria
        // rede. Never allow a recipient from another reseller's network.
        if (recipientRole === "adm") {
          isAllowed = true;
        } else if (recipientRole === "matriz" || recipientRole === "filial") {
          const { data: reseller } = await supabaseAdmin
            .from("resellers")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
          if (reseller?.id && recipientRoleRow.company_id) {
            const { data: company } = await supabaseAdmin
              .from("companies")
              .select("id")
              .eq("id", recipientRoleRow.company_id)
              .eq("reseller_id", reseller.id)
              .eq("status", "ativa")
              .maybeSingle();
            isAllowed = !!company;
          }
        }
      }

      if (!isAllowed) {
        throw new Error("Você não tem permissão para iniciar esta conversa.");
      }

      // 4. PRESERVE LEGACY SUPPORT MODEL (Single-participant)
      const expectedParticipants: Participant[] = [];
      const targetCompanyId = userRoleRow.company_id || recipientRoleRow.company_id || null;

      if (userRole === "adm" || recipientRole === "adm") {
        // Se for conversa com Suporte, apenas o participante não-ADM é registrado no BD
        const otherProfile = userRole === "adm" ? recipientRoleRow : userRoleRow;
        const otherRole = userRole === "adm" ? recipientRole : userRole;
        
        expectedParticipants.push({
          participant_type: mapRoleToParticipantType(otherRole || "matriz"),
          profile_id: otherProfile.user_id || (userRole === "adm" ? data.recipientProfileId : userId),
          branch_id: otherProfile.branch_id || null,
        });

      } else {
        // Conversa Matriz <-> Filial ou Filial <-> Filial (Ambos participantes)
        expectedParticipants.push({
          participant_type: mapRoleToParticipantType(userRole || "matriz"),
          profile_id: userId,
          branch_id: userRoleRow.branch_id || null,
        });
        expectedParticipants.push({
          participant_type: mapRoleToParticipantType(recipientRole || "matriz"),
          profile_id: data.recipientProfileId,
          branch_id: recipientRoleRow.branch_id || null,
        });
      }

      if (!targetCompanyId && !(userRole === "revenda" && recipientRole === "adm")) {
        throw new Error("Contexto empresarial não identificado.");
      }

      // 5. Canonical Key & RPC Call
      const canonicalKey = participantIdentity(expectedParticipants);

      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
        "chat_find_or_create_conversation",
        {
          // The RPC accepts NULL for the cross-tenant Revenda ↔ Suporte thread;
          // generated client types still describe the legacy non-null contract.
          p_company_id: targetCompanyId as string,
          p_participants: expectedParticipants as any,
          p_canonical_key: canonicalKey,
          p_creator_id: userId,
        },
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as {
        conversation_id: string;
        created: boolean;
      } | null;

      if (!result?.conversation_id) throw new Error("Falha ao obter ID da conversa.");

      return {
        conversationId: result.conversation_id,
        created: !!result.created,
      };

    } catch (err: unknown) {
      console.error("[Chat Critical Failure]", err);
      throw err;
    }
  });

export const getOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ recipientProfileId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ConversationResult> => {
    // Do not infer a conversation from partial participant matches here. That
    // legacy fallback could select an unrelated single-participant thread
    // (e.g. a Filial conversation) when a Reseller opened Support. The secure
    // RPC owns canonical identity and is the only source of truth for reuse.
    const { data: rpcResult, error } = await (context.supabase as any).rpc(
      "chat_find_or_create_for_recipient",
      { p_recipient_profile_id: data.recipientProfileId },
    );

    if (error) {
      console.error("[getOrCreateConversation] Secure RPC error:", error);
      throw new Error(error.message || "Não foi possível abrir a conversa.");
    }

    const result = (Array.isArray(rpcResult) ? rpcResult[0] : rpcResult) as {
      conversation_id?: string;
      created?: boolean;
    } | null;

    if (!result?.conversation_id) {
      throw new Error("A conversa não retornou um identificador válido.");
    }

    return {
      conversationId: result.conversation_id,
      created: Boolean(result.created),
    };
  });

export const resolveNudgeTargetUserIdsLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<string[]> => {
    const { supabase, userId } = context;

    // RLS confirms that the authenticated user may access this conversation
    // before server-only recipient resolution is allowed.
    const { data: authorizedConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", data.conversationId)
      .maybeSingle();

    if (!authorizedConversation) {
      throw new Error("Conversa não autorizada.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get conversation participants
    const { data: participants, error: partErr } = await supabaseAdmin
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", data.conversationId);

    if (partErr || !participants) {
      throw new Error("Erro ao buscar participantes da conversa.");
    }

    const targetUserIds = new Set<string>();

    // 2. Resolve normal participants (Matriz/Filial)
    (participants as any[]).forEach((p) => {
      if (p.profile_id && p.profile_id !== userId) {
        targetUserIds.add(p.profile_id);
      }
    });

    // 3. Check if it's a support conversation (only one participant who is the user)
    const isSupport =
      participants.length === 1 && (participants[0] as any)?.profile_id === userId;

    if (isSupport) {
      // Find all ADMs to receive the nudge as Support
      const { data: adms, error: admErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "adm");

      if (admErr) {
        console.error("[resolveNudgeTargetUserIds] ADM resolve error:", admErr);
      } else if (adms) {
        (adms as any[]).forEach((a) => {
          if (a.user_id !== userId) {
            targetUserIds.add(a.user_id);
          }
        });
      }
    }

    const result = Array.from(targetUserIds);
    if (result.length === 0) {
      throw new Error("Nenhum destinatário válido foi encontrado para a chamada de atenção.");
    }

    return result;
  });

export const resolveNudgeTargetUserIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<string[]> => {
    const { supabase, userId } = context;

    const { data: recipientIds, error } = await (supabase as any).rpc(
      "chat_get_recipient_ids",
      { p_conversation_id: data.conversationId },
    );

    if (!error) {
      const result = Array.isArray(recipientIds)
        ? recipientIds.filter((id: string) => Boolean(id) && id !== userId)
        : [];
      if (result.length > 0) return Array.from(new Set(result));
    } else {
      console.error("[resolveNudgeTargetUserIds] Secure RPC error:", error);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: participants, error: partErr } = await supabaseAdmin
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", data.conversationId);

    if (partErr || !participants) {
      throw new Error("Erro ao buscar participantes da conversa.");
    }

    const participantIds = (participants as any[])
      .map((p) => p.profile_id)
      .filter(Boolean);
    const targetUserIds = new Set<string>(
      participantIds.filter((profileId: string) => profileId !== userId),
    );

    const isLegacySupportConversation =
      participantIds.length === 1 && participantIds[0] === userId;

    if (isLegacySupportConversation) {
      const { data: adms, error: admErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "adm");

      if (admErr) {
        console.error("[resolveNudgeTargetUserIds] ADM resolve error:", admErr);
      } else {
        (adms ?? []).forEach((a: any) => {
          if (a.user_id && a.user_id !== userId) {
            targetUserIds.add(a.user_id);
          }
        });
      }
    }

    const result = Array.from(targetUserIds);
    if (result.length === 0) {
      throw new Error("Nenhum destinatário válido foi encontrado para a chamada de atenção.");
    }

    return result;
  });

export const markConversationAsReadLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    
    // Removed audit log to maintain clean production code after diagnosis

    // 1. Resolve participant and history constraints
    const { data: prefs, error: prefError } = await supabaseAdmin
      .from("conversation_user_preferences")
      .select("history_cleared_at")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (prefError) {
      console.error("[markConversationAsRead] Preferences error:", prefError);
    }

    // 2. Locate unread receipts for this conversation belonging to the user
    let query = supabaseAdmin
      .from("chat_message_receipts")
      .select(`
        message_id, 
        message:messages!inner(id, sender_id, conversation_id, created_at)
      `)
      .eq("recipient_profile_id", userId)
      .is("read_at", null)
      .eq("message.conversation_id", data.conversationId)
      .neq("message.sender_id", userId);

    if (prefs?.history_cleared_at) {
      query = query.gt("message.created_at", prefs.history_cleared_at);
    }

    const { data: receipts, error: findError } = await query;
    
    if (findError) {
      console.error("[markConversationAsRead] Find receipts error:", findError);
      throw findError;
    }

    const messageIds = (receipts as any[] || []).map(r => r.message_id);
    
    if (messageIds.length === 0) {
      // Registrar no servidor o motivo pelo qual não houve atualização
      console.log("[markConversationAsRead] No unread receipts found", { 
        conversationId: data.conversationId, 
        userId,
        reason: "No matching receipts or already read"
      });
      
      // Calculate remaining anyway to be sure
      const { count } = await supabaseAdmin
        .from("chat_message_receipts")
        .select("*", { count: 'exact', head: true })
        .eq("recipient_profile_id", userId)
        .is("read_at", null);

      return { 
        success: true, 
        conversationId: data.conversationId,
        readMessageIds: [], 
        remainingUnreadCount: count || 0 
      };
    }

    // 3. Update receipts: delivered_at = COALESCE(delivered_at, now()), read_at = now()
    // PostgREST doesn't support COALESCE directly in update, so we do it via RPC or simple update
    // since delivered_at being updated to 'now' even if it had a value is acceptable as per plan
    const { error: updateError } = await supabaseAdmin
      .from("chat_message_receipts")
      .update({ 
        read_at: now, 
        delivered_at: now,
        updated_at: now 
      } as any)
      .in("message_id", messageIds)
      .eq("recipient_profile_id", userId);

    if (updateError) {
      console.error("[markConversationAsRead] Update error:", updateError);
      throw updateError;
    }

    // 4. Update user preferences (last_read_at)
    await supabaseAdmin
      .from("conversation_user_preferences")
      .update({
        last_read_at: now,
        updated_at: now,
      } as any)
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);

    // 5. Broadcast status update back to senders (✓✓ cinza → ✓✓ turquesa)
    for (const receipt of (receipts as any[])) {
      const msg = (receipt as any).message;
      if (msg?.sender_id) {
        const channel = supabaseAdmin.channel(`local:widget:receipts:${msg.sender_id}`);
        await channel.send({
          type: "broadcast",
          event: "chat:receipt_update",
          payload: {
            messageId: receipt.message_id,
            conversationId: data.conversationId,
            status: "read",
            readAt: now,
          }
        });
        void supabaseAdmin.removeChannel(channel);
      }
    }

    // 6. Return counts for local UI update
    const { count: remainingCount } = await supabaseAdmin
      .from("chat_message_receipts")
      .select("*", { count: 'exact', head: true })
      .eq("recipient_profile_id", userId)
      .is("read_at", null);

    console.log("[markConversationAsRead] Success", { 
      conversationId: data.conversationId, 
      userId, 
      readCount: messageIds.length,
      remaining: remainingCount
    });

    return { 
      success: true, 
      conversationId: data.conversationId,
      readMessageIds: messageIds,
      readAt: now,
      remainingUnreadCount: remainingCount || 0
    };
  });

export const markConversationAsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const { data: prefs } = await supabase
      .from("conversation_user_preferences")
      .select("history_cleared_at")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    let query = supabase
      .from("chat_message_receipts")
      .select("message_id, message:messages!inner(id, sender_id, conversation_id, created_at)")
      .eq("recipient_profile_id", userId)
      .is("read_at", null)
      .eq("message.conversation_id", data.conversationId)
      .neq("message.sender_id", userId);

    if (prefs?.history_cleared_at) {
      query = query.gt("message.created_at", prefs.history_cleared_at);
    }

    const { data: receipts, error: findError } = await query;
    if (findError) throw findError;

    const messageIds = (receipts ?? []).map((receipt: any) => receipt.message_id);
    if (messageIds.length > 0) {
      const { error: updateError } = await supabase
        .from("chat_message_receipts")
        .update({ read_at: now, delivered_at: now, updated_at: now } as any)
        .in("message_id", messageIds)
        .eq("recipient_profile_id", userId);
      if (updateError) throw updateError;
    }

    await supabase
      .from("conversation_user_preferences")
      .update({ last_read_at: now, updated_at: now } as any)
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);

    const { count } = await supabase
      .from("chat_message_receipts")
      .select("*", { count: "exact", head: true })
      .eq("recipient_profile_id", userId)
      .is("read_at", null);

    return {
      success: true,
      conversationId: data.conversationId,
      readMessageIds: messageIds,
      readAt: now,
      remainingUnreadCount: count || 0,
    };
  });


