import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ENV_ERROR } from "@/lib/user-messages";

/**
 * Client navigateur : session synchronisée avec les cookies (compatible middleware).
 * Variables : NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(SUPABASE_ENV_ERROR);
  }
  return createBrowserClient(url, key);
}
