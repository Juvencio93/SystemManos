import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos e feiras | Manos Tech" },
      {
        name: "description",
        content:
          "Cadastre eventos com portal Wi-Fi próprio, período operacional e controle financeiro do contrato.",
      },
      { property: "og:title", content: "Eventos e feiras | Manos Tech" },
      {
        property: "og:description",
        content:
          "Cadastre eventos com portal Wi-Fi próprio, período operacional e controle financeiro do contrato.",
      },
    ],
  }),
  component: EventsPage,
});

const schema = z.object({
  company_id: z.string().uuid("Selecione a empresa"),
  name: z.string().trim().min(2, "Informe o nome do evento").max(120),
  portal_slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, números e hifen"),
  location: z.string().trim().max(160).optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  daily_reset_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  contracted_value: z.coerce.number().min(0),
  paid_value: z.coerce.number().min(0),
  cost_value: z.coerce.number().min(0),
});

const EMPTY = {
  company_id: "",
  name: "",
  portal_slug: "",
  location: "",
  starts_at: "",
  ends_at: "",
  daily_reset_time: "07:50",
  contracted_value: "0",
  paid_value: "0",
  cost_value: "0",
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function EventsPage() {
  const { data: access } = useAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const companies = useQuery({
    queryKey: ["companies-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, portal_slug, location, starts_at, ends_at, daily_reset_time, status, contracted_value, paid_value, cost_value",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const companyId = access?.role === "adm" ? form.company_id : (access?.companyId ?? "");
      const parsed = schema.parse({ ...form, company_id: companyId });
      const { error } = await supabase.from("events").insert({
        company_id: parsed.company_id,
        name: parsed.name,
        portal_slug: parsed.portal_slug,
        location: parsed.location?.trim() ? parsed.location : null,
        starts_at: parsed.starts_at || null,
        ends_at: parsed.ends_at || null,
        daily_reset_time: parsed.daily_reset_time,
        contracted_value: parsed.contracted_value,
        paid_value: parsed.paid_value,
        cost_value: parsed.cost_value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento cadastrado.");
      setOpen(false);
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Dados inválidos")
          : "Não foi possível salvar.",
      ),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "planejado" | "ativo" | "encerrado" | "cancelado";
    }) => {
      const { error } = await supabase.from("events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: () => toast.error("Não foi possível atualizar."),
  });

  return (
    <div>
      <PageHeader
        title="Eventos"
        subtitle="Feiras, shows e ativacoes temporarias com portal Wi-Fi e captação próprios."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            {access?.role === "adm" && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Novo evento
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo evento</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                {access?.role === "adm" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Empresa</Label>
                    <Select
                      value={form.company_id}
                      onValueChange={(v) => setForm({ ...form, company_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {(companies.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug do portal</Label>
                  <Input
                    value={form.portal_slug}
                    onChange={(e) =>
                      setForm({ ...form, portal_slug: e.target.value.toLowerCase() })
                    }
                    placeholder="expo-verao"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reinício diario</Label>
                  <Input
                    type="time"
                    value={form.daily_reset_time}
                    onChange={(e) => setForm({ ...form, daily_reset_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Local</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inicio</Label>
                  <Input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor contratado</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.contracted_value}
                    onChange={(e) => setForm({ ...form, contracted_value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor pago</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.paid_value}
                    onChange={(e) => setForm({ ...form, paid_value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custo</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.cost_value}
                    onChange={(e) => setForm({ ...form, cost_value: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createEvent.mutate()} disabled={createEvent.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="glass-panel">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events.data ?? []).map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">
                    {event.name}
                    <span className="block text-xs text-muted-foreground">
                      {event.location ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    /portal/{event.portal_slug}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[event.starts_at, event.ends_at].filter(Boolean).join(" › ") || "—"}
                  </TableCell>
                  <TableCell>{money(Number(event.contracted_value))}</TableCell>
                  <TableCell
                    className={
                      Number(event.contracted_value) - Number(event.paid_value) > 0
                        ? "text-destructive"
                        : "text-primary"
                    }
                  >
                    {money(Number(event.contracted_value) - Number(event.paid_value))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="outline">{event.status}</Badge>
                      {access?.role === "adm" && (
                        <>
                          {event.status !== "ativo" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus.mutate({ id: event.id, status: "ativo" })}
                            >
                              Ativar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateStatus.mutate({ id: event.id, status: "encerrado" })
                              }
                            >
                              Encerrar
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!events.isLoading && (events.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum evento cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
