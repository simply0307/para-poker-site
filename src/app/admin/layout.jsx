import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_SESSION_COOKIE } from "@/lib/auth/operatorAuthorizationCore.mjs";
import { requireOperator } from "@/lib/auth/operatorAuthorization";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(OPERATOR_SESSION_COOKIE)?.value;
  if (!accessToken) redirect("/operator-login");

  const request = new Request("https://internal.invalid/admin", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const authorization = await requireOperator(request, { allowCookie: false });
  if (!authorization.ok) {
    redirect(authorization.response.status === 401 ? "/operator-login" : "/operator-denied");
  }

  return children;
}
