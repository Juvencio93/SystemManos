import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageCircle, PlugZap, Unplug } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import { getWhatsappConexao } from "@/lib/whatsapp/conexoes.functions";

export function ConexaoView() {
  const { data: access } = useAccess();
  const companyId = access?.companyId ?? null;
  const branchId = access?.branchId ?? null;

  const fetchConexao = useServerFn(getWhatsappConexao);
  const { data: conexao, isLoading } = useQuery({
    queryKey: ["whatsapp-conexao", companyId, branchId],
    queryFn: () => fetchConexao({ data: { company_id: companyId!, branch_id: branchId } }),
    enabled: !!companyId,
  });

  return (
    <div>
      <PageHeader
        title="Conectar WhatsApp"
        subtitle="Conecte o WhatsApp da sua empresa pra enviar promoções. Seu número continua funcionando normal no celular."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Carregando...
        </div>
      ) : conexao ? (
        <Card className="border-emerald-400/40 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/70 hover:shadow-[0_8px_32px_rgba(52,211,153,0.25)]">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="size-7 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-emerald-300">Conectado ✓</p>
              <p className="text-sm text-muted-foreground">
                {conexao.numero ? `${conexao.numero} · ` : ""}
                {conexao.display_name ?? "WhatsApp Business"}
                {conexao.quality_rating ? ` · Qualidade: ${conexao.quality_rating}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              className="border-red-400/30 text-red-300 transition-all duration-300 hover:border-red-400/60 hover:bg-red-500/10"
            >
              <Unplug className="mr-2 size-4" /> Desconectar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-cyan-400/30 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-[0_8px_32px_rgba(0,192,240,0.2)]">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
            <div className="flex size-16 items-center justify-center rounded-full bg-cyan-500/15">
              <MessageCircle className="size-8 text-cyan-300" />
            </div>
            <div>
              <p className="text-xl font-bold">Conecte o WhatsApp da sua empresa</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Pra enviar promoções automáticas, você conecta o número uma única vez.
                Ele continua funcionando normal no celular — nada muda no seu dia a dia.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-cyan-500 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_8px_24px_rgba(0,192,240,0.35)]"
            >
              <PlugZap className="mr-2 size-5" /> Conectar WhatsApp
            </Button>
            <p className="text-xs text-muted-foreground">
              A conexão com a Meta será ativada na próxima fase.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
