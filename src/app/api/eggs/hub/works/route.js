import { consumerContext } from "@/lib/eggs/consumerClient";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import {
  ConsumerError,
  readConsumerJson,
  requireSameOrigin,
} from "@/lib/eggs/consumerCore.mjs";
import { requireHubEditor } from "@/lib/hub/server";
import { roomsEnabled, workCommand } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
export async function POST(request) {
  let context;
  try {
    if (!roomsEnabled())
      throw new ConsumerError(503, "Works are not available yet.");
    context = consumerContext(request.cookies);
    requireSameOrigin(request, context.config);
    await requireHubEditor(context);
    const work = await roomRepository(context.client).saveWork(
      workCommand(await readConsumerJson(request)),
    );
    return context.json({ work });
  } catch (error) {
    return consumerFailure(error, context);
  }
}
