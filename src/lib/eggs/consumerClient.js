import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CONSUMER_COOKIE, ConsumerError, consumerConfiguration, isConsumerCookie } from "./consumerCore.mjs";

export function consumerContext(cookieStore, onCookies) {
  const config = consumerConfiguration();
  if (!config) throw new ConsumerError(503, "EGGS accounts are not available yet.");
  const writes = new Map();
  const responseHeaders = new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer" });
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { name: CONSUMER_COOKIE, httpOnly: true, secure: config.secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 },
    cookies: {
      getAll: () => cookieStore.getAll().filter(cookie => isConsumerCookie(cookie.name)),
      setAll: (values, headers = {}) => {
        for (const value of values) {
          if (!isConsumerCookie(value.name)) continue;
          const cookie = { ...value, options: { ...value.options, httpOnly: true, secure: config.secure, sameSite: "lax", path: "/" } };
          if (value.name.includes("-code-verifier") && value.value) cookie.options.maxAge = 60 * 60;
          writes.set(value.name, cookie);
        }
        for (const [key, value] of Object.entries(headers)) responseHeaders.set(key, value);
        onCookies?.([...writes.values()]);
      },
    },
  });
  function finish(response) {
    for (const [key, value] of responseHeaders) response.headers.set(key, value);
    for (const cookie of writes.values()) response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }
  function clearCookies() {
    for (const cookie of [...cookieStore.getAll(), ...writes.values()].filter(value => isConsumerCookie(value.name))) {
      writes.set(cookie.name, { name: cookie.name, value: "", options: { path: "/", httpOnly: true, secure: config.secure, sameSite: "lax", maxAge: 0 } });
    }
  }
  return { client, config, finish, clearCookies, json: (data, status = 200) => finish(NextResponse.json(data, { status })) };
}

export async function pageConsumerContext() { return consumerContext(await cookies()); }

export function publicConsumerClient() {
  const config = consumerConfiguration();
  if (!config) return null;
  return createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

// Operator review also uses the operator's verified user token, never the
// privileged league data client, so the database rechecks role and RLS.
export function tokenScopedClient(token) {
  const config = consumerConfiguration();
  if (!config) throw new ConsumerError(503, "Claim review is not available yet.");
  return createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
