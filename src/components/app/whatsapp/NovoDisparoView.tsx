import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Rocket, Users } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import { getWhatsappMedicao } from "@/lib/whatsapp/medicao.functions";

export function NovoDisparoView() {
  const { data: access } = useAccess();
  const companyId = access?.companyId ?? null;

  const fetchMedicao = useServerFn(getWhatsappMedicao);
  const { data: medicao, isLoading } = useQuery({
    queryKey: ["whatsapp-medicao", companyId],
    queryFn: () => fetchMedicao({ data: { company_id: companyId! } }),
    enabled: !!companyId,
  });

  return (
    <div>
      <PageHeader
        title="Novo disparo"
        subtitle="Escolha a mensagem, o público e acompanhe o envio."
      />

      <Card className="border-white/10">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
          <div className="flex size-16 items-center justify-center rounded-full bg-cyan-500/10">
            <Rocket className="size-8 text-cyan-300/60" />
          </div>
          <div>
            <p className="text-lg font-bold">O assistente de disparo chega na próxima fase</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Aqui você vai escolher a mensagem aprovada, ver a pré-visualização no estilo
              balão de WhatsApp, escolher o público e confirmar o custo estimado antes de enviar.
            </p>
          </div>
          {!isLoading && medicao && (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm">
              <Users className="size-4 text-cyan-300" />
              <span className="text-muted-foreground">
                Disparos restantes no mês:{" "}
                <b className="text-foreground">
                  {medicao.restantes} de {medicao.cota}
                </b>
              </span>
            </div>
          )}
          {isLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          <Button disabled variant="outline">
            Montar disparo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
