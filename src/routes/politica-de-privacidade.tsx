import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { PrivacyPolicyContent } from "@/components/legal/legal-contents";
import { LEGAL_DOCUMENTS } from "@/lib/legal-document-versions";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade | Manos Tech" },
      {
        name: "description",
        content: "Como a plataforma Manos Tech trata e protege dados pessoais.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Proteção de dados"
      title="Política de privacidade"
      summary="Esta política explica quais dados são tratados na plataforma, para quais finalidades, com quem podem ser compartilhados e como os titulares podem exercer seus direitos."
      updatedAt={LEGAL_DOCUMENTS.privacyPolicy.updatedAt}
      version={LEGAL_DOCUMENTS.privacyPolicy.version}
    >
      <PrivacyPolicyContent />
    </LegalPageShell>
  );
}
