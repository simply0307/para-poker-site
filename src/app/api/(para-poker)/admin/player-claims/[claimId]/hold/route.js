import { requireOperator } from "@/modules/para-poker/lib/auth/operatorAuthorization";
import { tokenScopedClient } from "@/lib/eggs/consumerClient";
import { ConsumerError, consumerConfiguration, requireSameOrigin, readConsumerJson, onlyFields, uuid, boundedText, databaseError } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function POST(request, { params }) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    requireSameOrigin(request, consumerConfiguration());
    const body = await readConsumerJson(request); onlyFields(body, ["until", "reason"]);
    if (body.until !== null && (typeof body.until !== "string" || !Number.isFinite(Date.parse(body.until)))) throw new ConsumerError(400, "Choose a hold expiry or release the hold.");
    const result = await tokenScopedClient(authorization.accessToken).rpc("set_poker_claim_evidence_hold", {
      p_claim_id: uuid((await params).claimId), p_until: body.until === null ? null : new Date(body.until).toISOString(),
      p_reason: boundedText(body.reason, "hold reason", 500, { required: true }),
    });
    if (result.error) throw databaseError(result.error);
    return Response.json({ claim: result.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return consumerFailure(error); }
}
