import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CRM_STAGES = [
  "novo",
  "contato_iniciado",
  "respondeu",
  "interessado",
  "convertido",
  "nao_respondeu",
  "sem_interesse",
  "nao_contatar",
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export type CrmLeadListItem = {
  id: string;
  campaignId: string | null;
  campaignName: string;
  companyName: string;
  campaignStatus: string | null;
  visitorId: string;
  fullName: string;
  email: string | null;
  phoneE164: string;
  city: string | null;
  connectionsCount: number;
  lastSeenAt: string;
  stage: CrmStage;
  whatsappOptIn: boolean;
  doNotContact: boolean;
  nextActionAt: string | null;
  lastContactedAt: string | null;
  sourceName: string;
  sourceType: "Matriz" | "Filial" | "Evento";
};

type CrmRoleScope = {
  role: "adm" | "matriz" | "filial" | "revenda";
  companyId: string | null;
  branchId: string | null;
};

async function resolveCrmScope(
  client: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  userId: string,
): Promise<CrmRoleScope> {
  const { data, error } = await client
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[CRM] Falha ao resolver permissões do usuário autenticado", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Não foi possível validar as permissões do CRM.");
  }
  if (!data) throw new Error("Usuário sem permissões para acessar o CRM.");
  return {
    role: data.role,
    companyId: data.company_id,
    branchId: data.branch_id,
  };
}

async function assertLeadAccess(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  scope: CrmRoleScope,
  leadId: string,
) {
  const { data: lead, error } = await admin
    .from("crm_leads")
    .select("id, company_id, source_branch_id, visitor_id, stage, do_not_contact")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) throw new Error("Lead não encontrado.");
  if (scope.role === "adm") return lead;
  if (!scope.companyId || lead.company_id !== scope.companyId) {
    throw new Error("Você não tem permissão para acessar este lead.");
  }
  if (scope.role === "filial") {
    if (!scope.branchId) throw new Error("Filial sem vínculo configurado.");
    const { count } = await admin
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("visitor_id", lead.visitor_id)
      .eq("branch_id", scope.branchId);
    if (!count) throw new Error("Este lead não pertence à sua Filial.");
  }
  return lead;
}

export const getCrmCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await resolveCrmScope(context.supabase, context.userId);
    let query = context.supabase
      .from("campaigns")
      .select("id, name, status, company_id, branch_id, event_id, created_at")
      .order("created_at", { ascending: false });

    if (scope.role !== "adm" && scope.companyId) query = query.eq("company_id", scope.companyId);
    if (scope.role === "filial" && scope.branchId) query = query.eq("branch_id", scope.branchId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });

