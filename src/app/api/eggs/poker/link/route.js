import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { ConsumerError, databaseError, requireSameOrigin, readConsumerJson, onlyFields } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function PATCH(request) {
  let context;
  try {
    context = consumerContext(request.cookies); requireSameOrigin(request, context.config); await requireEggsUser(context);
    const body = await readConsumerJson(request); onlyFields(body, ["show_on_profile"]);
    if (typeof body.show_on_profile !== "boolean") throw new ConsumerError(400, "Choose whether to show your Poker summary.");
    const profile = await context.client.rpc("get_my_eggs_profile");
    if (profile.error) throw databaseError(profile.error);
    if (!profile.data?.[0]) throw new ConsumerError(409, "Create your EGGS profile first.");
    const result = await context.client.from("para_poker_profile_links").update(body).eq("profile_id", profile.data[0].id).select("profile_id,player_id,show_on_profile").maybeSingle();
    if (result.error) throw databaseError(result.error);
    if (!result.data) throw new ConsumerError(409, "A reviewed Poker association is required first.");
    return context.json({ link: result.data });
  } catch (error) { return consumerFailure(error, context); }
}
