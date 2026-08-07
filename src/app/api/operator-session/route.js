import { NextResponse } from "next/server";
import { OPERATOR_SESSION_COOKIE } from "@/lib/auth/operatorAuthorizationCore.mjs";
import { requireOperator } from "@/lib/auth/operatorAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicOperator(operator) {
  return {
    profileId: operator.profileId,
    role: operator.role,
    userId: operator.userId,
  };
}

export async function GET(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  return NextResponse.json({ operator: publicOperator(authorization.operator) });
}

export async function POST(request) {
  const authorization = await requireOperator(request, { allowCookie: false });
  if (!authorization.ok) return authorization.response;

  const response = NextResponse.json({ operator: publicOperator(authorization.operator) });
  response.cookies.set(OPERATOR_SESSION_COOKIE, authorization.accessToken, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(OPERATOR_SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
