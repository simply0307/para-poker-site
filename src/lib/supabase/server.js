import "server-only";
import { createClient } from "@supabase/supabase-js";

const authOptions = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
};
let authClient;

// Shared authentication only. No service-role client or project-role lookup.
export function getAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Authentication is unavailable.");
  return authClient ??= createClient(url, key, { auth: authOptions });
}
