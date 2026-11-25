import { NextResponse } from "next/server";
import { OPERATOR_SESSION_COOKIE } from "@/lib/auth/operatorAuthorizationCore.mjs";

// Optimistic UI gate only. Every /api/admin handler performs the full token and
// profile authorization independently before invoking privileged repositories.
export function proxy(request) {
  if (!request.cookies.get(OPERATOR_SESSION_COOKIE)?.value) {
    const login = new URL("/operator-login", request.url);
    const {pathname,searchParams}=request.nextUrl;
    const division=pathname==="/admin/suitfire"?"suitfire":searchParams.get("division");
    if(["suitfire","poker"].includes(division)) login.searchParams.set("division",division);
    if(pathname==="/admin/imports") login.searchParams.set("view","imports");
    else if(pathname==="/admin/suitfire" && ["reports","records"].includes(searchParams.get("view"))) login.searchParams.set("view",searchParams.get("view"));
    const match=searchParams.get("match");
    if(match && /^[a-zA-Z0-9-]{1,100}$/.test(match)) login.searchParams.set("match",match);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
