import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Mail } from "lucide-react";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const Route = createFileRoute("/direitos-do-titular")({
  head: () => ({
    meta: [
      { title: "Direitos do titular | Manos Tech" },
      {
        name: "description",
        content: "Canal para solicitações relacionadas a dados pessoais tratados pela Manos Tech.",
      },
    ],
  }),
  component: DataSubjectRightsPage,
});

function DataSubjectRightsPage() {
  return (
    <LegalPageShell
      eyebrow="Canal de privacidade"
      title="Direitos do titular"
      summary="Use este canal para entender ou solicitar providências relacionadas aos seus dados pessoais na plataforma Manos Tech."
      updatedAt="7 de outubro de 2026"
    >
      <LegalSection title="1 Solicitações disponíveis">
        <LegalList
          items={[
            "Confirmar se seus dados pessoais são tratados.",
            "Solicitar acesso e informações sobre finalidades e compartilhamentos.",
            "Corrigir dados incompletos, inexatos ou desatualizados.",
            "Solicitar anonimização, bloqueio ou eliminação quando aplicável.",
            "Revogar consentimento e interromper comunicações de marketing.",
            "Solicitar portabilidade ou revisão de decisão automatizada, quando cabível.",
          ]}
        />
      </LegalSection>
      <LegalSection title="2 Como solicitar">
        <p>
          Envie a solicitação pelo e-mail abaixo. Informe seu nome, telefone ou e-mail utilizado no
          portal, estabelecimento onde ocorreu o acesso e uma descrição objetiva do pedido.
        </p>
        <a
          href="mailto:manostech.suporte@gmail.com?subject=Solicitação%20de%20privacidade"
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          <Mail className="size-4" /> Enviar solicitação
        </a>
        <p className="text-xs text-slate-400">
          Para proteger o titular, poderá ser necessário confirmar a identidade antes de fornecer ou
          alterar dados.
        </p>
      </LegalSection>
      <LegalSection title="3 Responsável pelo atendimento">
        <p>
          Quando o pedido se referir a uma campanha ou portal Wi-Fi de um estabelecimento, a Manos
          Tech poderá encaminhá-lo à empresa responsável pela finalidade do tratamento e acompanhar
          o atendimento da solicitação.
        </p>
      </LegalSection>
      <LegalSection title="4 Informações adicionais">
        <p>
          Consulte também a{" "}
          <Link
            to="/politica-de-privacidade"
            className="font-medium text-cyan-300 hover:text-cyan-200"
          >
            Política de Privacidade
          </Link>
          . Informações oficiais sobre os direitos previstos na LGPD estão disponíveis no portal da
          ANPD.
        </p>
        <a
          href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
        >
          Direitos dos titulares na ANPD <ExternalLink className="size-4" />
        </a>
      </LegalSection>
    </LegalPageShell>
  );
}
