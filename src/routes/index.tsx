import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Wifi, Building2, BarChart3, QrCode, ShieldCheck, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      throw redirect({ to: "/dashboard" });
    }
    // Anonymous visitors see the landing page below instead of being
    // redirected straight to /auth.
  },
  head: () => ({
    meta: [
      { title: "ManosTech | Solução em Marketing para Wi-Fi" },
      {
        name: "description",
        content:
          "A plataforma ManosTech conecta portais Wi-Fi, campanhas, CRM próprio e indicadores em uma única base — para matrizes, filiais e eventos.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Wifi,
    title: "Portal Wi-Fi inteligente",
    description:
      "Cada filial e evento com link permanente, período operacional próprio e cadastro com consentimento LGPD.",
  },
  {
    icon: Building2,
    title: "Matriz, filiais e eventos",
    description:
      "Estrutura multiempresa: a matriz enxerga toda a rede, cada filial enxerga somente a própria operação.",
  },
  {
    icon: BarChart3,
    title: "Inteligência comercial",
    description:
      "Conexões, recorrência, campanhas ativas e evolução diária em painéis prontos para decisão.",
  },
  {
    icon: QrCode,
    title: "Campanhas rastreáveis",
    description:
      "Uma campanha ativa por operação, com histórico preservado e leads sempre atribuídos à origem correta.",
  },
  {
    icon: ShieldCheck,
    title: "Base própria e segura",
    description:
      "Permissões por papel no banco de dados e isolamento total de dados entre empresas clientes.",
  },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />

      <header className="relative flex items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl glow-ring">
            <Radar className="size-4 text-primary" />
          </span>
          <span className="font-display text-lg font-black tracking-tight">ManosTech</span>
        </Link>
        <Button asChild variant="outline">
          <Link to="/auth">Acessar painel</Link>
        </Button>
      </header>

      <main className="relative px-6 pb-24 pt-10 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Solução em marketing
          </p>
          <h1 className="mt-4 font-display text-4xl font-black leading-[1.1] tracking-tighter sm:text-5xl">
            Transforme o Wi-Fi em uma{" "}
            <span className="text-gradient">máquina de captação</span> e inteligência comercial
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground">
            A plataforma ManosTech conecta portais Wi-Fi, campanhas, CRM próprio e indicadores em
            uma única base — para matrizes, filiais e eventos.
          </p>
          <Button asChild size="lg" className="mt-8 shadow-glow">
            <Link to="/auth">Entrar na plataforma</Link>
          </Button>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-panel rounded-2xl border border-border p-6"
            >
              <feature.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-display text-base font-black tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
