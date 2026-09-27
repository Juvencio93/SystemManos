import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/app-shell";
import { GlobalChatWidget } from "@/components/app/chat/GlobalChatWidget";
import { ChatPresenceProvider } from "@/components/app/chat/ChatPresenceProvider";
import { supabase } from "@/integrations/supabase/client";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return {
      user: data.user,
      supabase, // Injecting supabase client into route context
    };
  },
  component: () => (
    <AppErrorBoundary>
      <ChatPresenceProvider>
        <AppShell>
          <Outlet />
          <GlobalChatWidget />
        </AppShell>
      </ChatPresenceProvider>
    </AppErrorBoundary>
  ),
});

