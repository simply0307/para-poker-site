import { NextResponse } from "next/server";
import { publicConsumerClient } from "@/lib/eggs/consumerClient";
import { uuid } from "@/lib/eggs/consumerCore.mjs";
import { communityEnabled } from "@/lib/community/core.mjs";
import { communityRepository } from "@/lib/community/repository.mjs";
export async function GET(request, { params }) {
  const json = (body, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (!communityEnabled())
    return json({ error: "The community is not open yet." }, 503);
  try {
    const id = uuid((await params).id),
      client = publicConsumerClient();
    if (!client) return json({ error: "Conversation unavailable." }, 503);
    const thread = await communityRepository(client).post(id);
    return thread
      ? json(thread)
      : json({ error: "Conversation not found." }, 404);
  } catch (error) {
    return json({ error: "Conversation unavailable." }, error.status || 503);
  }
}
