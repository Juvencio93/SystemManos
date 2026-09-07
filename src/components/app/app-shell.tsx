import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Megaphone,
  QrCode,
  Radar,
  ReceiptText,
  Settings,
  Sparkles,
  Users,
  Wallet,
  HandCoins,
  Handshake,
} from "lucide-react";

import { useEffect, useState, type ReactNode } from "react";
import { usePresence } from "@/components/app/chat/ChatPresenceProvider";

import defaultLogo from "@/assets/manos-tech-logo-institutional.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { roleLabel, useAccess, type AppRole } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
};

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Painel",
    icon: LayoutDashboard,
    roles: ["adm", "matriz", "filial", "revenda"],
  },
  {
    to: "/gerente-operacional",
    label: "Gerente Operacional IA",
    icon: Sparkles,
    roles: ["adm", "matriz", "revenda"],
  },
  { to: "/empresas", label: "Empresas", icon: Building2, roles: ["adm", "revenda"] },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["adm", "revenda"] },
  { to: "/creditos", label: "Créditos", icon: HandCoins, roles: ["revenda"] },
  { to: "/eventos", label: "Eventos", icon: CalendarDays, roles: ["adm"] },
  { to: "/assinatura", label: "Minha Assinatura", icon: ReceiptText, roles: ["matriz"] },
  { to: "/portais", label: "Portais & QR", icon: QrCode, roles: ["adm", "matriz", "filial", "revenda"] },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone, roles: ["adm", "matriz", "filial", "revenda"] },
  {
    to: "/relatorios",
    label: "Relatórios",
    icon: FileBarChart,
    roles: ["adm", "matriz", "filial", "revenda"],
  },
  { to: "/visitantes", label: "CRM", icon: Users, roles: ["adm", "matriz", "filial", "revenda"] },
  {
    to: "/revendas",
    label: "Revendas",
    icon: Handshake,
    roles: ["adm"],
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    roles: ["adm", "matriz", "filial", "revenda"],
  },
  { to: "/filiais", label: "Filiais", icon: Building2, roles: ["matriz"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: access, isLoading: accessLoading } = useAccess();
  // usePresence is now consumed by components that need it,
  // and the side effect is managed by the Provider in the route.

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const role = access?.role ?? null;
  const blockedAccess = Boolean(access?.companyBlocked) && role !== "adm";
  const branchLimit = Number(access?.activationLimit ?? 0);
  // REGRA ABSOLUTA: Ocultar menu se o activation_limit <= 1 (1 Matriz + 0 Filiais)
  const canUseBranches = role === "adm" || branchLimit > 1;
  const showFilialFeatures = canUseBranches;

  const items = NAV.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (role === "matriz" && item.to === "/filiais" && !showFilialFeatures) return false;
    return true;
  });

  const pendingAccess = !accessLoading && Boolean(access) && role === null;
  // Marca fixa no cabeçalho: Robô + "Manos Tech"
  const brandName = "Manos Tech";
  const brandLogo = defaultLogo;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/80 px-3 py-3 backdrop-blur sm:flex-nowrap sm:gap-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4">
              <SheetTitle className="sr-only">Menu do painel</SheetTitle>
              <div className="mb-6 flex items-center gap-2 px-1 pt-1">
                <span className="grid size-9 place-items-center rounded-lg glow-ring">
                  <Radar className="size-5 text-primary" />
                </span>
                <span className="font-display text-sm font-semibold leading-tight">
                  Manos Tech
                  <span className="block text-[10px] font-normal uppercase tracking-[0.2em] text-muted-foreground">
                    Plataforma de Marketing Inteligente
                  </span>
                </span>
              </div>

              <nav className="flex flex-col gap-1">
                {items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-xl border border-sidebar-border bg-card/60 p-3">
                <p className="truncate text-xs text-muted-foreground">{access?.email}</p>
                <p className="mt-1 truncate text-sm font-medium">{access?.fullName}</p>
                {role ? (
                  <Badge variant="outline" className="mt-2 border-primary/40 text-primary">
                    {roleLabel[role]}
                  </Badge>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full justify-start"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
            <img
              src={brandLogo}
              alt={`Logo ${brandName}`}
              className="h-8 w-auto max-w-[160px] shrink-0 object-contain"
            />
            <span className="hidden truncate font-display text-sm font-semibold sm:inline">
              {brandName}
            </span>
          </Link>
        </div>

        <Button variant="ghost" size="sm" className="shrink-0" onClick={handleSignOut}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 sm:p-6 md:p-8 overflow-hidden">
        {blockedAccess ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center">
            <Lock className="mx-auto mb-3 size-6 text-destructive" />
            <h1 className="font-display text-lg font-semibold">Acesso bloqueado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A conta desta empresa está bloqueada. Matriz e filiais permanecem sem acesso ao painel
              até a liberação. Fale com o suporte da plataforma para regularizar.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        ) : pendingAccess ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/60 p-6 text-center">
            <Lock className="mx-auto mb-3 size-6 text-muted-foreground" />
            <h1 className="font-display text-lg font-semibold">Acesso pendente de liberação</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua conta foi criada, mas ainda não está vinculada a nenhuma empresa, filial ou perfil
              administrativo. Solicite ao administrador o cadastro do seu e-mail (
              {access?.email ?? "-"}) para liberar o painel.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        ) : (
          children
        )}
      </main>

      <footer className="border-t border-border px-4 py-4 text-center text-[11px] text-muted-foreground md:px-8">
        Powered by Manos Tech · Plataforma de Marketing Inteligente
      </footer>
    </div>
  );
}
