import "server-only";
import { NextResponse } from "next/server";
import { ConsumerError } from "./consumerCore.mjs";

export function consumerFailure(error, context) {
  const safe = error instanceof ConsumerError ? error : new ConsumerError(503, "EGGS accounts are temporarily unavailable. Please try again later.");
  const response = NextResponse.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  return context ? context.finish(response) : response;
}
