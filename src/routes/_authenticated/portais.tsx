import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, QrCode } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { PortalQrCard } from "@/components/app/portal-qr-card";
import { useAccess } from "@/hooks/use-access";
import { getPortals, type PortalItem } from "@/lib/portals.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/portais")({
  head: () => ({
    meta: [
      { title: "Portais e QR Codes | Manos Tech" },
      {
        name: "description",
        content:
          "Gerencie os portais Wi-Fi e obtenha os QR Codes permanentes para sua sede e filiais.",
      },
    ],
  }),
  component: PortalsPage,
});

function PortalsPage() {
  const { data: access } = useAccess();
  const fetchPortals = useServerFn(getPortals);
  const portalsQuery = useQuery({
    queryKey: ["portals-list"],
    queryFn: () => fetchPortals(),
  });

  const isLoading = portalsQuery.isLoading || !access;
  const items = (portalsQuery.data?.items || []) as PortalItem[];
  const userRole = access?.role;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Group items by company
  const groups = items.reduce(
    (acc, item) => {
      const companyId = item.parentCompanyId || item.companyId;
      const companyName = item.parentCompanyName || item.companyName;

      if (!acc[companyId]) {
        acc[companyId] = { companyName, items: [] };
      }
      acc[companyId].items.push(item);
      return acc;
    },
    {} as Record<string, { companyName: string; items: PortalItem[] }>,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="font-display font-black tracking-tight text-3xl">
            Portais e QR Codes
          </span>
        }
        subtitle={
          <span className="text-base opacity-80">
            Acesse os links permanentes e baixe os QR Codes para impressão.
          </span>
        }
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groups).map(([groupId, group]) => (
            <div key={groupId} className="space-y-4">
              {/* Ocultar cabeçalho do grupo se a matriz não tiver filiais/eventos e houver apenas 1 item (a Sede) */}
              {(userRole !== "matriz" || group.items.length > 1) && (
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Building2 className="size-5 text-primary" />
                  <h2 className="text-xl font-semibold tracking-tight">{group.companyName}</h2>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({group.items.length} {group.items.length === 1 ? "unidade" : "unidades"})
                  </span>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {group.items
                  .filter(
                    (item) =>
                      userRole !== "matriz" ||
                      item.kind === "Sede" ||
                      (access?.activationLimit ?? 0) > 0,
                  )
                  .map((item) => (
                    <PortalQrCard
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      baseUrl={baseUrl}
                      canManage={userRole === "adm"}
                      canConfigureEquipment={userRole === "adm"}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
