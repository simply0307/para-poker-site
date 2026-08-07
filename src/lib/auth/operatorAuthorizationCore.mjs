export const OPERATOR_SESSION_COOKIE = "para_league_operator";
export const ALLOWED_OPERATOR_ROLES = new Set(["admin", "owner"]);

function jsonError(status, error) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function cookieValue(header, name) {
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return "";
}

export function bearerTokenFromRequest(request, { allowBearer = true, allowCookie = true } = {}) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (allowBearer && match?.[1]) return match[1].trim();
  if (!allowCookie) return "";
  return request.cookies?.get?.(OPERATOR_SESSION_COOKIE)?.value
    || cookieValue(request.headers.get("cookie"), OPERATOR_SESSION_COOKIE);
}

export async function authorizeOperatorRequest(
  request,
  { verifyAccessToken, resolveProfile, allowBearer = true, allowCookie = true },
) {
  const accessToken = bearerTokenFromRequest(request, { allowBearer, allowCookie });
  if (!accessToken) return { ok: false, response: jsonError(401, "Authentication required.") };

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    return { ok: false, response: jsonError(401, "Authentication required.") };
  }
  if (!user?.id) return { ok: false, response: jsonError(401, "Authentication required.") };

  let profile;
  try {
    profile = await resolveProfile(user.id);
  } catch {
    return { ok: false, response: jsonError(503, "Operator authorization is unavailable.") };
  }
  if (!profile || profile.auth_user_id !== user.id || !ALLOWED_OPERATOR_ROLES.has(profile.role)) {
    return { ok: false, response: jsonError(403, "Operator access required.") };
  }

  return {
    ok: true,
    accessToken,
    operator: {
      profileId: profile.id,
      role: profile.role,
      userId: user.id,
    },
  };
}

export function isPrivilegedAdminApiPath(pathname) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function isAdminWorkspacePath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
