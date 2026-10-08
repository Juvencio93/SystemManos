import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPrivacyRequest } from "@/lib/privacy.functions";

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
  const submitRequest = useServerFn(submitPrivacyRequest);
  const [form, setForm] = useState({
    requestType: "marketing_revocation",
    fullName: "",
    email: "",
    phone: "",
    portalSlug: "",
    details: "",
  });
  const [result, setResult] = useState<{ protocol: string; immediatelyRevoked: boolean } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: () =>
      submitRequest({
        data: {
          ...form,
          requestType: form.requestType as
            "access" | "correction" | "deletion" | "marketing_revocation" | "information" | "other",
        },
      }),
    onSuccess: setResult,
    onError: (error: Error) => toast.error(error.message),
  });
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
        {result ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <CheckCircle2 className="size-6 text-emerald-300" />
            <p className="mt-3 font-semibold text-white">Solicitação registrada</p>
            <p>Protocolo: {result.protocol}</p>
            <p>
              {result.immediatelyRevoked
                ? "O consentimento de marketing localizado foi revogado imediatamente."
                : "A equipe responsável verificará sua identidade antes de atender o pedido."}
            </p>
          </div>
        ) : (
          <form
            className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="requestType">O que você deseja solicitar?</Label>
              <select
                id="requestType"
                value={form.requestType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, requestType: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-sm"
              >
                <option value="marketing_revocation">Parar de receber ofertas</option>
                <option value="access">Consultar meus dados</option>
                <option value="correction">Corrigir meus dados</option>
                <option value="deletion">Excluir meus dados</option>
                <option value="information">Pedir informações</option>
                <option value="other">Outro pedido</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="privacyName">Nome completo</Label>
              <Input
                id="privacyName"
                required
                minLength={3}
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacyEmail">E-mail usado no portal</Label>
              <Input
                id="privacyEmail"
                type="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacyPhone">Telefone usado no portal</Label>
              <Input
                id="privacyPhone"
                required
                inputMode="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="privacyPortal">Código do portal ou estabelecimento (opcional)</Label>
              <Input
                id="privacyPortal"
                value={form.portalSlug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, portalSlug: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="privacyDetails">Detalhes do pedido (opcional)</Label>
              <textarea
                id="privacyDetails"
                maxLength={2000}
                value={form.details}
                onChange={(event) =>
                  setForm((current) => ({ ...current, details: event.target.value }))
                }
                className="min-h-24 w-full rounded-md border border-white/15 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Registrar solicitação
              </Button>
            </div>
          </form>
        )}
        <p className="text-xs text-slate-400">
          Para proteger o titular, poderá ser necessário confirmar a identidade antes de fornecer,
          corrigir ou excluir dados. O atendimento também pode ser solicitado pelo e-mail
          manostech.suporte@gmail.com.
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
