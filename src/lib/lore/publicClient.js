import "server-only";
import { createClient } from "@supabase/supabase-js";
// Public lore does not require consumer rollout or a visitor session.
export function publicLoreClient() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
}
