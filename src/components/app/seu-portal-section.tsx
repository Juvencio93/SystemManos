import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, QrCode } from "lucide-react";

import { PortalQrCard } from "@/components/app/portal-qr-card";
import { useAccess } from "@/hooks/use-access";
import { getPortals, type PortalItem } from "@/lib/portals.functions";

/**
 * "Seu portal" — link permanente e QR Code das unidades, dentro da
 * pagina de Campanhas (matriz e filial). E o mesmo conteudo que vivia
 * na pagina Portais: como o link/QR sao unicos por unidade, eles ficam
 * junto de quem monta o que o visitante ve. A pagina Portais segue
 * existindo para ADM e revenda.
 */
export function SeuPortalSection() {
  const { data: access } = useAccess();
  const fetchPortals = useServerFn(getPortals);
  const portalsQuery = useQuery({
    queryKey: ["portals-list"],
    queryFn: () => fetchPortals(),
    enabled: access?.role === "matriz" || access?.role === "filial",
  });

  if (access?.role !== "matriz" && access?.role !== "filial") return null;

  const items = ((portalsQuery.data?.items || []) as PortalItem[]).filter(
    (item) =>
      access.role !== "matriz" ||
      item.kind === "Sede" ||
      (access.activationLimit ?? 0) > 0,
  );
  if (portalsQuery.isLoading || !items.length) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const groups = items.reduce(
    (acc, item) => {
      const companyId = item.parentCompanyId || item.companyId;
      const companyName = item.parentCompanyName || item.companyName;
      if (!acc[companyId]) acc[companyId] = { companyName, items: [] };
      acc[companyId].items.push(item);
      return acc;
    },
    {} as Record<string, { companyName: string; items: PortalItem[] }>,
  );
  const groupList = Object.entries(groups);
  const showHeaders = groupList.length > 1 || items.length > 1;

  return (
    <section className="mb-8 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-black tracking-tight">
          <QrCode className="size-5 text-primary" /> Seu portal — link e QR Code
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O endereço é único e permanente: imprima o QR Code e cole no local — quem escanear cai
          direto no seu portal e vê a campanha ativa.
        </p>
      </div>

      {groupList.map(([groupId, group]) => (
        <div key={groupId} className="space-y-3">
          {showHeaders ? (
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Building2 className="size-4 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight">{group.companyName}</h3>
              <span className="text-xs text-muted-foreground">
                ({group.items.length} {group.items.length === 1 ? "unidade" : "unidades"})
              </span>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {group.items.map((item) => (
              <PortalQrCard
                key={`${item.kind}-${item.id}`}
                item={item}
                baseUrl={baseUrl}
                canManage={false}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
