import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Building2,
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Megaphone,
  QrCode,
  ReceiptText,
  Settings,
  Sparkles,
  Users,
  Wallet,
  HandCoins,
  Handshake,
  ClipboardList,
  Router,
  Package,
} from "lucide-react";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { usePresence } from "@/components/app/chat/ChatPresenceProvider";
import { NotificationCenter } from "@/components/app/notification-center";
import { ForcedPasswordChange } from "@/components/app/forced-password-change";

import defaultLogo from "@/assets/manos-tech-logo-institutional.png";
import sidebarLogo from "@/assets/manostech-sidebar-logo.svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { roleLabel, useAccess, type AppRole } from "@/hooks/use-access";
import { supabase, resetClientSessionWatchers } from "@/integrations/supabase/client";
import { signOutFn } from "@/integrations/supabase/auth-session.functions";
import { getUnreadPreSalesCount } from "@/lib/pre-sales.functions";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
  // UX parte 5: o menu é exibido em blocos nomeados (Miller) — a memória
  // reconhece 4 grupos curtos em vez de uma lista plana de até 15 itens.
  group: string;
};

// Ordem dos blocos no menu.
const NAV_GROUPS = ["Operação", "Comercial", "Marketing", "Sistema"] as const;

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Painel",
    icon: LayoutDashboard,
    roles: ["adm", "matriz", "filial", "revenda"],
    group: "Operação",
  },
  {
    to: "/gerente-operacional",
    label: "Gerente Operacional IA",
    icon: Sparkles,
    roles: ["adm", "matriz", "revenda"],
    group: "Operação",
  },
  { to: "/empresas", label: "Empresas", icon: Building2, roles: ["adm", "revenda"], group: "Comercial" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["adm", "revenda"], group: "Comercial" },
  { to: "/hotspot", label: "Hotspot", icon: Router, roles: ["adm", "revenda"], group: "Operação" },
  { to: "/monitoramento", label: "Monitoramento", icon: Activity, roles: ["adm"], group: "Operação" },
  { to: "/estoque-rbs", label: "Estoque RBs", icon: Package, roles: ["adm", "revenda"], group: "Operação" },
  { to: "/creditos", label: "Créditos", icon: HandCoins, roles: ["revenda"], group: "Comercial" },
  { to: "/eventos", label: "Eventos", icon: CalendarDays, roles: ["adm"], group: "Operação" },
  { to: "/pre-venda", label: "Pré-venda", icon: ClipboardList, roles: ["adm"], group: "Comercial" },
  { to: "/assinatura", label: "Minha Assinatura", icon: ReceiptText, roles: ["matriz"], group: "Comercial" },
  { to: "/portais", label: "Portais & QR", icon: QrCode, roles: ["adm", "revenda"], group: "Marketing" },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone, roles: ["adm", "matriz", "filial", "revenda"], group: "Marketing" },
  {
    to: "/relatorios",
    label: "Relatórios",
    icon: FileBarChart,
    roles: ["adm", "matriz", "filial", "revenda"],
    group: "Operação",
  },
  { to: "/visitantes", label: "CRM", icon: Users, roles: ["adm", "matriz", "filial", "revenda"], group: "Comercial" },
  {
    to: "/revendas",
    label: "Revendas",
    icon: Handshake,
    roles: ["adm"],
    group: "Comercial",
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    roles: ["adm", "matriz", "filial", "revenda"],
    group: "Sistema",
  },
  { to: "/filiais", label: "Filiais", icon: Building2, roles: ["matriz"], group: "Comercial" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: access, isLoading: accessLoading } = useAccess();
  const fetchPreSalesCount = useServerFn(getUnreadPreSalesCount);
  const signOutServerFn = useServerFn(signOutFn);
  const preSalesCount = useQuery({
    queryKey: ["pre-sales-unread-count"],
    queryFn: () => fetchPreSalesCount(),
    enabled: access?.role === "adm",
    refetchInterval: 180_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const previousPreSalesCount = useRef<number | null>(null);
  // usePresence is now consumed by components that need it,
  // and the side effect is managed by the Provider in the route.

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const count = preSalesCount.data?.count;
    if (access?.role !== "adm" || count === undefined) return;
    if (previousPreSalesCount.current !== null && count > previousPreSalesCount.current) {
      const difference = count - previousPreSalesCount.current;
      toast.info(difference === 1 ? "Nova solicitação de pré-venda" : `${difference} novas solicitações de pré-venda`, {
        description: "Acesse o menu Pré-venda para ver os dados e acompanhar o contato.",
      });
    }
    previousPreSalesCount.current = count;
  }, [access?.role, preSalesCount.data?.count]);

  const role = access?.role ?? null;
  const blockedAccess =
    Boolean(access?.companyBlocked) && role !== "adm" && !pathname.startsWith("/assinatura");
  const branchLimit = Number(access?.activationLimit ?? 0);
  // REGRA ABSOLUTA: Ocultar menu se o activation_limit <= 1 (1 Matriz + 0 Filiais)
  const canUseBranches = role === "adm" || branchLimit > 1;
  const showFilialFeatures = canUseBranches;

  const items = NAV.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (role === "matriz" && item.to === "/filiais" && !showFilialFeatures) return false;
    return true;
  });

  const renderNavLink = (item: NavItem) => {
    const active = pathname.startsWith(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        }`}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="rail-label">{item.label}</span>
        {item.to === "/pre-venda" && (preSalesCount.data?.count ?? 0) > 0 ? (
          <span className="rail-label ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
            {preSalesCount.data!.count > 99 ? "99+" : preSalesCount.data!.count}
          </span>
        ) : null}
      </Link>
    );
  };

  // Blocos compartilhados entre a gaveta (celular) e a barra lateral
  // (desktop). A barra desktop é ESTREITA (só ícones) e EXPANDE no
  // hover/foco — o conteúdo interno tem largura fixa de 18rem e é
  // cortado pelo overflow da barra recolhida.
  const navGroups = (
    <div className="flex flex-col gap-3">
      {NAV_GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group} className="flex flex-col gap-1">
            <p className="rail-label whitespace-nowrap px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {group}
            </p>
            {groupItems.map(renderNavLink)}
          </div>
        );
      })}
    </div>
  );

  const userFooter = (
    <div className="rounded-xl border border-sidebar-border bg-card/60 p-3">
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
  );

  const pendingAccess = !accessLoading && Boolean(access) && role === null;
  // Marca do cabeçalho: Matriz/Filial com logo cadastrado veem a
  // PRÓPRIA marca (white-label leve — o painel vira "o sistema dele");
  // ADM/revenda e quem não tem logo seguem com a Manos Tech. O rodapé
  // "Powered by Manos Tech" (sidebar) não muda.
  const clienteBrand = (role === "matriz" || role === "filial") && Boolean(access?.logoUrl);
  const brandName = clienteBrand ? (access?.companyName ?? "Manos Tech") : "Manos Tech";
  const brandLogo = clienteBrand ? (access?.logoUrl as string) : defaultLogo;
  const brandImgClass = clienteBrand ? "rounded-md bg-white p-0.5" : "";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    // Limpa a sessão no servidor (revoga os tokens + apaga o cookie
    // httpOnly) e depois no client em memória.
    try {
      await signOutServerFn();
    } catch {
      // Segue para limpar o client de qualquer forma.
    }
    await supabase.auth.signOut();
    // Desarma os watchers de idle/duração da sessão anterior.
    resetClientSessionWatchers();
    navigate({ to: "/auth", replace: true });
  }

  // Senha temporária (redefinição aprovada): o painel inteiro é
  // substituído pela troca obrigatória até a senha definitiva ser
  // salva — ou pela tela de expirada, se a hora venceu.
  if (!accessLoading && access?.mustChangePassword) {
    const tempExpired =
      !access.tempPasswordUntil || new Date(access.tempPasswordUntil) < new Date();
    return <ForcedPasswordChange expired={tempExpired} onSignOut={handleSignOut} />;
  }

  return (
    <div className="flex min-h-screen flex-col md:pl-[68px] print:pl-0">
      {/* Barra lateral do DESKTOP: estreita (só ícones, 68px) e
          EXPANDE ao passar o mouse ou focar pelo teclado (288px,
          flutuando sobre o conteúdo). Os textos têm a classe
          rail-label: somem com a barra recolhida e aparecem no hover.
          No celular quem manda é a gaveta (Sheet) do cabeçalho. */}
      <aside
        aria-label="Menu lateral"
        className="menu-lateral group fixed inset-y-0 left-0 z-40 hidden w-[68px] overflow-hidden bg-sidebar transition-[width] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] md:flex md:flex-col print:hidden"
      >
        <div className="flex w-72 flex-col h-full">
          <div className="flex h-16 shrink-0 items-center gap-2 px-3">
            <img
              src={clienteBrand ? (access?.logoUrl as string) : sidebarLogo}
              alt={`Logo ${brandName}`}
              className={`size-11 shrink-0 rounded-full object-contain ${clienteBrand ? "bg-white p-1" : ""}`}
            />
            <span className="rail-label min-w-0 font-display text-sm font-semibold leading-tight">
              <span className="block truncate">{brandName}</span>
              <span className="block text-[10px] font-normal uppercase leading-snug tracking-[0.14em] text-muted-foreground">
                {clienteBrand ? "Painel da sua empresa" : "Plataforma de Marketing Inteligente"}
              </span>
            </span>
          </div>
          <nav
            aria-label="Navegação principal"
            className="menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
          >
            {navGroups}
          </nav>
          <div className="mt-auto shrink-0 px-3 py-3">
            <p className="rail-label truncate text-xs text-muted-foreground">{access?.email}</p>
            <p className="rail-label mt-1 truncate text-sm font-medium">{access?.fullName}</p>
            {role ? (
              <Badge variant="outline" className="rail-label mt-2 border-primary/40 text-primary">
                {roleLabel[role]}
              </Badge>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start whitespace-nowrap"
              onClick={handleSignOut}
            >
              <LogOut className="size-4 shrink-0" /> <span className="rail-label">Sair</span>
            </Button>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-background/80 px-3 py-3 backdrop-blur sm:flex-nowrap sm:gap-3 md:px-6 md:h-16 md:py-0 print:hidden print-hide">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex h-dvh max-h-dvh w-72 flex-col overflow-hidden border-sidebar-border bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">Menu do painel</SheetTitle>
              <div className="flex shrink-0 items-center gap-2 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] pr-12">
                <img
                  src={clienteBrand ? (access?.logoUrl as string) : sidebarLogo}
                  alt={`Logo ${brandName}`}
                  className={`size-11 shrink-0 rounded-full object-contain ${clienteBrand ? "bg-white p-1" : ""}`}
                />
                <span className="font-display text-sm font-semibold leading-tight">
                  {brandName}
                  <span className="block text-[10px] font-normal uppercase tracking-[0.2em] text-muted-foreground">
                    {clienteBrand ? "Painel da sua empresa" : "Plataforma de Marketing Inteligente"}
                  </span>
                </span>
              </div>

              <nav
                aria-label="Navegação principal"
                className="menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
              >
                {navGroups}
              </nav>

              <div className="mt-auto shrink-0 bg-sidebar px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
                {userFooter}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <img
              src={brandLogo}
              alt={`Logo ${brandName}`}
              className={`h-8 w-auto max-w-[160px] shrink-0 object-contain ${brandImgClass}`}
            />
            <span className="hidden truncate font-display text-sm font-semibold sm:inline">
              {brandName}
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {access?.userId && role ? (
            <NotificationCenter userId={access.userId} role={role} />
          ) : null}
          <Button variant="ghost" size="sm" className="shrink-0" onClick={handleSignOut}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 sm:p-6 md:p-8 overflow-hidden print:max-w-none print:overflow-visible print:p-0">
        {blockedAccess ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center">
            <Lock className="mx-auto mb-3 size-6 text-destructive" />
            <h1 className="font-display text-lg font-semibold">Acesso bloqueado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A conta desta empresa está bloqueada. Matriz e filiais permanecem sem acesso ao painel
              até a liberação. Acesse “Minha Assinatura” para regularizar o pagamento ou fale com o suporte.
            </p>
            {role === "matriz" ? (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/assinatura">Regularizar pagamento</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="mt-4" onClick={handleSignOut}>
                <LogOut className="size-4" /> Sair
              </Button>
            )}
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

      <footer className="border-t border-border px-4 py-4 text-center text-[11px] text-muted-foreground md:px-8 print:hidden print-hide">
        Powered by Manos Tech · Plataforma de Marketing Inteligente
      </footer>
    </div>
  );
}
