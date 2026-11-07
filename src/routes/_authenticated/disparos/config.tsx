import { createFileRoute } from "@tanstack/react-router";
import { ConfigView } from "@/components/app/whatsapp/ConfigView";

export const Route = createFileRoute("/_authenticated/disparos/config")({
  component: ConfigView,
});
