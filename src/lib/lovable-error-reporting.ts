// Stub de error reporting.
// O projeto nao depende mais do sandbox Lovable, entao nao ha
// hook global para capturar excecoes. Apenas loga no console.

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const message =
    error instanceof Error
      ? error.message
      : error instanceof Response
        ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
        : String(error);
  console.error("[error-report]", message, context);
}
