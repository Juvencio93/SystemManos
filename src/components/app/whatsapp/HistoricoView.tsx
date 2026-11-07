import { History } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function HistoricoView() {
  return (
    <div>
      <PageHeader
        title="Histórico"
        subtitle="Veja os disparos já feitos: alcance, entregues, lidas e custo real."
      />

      <Card className="border-white/10">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
          <div className="flex size-16 items-center justify-center rounded-full bg-cyan-500/10">
            <History className="size-8 text-cyan-300/60" />
          </div>
          <div>
            <p className="text-lg font-bold">Nenhum disparo ainda</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Quando você fizer o primeiro disparo, ele aparece aqui com o resumo completo:
              quantas pessoas receberam, quantas leram e quanto custou.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
