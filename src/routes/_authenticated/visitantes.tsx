import { createFileRoute } from "@tanstack/react-router";
import { CrmRedesign } from "@/components/app/crm/CrmRedesign";

export const Route = createFileRoute("/_authenticated/visitantes")({
  head: () => ({
    meta: [
      { title: "CRM de Leads Wi-Fi | Manos Tech" },
      {
        name: "description",
        content: "Prospecção e conversão dos leads captados pelo portal Wi-Fi.",
      },
    ],
  }),
  component: CrmRedesign,
});
