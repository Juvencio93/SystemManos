import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Role check handled in child components or via context if needed.
    // We let the route load so we can show "Acesso restrito" if needed.
    return { user: data.user };
  },
  component: () => <Outlet />,
});
