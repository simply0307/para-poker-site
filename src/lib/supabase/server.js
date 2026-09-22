import "server-only";
import { createClient } from "@supabase/supabase-js";

const authOptions = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
};
let serviceClient;
let authClient;

export function hasLeagueConfiguration() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function getAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Authentication is unavailable.");
  return authClient ??= createClient(url, key, { auth: authOptions });
}

// Consumer profile queries must use a user-scoped client and RLS instead.
export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("League data is unavailable.");
  return serviceClient ??= createClient(url, key, { auth: authOptions });
}
