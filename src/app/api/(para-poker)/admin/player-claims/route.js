import { requireOperator } from "@/modules/para-poker/lib/auth/operatorAuthorization";
import { tokenScopedClient } from "@/lib/eggs/consumerClient";
import { ConsumerError, databaseError } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function GET(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const offset = Number(url.searchParams.get("offset") || 0);
    if (!["pending", "approved", "rejected", "withdrawn", "all"].includes(status) || !Number.isInteger(offset) || offset < 0 || offset > 100000) throw new ConsumerError(400, "Choose a valid review filter.");
    const client = tokenScopedClient(authorization.accessToken);
    const [claims, retention] = await Promise.all([
      client.rpc("get_poker_claim_review_queue", { p_status: status, p_offset: offset }),
      client.rpc("get_poker_claim_retention_status"),
    ]);
    if (claims.error || retention.error) throw databaseError(claims.error || retention.error);
    const needsAttention = !retention.data.last_run_at || Date.now() - Date.parse(retention.data.last_run_at) > 2 * 60 * 60 * 1000 || retention.data.overdue_count > 0 || retention.data.unreviewed_overdue_count > 0;
    return Response.json({ claims: claims.data, retention: { ...retention.data, needs_attention: needsAttention } }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
  } catch (error) { return consumerFailure(error); }
}
