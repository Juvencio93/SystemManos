import { buildHotspotCommand, expireStaleRequests, hotspotCommandHeaders, NO_OP_COMMAND, RebootDispatchAuditError } from "@/lib/rb-command.server";
import { createFileRoute } from "@tanstack/react-router";
import { hasAssignedRouterAuth } from "@/lib/hotspot-router-auth";

const headers = hotspotCommandHeaders;

export const Route = createFileRoute("/api/internal/hotspot-command")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const identity = url.searchParams.get("routerIdentity") ?? "";
        const commandIdFromRouter = url.searchParams.get("rebootCommandId") ?? "";
        if (!/^MT-[A-Z0-9-]{6,48}$/.test(identity)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const baseSelect = "id,status,company_id,hotspot_config_id,assignment_version,credential_version,assignment_applied_version,verification_expires_at,router_applied_status,reboot_requested_at,router_status_requested_at,router_status_applied_at,sync_requested_at,sync_applied_at";
        // A coluna pending_router_identity só existe após a migration do rename.
        // Sem ela, o lookup volta ao select antigo (o comportamento não muda).
        const loadByIdentity = async () => {
          const full = await (supabaseAdmin as any)
            .from("hotspot_devices")
            .select(`${baseSelect},pending_router_identity`)
            .eq("router_identity", identity)
            .neq("status", "suspended")
            .maybeSingle();
          if (!full.error) return full.data;
          const legacy = await (supabaseAdmin as any)
            .from("hotspot_devices")
            .select(baseSelect)
            .eq("router_identity", identity)
            .neq("status", "suspended")
            .maybeSingle();
          if (legacy.error) throw legacy.error;
          return legacy.data;
        };
        // Caixa já renomeada, antes do ack: busca pelo pending para ela
        // conseguir buscar o script de novo (ex.: ack falhou na 1ª tentativa).
        // Sem a coluna (migration pendente) não há pending: volta null.
        const loadByPending = async () => {
          const res = await (supabaseAdmin as any)
            .from("hotspot_devices")
            .select(`${baseSelect},pending_router_identity`)
            .eq("pending_router_identity", identity)
            .neq("status", "suspended")
            .maybeSingle();
          if (res.error) {
            if (String(res.error.message ?? "").includes("pending_router_identity")) return null;
            throw res.error;
          }
          return res.data;
        };
        let device: any;
        try {
          device = await loadByIdentity();
          if (!device) device = await loadByPending();
        } catch {
          return new Response("Could not read device", { status: 500 });
        }
        if (!device || !hasAssignedRouterAuth(request, identity, device)) return new Response("Unauthorized", { status: 401 });

        // Pedidos expirados (~30 min sem confirmação) são limpos antes de
        // montar o comando, para a RB parar de receber o comando travado.
        const now = new Date().toISOString();
        device = (await expireStaleRequests(supabaseAdmin, device, now)).device;

        // O GET é o transporte das RBs com o script antigo (e o fallback do
        // piggyback): sempre devolve um script, como antes.
        let command: string | null;
        try {
          command = await buildHotspotCommand(supabaseAdmin, {
            identity,
            commandIdFromRouter,
            device,
            includeRefresh: true,
          });
        } catch (error) {
          if (error instanceof RebootDispatchAuditError) {
            return new Response("Could not audit reboot dispatch", { status: 500 });
          }
          throw error;
        }
        return new Response(command ?? NO_OP_COMMAND, { headers });
      },
    },
  },
});
