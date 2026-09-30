import { consumerContext } from "@/lib/eggs/consumerClient";
import { ConsumerError, consumerConfiguration, requireSameOrigin, readConsumerJson, onlyFields, boundedText } from "@/lib/eggs/consumerCore.mjs";
import { consumerFailure } from "@/lib/eggs/consumerResponse";

export async function POST(request) {
  let context;
  try {
    requireSameOrigin(request, consumerConfiguration());
    context = consumerContext(request.cookies);
    const body = await readConsumerJson(request);
    onlyFields(body, body.action === "email-link" ? ["action", "email"] : ["action", "email", "password"]);
    if (!["login", "register", "email-link"].includes(body.action)) throw new ConsumerError(400, "Choose a sign-in method or create an account.");
    const email = boundedText(body.email, "email", 254, { required: true }).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new ConsumerError(400, "Enter a valid email address.");
    if (body.action === "email-link") {
      const result = await context.client.auth.signInWithOtp({ email, options: {
        shouldCreateUser: false,
        emailRedirectTo: `${context.config.origin}/auth/callback`,
      } });
      if (result.error?.status === 429) throw new ConsumerError(429, "Too many attempts. Please wait before trying again.");
      if (result.error && !(result.error.status >= 400 && result.error.status < 500)) throw new ConsumerError(503, "Email sign-in is temporarily unavailable. Please try again later.");
      // A nonexistent account gets the same public reply as a dispatched link.
      // The SSR client stores the PKCE verifier; no session is issued here.
      return context.json({ message: "If you have an EGGS account, check your email for a sign-in link. Open it in this browser." }, 202);
    }
    const password = boundedText(body.password, "password", 128, { required: true });
    if (body.action === "register" && password.length < 8) throw new ConsumerError(400, "Enter a password of at least 8 characters.");
    const result = body.action === "register"
      ? await context.client.auth.signUp({ email, password, options: { emailRedirectTo: `${context.config.origin}/auth/callback` } })
      : await context.client.auth.signInWithPassword({ email, password });
    if (result.error) {
      if (result.error.status === 429) throw new ConsumerError(429, "Too many attempts. Please wait before trying again.");
      throw new ConsumerError(400, body.action === "login" ? "Could not sign in. Check your details and confirm your email." : "Could not create an account. Check your details or try signing in.");
    }
    if (body.action === "register") return context.json({ message: "Check your email to confirm your account. Open the link in this browser, then choose your handle." }, 202);
    const verified = await context.client.auth.getUser();
    if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.is_anonymous) {
      await context.client.auth.signOut({ scope: "local" }); context.clearCookies();
      throw new ConsumerError(403, "Confirm your email before continuing.");
    }
    return context.json({ redirect: "/profile" });
  } catch (error) { return consumerFailure(error, context); }
}
