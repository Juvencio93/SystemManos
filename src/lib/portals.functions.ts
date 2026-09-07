import { createServerFn } from "@tanstack/react-start";
import { getBranchDisplayName, getCompanyDisplayName, type Branch } from "@/lib/name-utils";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalItem = {
  id: string;
  name: string;
  slug: string;
  kind: "Sede" | "Filial" | "Evento";
  detail: string | null;
  campaignName: string | null;
  active: boolean;
  companyId: string;
  companyName: string;
  parentCompanyId?: string | null;
  parentCompanyName?: string | null;
  city?: string | null;
};

export const getPortals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id")
      .eq("user_id", userId);

    if (!roles || roles.length === 0) return { items: [], role: null };

    const ROLE_PRIORITY = ["adm", "matriz", "filial"];
    const sorted = [...roles].sort(
      (a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role),
    );
    const primary = sorted[0];
    if (!primary) return { items: [], role: null };

    const role = primary.role;

    let companiesQuery = supabase
      .from("companies")
      .select("id, name, trade_name, legal_name, portal_slug, portal_active, city, state, status, blocked");
    let branchesQuery = supabase
      .from("branches")
      .select(
        "id, name, trade_name, legal_name, portal_slug, city, state, active, company_id, is_headquarters",
      );
    let eventsQuery = supabase
      .from("events")
      .select("id, name, portal_slug, location, status, company_id");
    let campaignsQuery = supabase
      .from("campaigns")
      .select("id, name, branch_id, event_id, company_id")
      .eq("status", "ativa");

    if (role === "matriz" && primary.company_id) {
      companiesQuery = companiesQuery.eq("id", primary.company_id);
      branchesQuery = branchesQuery.eq("company_id", primary.company_id);
      eventsQuery = eventsQuery.eq("company_id", primary.company_id);
      campaignsQuery = campaignsQuery.eq("company_id", primary.company_id);
    } else if (role === "filial" && primary.branch_id) {
      const { data: branch } = await supabase
        .from("branches")
        .select("company_id")
        .eq("id", primary.branch_id)
        .single();
      if (branch?.company_id) {
        companiesQuery = companiesQuery.eq("id", branch.company_id);
        branchesQuery = branchesQuery.eq("id", primary.branch_id);
        eventsQuery = eventsQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // UUID zero to return no results safely
        campaignsQuery = campaignsQuery
          .eq("company_id", branch.company_id)
          .eq("branch_id", primary.branch_id);
      } else {
        return { items: [], role };
      }
    }

    const [companiesRes, branchesRes, eventsRes, campaignsRes] = await Promise.all([
      companiesQuery,
      branchesQuery,
      eventsQuery,
      campaignsQuery,
    ]);

    const items: PortalItem[] = [];
    const activeCampaigns = campaignsRes.data || [];
    const companies = companiesRes.data || [];
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    // Add Company Portals
    companies.forEach((company) => {
      items.push({
        id: company.id,
        name: getCompanyDisplayName(company),
        slug: company.portal_slug || `matriz-${company.id.slice(0, 8)}`,
        kind: "Sede",
        detail: [company.city, company.state].filter(Boolean).join(" · ") || null,
        campaignName:
          activeCampaigns.find((c) => c.company_id === company.id && !c.branch_id && !c.event_id)
            ?.name ?? null,
        active: (!company.blocked && company.status === "ativa") && (company as any).portal_active !== false,
        companyId: company.id,
        companyName: getCompanyDisplayName(company),
        city: company.city,
      });
    });

    // Add Branch Portals
    (branchesRes.data || []).forEach((b) => {
      if (!b.is_headquarters) {
        const parentCompany = companyMap.get(b.company_id);
        items.push({
          id: b.id,
          name: getBranchDisplayName(b as Branch),
          slug: b.portal_slug || `filial-${b.id.slice(0, 8)}`,
          kind: "Filial",
          detail: [b.city, b.state].filter(Boolean).join(" · ") || null,
          campaignName: activeCampaigns.find((c) => c.branch_id === b.id)?.name ?? null,
          active: b.active ?? false,
          companyId: b.id,
          companyName: getBranchDisplayName(b as Branch),
          parentCompanyId: b.company_id,
          parentCompanyName: parentCompany
            ? getCompanyDisplayName(parentCompany)
            : "Unidade Independente",
          city: b.city,
        });
      }
    });

    // Add Event Portals
    (eventsRes.data || []).forEach((e) => {
      const parentCompany = companyMap.get(e.company_id);
      items.push({
        id: e.id,
        name: e.name || "",
        slug: e.portal_slug || `evento-${e.id.slice(0, 8)}`,
        kind: "Evento",
        detail: e.location || null,
        campaignName: activeCampaigns.find((c) => c.event_id === e.id)?.name ?? null,
        active: e.status === "ativo" || e.status === "planejado",
        companyId: e.id,
        companyName: e.name || "",
        parentCompanyId: e.company_id,
        parentCompanyName: parentCompany ? getCompanyDisplayName(parentCompany) : null,
      });
    });

    return { items, role };
  });
