import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import(
      "@/integrations/supabase/client.server"
    );
    const { deleteCompanyFull } = await import("./company-delete.server");
    return deleteCompanyFull(db, context.userId, data.companyId);
  });
