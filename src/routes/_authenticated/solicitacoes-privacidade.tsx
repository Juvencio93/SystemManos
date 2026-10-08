import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccess } from "@/hooks/use-access";
import { listPrivacyRequests, updatePrivacyRequestStatus } from "@/lib/privacy.functions";

export const Route = createFileRoute("/_authenticated/solicitacoes-privacidade")({
  head: () => ({ meta: [{ title: "Solicitações de privacidade | Manos Tech" }] }),
  component: PrivacyRequestsPage,
});

const requestLabels: Record<string, string> = {
  access: "Consultar dados",
  correction: "Corrigir dados",
  deletion: "Excluir dados",
  marketing_revocation: "Parar ofertas",
  information: "Informações",
  other: "Outro pedido",
};

const statusLabels: Record<string, string> = {
  requested: "Recebida",
  identity_verification: "Confirmar identidade",
  in_progress: "Em atendimento",
  completed: "Concluída",
  rejected: "Recusada",
};

function PrivacyRequestsPage() {
  const access = useAccess();
  const queryClient = useQueryClient();
  const allowed = access.data?.role === "adm" || access.data?.role === "matriz";
  const requests = useQuery({
    queryKey: ["privacy-requests"],
    queryFn: () => listPrivacyRequests(),
    enabled: allowed,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      updatePrivacyRequestStatus({ data: input as any }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["privacy-requests"] });
      toast.success("Andamento atualizado.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });

  if (!access.isLoading && !allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Solicitações de privacidade" subtitle="Área restrita." />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitações de privacidade"
        subtitle="Acompanhe pedidos de acesso, correção, exclusão e revogação de marketing."
      />
      <Button asChild variant="ghost" className="gap-2">
        <Link to="/configuracoes">
          <ArrowLeft className="size-4" /> Voltar para Configurações
        </Link>
      </Button>
      <Card className="glass-panel border-primary/10">
        <CardContent className="pt-6">
          {requests.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
          ) : requests.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Recebida em</TableHead>
                    <TableHead>Andamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.data.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.protocol}</TableCell>
                      <TableCell>
                        <p className="font-medium">{item.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.email} · {item.phone_e164}
                        </p>
                        {item.details && (
                          <p className="mt-1 max-w-72 text-xs text-muted-foreground">
                            {item.details}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {requestLabels[item.request_type] ?? item.request_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.companies?.trade_name || item.companies?.name || "Não identificada"}
                      </TableCell>
                      <TableCell>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(item.created_at))}
                      </TableCell>
                      <TableCell>
                        <select
                          aria-label={`Andamento de ${item.protocol}`}
                          value={item.status}
                          disabled={update.isPending}
                          onChange={(event) =>
                            update.mutate({ id: item.id, status: event.target.value })
                          }
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <ShieldCheck className="size-10 text-primary" />
              <p>Nenhuma solicitação recebida.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
