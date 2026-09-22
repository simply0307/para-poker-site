import "server-only";
import { getAuthClient } from "@/lib/supabase/server";

// Authentication only: not operator access or ownership of a project record.
export async function verifyAccessToken(accessToken) {
  const { data, error } = await getAuthClient().auth.getUser(accessToken);
  if (error || !data?.user?.id) throw new Error("Authentication required.");
  return { id: data.user.id };
}
