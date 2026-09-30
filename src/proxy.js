import { NextResponse } from "next/server";
import { OPERATOR_SESSION_COOKIE } from "@/modules/para-poker/lib/auth/operatorAuthorizationCore.mjs";
import { refreshConsumerPageSession } from "@/lib/eggs/consumerProxy";

// Optimistic UI gate only. Every /api/admin handler performs the full token and
// profile authorization independently before invoking privileged repositories.
export async function proxy(request) {
  if (!request.nextUrl.pathname.startsWith("/admin")) return refreshConsumerPageSession(request);
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/operator-login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile", "/profile/claim"],
};