export const getCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      campaignId: z.string().uuid().nullable().optional(),
      stage: z.enum(CRM_STAGES).nullable().optional(),
      term: z.string().trim().max(80).optional().default(""),
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(10).max(100).optional().default(25),
    }).parse(input),
  )
  .handler(async ({ data: filters, context }) => {
    const scope = await resolveCrmScope(context.supabase, context.userId);

    let query = context.supabase
      .from("crm_leads")
      .select(
        "id, campaign_id, company_id, visitor_id, source_branch_id, source_event_id, stage, whatsapp_opt_in, do_not_contact, next_action_at, last_contacted_at, created_at, visitors!inner(full_name, email, phone_e164, city, connections_count, last_seen_at), campaigns(name, status), branches:branches!crm_leads_source_branch_id_fkey(name, trade_name), events:events!crm_leads_source_event_id_fkey(name), companies(name, trade_name, legal_name)",
      )
      .order("created_at", { ascending: false })
      .limit(2000);

    if (scope.role !== "adm" && scope.companyId) query = query.eq("company_id", scope.companyId);
    if (scope.role === "filial" && scope.branchId) {
      query = query.eq("source_branch_id", scope.branchId);
    }
    if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
    if (filters.stage) query = query.eq("stage", filters.stage);

    const { data, error } = await query;
    if (error) throw error;

    const cleanTerm = filters.term.toLocaleLowerCase("pt-BR");
    const mapped: CrmLeadListItem[] = (data ?? []).map((row) => {
      const visitor = row.visitors as {
        full_name: string;
        email: string | null;
        phone_e164: string;
        city: string | null;
        connections_count: number;
        last_seen_at: string;
      };
      const campaign = row.campaigns as { name: string; status: string } | null;
      const branch = row.branches as { name: string; trade_name: string | null } | null;
      const event = row.events as { name: string } | null;
      const company = row.companies as { name: string; trade_name: string | null; legal_name: string | null } | null;

      const companyName =
        company?.trade_name?.trim() ||
        company?.legal_name?.trim() ||
        company?.name?.trim() ||
        "Empresa";

      return {
        id: row.id,
        campaignId: row.campaign_id,
        campaignName: campaign?.name ?? "Sem campanha",
        companyName,
        campaignStatus: campaign?.status ?? null,
        visitorId: row.visitor_id,
        fullName: visitor.full_name,
        email: visitor.email,
        phoneE164: visitor.phone_e164,
        city: visitor.city,
        connectionsCount: visitor.connections_count,
        lastSeenAt: visitor.last_seen_at,
        stage: row.stage as CrmStage,
        whatsappOptIn: row.whatsapp_opt_in,
        doNotContact: row.do_not_contact,
        nextActionAt: row.next_action_at,
        lastContactedAt: row.last_contacted_at,
        sourceName: event?.name ?? branch?.trade_name ?? branch?.name ?? "Matriz",
        sourceType: event ? "Evento" : branch ? "Filial" : "Matriz",
      };
    });

    const visible = cleanTerm
      ? mapped.filter((lead) =>
          [lead.fullName, lead.phoneE164, lead.email ?? "", lead.city ?? ""]
            .some((value) => value.toLocaleLowerCase("pt-BR").includes(cleanTerm)),
        )
      : mapped;

    const start = (filters.page - 1) * filters.pageSize;
    const stageCounts = CRM_STAGES.reduce<Record<CrmStage, number>>((acc, stage) => {
      acc[stage] = mapped.filter((lead) => lead.stage === stage).length;
      return acc;
    }, {} as Record<CrmStage, number>);

    return {
      leads: visible.slice(start, start + filters.pageSize),
      total: visible.length,
      page: filters.page,
      pageSize: filters.pageSize,
      stageCounts,
    };
  });

export const updateCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      leadId: z.string().uuid(),
      stage: z.enum(CRM_STAGES).optional(),
      note: z.string().trim().max(2000).optional(),
      nextActionAt: z.string().datetime().nullable().optional(),
      doNotContact: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const scope = await resolveCrmScope(context.supabase, context.userId);
    const lead = await assertLeadAccess(context.supabase, scope, data.leadId);
    const now = new Date().toISOString();
    const updates: {
      stage?: CrmStage;
      next_action_at?: string | null;
      do_not_contact?: boolean;
      converted_at?: string | null;
      updated_at: string;
    } = { updated_at: now };

    if (data.stage) {
      updates.stage = data.stage;
      if (data.stage === "convertido") updates.converted_at = now;
      if (data.stage === "nao_contatar") updates.do_not_contact = true;
    }
    if (data.nextActionAt !== undefined) updates.next_action_at = data.nextActionAt;
    if (data.doNotContact !== undefined) updates.do_not_contact = data.doNotContact;

    const { error } = await context.supabase
      .from("crm_leads")
      .update(updates)
      .eq("id", data.leadId);
    if (error) throw error;

    const activities: Array<{
      lead_id: string;
      company_id: string;
      author_id: string;
      activity_type: "note" | "stage_changed" | "follow_up_scheduled" | "opt_out";
      note: string | null;
      metadata: { [key: string]: string | boolean | null };
    }> = [];

    if (data.stage && data.stage !== lead.stage) {
      activities.push({
        lead_id: data.leadId,
        company_id: lead.company_id,
        author_id: context.userId,
        activity_type: "stage_changed",
        note: null,
        metadata: { from: lead.stage, to: data.stage },
      });
    }
    if (data.note) {
      activities.push({
        lead_id: data.leadId,
        company_id: lead.company_id,
        author_id: context.userId,
        activity_type: "note",
        note: data.note,
        metadata: {},
      });
    }
    if (data.nextActionAt !== undefined) {
      activities.push({
        lead_id: data.leadId,
        company_id: lead.company_id,
        author_id: context.userId,
        activity_type: "follow_up_scheduled",
        note: null,
        metadata: { nextActionAt: data.nextActionAt },
      });
    }
    if (data.doNotContact === true && !lead.do_not_contact) {
      activities.push({
        lead_id: data.leadId,
        company_id: lead.company_id,
        author_id: context.userId,
        activity_type: "opt_out",
        note: data.note ?? null,
        metadata: {},
      });
    }
    if (activities.length) {
      const { error: activityError } = await context.supabase
        .from("crm_lead_activities")
        .insert(activities);
      if (activityError) throw activityError;
    }

    return { ok: true };
  });

