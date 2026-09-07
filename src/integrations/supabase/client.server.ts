// Server-side Supabase client with service role key - bypasses RLS.
// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_FALLBACK } from "./public-config";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Creates a custom fetcher for the Supabase client that ensures correct header handling.
 * Specifically prevents "JWT issued at future" errors when using opaque sb_secret_ keys
 * by stripping any accidentally inherited Authorization headers.
 */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);

    // Security: Only send Authorization if it's NOT an opaque key.
    // If it IS an opaque key (sb_secret_...), we must ONLY use the 'apikey' header.
    if (isNewSupabaseApiKey(supabaseKey)) {
      headers.delete("Authorization");
    } else if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${supabaseKey}`);
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || SUPABASE_PUBLIC_FALLBACK.url;
  const TECH_SUPABASE_SERVICE_KEY = process.env["TECH_SUPABASE_SERVICE_KEY"];

  if (!SUPABASE_URL || !TECH_SUPABASE_SERVICE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!TECH_SUPABASE_SERVICE_KEY ? ["TECH_SUPABASE_SERVICE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, TECH_SUPABASE_SERVICE_KEY, {
    global: {
      fetch: createSupabaseFetch(TECH_SUPABASE_SERVICE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
