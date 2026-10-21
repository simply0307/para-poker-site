import { NextResponse } from "next/server";
import { publicConsumerClient } from "@/lib/eggs/consumerClient";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
export async function GET(request, { params }) {
  const { handle } = await params;
  const response = (body, status) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (!roomsEnabled())
    return response({ error: "Personal rooms are not available yet." }, 503);
  if (!/^[a-z0-9_]{3,30}$/u.test(handle))
    return response({ error: "Profile not found." }, 404);
  const client = publicConsumerClient();
  if (!client) return response({ error: "Profile not found." }, 404);
  try {
    const room = await roomRepository(client).publicRoom(handle);
    return room
      ? response({ room }, 200)
      : response({ error: "Profile not found." }, 404);
  } catch {
    return response({ error: "Profile temporarily unavailable." }, 503);
  }
}
