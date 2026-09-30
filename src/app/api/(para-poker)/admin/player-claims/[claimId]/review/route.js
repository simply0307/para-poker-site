import { requireOperator } from "@/modules/para-poker/lib/auth/operatorAuthorization";
import { tokenScopedClient } from "@/lib/eggs/consumerClient";
import { ConsumerError, consumerConfiguration, requireSameOrigin, readConsumerJson, onlyFields, uuid, boundedText, databaseError } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function POST(request, { params }) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    requireSameOrigin(request, consumerConfiguration());
    const body = await readConsumerJson(request); onlyFields(body, ["decision", "reason"]);
    if (!["approve", "reject"].includes(body.decision)) throw new ConsumerError(400, "Choose approve or reject.");
    const reason = boundedText(body.reason, "decision reason", 500, { required: true });
    const result = await tokenScopedClient(authorization.accessToken).rpc("review_para_poker_claim", { p_claim_id: uuid((await params).claimId), p_decision: body.decision, p_note: reason });
    if (result.error) throw databaseError(result.error);
    return Response.json({ claim: result.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return consumerFailure(error); }
}
