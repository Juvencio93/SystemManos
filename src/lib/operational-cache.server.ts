import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export interface OperationalCache {
  company_id: string;
  analysis_date: string;
  generated_at: string;
  summary: any;
  indicators: any;
  operations_snapshot: any;
  status: string;
}

export async function getOperationalCache(
  supabase: SupabaseClient<Database>,
  companyId: string,
  date: string // YYYY-MM-DD em America/Sao_Paulo
): Promise<OperationalCache | null> {
  const { data, error } = await supabase
    .from("company_operational_analyses")
    .select("*")
    .eq("company_id", companyId)
    .eq("analysis_date", date)
    .maybeSingle();

  if (error) {
    console.error("[getOperationalCache] Error:", error);
    return null;
  }

  return data as OperationalCache | null;
}
