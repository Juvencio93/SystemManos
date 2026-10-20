import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { TermsOfUseContent } from "@/components/legal/legal-contents";
import { LEGAL_DOCUMENTS } from "@/lib/legal-document-versions";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de uso | Manos Tech" },
      { name: "description", content: "Regras para acesso e utilização da plataforma Manos Tech." },
    ],
  }),
  component: TermsOfUsePage,
});

function TermsOfUsePage() {
  return (
    <LegalPageShell
      eyebrow="Condições da plataforma"
      title="Termos de uso"
      summary="Regras aplicáveis aos administradores e usuários autorizados pelas empresas que utilizam a plataforma Manos Tech."
      updatedAt={LEGAL_DOCUMENTS.termsOfUse.updatedAt}
      version={LEGAL_DOCUMENTS.termsOfUse.version}
    >
      <TermsOfUseContent />
    </LegalPageShell>
  );
}
