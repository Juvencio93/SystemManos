import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReceiptData } from "@/lib/receipt.functions";
import { ReceiptView } from "@/components/financeiro/ReceiptView";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro/recibo/$chargeId")({
  component: ReceiptPage,
});

function ReceiptPage() {
  const { chargeId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["receipt", chargeId],
    queryFn: () => getReceiptData({ data: { chargeId } }),
  });

  if (isLoading) return <div className="p-8 text-center">Gerando recibo...</div>;
  if (error || !data) {
    return (
      <div className="p-8 text-center text-destructive">
        Erro ao carregar recibo. Verifique se a cobrança está paga.
      </div>
    );
  }

  const { charge, settings } = data;

  const handlePrint = () => {
    window.print();
  };

  // Fixed branding branding
  const institutionalName = "Manos Tech";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Ações (escondidas na impressão) */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Recibo
          </Button>
        </div>

        {/* O Recibo */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden print:shadow-none print:border-none">
          <ReceiptView data={data as unknown as Parameters<typeof ReceiptView>[0]["data"]} />

          {/* Rodapé Adicional (Audit) */}
          <div className="p-8 pt-0 border-t border-slate-100 bg-slate-50/30 print:bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-[10px] text-slate-400 uppercase tracking-widest">
              <div>Código de Autenticação: {charge.id?.split("-")[0]?.toUpperCase() || "N/A"}</div>
              <div>
                Documento gerado eletronicamente em {new Date().toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        {/* Informações da Plataforma (Assinatura Manos Tech) */}
        <div className="text-center space-y-2 text-slate-400 text-xs print:mt-12">
          <p>Plataforma de Gestão {institutionalName}</p>
          <div className="flex flex-col items-center gap-1 opacity-80">
            {/* Use institutional data for the platform issuer, not user display name */}
            <p>Empresa: {institutionalName} Solução em Marketing</p>
            <p>
              CNPJ:{" "}
              {(settings as unknown as { document?: string })?.document || "00.000.000/0000-00"}
            </p>
            <p>Razão Social: {institutionalName} LTDA</p>
          </div>
        </div>
      </div>
    </div>
  );
}
