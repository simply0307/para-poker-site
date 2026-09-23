import "server-only";
import { createClient } from "@supabase/supabase-js";

let serviceClient;

export function hasLeagueConfiguration() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_PUBLISHABLE_KEY);
}

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("League data is unavailable.");
  return serviceClient ??= createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

// Compatibility for the existing league repositories. Public league server
// rendering also uses this privileged client; it is not an EGGS profile API.
// Defer configuration until use so the independent shell works without secrets.
function lazyClient(getClient) {
  return new Proxy({}, {
    get(_target, property) {
      const client = getClient();
      const value = Reflect.get(client, property);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const supabase = lazyClient(getServiceClient);
