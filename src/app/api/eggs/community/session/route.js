import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { ConsumerError } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import { communityEnabled } from "@/lib/community/core.mjs";
import { communityRepository } from "@/lib/community/repository.mjs";
export async function GET(request) {
  let context;
  try {
    if (!communityEnabled())
      throw new ConsumerError(503, "The community is not open yet.");
    context = consumerContext(request.cookies);
    await requireEggsUser(context);
    return context.json({
      session: await communityRepository(context.client).session(),
    });
  } catch (error) {
    return consumerFailure(error, context);
  }
}
