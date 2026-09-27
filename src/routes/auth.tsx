import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, Suspense } from "react";
import { Radar } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import manosTechLogo from "@/assets/manos-tech-logo-institutional.png";

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

function AuthPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Até a hidratação concluir, o clique em "Entrar" viraria um submit nativo
    // (recarregava /auth sem autenticar). Só liberamos os botões depois disso.
    setReady(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <Suspense>
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="absolute inset-0 grid-lines opacity-40" />
          <Link to="/" className="relative flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-xl glow-ring">
              <Radar className="size-5 text-primary" />
            </span>
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
            </form>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
