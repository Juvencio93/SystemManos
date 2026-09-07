import { useEffect, useState, useMemo } from "react";
import QRCode from "qrcode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  Pencil,
  QrCode,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HotspotConfigDialog } from "@/components/app/hotspot-config-dialog";
import { revokePortalUrl, deactivatePortal, createPortal } from "@/lib/portal-admin.functions";

export type PortalItem = {
  id: string;
  name: string;
  slug: string;
  kind: "Sede" | "Filial" | "Evento";
  detail: string | null;
  campaignName: string | null;
  active: boolean;
  companyId: string;
  companyName: string;
  parentCompanyId?: string | null;
  parentCompanyName?: string | null;
  city?: string | null;
};

export function PortalQrCard({
  item,
  baseUrl,
  canManage = true,
  canConfigureEquipment = false,
}: {
  item: PortalItem;
  baseUrl: string;
  canManage?: boolean;
  canConfigureEquipment?: boolean;
}) {
  const url = `${baseUrl}/portal/${item.slug}`;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!item.slug || !item.active) {
      setDataUrl(null);
      return;
    }
    const urlToEncode = `${baseUrl}/portal/${item.slug}`;
    let cancelled = false;
    QRCode.toDataURL(urlToEncode, {
      width: 512,
      margin: 1,
      color: { dark: "#04131a", light: "#ffffff" },
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [baseUrl, item.slug, item.active]);

  const revoke = useMutation({
    mutationFn: async () => revokePortalUrl({ data: { companyId: item.id } }),
    onSuccess: () => {
      toast.success("URL do portal revogada com sucesso.");
      setRevokeOpen(false);
      setRevokeConfirm("");
      queryClient.invalidateQueries({ queryKey: ["portals-list"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao revogar URL."),
  });

  const deactivate = useMutation({
    mutationFn: async () => deactivatePortal({ data: { companyId: item.id } }),
    onSuccess: () => {
      toast.success("Portal desativado com sucesso.");
      setDeleteOpen(false);
      setDeleteConfirm("");
      queryClient.invalidateQueries({ queryKey: ["portals-list"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao desativar portal."),
  });

  const reactivate = useMutation({
    mutationFn: async () => createPortal({ data: { companyId: item.id } }),
    onSuccess: () => {
      toast.success("Portal ativado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["portals-list"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao ativar portal."),
  });

  function download() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qrcode-${item.slug}.png`;
    link.click();
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    toast.success("Link do portal copiado.");
  }

  return (
    <Card className="glass-panel">
      <CardContent className="space-y-4 p-4">
        {item.active ? (
          <div className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1.5">
              {dataUrl ? (
                <img
                          loading="lazy"
                          decoding="async"
                  src={dataUrl}
                  alt={`QR Code do portal Wi-Fi`}
                  className="size-full"
                />
              ) : (
                <QrCode className="size-8 text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
                <Lock className="size-3" /> Link e QR Code fixos
              </p>
              <p className="mt-1 break-all font-mono text-xs">{url}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy className="size-3.5" /> Link
                </Button>
                <Button size="sm" variant="outline" onClick={download} disabled={!dataUrl}>
                  <Download className="size-3.5" /> QR Code
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" /> Abrir
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted-foreground/30 p-6 text-center">
            <Lock className="size-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Portal Desativado</p>
              <p className="text-xs text-muted-foreground">
                Este portal não possui uma URL ativa no momento.
              </p>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                {reactivate.isPending ? (
                  <Loader2 className="size-3 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="size-3 mr-2" />
                )}
                Ativar Portal
              </Button>
            )}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">
              {item.kind}
            </Badge>
            {!item.active ? <Badge variant="destructive">inativo</Badge> : null}
          </div>
          <p className="mt-2 truncate font-medium">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">{item.detail ?? "—"}</p>
          <p className="mt-1 truncate text-xs">
            {item.campaignName ? (
              <span className="text-primary">Campanha ativa: {item.campaignName}</span>
            ) : (
              <span className="text-muted-foreground">Sem campanha ativa</span>
            )}
          </p>

          {canConfigureEquipment && item.kind !== "Evento" ? (
            <div className="mt-3">
              <HotspotConfigDialog
                kind={item.kind === "Sede" ? "company" : "branch"}
                targetId={item.id}
                unitName={item.name}
              />
            </div>
          ) : null}

          {canManage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.active && (
                <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <RefreshCw className="size-3.5" /> Revogar URL
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revogar URL e QR Code?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3 text-slate-400">
                        <p>
                          A URL e o QR Code atuais deixarão de funcionar imediatamente. Campanhas,
                          leads, conexões, CRM e relatórios serão preservados.
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          Digite <code className="text-primary">REVOGAR</code> para confirmar:
                        </p>
                        <Input
                          value={revokeConfirm}
                          onChange={(e) => setRevokeConfirm(e.target.value)}
                          placeholder="REVOGAR"
                          className="mt-2"
                        />
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRevokeConfirm("")}>
                        Cancelar
                      </AlertDialogCancel>
                      <Button
                        variant="destructive"
                        disabled={revokeConfirm !== "REVOGAR" || revoke.isPending}
                        onClick={() => revoke.mutate()}
                      >
                        {revoke.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                        Confirmar Revogação
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive">
                    <Trash2 className="size-3.5" /> Excluir portal
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir e desativar portal?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3 text-slate-400">
                      <p>
                        O portal e sua URL serão desativados. A empresa, usuários, campanhas,
                        conexões, CRM, relatórios e histórico não serão excluídos.
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        Digite <code className="text-primary">EXCLUIR</code> para confirmar:
                      </p>
                      <Input
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="EXCLUIR"
                        className="mt-2"
                      />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirm("")}>
                      Cancelar
                    </AlertDialogCancel>
                    <Button
                      variant="destructive"
                      disabled={deleteConfirm !== "EXCLUIR" || deactivate.isPending}
                      onClick={() => deactivate.mutate()}
                    >
                      {deactivate.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                      Confirmar Exclusão
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
