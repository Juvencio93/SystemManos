import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePortalTarget } from "@/lib/portal.server";

const privacyRequestSchema = z.object({
  requestType: z.enum([
    "access",
    "correction",
    "deletion",
    "marketing_revocation",
    "information",
    "other",
  ]),
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(8).max(24),
  portalSlug: z.string().trim().max(120).optional(),
  details: z.string().trim().max(2000).optional(),
});

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function requestIp() {
  const request = getRequest();
  return (
    request?.headers.get("x-vercel-forwarded-for") ||
    request?.headers.get("cf-connecting-ip") ||
    request?.headers.get("x-real-ip") ||
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export const submitPrivacyRequest = createServerFn({ method: "POST" })
  .validator((input: unknown) => privacyRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = requestIp();
    const { data: allowed, error: limiterError } = await (supabaseAdmin as any).rpc(
      "consume_portal_checkin_rate_limit",
      {
        p_bucket_key: `privacy:${ip}`,
        p_limit: 5,
        p_window_seconds: 3600,
      },
    );
    if (limiterError || allowed !== true) {
      throw new Error(
        "Não foi possível registrar a solicitação agora. Tente novamente mais tarde.",
      );
    }

    const target = data.portalSlug
      ? await resolvePortalTarget(supabaseAdmin, data.portalSlug)
      : null;
    const phoneE164 = normalizePhone(data.phone);
    const protocol = `LGPD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const request = getRequest();
    const now = new Date().toISOString();

    const { data: insertedRequest, error: insertError } = await (supabaseAdmin as any)
      .from("privacy_requests")
      .insert({
        protocol,
        company_id: target?.companyId ?? null,
        request_type: data.requestType,
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        phone_e164: phoneE164,
        portal_slug: data.portalSlug || null,
        details: data.details || null,
        request_ip: ip === "unknown" ? null : ip,
        user_agent: request?.headers.get("user-agent")?.slice(0, 400) ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insertError) throw new Error("Não foi possível registrar a solicitação agora.");
    await (supabaseAdmin as any).from("privacy_request_events").insert({
      privacy_request_id: insertedRequest.id,
      event_type: "created",
      new_status: "requested",
      note: "Solicitação registrada pelo canal público.",
    });

    let immediatelyRevoked = false;
    if (data.requestType === "marketing_revocation") {
      let visitorQuery = supabaseAdmin
        .from("visitors")
        .select("id,company_id")
        .ilike("email", data.email)
        .eq("phone_e164", phoneE164);
      if (target?.companyId) visitorQuery = visitorQuery.eq("company_id", target.companyId);
      const { data: visitors } = await visitorQuery;
      const visitorIds = visitors?.map((visitor) => visitor.id) ?? [];

      if (visitorIds.length > 0) {
        await supabaseAdmin
          .from("visitors")
          .update({
            marketing_consent: false,
            marketing_consent_at: null,
            marketing_consent_revoked_at: now,
            whatsapp_opt_in: false,
            whatsapp_opt_in_at: null,
          })
          .in("id", visitorIds);
        await supabaseAdmin
          .from("crm_leads")
          .update({
            whatsapp_opt_in: false,
            whatsapp_opt_in_at: null,
            do_not_contact: true,
            updated_at: now,
          })
          .in("visitor_id", visitorIds);
        await (supabaseAdmin as any).from("visitor_consent_events").insert(
          visitors!.map((visitor) => ({
            visitor_id: visitor.id,
            company_id: visitor.company_id,
            purpose: "marketing",
            granted: false,
            consent_version: "privacy-revocation-v1",
            source: "privacy_center",
            portal_slug: data.portalSlug || null,
            request_ip: ip === "unknown" ? null : ip,
            user_agent: request?.headers.get("user-agent")?.slice(0, 400) ?? null,
          })),
        );
        immediatelyRevoked = true;
      }
    }

    const [{ data: admins }, { data: companyManagers }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "adm"),
      target?.companyId
        ? supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "matriz")
            .eq("company_id", target.companyId)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);
    const recipientIds = [
      ...new Set([...(admins ?? []), ...(companyManagers ?? [])].map((item) => item.user_id)),
    ];
    if (recipientIds.length > 0) {
      await (supabaseAdmin as any).from("system_notifications").upsert(
        recipientIds.map((userId) => ({
          recipient_user_id: userId,
          event_key: `privacy-request:${protocol}`,
          category: "privacy",
          severity: "warning",
          title: `Nova solicitação de privacidade — ${protocol}`,
          description: `${data.fullName} enviou uma solicitação do tipo ${data.requestType}.`,
          company_id: target?.companyId ?? null,
          created_at: now,
          updated_at: now,
        })),
        { onConflict: "recipient_user_id,event_key" },
      );
    }

    return { protocol, immediatelyRevoked };
  });

const privacyStatusSchema = z.enum([
  "requested",
  "identity_verification",
  "in_progress",
  "completed",
  "rejected",
]);

async function privacyScope(context: any) {
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role,company_id")
    .eq("user_id", context.userId)
    .in("role", ["adm", "matriz"])
    .maybeSingle();
  if (!role) throw new Error("Você não tem permissão para acessar estas solicitações.");
  return role as { role: "adm" | "matriz"; company_id: string | null };
}

export const listPrivacyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const role = await privacyScope(context);
    let query = (supabaseAdmin as any)
      .from("privacy_requests")
      .select(
        "id,protocol,company_id,request_type,full_name,email,phone_e164,portal_slug,details,status,assigned_to,due_at,internal_notes,identity_verification_method,identity_verified_at,resolution_summary,resolved_at,created_at,updated_at,companies(name,trade_name),assigned_profile:profiles!privacy_requests_assigned_to_fkey(full_name,email)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (role.role === "matriz") query = query.eq("company_id", role.company_id);
    const { data, error } = await query;
    if (error) throw new Error("Não foi possível carregar as solicitações de privacidade.");
    return data ?? [];
  });

export const updatePrivacyRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: privacyStatusSchema,
        assignToSelf: z.boolean().optional(),
        internalNotes: z.string().trim().max(4000).optional(),
        identityVerificationMethod: z.string().trim().max(240).optional(),
        resolutionSummary: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const role = await privacyScope(context);
    let lookup = (supabaseAdmin as any)
      .from("privacy_requests")
      .select("id,company_id,request_type,status,assigned_to,internal_notes")
      .eq("id", data.id);
    if (role.role === "matriz") lookup = lookup.eq("company_id", role.company_id);
    const { data: requestRow } = await lookup.maybeSingle();
    if (!requestRow) throw new Error("Solicitação não encontrada ou sem permissão.");
    if (
      ["in_progress", "completed"].includes(data.status) &&
      requestRow.request_type !== "marketing_revocation" &&
      !data.identityVerificationMethod
    ) {
      throw new Error("Informe como a identidade do titular foi confirmada.");
    }
    if (["completed", "rejected"].includes(data.status) && !data.resolutionSummary) {
      throw new Error("Registre a resposta final ou o motivo da recusa.");
    }

    const now = new Date().toISOString();
    const updates: Record<string, string | null> = {
      status: data.status,
      updated_at: now,
      resolved_at: ["completed", "rejected"].includes(data.status) ? now : null,
    };
    if (data.assignToSelf) updates["assigned_to"] = context.userId;
    if (data.internalNotes !== undefined) updates["internal_notes"] = data.internalNotes || null;
    if (data.identityVerificationMethod !== undefined)
      updates["identity_verification_method"] = data.identityVerificationMethod || null;
    if (data.status === "in_progress" && data.identityVerificationMethod) {
      updates["identity_verified_at"] = now;
      updates["identity_verified_by"] = context.userId;
    }
    if (data.resolutionSummary !== undefined)
      updates["resolution_summary"] = data.resolutionSummary || null;
    const { error } = await (supabaseAdmin as any)
      .from("privacy_requests")
      .update(updates)
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar a solicitação.");
    const eventTypes = new Set<string>();
    if (requestRow.status !== data.status) eventTypes.add("status_changed");
    if (data.assignToSelf && requestRow.assigned_to !== context.userId) eventTypes.add("assigned");
    if (data.identityVerificationMethod && data.status === "in_progress")
      eventTypes.add("identity_verified");
    if (data.internalNotes !== undefined && data.internalNotes !== requestRow.internal_notes)
      eventTypes.add("note_updated");
    if (["completed", "rejected"].includes(data.status)) eventTypes.add("resolved");
    if (eventTypes.size > 0) {
      await (supabaseAdmin as any).from("privacy_request_events").insert(
        [...eventTypes].map((eventType) => ({
          privacy_request_id: data.id,
          actor_user_id: context.userId,
          event_type: eventType,
          previous_status: requestRow.status,
          new_status: data.status,
          note: data.resolutionSummary || data.internalNotes || null,
        })),
      );
    }
    return { ok: true };
  });
