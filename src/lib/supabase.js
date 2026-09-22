import "server-only";
import { getServiceClient, getAuthClient } from "./supabase/server";

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
export const supabaseAuth = lazyClient(getAuthClient);