export const registerCrmWhatsAppOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const scope = await resolveCrmScope(context.supabase, context.userId);
    const lead = await assertLeadAccess(context.supabase, scope, data.leadId);

    if (lead.do_not_contact) throw new Error("Este lead solicitou não receber contatos.");

    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("crm_leads")
      .update({
        stage: lead.stage === "novo" ? "contato_iniciado" : lead.stage,
        last_contacted_at: now,
        updated_at: now,
      })
      .eq("id", data.leadId);
    if (error) throw error;

    const { error: activityError } = await context.supabase.from("crm_lead_activities").insert({
      lead_id: data.leadId,
      company_id: lead.company_id,
      author_id: context.userId,
      activity_type: "whatsapp_opened",
      metadata: {},
    });
    if (activityError) throw activityError;
    return { ok: true };
  });

export type VisitorHistoryEntry = {
  id: string;
  createdAt: string;
  unitName: string;
  unitType: "Matriz" | "Filial" | "Evento";
  campaignName?: string | null;
  deviceType?: string | null;
  isFirst: boolean;
};

export type VisitorHistorySummary = {
  totalAcessos: number;
  primeiraCaptacao: string | null;
  ultimoAcesso: string | null;
  unidadesVisitadas: number;
};

export type VisitorHistoryData = {
  entries: VisitorHistoryEntry[];
  summary: VisitorHistorySummary;
  visitor: {
    fullName: string;
    phoneE164: string;
  };
  hasMore: boolean;
};

export type VisitorHistoryResult =
  | {
      ok: true;
      data: VisitorHistoryData;
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 500;
      code: string;
      message: string;
    };

export type HistoryStage =
  | "input"
  | "session"
  | "role"
  | "visitor"
  | "authorization"
  | "connections"
  | "company"
  | "branches"
  | "events"
  | "summary"
  | "serialization";

