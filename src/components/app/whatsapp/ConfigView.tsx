import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Gauge, Loader2, Settings2 } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAccess } from "@/hooks/use-access";
import { getWhatsappMedicao } from "@/lib/whatsapp/medicao.functions";
import { getModuloDisparosStatus } from "@/lib/whatsapp/conexoes.functions";

export function ConfigView() {
  const { data: access } = useAccess();
  const companyId = access?.companyId ?? null;

  const fetchMedicao = useServerFn(getWhatsappMedicao);
  const fetchModulo = useServerFn(getModuloDisparosStatus);

  const { data: medicao, isLoading: loadingMedicao } = useQuery({
    queryKey: ["whatsapp-medicao", companyId],
    queryFn: () => fetchMedicao({ data: { company_id: companyId! } }),
    enabled: !!companyId,
  });

  const { data: modulo, isLoading: loadingModulo } = useQuery({
    queryKey: ["whatsapp-modulo", companyId],
    queryFn: () => fetchModulo({ data: { company_id: companyId! } }),
    enabled: !!companyId,
  });

  const usados = medicao?.disparos_feitos ?? 0;
  const cota = medicao?.cota ?? 4;
  const pct = cota > 0 ? Math.min(100, Math.round((usados / cota) * 100)) : 0;

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Cota do módulo, consumo do mês e status da cobrança na Meta."
      />

      {loadingMedicao || loadingModulo ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-cyan-400/30 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-[0_8px_32px_rgba(0,192,240,0.2)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-5 text-cyan-300" /> Cota do mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black">
                {usados}
                <span className="text-lg font-semibold text-muted-foreground"> / {cota}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">disparos usados</p>
              <Progress value={pct} className="mt-4" />
              {modulo?.plano && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Plano {modulo.plano.nome} · R$ {Number(modulo.plano.valor_mensal).toFixed(2).replace(".", ",")}/mês
                  {modulo.cota_custom != null ? " · cota ajustada pelo suporte" : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-white/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-5 text-amber-300" /> Cobrança da Meta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cada mensagem de marketing entregue custa cerca de{" "}
                <b className="text-foreground">R$ 0,32</b>, cobrado direto no seu cartão
                cadastrado na Meta.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Custo estimado este mês:{" "}
                <b className="text-foreground">
                  R$ {Number(medicao?.custo_estimado ?? 0).toFixed(2).replace(".", ",")}
                </b>
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Settings2 className="size-3.5" />
                Sem cartão válido na Meta, os disparos não são entregues.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
