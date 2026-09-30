import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { ConsumerError, databaseError, onlyFields, uuid, boundedText, requireSameOrigin, readConsumerJson } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function GET(request) {
  let context;
  try {
    context = consumerContext(request.cookies); await requireEggsUser(context);
    const result = await context.client.rpc("get_my_poker_claims");
    if (result.error) throw databaseError(result.error);
    return context.json({ claims: result.data });
  } catch (error) { return consumerFailure(error, context); }
}
export async function POST(request) {
  let context;
  try {
    context = consumerContext(request.cookies); requireSameOrigin(request, context.config); await requireEggsUser(context);
    const body = await readConsumerJson(request); onlyFields(body, ["player_id", "evidence_note"]);
    const player = uuid(body.player_id);
    const evidence = body.evidence_note === undefined ? null : boundedText(body.evidence_note, "supporting evidence", 2000).trim() || null;
    const profile = await context.client.rpc("get_my_eggs_profile");
    if (profile.error) throw databaseError(profile.error);
    if (!profile.data?.[0]) throw new ConsumerError(409, "Create your EGGS profile first.");
    const result = await context.client.from("para_poker_player_claims").insert({ player_id: player, evidence_note: evidence }).select("id,status,player_id").single();
    if (result.error) {
      if (result.error.code === "23505") {
        const previous = await context.client.rpc("get_my_poker_claims");
        const pending = previous.data?.find(claim => claim.player_id === player && claim.status === "pending");
        if (pending) return context.json({ claim: { id: pending.id, status: pending.status, player_id: pending.player_id } });
      }
      throw databaseError(result.error);
    }
    return context.json({ claim: result.data }, 201);
  } catch (error) { return consumerFailure(error, context); }
}
