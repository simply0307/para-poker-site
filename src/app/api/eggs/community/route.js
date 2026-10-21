import { NextResponse } from "next/server";
import { publicConsumerClient } from "@/lib/eggs/consumerClient";
import { communityEnabled, feedOptions } from "@/lib/community/core.mjs";
import { communityRepository } from "@/lib/community/repository.mjs";
export async function GET(request) {
  const json = (body, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (!communityEnabled())
    return json({ error: "The community is not open yet." }, 503);
  try {
    const options = feedOptions(new URL(request.url).searchParams),
      client = publicConsumerClient();
    if (!client)
      return json({ error: "The community is temporarily unavailable." }, 503);
    return json(await communityRepository(client).feed(options));
  } catch (error) {
    return json(
      {
        error:
          error.status === 400
            ? error.message
            : "The community is temporarily unavailable.",
      },
      error.status || 503,
    );
  }
}
