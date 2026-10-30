import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMacBypass, listMacBypass, removeMacBypass } from "@/lib/mac-bypass.functions";

type MacBypassRow = {
  id: string;
  company_id: string;
  branch_id: string | null;
  mac_address: string;
  label: string;
  created_at: string;
};

function formatMacInput(value: string): string {
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < hex.length; i += 2) parts.push(hex.slice(i, i + 2));
  return parts.join(":");
}

export function MacBypassManager({
  companyId,
  branchId,
}: {
  companyId: string;
  branchId?: string | null;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMacBypass);
  const addFn = useServerFn(addMacBypass);
  const removeFn = useServerFn(removeMacBypass);

  const [mac, setMac] = useState("");
  const [label, setLabel] = useState("");

  const queryKey = ["mac-bypass", companyId, branchId ?? null];
  const { data: rows, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { company_id: companyId, branch_id: branchId ?? null } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addMutation = useMutation({
    mutationFn: (input: { mac_address: string; label: string }) =>
      addFn({
        data: {
          company_id: companyId,
          branch_id: branchId ?? null,
          mac_address: input.mac_address,
          label: input.label,
        },
      }),
    onSuccess: () => {
      toast.success("Dispositivo liberado.");
      setMac("");
      setLabel("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível adicionar."),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Dispositivo removido da lista.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível remover."),
  });

  const handleAdd = () => {
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
      toast.error("MAC inválido. Use o formato XX:XX:XX:XX:XX:XX.");
      return;
    }
    if (!label.trim()) {
      toast.error("Informe um nome para o dispositivo.");
      return;
    }
    addMutation.mutate({ mac_address: mac, label: label.trim() });
  };

  const list: MacBypassRow[] = (rows as MacBypassRow[] | undefined) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Dispositivos liberados
        </CardTitle>
        <CardDescription>
          MACs que pulam o portal automaticamente (ex: maquininha de cartão). A RB aplica em até 2 minutos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="mac-bypass-mac">MAC</Label>
            <Input
              id="mac-bypass-mac"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={mac}
              onChange={(e) => setMac(formatMacInput(e.target.value))}
              maxLength={17}
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mac-bypass-label">Nome do dispositivo</Label>
            <Input
              id="mac-bypass-label"
              placeholder="Maquininha caixa 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
          </div>
          <Button onClick={handleAdd} disabled={addMutation.isPending} className="sm:w-auto">
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Liberar</span>
          </Button>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dispositivo liberado.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.mac_address}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${row.label}`}
                  onClick={() => removeMutation.mutate(row.id)}
                  disabled={removeMutation.isPending}
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
