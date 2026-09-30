import "server-only";
import { ConsumerError, databaseError } from "./consumerCore.mjs";

// Authentication only. Never consult the operator table, guard or cookie.
export async function requireEggsUser(context) {
  const { data, error } = await context.client.auth.getUser();
  if (error || !data?.user?.id) throw new ConsumerError(401, "Sign in to EGGS to continue.");
  if (!data.user.email_confirmed_at || data.user.is_anonymous) throw new ConsumerError(403, "Confirm your email before creating an EGGS profile.");
  const active = await context.client.rpc("is_eggs_session_active");
  if (active.error) throw databaseError(active.error);
  if (!active.data) throw new ConsumerError(401, "Your EGGS session has ended. Please sign in again.");
  return { id: data.user.id };
}
