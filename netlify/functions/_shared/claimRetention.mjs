import { createClient } from "@supabase/supabase-js";

export async function runClaimRetention({ url, key, client, maxBatches = 4 }) {
  if (!client && (!url || !key)) throw new Error("Claim retention is missing its server configuration.");
  const database = client || createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(5000) }) },
  });
  let total = 0; let withdrawn = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const { data, error } = await database.rpc("run_poker_claim_retention");
    if (error || ![data?.redacted, data?.withdrawn].every(count => Number.isInteger(count) && count >= 0 && count <= 500)) throw new Error("Claim evidence redaction failed; inspect database availability and grants.");
    total += data.redacted; withdrawn += data.withdrawn;
    if (data.redacted < 500 && data.withdrawn < 500) return { redacted: total, withdrawn, batches: batch + 1 };
  }
  throw new Error("Claim retention batch limit reached; inspect the remaining backlog.");
}
