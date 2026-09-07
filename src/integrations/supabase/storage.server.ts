import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_FALLBACK } from "./public-config";
import type { Database } from "./types";

/**
 * Supabase client dedicated to Storage operations.
 * Bypasses custom fetch logic that strips Authorization headers.
 * Used exclusively for generating signed URLs and managing private buckets.
 */
function createSupabaseStorageAdmin() {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || SUPABASE_PUBLIC_FALLBACK.url;
  const TECH_SUPABASE_SERVICE_KEY = process.env["TECH_SUPABASE_SERVICE_KEY"];

  if (!SUPABASE_URL || !TECH_SUPABASE_SERVICE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!TECH_SUPABASE_SERVICE_KEY ? ["TECH_SUPABASE_SERVICE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s) for Storage Admin: ${missing.join(", ")}.`;
    console.error(`[StorageAdmin] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, TECH_SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: undefined,
    },
  });
}

let _supabaseStorageAdmin: ReturnType<typeof createSupabaseStorageAdmin> | undefined;

/**
 * Proxy for the Storage Admin client.
 * SECURITY: Only use this for trusted server-side operations, never expose to client code.
 * Load inside server handlers: const { supabaseStorageAdmin } = await import("@/integrations/supabase/storage.server");
 */
export const supabaseStorageAdmin = new Proxy({} as ReturnType<typeof createSupabaseStorageAdmin>, {
  get(_, prop, receiver) {
    if (!_supabaseStorageAdmin) _supabaseStorageAdmin = createSupabaseStorageAdmin();
    return Reflect.get(_supabaseStorageAdmin, prop, receiver);
  },
});
