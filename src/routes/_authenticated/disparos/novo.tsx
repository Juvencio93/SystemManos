import { createFileRoute } from "@tanstack/react-router";
import { NovoDisparoView } from "@/components/app/whatsapp/NovoDisparoView";

export const Route = createFileRoute("/_authenticated/disparos/novo")({
  component: NovoDisparoView,
});
