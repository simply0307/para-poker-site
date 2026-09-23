import { consumerContext } from "@/lib/eggs/consumerClient";
import { ConsumerError, consumerConfiguration, requireSameOrigin } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function POST(request) {
  let context;
  try {
    requireSameOrigin(request, consumerConfiguration());
    context = consumerContext(request.cookies);
    const { error } = await context.client.auth.signOut({ scope: "local" });
    context.clearCookies();
    if (error) throw new ConsumerError(503, "This browser is signed out, but server session revocation could not be confirmed.");
    return context.json({ redirect: "/login", signedOut: true });
  } catch (error) { return consumerFailure(error, context); }
}
