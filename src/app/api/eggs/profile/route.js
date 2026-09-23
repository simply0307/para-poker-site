import { consumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { ConsumerError, PROFILE_COLUMNS, databaseError, profileInput, requireSameOrigin, readConsumerJson } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

async function ownProfile(client) {
  const { data, error } = await client.rpc("get_my_eggs_profile");
  if (error) throw databaseError(error);
  return data?.[0] || null;
}
export async function GET(request) {
  let context;
  try {
    context = consumerContext(request.cookies); await requireEggsUser(context);
    return context.json({ profile: await ownProfile(context.client) });
  } catch (error) { return consumerFailure(error, context); }
}
export async function POST(request) {
  let context;
  try {
    context = consumerContext(request.cookies); requireSameOrigin(request, context.config); await requireEggsUser(context);
    const input = profileInput(await readConsumerJson(request), true);
    const existing = await ownProfile(context.client);
    if (existing) {
      if (existing.handle !== input.handle) throw new ConsumerError(409, "Your account already has a profile. Handles cannot be changed.");
      return context.json({ profile: existing });
    }
    const result = await context.client.from("eggs_profiles").insert(input).select(PROFILE_COLUMNS).single();
    if (result.error) {
      if (result.error.code === "23505") {
        const raced = await ownProfile(context.client);
        if (raced?.handle === input.handle) return context.json({ profile: raced });
      }
      throw databaseError(result.error);
    }
    return context.json({ profile: result.data }, 201);
  } catch (error) { return consumerFailure(error, context); }
}
export async function PATCH(request) {
  let context;
  try {
    context = consumerContext(request.cookies); requireSameOrigin(request, context.config); await requireEggsUser(context);
    const input = profileInput(await readConsumerJson(request));
    const own = await ownProfile(context.client);
    if (!own) throw new ConsumerError(409, "Create your EGGS profile first.");
    const result = await context.client.from("eggs_profiles").update(input).eq("id", own.id).select(PROFILE_COLUMNS).single();
    if (result.error) throw databaseError(result.error);
    return context.json({ profile: result.data });
  } catch (error) { return consumerFailure(error, context); }
}
