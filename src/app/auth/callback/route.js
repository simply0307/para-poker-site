import { NextResponse } from "next/server";
import { consumerContext } from "@/lib/eggs/consumerClient";
import { consumerConfiguration } from "@/lib/eggs/consumerCore.mjs";

export async function GET(request) {
  const config = consumerConfiguration();
  const origin = config?.origin || new URL(request.url).origin;
  const failure = () => {
    const response = NextResponse.redirect(new URL("/login?confirmation=failed", origin), 303);
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  let context;
  try {
    if (!config) return failure();
    context = consumerContext(request.cookies);
    const code = new URL(request.url).searchParams.get("code");
    if (!code || code.length > 2048) return context.finish(failure());
    const exchanged = await context.client.auth.exchangeCodeForSession(code);
    const verified = exchanged.error ? null : await context.client.auth.getUser();
    if (!verified || verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.is_anonymous) return context.finish(failure());
    return context.finish(NextResponse.redirect(new URL("/profile", config.origin), 303));
  } catch { return context ? context.finish(failure()) : failure(); }
}
