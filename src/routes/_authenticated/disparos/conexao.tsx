import { createFileRoute } from "@tanstack/react-router";
import { ConexaoView } from "@/components/app/whatsapp/ConexaoView";

export const Route = createFileRoute("/_authenticated/disparos/conexao")({
  component: ConexaoView,
});
