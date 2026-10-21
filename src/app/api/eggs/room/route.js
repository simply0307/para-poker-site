import { consumerContext } from "@/lib/eggs/consumerClient";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import {
  ConsumerError,
  readConsumerJson,
  requireSameOrigin,
} from "@/lib/eggs/consumerCore.mjs";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { roomsEnabled, roomCommand } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
async function handle(request, write) {
  let context;
  try {
    if (!roomsEnabled())
      throw new ConsumerError(503, "Personal rooms are not available yet.");
    context = consumerContext(request.cookies);
    if (write) requireSameOrigin(request, context.config);
    await requireEggsUser(context);
    const repository = roomRepository(context.client);
    const room = write
      ? await repository.save(roomCommand(await readConsumerJson(request)))
      : await repository.mine();
    return context.json({ room });
  } catch (error) {
    return consumerFailure(error, context);
  }
}
export async function GET(request) {
  return handle(request, false);
}
export async function PUT(request) {
  return handle(request, true);
}
