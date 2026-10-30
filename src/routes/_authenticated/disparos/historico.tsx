import { createFileRoute } from "@tanstack/react-router";
import { HistoricoView } from "@/components/app/whatsapp/HistoricoView";

export const Route = createFileRoute("/_authenticated/disparos/historico")({
  component: HistoricoView,
});
