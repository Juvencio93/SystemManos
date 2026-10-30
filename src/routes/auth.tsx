import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, Suspense } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/password-reset.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, ensureClientSession } from "@/integrations/supabase/client";
import { signInFn } from "@/integrations/supabase/auth-session.functions";
import { LOGIN_RATE_LIMIT_MESSAGE } from "@/integrations/supabase/login-rate-limit";
import manosTechLogo from "@/assets/manos-tech-logo-institutional.png";
import sidebarLogo from "@/assets/manostech-sidebar-logo.svg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Manos Tech Plataforma de Marketing Inteligente" },
      {
        name: "description",
        content:
          "Acesse o painel Manos Tech para gerenciar campanhas, filiais e leads captados pelo Wi-Fi.",
      },
      { property: "og:title", content: "Entrar | Manos Tech Plataforma de Marketing Inteligente" },
      {
        property: "og:description",
        content:
          "Acesse o painel Manos Tech para gerenciar campanhas, filiais e leads captados pelo Wi-Fi.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

type AuthMode = "login" | "forgot" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const requestResetFn = useServerFn(requestPasswordReset);
  const signInServerFn = useServerFn(signInFn);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // UX parte 6: recuperação de senha (antes não existia nenhum caminho —
  // quem esquecia a senha ficava travado fora do painel).
  const [mode, setMode] = useState<AuthMode>("login");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // Até a hidratação concluir, o clique em "Entrar" viraria um submit nativo
    // (recarregava /auth sem autenticar). Só liberamos os botões depois disso.
    setReady(true);
    // Quem chega pelo link do e-mail de recuperação NÃO pode ser mandado
    // direto ao dashboard: precisa definir a nova senha primeiro.
    const recoveryLink =
      typeof window !== "undefined" && window.location.hash.includes("type=recovery");
    if (recoveryLink) setMode("reset");
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    // Hidrata o client em memória a partir do cookie httpOnly antes de
    // decidir o redirect — sem isso, um reload em /auth com cookie válido
    // não redirecionaria ao dashboard.
    void ensureClientSession().then(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session && !recoveryLink) navigate({ to: "/dashboard", replace: true });
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    // Login no SERVIDOR: a sessão vai para um cookie httpOnly (ver
    // auth-session.functions.ts). A resposta hidrata o client em memória.
    try {
      const { session } = await signInServerFn({ data: parsed.data });
      if (session) await supabase.auth.setSession(session);
    } catch (err) {
      setLoading(false);
      // O bloqueio anti-força-bruta tem mensagem própria (neutra: não
      // revela se o e-mail existe); demais erros mantêm a genérica.
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message === LOGIN_RATE_LIMIT_MESSAGE
          ? message
          : "Não foi possível entrar. Verifique e-mail e senha.",
      );
      return;
    }
    setLoading(false);
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const parsedEmail = z.string().trim().email("E-mail inválido").max(255).safeParse(email);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }
    setLoading(true);
    // Fluxo com aprovação (2026-10-20): o pedido NÃO dispara e-mail —
    // registra uma solicitação que o ADM aprova no painel ou pelo
    // Hermes, e o link é enviado ao cliente pela equipe.
    try {
      await requestResetFn({ data: { email: parsedEmail.data } });
    } catch {
      setLoading(false);
      toast.error("Não foi possível registrar o pedido agora. Tente de novo em instantes.");
      return;
    }
    setLoading(false);
    // Mensagem neutra de propósito: não confirmamos se o e-mail existe.
    toast.success(
      "Pedido registrado! Se este e-mail tiver uma conta, nossa equipe vai te enviar o link de redefinição.",
    );
    setMode("login");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6 || newPassword.length > 72) {
      toast.error("A nova senha deve ter entre 6 e 72 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setLoading(false);
      toast.error("Não foi possível salvar a nova senha. Abra o link do e-mail de novo.");
      return;
    }
    // A troca via link de recuperação autenticou só o client em memória;
    // estabelece a sessão no servidor (cookie httpOnly) com a nova senha.
    // Sem isso, o dashboard carregaria sem sessão nas server functions.
    try {
      const { data: userData } = await supabase.auth.getUser();
      const recoveryEmail = userData.user?.email ?? email;
      if (recoveryEmail) {
        const { session } = await signInServerFn({
          data: { email: recoveryEmail, password: newPassword },
        });
        if (session) await supabase.auth.setSession(session);
      }
    } catch {
      // Se falhar, o login manual com a nova senha resolve.
    }
    setLoading(false);
    toast.success("Senha atualizada! Bem-vindo de volta.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <Suspense>
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <Link to="/" className="relative flex items-center gap-2">
            <img
              src={sidebarLogo}
              alt="Logo Manos Tech"
              className="size-11 shrink-0 rounded-full object-contain"
            />
            <span className="font-display text-2xl font-black tracking-tight">Manos Tech</span>
          </Link>
          <div className="relative max-w-md">
            <h2 className="text-4xl font-display font-black leading-tight tracking-tighter">
              O Wi-Fi como <span className="text-gradient">máquina de captação</span>
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Matriz, filiais e eventos em uma única base: campanhas, leads, CRM e inteligência
              comercial em tempo real.
            </p>
          </div>
          <p className="relative text-xs text-muted-foreground">Manos Tech Solução em Marketing</p>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-8 text-center border-primary/20">
            <div className="mb-8 flex flex-col items-center">
              <img src={manosTechLogo} alt="Manos Tech Logo" className="h-32 w-auto mb-6 drop-shadow-glow" />
              <h2 className="text-lg font-display font-black text-foreground mb-3 tracking-tight">
                A inteligência por trás do seu Wi-Fi corporativo
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Acesso restrito. Use as credenciais fornecidas pela Manos Tech.
              </p>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleSignIn} className="space-y-5 text-left">
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest opacity-60 ml-1">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="password" className="text-[11px] font-black uppercase tracking-widest opacity-60 ml-1">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full shadow-glow" disabled={loading || !ready}>
                  {ready ? (loading ? "Entrando..." : "Entrar") : "Carregando..."}
                </Button>
                <p className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </p>
              </form>
            ) : mode === "forgot" ? (
              <form onSubmit={handleForgot} className="space-y-5 text-left">
                <p className="text-sm text-muted-foreground">
                  Informe seu e-mail: nossa equipe confirma o pedido e te envia o link para
                  criar uma nova senha.
                </p>
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest opacity-60 ml-1">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full shadow-glow" disabled={loading || !ready}>
                  {loading ? "Registrando..." : "Pedir redefinição de senha"}
                </Button>
                <p className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    Voltar para o login
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-5 text-left">
                <p className="text-sm text-muted-foreground">
                  Quase lá: defina sua nova senha para voltar ao painel.
                </p>
                <div className="space-y-2.5">
                  <Label htmlFor="new-password" className="text-[11px] font-black uppercase tracking-widest opacity-60 ml-1">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="confirm-password" className="text-[11px] font-black uppercase tracking-widest opacity-60 ml-1">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full shadow-glow" disabled={loading || !ready}>
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            )}

            <nav
              aria-label="Informações legais"
              className="mt-7 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-white/10 pt-5 text-xs text-muted-foreground"
            >
              <Link to="/termos-de-uso" className="transition-colors hover:text-primary">
                Termos de Uso
              </Link>
              <Link to="/politica-de-privacidade" className="transition-colors hover:text-primary">
                Política de Privacidade
              </Link>
              <Link to="/direitos-do-titular" className="transition-colors hover:text-primary">
                Direitos do Titular
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
