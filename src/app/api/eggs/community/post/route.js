import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import {
  ConsumerError,
  readConsumerJson,
  requireSameOrigin,
} from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import { communityEnabled, communityCommand } from "@/lib/community/core.mjs";
import { communityRepository } from "@/lib/community/repository.mjs";
export async function POST(request) {
  let context;
  try {
    if (!communityEnabled())
      throw new ConsumerError(503, "The community is not open yet.");
    context = consumerContext(request.cookies);
    requireSameOrigin(request, context.config);
    await requireEggsUser(context);
    return context.json(
      await communityRepository(context.client).write(
        communityCommand(await readConsumerJson(request)),
      ),
    );
  } catch (error) {
    return consumerFailure(error, context);
  }
}
