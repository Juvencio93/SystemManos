import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Toasts (avisos) na identidade do sistema: superfície #0B1118,
// borda branca suave, texto claro — nada das cores padrão da
// biblioteca (o richColors saiu da montagem em __root.tsx).
// A cor do tipo (sucesso/erro/aviso/info) aparece só no ícone,
// via CSS em styles.css (.toaster [data-sonner-toast]...).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      theme="dark"
      style={
        {
          "--normal-bg": "#0B1118",
          "--normal-border": "rgba(255, 255, 255, 0.1)",
          "--normal-text": "#E2E8F0",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast shadow-2xl shadow-black/50",
          title: "font-semibold text-slate-50",
          description: "group-[.toast]:text-slate-400",
          actionButton:
            "group-[.toast]:bg-cyan-500 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-white/5 group-[.toast]:text-slate-300",
          closeButton:
            "border-white/10 bg-white/5 text-slate-400 hover:text-slate-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
