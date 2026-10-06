import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "adm" | "matriz" | "filial" | "revenda";

export type AccessInfo = {
  userId: string;
  email: string | null;
  fullName: string | null;
  displayName: string | null;
  role: AppRole | null;
  companyId: string | null;
  branchId: string | null;
  resellerId: string | null;
  companyName: string | null;
  companyBlocked: boolean;
  logoUrl: string | null;
  platformName?: string | null;
  platformLogo?: string | null;
  platformLogoRelatorios?: string | null;
  activationLimit?: number | null;
};

const ROLE_PRIORITY: AppRole[] = ["adm", "revenda", "matriz", "filial"];

const authListeners = new WeakMap<
  QueryClient,
  { users: number; unsubscribe: () => void }
>();

function subscribeToAccessChanges(queryClient: QueryClient) {
  let listener = authListeners.get(queryClient);
  if (!listener) {
    const { data } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["access"] });
    });
    listener = { users: 0, unsubscribe: () => data.subscription.unsubscribe() };
    authListeners.set(queryClient, listener);
  }

  listener.users += 1;
  const activeListener = listener;
  return () => {
    activeListener.users -= 1;
    if (activeListener.users === 0) {
      activeListener.unsubscribe();
      authListeners.delete(queryClient);
    }
  };
}

export function useAccess() {
  const queryClient = useQueryClient();

  useEffect(() => subscribeToAccessChanges(queryClient), [queryClient]);

  return useQuery<AccessInfo | null>({
    queryKey: ["access"],
    queryFn: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn("[useAccess] Session unavailable:", sessionError.message);
        return null;
      }

      const sessionUser = sessionData.session?.user;
      if (!sessionUser) return null;

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (authError.name === "AuthSessionMissingError") return null;
        console.error("[useAccess] Auth error:", authError);
        return null;
      }

      const user = userData.user ?? sessionUser;
      if (!user) return null;

      const [
        { data: roles, error: rolesError },
        { data: profile, error: profileError },
        { data: pSettings },
      ] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role, company_id, branch_id, reseller_id")
          .eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("full_name, display_name, email")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_settings")
          .select("display_name, logo_url, logo_url_relatorios")
          .maybeSingle(),
      ]);

      if (rolesError) console.error("[useAccess] Roles error:", rolesError);
      if (profileError) console.error("[useAccess] Profile error:", profileError);

      const sorted = (roles ?? [])
        .slice()
        .sort(
          (a, b) =>
            ROLE_PRIORITY.indexOf(a.role as AppRole) - ROLE_PRIORITY.indexOf(b.role as AppRole),
        );
      const primary = sorted[0] ?? null;

      let customDisplayName: string | null = null;
      let companyBlocked = false;
      let logoUrl: string | null = null;
      let platformName: string | null = null;
      let platformLogo: string | null = null;
      let platformLogoRelatorios: string | null = null;

      let activationLimit: number | null = null;
      platformName = pSettings?.display_name ?? "Manos Tech";
      platformLogo = pSettings?.logo_url ?? null;
      platformLogoRelatorios = pSettings?.logo_url_relatorios ?? null;

      if (primary?.company_id) {
        // Dados básicos apenas (nome/bloqueio/logo).
        const { data: basics } = await supabase
          .from("companies")
          .select(
            "id, name, trade_name, legal_name, blocked, billing_blocked, logo_url, activation_limit",
          )
          .eq("id", primary.company_id)
          .maybeSingle();

        const company = basics ?? null;
        // Use trade_name for platform display if it exists, fallback to legacy name
        customDisplayName = company?.trade_name || company?.name || null;
        companyBlocked = Boolean(company?.blocked || company?.billing_blocked);
        logoUrl = company?.logo_url ?? null;
        activationLimit = basics?.activation_limit ?? 0;
        // Log solicitado para auditoria
        console.log(
          `[useAccess] Empresa: ${primary.company_id} | Limite Filiais: ${activationLimit}`,
        );
      }

      // Filial usa a logo da própria unidade quando houver; senão herda a da matriz.

      if (primary?.branch_id) {
        const { data: branch } = await supabase
          .from("branches")
          .select("name, trade_name, legal_name, logo_url")
          .eq("id", primary.branch_id)
          .maybeSingle();
        if (branch) customDisplayName = branch.trade_name || branch.name;
        if (branch?.logo_url) logoUrl = branch.logo_url;
      }

      if (primary?.role === "adm") {
        customDisplayName = platformName;
      }

      return {
        userId: user.id,
        email: profile?.email ?? user.email ?? null,
        fullName: profile?.full_name ?? null,
        displayName: profile?.display_name ?? null,
        role: (primary?.role as AppRole | undefined) ?? null,
        companyId: primary?.company_id ?? null,
        branchId: primary?.branch_id ?? null,
        resellerId: primary?.reseller_id ?? null,
        companyName: customDisplayName,
        companyBlocked,
        logoUrl,
        platformName,
        platformLogo,
        platformLogoRelatorios,
        activationLimit,
      };
    },

    staleTime: 15_000,
    // A payment webhook can release a blocked company while its screen remains
    // open. Polling keeps the access state aligned without requiring a logout.
    refetchInterval: 15_000,
    retry: false,
  });
}

export const roleLabel: Record<AppRole, string> = {
  adm: "ADM Manos Tech",
  matriz: "Matriz",
  filial: "Filial",
  revenda: "Revenda",
};
