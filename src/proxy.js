import { NextResponse } from "next/server";
import { OPERATOR_SESSION_COOKIE } from "@/lib/auth/operatorAuthorizationCore.mjs";

// Optimistic UI gate only. Every /api/admin handler performs the full token and
// profile authorization independently before invoking privileged repositories.
export function proxy(request) {
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) {
    const login = new URL("/operator-login", request.url);
    if (request.nextUrl.pathname === "/admin/newsroom") {
      login.searchParams.set("division", request.nextUrl.searchParams.get("division")==="poker" ? "poker" : "suitfire");
      const match=request.nextUrl.searchParams.get("match");
      if (match && /^[a-zA-Z0-9-]{1,100}$/.test(match)) login.searchParams.set("match",match);
    }
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
