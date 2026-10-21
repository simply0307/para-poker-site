import { consumerContext } from "@/lib/eggs/consumerClient";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import {
  ConsumerError,
  readConsumerJson,
  requireSameOrigin,
} from "@/lib/eggs/consumerCore.mjs";
import { requireHubEditor } from "@/lib/hub/server";
import { loreEnabled, loreCommand } from "@/lib/lore/core.mjs";
import { loreRepository } from "@/lib/lore/repository.mjs";
export async function POST(request) {
  let context;
  try {
    if (!loreEnabled()) throw new ConsumerError(503, "Lore is not open yet.");
    context = consumerContext(request.cookies);
    requireSameOrigin(request, context.config);
    await requireHubEditor(context);
    return context.json({
      entry: await loreRepository(context.client).save(
        loreCommand(await readConsumerJson(request, 98304)),
      ),
    });
  } catch (error) {
    return consumerFailure(error, context);
  }
}
