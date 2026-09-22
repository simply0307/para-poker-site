import "server-only";
import { authorizeOperatorRequest } from "@/lib/auth/operatorAuthorizationCore.mjs";
import { supabase } from "@/lib/supabase";
import { verifyAccessToken } from "@/lib/auth/verifiedIdentity";

async function resolveProfile(authUserId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function requireOperator(request, options = {}) {
  return authorizeOperatorRequest(request, {
    verifyAccessToken,
    resolveProfile,
    ...options,
  });
}

export function withOperatorAuthorization(handler) {
  return async function authorizedAdminHandler(request, context) {
    const authorization = await requireOperator(request);
    if (!authorization.ok) return authorization.response;
    return handler(request, context, authorization.operator);
  };
}
