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
    const claims = await client.rpc("get_poker_claim_review_queue", { p_status: status, p_offset: offset });
    if (claims.error) throw databaseError(claims.error);
    return Response.json({ claims: claims.data }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
  } catch (error) { return consumerFailure(error); }
}
