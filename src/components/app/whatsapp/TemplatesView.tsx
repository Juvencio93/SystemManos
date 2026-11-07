import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import {
  listWhatsappTemplates,
  removeWhatsappTemplate,
} from "@/lib/whatsapp/templates.functions";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-slate-500/15 text-slate-300 border-slate-400/30",
  em_analise: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  aprovado: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  reprovado: "bg-red-500/15 text-red-300 border-red-400/30",
};

export function TemplatesView() {
  const { data: access } = useAccess();
  const companyId = access?.companyId ?? null;
  const queryClient = useQueryClient();

  const fetchTemplates = useServerFn(listWhatsappTemplates);
  const removeFn = useServerFn(removeWhatsappTemplate);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates", companyId],
    queryFn: () => fetchTemplates({ data: { company_id: companyId! } }),
    enabled: !!companyId,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id, company_id: companyId! } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates", companyId] });
      toast.success("Mensagem removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Mensagens"
        subtitle="Crie as mensagens que serão enviadas nos disparos. Só mensagens aprovadas pela Meta podem ser usadas."
        action={
          <Button className="bg-cyan-500 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_8px_24px_rgba(0,192,240,0.35)]">
            <Plus className="mr-2 size-4" /> Criar mensagem
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Carregando...
        </div>
      ) : !templates?.length ? (
        <Card className="border-white/10">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
            <div className="flex size-16 items-center justify-center rounded-full bg-cyan-500/10">
              <FileText className="size-8 text-cyan-300/60" />
            </div>
            <div>
              <p className="text-lg font-bold">Nenhuma mensagem ainda</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Crie sua primeira mensagem. Depois de pronta, ela vai pra aprovação da Meta
                antes de poder ser usada nos disparos.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t: any) => (
            <Card
              key={t.id}
              className="border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_8px_24px_rgba(0,192,240,0.15)]"
            >
              <CardContent className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-bold">{t.nome}</p>
                  <Badge variant="outline" className={STATUS_STYLE[t.status] ?? STATUS_STYLE["rascunho"]}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{t.corpo}</p>
                {t.status === "reprovado" && t.motivo_reprovacao ? (
                  <p className="mt-2 text-xs text-red-300">Motivo: {t.motivo_reprovacao}</p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Pencil className="mr-1 size-3.5" /> Editar
                  </Button>
                  {(t.status === "rascunho" || t.status === "reprovado") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-300/80 hover:text-red-300"
                      onClick={() => removeMutation.mutate(t.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="mr-1 size-3.5" /> Remover
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
