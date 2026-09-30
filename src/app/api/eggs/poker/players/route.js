import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { databaseError, boundedText } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function GET(request) {
  let context;
  try {
    context = consumerContext(request.cookies); await requireEggsUser(context);
    const search = boundedText(new URL(request.url).searchParams.get("q") || "", "search", 80);
    const result = await context.client.rpc("get_public_poker_players", { p_search: search });
    if (result.error) throw databaseError(result.error);
    return context.json({ players: result.data });
  } catch (error) { return consumerFailure(error, context); }
}
