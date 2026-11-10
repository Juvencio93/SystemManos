import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { RefundPolicyContent } from "@/components/legal/legal-contents";
import { LEGAL_DOCUMENTS } from "@/lib/legal-document-versions";

export const Route = createFileRoute("/reembolso")({
  head: () => ({
    meta: [
      { title: "Política de reembolso | Manos Tech" },
      {
        name: "description",
        content: "Arrependimento em 7 dias, cancelamento, defeito e devolução de valores da assinatura Manos Tech.",
      },
    ],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Consumidor"
      title="Política de reembolso"
      summary="Quando você pode desistir da assinatura, como cancelar, o que acontece em caso de defeito ou cobrança indevida e como o reembolso é feito."
      updatedAt={LEGAL_DOCUMENTS.refundPolicy.updatedAt}
      version={LEGAL_DOCUMENTS.refundPolicy.version}
    >
      <RefundPolicyContent />
    </LegalPageShell>
  );
}
