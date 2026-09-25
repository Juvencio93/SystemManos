import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** The IDs are resolved from the authenticated role, never from request input. */
export async function loadBannerContext(
  db: SupabaseClient<Database>,
  companyId: string,
  branchId: string | null,
) {
  const { data: company, error } = await db
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (error || !company) throw new Error("BANNER_COMPANY_UNAVAILABLE");
  let unit = null;
  if (branchId) {
    const result = await db
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .eq("company_id", companyId)
      .single();
    if (result.error || !result.data)
      throw new Error("BANNER_BRANCH_UNAVAILABLE");
    unit = result.data;
  }
  // Campaign appearance is the existing source of saved colors and public links.
  let query = db
    .from("campaigns")
    .select("primary_color, accent_color, visual_style, redirect_url")
    .eq("company_id", companyId)
    .eq("status", "ativa");
  query = branchId
    ? query.eq("branch_id", branchId)
    : query.is("branch_id", null);
  const appearance = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appearance.error) throw new Error("BANNER_APPEARANCE_UNAVAILABLE");
  const name =
    unit?.trade_name || unit?.name || company.trade_name || company.name;
  const description = company.business_description || "";
  // Explicit public URLs in About the business are useful even without dedicated social fields.
  const publicLinks = Array.from(
    new Set([
      ...(description.match(/https?:\/\/[^\s<>"']+/g) || []),
      ...(appearance.data?.redirect_url ? [appearance.data.redirect_url] : []),
    ]),
  ).filter((link) => {
    try {
      return ["http:", "https:"].includes(new URL(link).protocol);
    } catch {
      return false;
    }
  });
  return {
    name,
    tradeName: unit?.trade_name || company.trade_name,
    legalName: unit?.legal_name || company.legal_name,
    segment:
      company.business_segment || company.segment || company.cnae_description,
    description,
    marketingGoal: company.wifi_marketing_goal,
    // A branch never inherits the headquarters' address as its own.
    address: unit ? unit.address : company.address,
    neighborhood: unit ? unit.neighborhood : company.neighborhood,
    city: unit ? unit.city : company.city,
    state: unit ? unit.state : company.state,
    logo: unit?.logo_url || company.logo_url,
    colors: [
      appearance.data?.primary_color,
      appearance.data?.accent_color,
    ].filter(Boolean),
    visualStyle: appearance.data?.visual_style || null,
    publicLinks,
  };
}

