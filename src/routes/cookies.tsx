import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { CookiePolicyContent } from "@/components/legal/legal-contents";
import { LEGAL_DOCUMENTS } from "@/lib/legal-document-versions";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Política de cookies | Manos Tech" },
      {
        name: "description",
        content: "Quais cookies e dados locais a plataforma Manos Tech usa, para quê e como controlar.",
      },
    ],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacidade"
      title="Política de cookies"
      summary="A plataforma usa apenas cookies necessários para o login e o Wi-Fi. Veja a lista completa, o que fica guardado no seu aparelho e como controlar."
      updatedAt={LEGAL_DOCUMENTS.cookiePolicy.updatedAt}
      version={LEGAL_DOCUMENTS.cookiePolicy.version}
    >
      <CookiePolicyContent />
    </LegalPageShell>
  );
}
