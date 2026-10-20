import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/lib/settings.functions";

// Tela de troca OBRIGATÓRIA exibida pelo app-shell quando o usuário
// entrou com a senha temporária da redefinição aprovada. Enquanto a
// flag profiles.must_change_password estiver ligada, o painel inteiro
// é substituído por esta tela; ao salvar, o servidor desliga a flag e
// a query ["access"] recarrega, liberando o shell.
export function ForcedPasswordChange({
  expired,
  onSignOut,
}: {
  expired: boolean;
  onSignOut: () => void;
}) {
  const queryClient = useQueryClient();
  const updatePasswordFn = useServerFn(updatePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      await updatePasswordFn({
        data: { currentPassword, newPassword, confirmPassword },
      });
      toast.success("Senha atualizada! Bem-vindo de volta.");
      await queryClient.invalidateQueries({ queryKey: ["access"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível trocar a senha.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-primary/15 bg-[#0a1118] p-6 shadow-2xl">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">
            {expired ? "Senha temporária expirada" : "Troque sua senha"}
          </h1>
        </div>

        {expired ? (
          <>
            <p className="text-sm text-muted-foreground">
              A senha temporária venceu (a validade é de 1 hora) antes de você
              trocar. Saia e peça uma nova redefinição na tela de login — a
              equipe libera outra pra você.
            </p>
            <Button variant="secondary" className="w-full" onClick={onSignOut}>
              <LogOut className="size-4" /> Sair
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Você entrou com uma senha temporária. Defina sua senha definitiva
              pra continuar usando o painel.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fp-current">Senha temporária (atual)</Label>
                <Input
                  id="fp-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-new">Nova senha</Label>
                <Input
                  id="fp-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-confirm">Confirmar nova senha</Label>
                <Input
                  id="fp-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
            <button
              type="button"
              onClick={onSignOut}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              <LogOut className="size-3.5" /> Sair e trocar depois
            </button>
          </>
        )}
      </div>
    </div>
  );
}
