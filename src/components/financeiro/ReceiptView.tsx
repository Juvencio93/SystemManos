import { getCompanyDisplayName } from "@/lib/name-utils";

interface ReceiptViewProps {
  data: {
    charge: {
      id: string;
      amount: number;
      due_date: string;
      paid_at?: string;
      competence?: string;
      description?: string;
    };
    company: {
      name: string;
      trade_name?: string | null;
      legal_name?: string | null;
      document?: string | null;
    };
    settings: {
      legal_name?: string | null;
      trade_name?: string | null;
      document?: string | null;
      logo_url_relatorios?: string | null;
    } | null;
  };
}

export function ReceiptView({ data }: ReceiptViewProps) {
  const { charge, company, settings } = data;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="p-8 space-y-8 bg-white text-slate-900 font-sans">
      {/* Header */}
      <div className="flex justify-between items-start border-b pb-8 border-slate-100">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">RECIBO DE PAGAMENTO</h1>
          <p className="text-sm text-slate-500 font-medium">
            Nº {charge.id?.split("-")[0]?.toUpperCase() || "N/A"}
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="h-12 flex items-center justify-end">
            {settings?.logo_url_relatorios ? (
              <img
                src={settings.logo_url_relatorios}
                alt="Logo"
                className="h-full object-contain"
              />
            ) : (
              <span className="text-xl font-bold text-slate-900 uppercase">Manos Tech</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Comprovante Oficial de Quitação
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 py-4">
        <div className="bg-slate-50 rounded-lg p-6 space-y-4 border border-slate-100">
          <p className="text-lg leading-relaxed text-slate-700">
            Recebemos de{" "}
            <strong className="text-slate-900">
              {getCompanyDisplayName({
                name: company.name,
                trade_name: company.trade_name ?? null,
                legal_name: company.legal_name ?? null,
              })}
            </strong>{" "}
            o valor de
            <strong className="text-slate-900"> {formatCurrency(charge.amount)}</strong>, referente
            ao pagamento da fatura de serviço da plataforma{" "}
            <span className="font-semibold italic text-slate-800">Manos Tech</span>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Pagador
              </p>
              <p className="font-bold text-slate-900">
                {getCompanyDisplayName({
                  name: company.name,
                  trade_name: company.trade_name ?? null,
                  legal_name: company.legal_name ?? null,
                })}
              </p>
              <p className="text-slate-500">{company.document || "CNPJ não informado"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Competência
              </p>
              <p className="font-bold text-slate-900">{charge.competence || "—"}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Beneficiário
              </p>
              <p className="font-bold text-slate-900">
                {settings?.legal_name || settings?.trade_name || "Manos Tech"}
              </p>
              <p className="text-slate-500">{settings?.document || "00.000.000/0000-00"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Data do Pagamento
              </p>
              <p className="font-bold text-slate-900">
                {formatDate(charge.paid_at || charge.due_date)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Signature */}
      <div className="pt-12 flex flex-col items-center space-y-4">
        <div className="w-64 h-px bg-slate-200" />
        <div className="text-center">
          <p className="font-bold text-slate-900">{settings?.trade_name || "Manos Tech"}</p>
          <p className="text-xs text-slate-400">Plataforma Digital de Wi-Fi Marketing</p>
        </div>
      </div>
    </div>
  );
}
