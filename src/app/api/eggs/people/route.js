import { NextResponse } from "next/server";
import { publicConsumerClient } from "@/lib/eggs/consumerClient";
import { communityEnabled, peopleOptions } from "@/lib/community/core.mjs";
import { communityRepository } from "@/lib/community/repository.mjs";
export async function GET(request) {
  const json = (body, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (!communityEnabled())
    return json({ error: "People discovery is not open yet." }, 503);
  try {
    const options = peopleOptions(new URL(request.url).searchParams),
      client = publicConsumerClient();
    if (!client)
      return json({ error: "People are temporarily unavailable." }, 503);
    return json(await communityRepository(client).people(options));
  } catch (error) {
    return json(
      {
        error:
          error.status === 400
            ? error.message
            : "People are temporarily unavailable.",
      },
      error.status || 503,
    );
  }
}
