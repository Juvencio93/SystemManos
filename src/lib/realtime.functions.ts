import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const RealtimeActivitySchema = z.object({
  hour: z.number(),
  opName: z.string(),
  is_returning: z.boolean(),
  visitor_id: z.string(),
});

export type RealtimeActivity = z.infer<typeof RealtimeActivitySchema>;

export interface RealtimeActivityResponse {
  activity: RealtimeActivity[];
  lastUpdate: string;
}

export const getRealtimeActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RealtimeActivityResponse> => {
    const { userId, supabase } = context;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id, reseller_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData) return { activity: [], lastUpdate: new Date().toISOString() };

    const { role, company_id, branch_id, reseller_id } = roleData;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value ?? "1970";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const dateStr = `${year}-${month}-${day}`;
    let query = supabase
      .from("connections")
      .select(
        `
        id, created_at, period_date, is_returning, visitor_id, branch_id, company_id,
        branches(id, name, trade_name, legal_name), 
        companies(id, name, trade_name, legal_name)
      `,
      )
      .eq("period_date", dateStr);

    if (role === "matriz" && company_id) {
      query = query.eq("company_id", company_id);
    } else if (role === "filial" && branch_id) {
      query = query.eq("branch_id", branch_id);
    } else if (role === "revenda" && reseller_id) {
      const { data: companies } = await supabase.from("companies").select("id").eq("reseller_id", reseller_id);
      const ids = (companies ?? []).map((company) => company.id);
      if (!ids.length) return { activity: [], lastUpdate: new Date().toISOString() };
      query = query.in("company_id", ids);
    } else if (role !== "adm") {
      return { activity: [], lastUpdate: new Date().toISOString() };
    }

    const { data } = await query;
    const activity: RealtimeActivity[] = (data || []).map((conn) => {
      const hourStr = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false,
      }).format(new Date(conn.created_at));
      const hour = parseInt(hourStr, 10);

      const opName =
        conn.branches?.trade_name ||
        conn.branches?.name ||
        conn.companies?.trade_name ||
        conn.companies?.name ||
        "Operação";

      return {
        hour,
        opName,
        is_returning: !!conn.is_returning,
        visitor_id: conn.visitor_id,
      };
    });

    return {
      activity,
      lastUpdate: new Date().toISOString(),
    };
  });
