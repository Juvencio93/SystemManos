import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("requested");
  const [notes, setNotes] = useState("");
  const [verification, setVerification] = useState("");
  const [resolution, setResolution] = useState("");
  const requests = useQuery({
    queryKey: ["privacy-requests"],
    queryFn: () => listPrivacyRequests(),
    enabled: allowed,
  });
  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      updatePrivacyRequestStatus({ data: input as any }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["privacy-requests"] });
      toast.success("Andamento atualizado.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });
  const selected = requests.data?.find((item: any) => item.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status);
    setNotes(selected.internal_notes ?? "");
    setVerification(selected.identity_verification_method ?? "");
    setResolution(selected.resolution_summary ?? "");
  }, [selected]);

  const saveSelected = (assignToSelf = false) => {
    if (!selected) return;
    update.mutate({
      id: selected.id,
      status,
      assignToSelf,
      internalNotes: notes,
      identityVerificationMethod: verification,
      resolutionSummary: resolution,
    });
  };

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
                    <TableHead>Prazo</TableHead>
                    <TableHead>Responsável</TableHead>
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
                        <span
                          className={
                            new Date(item.due_at) < new Date() &&
                            !["completed", "rejected"].includes(item.status)
                              ? "font-semibold text-destructive"
                              : ""
                          }
                        >
                          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                            new Date(item.due_at),
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.assigned_profile?.full_name ||
                          item.assigned_profile?.email ||
                          "Não definido"}
                      </TableCell>
                      <TableCell className="space-y-2">
                        <Badge variant="outline">{statusLabels[item.status] ?? item.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => setSelectedId(item.id)}>
                          Gerenciar
                        </Button>
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
      {selected && (
        <Card className="glass-panel border-primary/20">
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Atendimento do protocolo</p>
                <p className="font-mono font-semibold">{selected.protocol}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" /> Prazo operacional:{" "}
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                  new Date(selected.due_at),
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Andamento</Label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Método de confirmação da identidade</Label>
                <Input
                  value={verification}
                  onChange={(event) => setVerification(event.target.value)}
                  placeholder="Ex.: código enviado ao e-mail cadastrado"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Registre contatos, verificações e providências tomadas."
              />
            </div>
            <div className="space-y-2">
              <Label>Resposta ou conclusão</Label>
              <Textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={3}
                placeholder="Descreva o que foi atendido ou o motivo fundamentado da recusa."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveSelected(false)} disabled={update.isPending}>
                Salvar atendimento
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => saveSelected(true)}
                disabled={update.isPending}
              >
                <UserCheck className="size-4" /> Assumir atendimento
              </Button>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
