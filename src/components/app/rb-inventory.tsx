import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRbInventory, manageRbInventory, downloadRbSetup } from "@/lib/rb-inventory.functions";
import { RbInventoryView } from "./rb-inventory-view";
export function RbInventory() {
  const list = useServerFn(listRbInventory);
  const manage = useServerFn(manageRbInventory);
  const download = useServerFn(downloadRbSetup);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["rb-inventory"], queryFn: () => list(), refetchInterval: 180_000, refetchIntervalInBackground: false });
  return <RbInventoryView data={query.data} loading={query.isLoading} error={query.error?.message}
    refresh={async () => { await query.refetch(); }}
    action={async data => { await manage({ data }); await query.refetch(); await qc.invalidateQueries({ queryKey:["hotspot-approved-clients"] }); }}
    download={async (deviceId,kind) => { window.location.href = await download({ data:{ deviceId,kind } }); }} />;
}

