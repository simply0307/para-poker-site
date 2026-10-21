import "server-only";
import { createClient } from "@supabase/supabase-js";
import { roomsEnabled } from "./core.mjs";
import { roomRepository } from "./repository.mjs";
export async function publicWorks() {
  if (!roomsEnabled()) return { works: [], unavailable: false };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)
    return { works: [], unavailable: true };
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  try {
    return { works: await roomRepository(client).works(), unavailable: false };
  } catch {
    return { works: [], unavailable: true };
  }
}
