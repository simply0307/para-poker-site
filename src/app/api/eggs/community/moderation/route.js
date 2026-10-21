import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { ConsumerError, databaseError } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import { communityEnabled } from "@/lib/community/core.mjs";
export async function GET(request) {
  let context;
  try {
    if (!communityEnabled())
      throw new ConsumerError(503, "The community is not open yet.");
    context = consumerContext(request.cookies);
    await requireEggsUser(context);
    const { data, error } = await context.client.rpc(
      "get_eggs_community_moderation",
    );
    if (error) throw databaseError(error);
    return context.json(data);
  } catch (error) {
    return consumerFailure(error, context);
  }
}
