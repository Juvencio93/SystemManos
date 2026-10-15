/**
 * Development-only fallback for the publishable Supabase project.
 *
 * Production builds (Vite `import.meta.env.PROD` true, or `NODE_ENV === "production"`)
 * refuse to substitute this value: missing `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_PUBLISHABLE_KEY` (browser) or `SUPABASE_URL` and
 * `SUPABASE_PUBLISHABLE_KEY` (server) is treated as a misconfiguration that
 * must fail loudly. The fallback exists only so local `npm run dev` works
 * without committing secrets to the repository.
 *
 * Only publishable keys may live here. Privileged keys (`TECH_SUPABASE_SERVICE_KEY`,
 * `CRON_SECRET`, payment or AI keys) must never have a fallback.
 */
const DEV_SUPABASE_FALLBACK = {
  projectId: "idzvginmbesnkcaapehh",
  url: "https://idzvginmbesnkcaapehh.supabase.co",
  publishableKey: "sb_publishable_d3wpxtFYHdfVrQpgIIAwQg_Z1zMRnN_",
} as const;

function isProduction(): boolean {
  // Vite injects import.meta.env at build time. Default to NODE_ENV so the
  // server bundle (no Vite) still distinguishes dev from prod.
  try {
    const meta = import.meta as unknown as { env?: { PROD?: boolean; DEV?: boolean } } | undefined;
    if (meta?.env) {
      if (meta.env.PROD === true) return true;
      if (meta.env.DEV === true) return false;
    }
  } catch {
    // import.meta may be undefined in some runtimes; fall through.
  }
  if (typeof process !== "undefined" && process.env?.["NODE_ENV"] === "production") {
    return true;
  }
  return false;
}

export function supabaseDevFallback() {
  return isProduction() ? null : DEV_SUPABASE_FALLBACK;
}
