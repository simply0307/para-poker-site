import { NextResponse } from "next/server";
import { consumerContext } from "./consumerClient";
import { consumerConfiguration } from "./consumerCore.mjs";

export async function refreshConsumerPageSession(request) {
  if (!consumerConfiguration()) return NextResponse.next();
  const context = consumerContext(request.cookies, values => {
    for (const { name, value } of values) request.cookies.set(name, value);
  });
  // Server components cannot persist refreshed cookies. Update both the
  // forwarded request and browser response before rendering the private page.
  try { await context.client.auth.getUser(); } catch { /* page guard fails closed */ }
  return context.finish(NextResponse.next({ request }));
}