export const getVisitorHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown): { visitorId: string; page: number } => {
    const schema = z.object({
      visitorId: z.string(),
      page: z.number().optional().default(1),
    });
    const parsed = schema.safeParse(d);
    if (!parsed.success) {
      throw new Error("INVALID_INPUT");
    }
    return parsed.data;
  })
  .handler(async ({ data: { visitorId, page }, context }): Promise<VisitorHistoryResult> => {
    const { supabase, userId } = context;
    const pageSize = 20;
    let stage: HistoryStage = "input";

    try {
      // 1. Session check
      stage = "session";
      if (!userId) {
        return {
          ok: false,
          status: 401,
          code: "HISTORY_SESSION_MISSING",
          message: "Sessão não encontrada.",
        };
      }

      // 2. Role & Authorization
      stage = "role";
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role, company_id, branch_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) {
        console.error(
          `[CRM History] Stage: ${stage}, Code: ${roleError.code}, Message: ${roleError.message}`,
        );
        return {
          ok: false,
          status: 500,
          code: `HISTORY_${stage.toUpperCase()}_FAILED`,
          message: "Não foi possível carregar o histórico de acessos.",
        };
      }

      if (!roleData) {
        return {
          ok: false,
          status: 401,
          code: "HISTORY_ROLE_MISSING",
          message: "Usuário sem permissões atribuídas.",
        };
      }

      const userRole = roleData.role;
      const userCompanyId = roleData.company_id;
      const userBranchId = roleData.branch_id;

      // 3. Visitor Check
      stage = "visitor";
      const { data: visitor, error: visitorError } = await supabase
        .from("visitors")
        .select("full_name, phone_e164, company_id")
        .eq("id", visitorId)
        .maybeSingle();

      if (visitorError) {
        console.error(
          `[CRM History] Stage: ${stage}, Code: ${visitorError.code}, Message: ${visitorError.message}`,
        );
        return {
          ok: false,
          status: 500,
          code: `HISTORY_${stage.toUpperCase()}_FAILED`,
          message: "Não foi possível carregar o histórico de acessos.",
        };
      }

      if (!visitor) {
        return {
          ok: false,
          status: 404,
          code: "HISTORY_VISITOR_NOT_FOUND",
          message: "Visitante não encontrado.",
        };
      }

      // 4. Authorization check
      stage = "authorization";
      if (userRole !== "adm" && visitor.company_id !== userCompanyId) {
        return {
          ok: false,
          status: 403,
          code: "HISTORY_FORBIDDEN",
          message: "Você não tem permissão para acessar este histórico.",
        };
      }

      // 5. Connections Query
      stage = "connections";
      const currentPage = Math.max(1, Math.floor(page));
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const {
        data: connData,
        error: cError,
        count: tCount,
      } = await supabase
        .from("connections")
        .select("id, created_at, branch_id, event_id, campaign_id, device_type", { count: "exact" })
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (cError) {
        console.error(
          `[CRM History] Stage: ${stage}, Code: ${cError.code}, Message: ${cError.message}, Range: ${from}-${to}`,
        );
        return {
          ok: false,
          status: 500,
          code: `HISTORY_${stage.toUpperCase()}_FAILED`,
          message: "Não foi possível carregar o histórico de acessos.",
        };
      }

      const connections_list = connData || [];

      // 6. Branch Resolution (Optional)
      stage = "branches";
      const branchIds = [...new Set(connections_list.map((c) => c.branch_id).filter(Boolean))];
      let branchMap = new Map();
      if (branchIds.length > 0) {
        const { data: bData, error: bError } = await supabase
          .from("branches")
          .select("id, name, trade_name, legal_name")
          .in("id", branchIds as string[]);

        if (bError) {
          console.warn(
            `[CRM History] Stage: ${stage} (Non-blocking), Code: ${bError.code}, Message: ${bError.message}`,
          );
        } else {
          branchMap = new Map(bData?.map((b) => [b.id, b]));
        }
      }

      // 7. Event Resolution (Optional)
      stage = "events";
      const eventIds = [...new Set(connections_list.map((c) => c.event_id).filter(Boolean))];
      let eventMap = new Map();
      if (eventIds.length > 0) {
        const { data: eData, error: eError } = await supabase
          .from("events")
          .select("id, name")
          .in("id", eventIds as string[]);

        if (eError) {
          console.warn(
            `[CRM History] Stage: ${stage} (Non-blocking), Code: ${eError.code}, Message: ${eError.message}`,
          );
        } else {
          eventMap = new Map(eData?.map((e) => [e.id, e]));
        }
      }

      // 8. Campaign Resolution (Optional)
      stage = "connections"; // Reusing connections stage context for campaigns
      const campaignIds = [...new Set(connections_list.map((c) => c.campaign_id).filter(Boolean))];
      let campaignMap = new Map();
      if (campaignIds.length > 0) {
        const { data: campData, error: campError } = await supabase
          .from("campaigns")
          .select("id, name")
          .in("id", campaignIds as string[]);

        if (campError) {
          console.warn(
            `[CRM History] Stage: campaigns (Non-blocking), Code: ${campError.code}, Message: ${campError.message}`,
          );
        } else {
          campaignMap = new Map(campData?.map((c) => [c.id, c.name]));
        }
      }

      // 9. Company Resolution (Optional)
      stage = "company";
      const { data: company, error: compError } = await supabase
        .from("companies")
        .select("id, name, trade_name, legal_name")
        .eq("id", visitor.company_id)
        .maybeSingle();

      if (compError) {
        console.warn(
          `[CRM History] Stage: ${stage} (Non-blocking), Code: ${compError.code}, Message: ${compError.message}`,
        );
      }

      const { getCompanyDisplayName, getBranchDisplayName } = await import("./name-utils");

      // 10. Summary & First Access
      stage = "summary";
      const { data: firstConn } = await supabase
        .from("connections")
        .select("id, created_at")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: allConnForSummary } = await supabase
        .from("connections")
        .select("branch_id, event_id")
        .eq("visitor_id", visitorId);

      const uniqueUnits = new Set(
        (allConnForSummary || []).map((c) =>
          c.event_id ? `event_${c.event_id}` : `branch_${c.branch_id || "hq"}`,
        ),
      );

      // 11. Final Mapping
      stage = "serialization";
      const entries: VisitorHistoryEntry[] = connections_list.map((c) => {
        let unitName = "Unidade não identificada";
        let unitType: VisitorHistoryEntry["unitType"] = "Matriz";

        const connBranchId = c.branch_id as string | null;
        const connEventId = c.event_id as string | null;
        const connCampaignId = c.campaign_id as string | null;

        if (connEventId && eventMap.has(connEventId)) {
          const event = eventMap.get(connEventId);
          unitName = event?.name || "Evento";
          unitType = "Evento";
        } else if (connBranchId && branchMap.has(connBranchId)) {
          const branch = branchMap.get(connBranchId);
          unitName = `Filial — ${getBranchDisplayName(branch || null)}`;
          unitType = "Filial";
        } else if (company) {
          unitName = `Matriz — ${getCompanyDisplayName(company)}`;
          unitType = "Matriz";
        }

        return {
          id: c.id,
          createdAt: c.created_at,
          unitName,
          unitType,
          campaignName: connCampaignId ? campaignMap.get(connCampaignId) || null : null,
          deviceType: c.device_type,
          isFirst: c.id === firstConn?.id,
        };
      });

      const summary: VisitorHistorySummary = {
        totalAcessos: tCount || 0,
        primeiraCaptacao: firstConn?.created_at || null,
        ultimoAcesso: connections_list[0]?.created_at || null,
        unidadesVisitadas: uniqueUnits.size,
      };

      return {
        ok: true,
        data: {
          entries,
          summary,
          visitor: {
            fullName: visitor.full_name || "Visitante",
            phoneE164: visitor.phone_e164,
          },
          hasMore: (tCount || 0) > currentPage * pageSize,
        },
      };
    } catch (e: unknown) {
      const error = e as Error;
      console.error(`[CRM History] Fatal Error at Stage: ${stage}`, {
        visitorId: visitorId.substring(0, 8),
        page,
        userId: userId?.substring(0, 8),
        message: error.message,
      });

      return {
        ok: false,
        status: 500,
        code: "VISITOR_HISTORY_QUERY_FAILED",
        message: "Não foi possível carregar o histórico de acessos.",
      };
    }
  });
