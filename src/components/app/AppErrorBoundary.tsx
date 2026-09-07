import React, { type ErrorInfo, type ReactNode } from "react";
import { reportRuntimeError } from "@/lib/error-reporting";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Unhandled component error", error, info.componentStack);
    void reportRuntimeError(error, { boundary: "authenticated_app_error_boundary" });
  }

  private recover = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <section className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="text-xl font-semibold text-foreground">Algo não carregou</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O restante do sistema continua seguro. Tente recarregar esta tela para continuar.
          </p>
          <button
            type="button"
            onClick={this.recover}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Recarregar tela
          </button>
        </section>
      </main>
    );
  }
}

