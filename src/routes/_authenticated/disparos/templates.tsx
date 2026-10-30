import { createFileRoute } from "@tanstack/react-router";
import { TemplatesView } from "@/components/app/whatsapp/TemplatesView";

export const Route = createFileRoute("/_authenticated/disparos/templates")({
  component: TemplatesView,
});
