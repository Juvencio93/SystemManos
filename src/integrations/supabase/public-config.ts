/**
 * Public fallback used when a hosting provider does not inject build-time
 * Supabase variables. Publishable keys are intentionally safe for browser
 * clients; privileged keys must never be added here.
 */
export const SUPABASE_PUBLIC_FALLBACK = {
  projectId: "idzvginmbesnkcaapehh",
  url: "https://idzvginmbesnkcaapehh.supabase.co",
  publishableKey: "sb_publishable_d3wpxtFYHdfVrQpgIIAwQg_Z1zMRnN_",
} as const;
