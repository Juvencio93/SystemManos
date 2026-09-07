type ReportedErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

/**
 * Minimal runtime error reporter for React error boundaries and route
 * loaders/server functions. Prod React does not rethrow boundary-caught
 * errors to window.onerror, so this is the only place those errors surface.
 *
 * Currently logs to the console. Swap the body for a real error-tracking
 * SDK (Sentry, etc.) when one is configured — the call sites and context
 * shape are already set up for it.
 */
export function reportRuntimeError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: ReportedErrorOptions = {},
) {
  if (typeof window === "undefined") return;

  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error("[error-reporting]", message, {
    route: window.location.pathname,
    stack,
    ...context,
    mechanism: options.mechanism ?? "react_error_boundary",
    handled: options.handled ?? false,
    severity: options.severity ?? "error",
  });
}
