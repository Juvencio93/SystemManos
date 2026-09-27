import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server function to check if a campaign exists and is active for a given target.
 * This is used to ensure atomic activation.
 */
export const checkExistingActiveCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { target: string }) => z.object({ target: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [kind, id] = data.target.split(":") as ["company" | "branch" | "event", string];

    let query = supabase.from("campaigns").select("id").eq("status", "ativa");

    if (kind === "branch") {
      query = query.eq("branch_id", id);
    } else if (kind === "event") {
      query = query.eq("event_id", id);
    } else {
      query = query.eq("company_id", id).is("branch_id", null).is("event_id", null);
    }

    const { data: existing } = await query.maybeSingle();
    return existing || null;
  });
