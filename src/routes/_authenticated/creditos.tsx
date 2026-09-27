import { createFileRoute } from "@tanstack/react-router";
import { ResellersPage } from "./revendas";

export const Route = createFileRoute("/_authenticated/creditos")({
  head: () => ({ meta: [{ title: "Créditos | Manos Tech" }] }),
  component: ResellersPage,
});
