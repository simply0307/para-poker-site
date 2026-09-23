import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { databaseError, requireSameOrigin, uuid } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function POST(request, { params }) {
  let context;
  try {
    context = consumerContext(request.cookies); requireSameOrigin(request, context.config); await requireEggsUser(context);
    const result = await context.client.rpc("withdraw_para_poker_claim", { p_claim_id: uuid((await params).claimId) });
    if (result.error) throw databaseError(result.error);
    return context.json({ claim: result.data });
  } catch (error) { return consumerFailure(error, context); }
}
