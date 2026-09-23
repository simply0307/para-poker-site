/* global Netlify */
import { runClaimRetention } from "./_shared/claimRetention.mjs";

// No public URL invocation on Netlify. Disabled until the reviewed SQL and
// worker credentials are configured; enabling/deploying remains a separate step.
export default async function claimRetentionSchedule() {
  if (Netlify.env.get("EGGS_CLAIM_RETENTION_ENABLED") !== "true") return;
  const result = await runClaimRetention({
    url: Netlify.env.get("SUPABASE_URL"), key: Netlify.env.get("EGGS_RETENTION_SERVICE_KEY"),
  });
  console.log("EGGS claim evidence retention", result); // Counts only, no claim IDs or evidence.
}

export const config = { schedule: "@hourly" };
