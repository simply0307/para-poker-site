export const CONSUMER_COOKIE = "eggs_consumer";
export const PROFILE_COLUMNS = "id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at";
export const isConsumerCookie = name => name === CONSUMER_COOKIE || name.startsWith(`${CONSUMER_COOKIE}.`) || name === `${CONSUMER_COOKIE}-code-verifier` || name.startsWith(`${CONSUMER_COOKIE}-code-verifier.`);

export class ConsumerError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function consumerConfiguration(env = process.env) {
  if (env.EGGS_CONSUMER_ENABLED !== "true" || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.EGGS_SITE_URL) return null;
  try {
    const site = new URL(env.EGGS_SITE_URL);
    if (site.username || site.password || site.pathname !== "/" || site.search || site.hash) return null;
    if (site.protocol !== "https:" && !(site.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname))) return null;
    return { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY, origin: site.origin, secure: site.protocol === "https:" };
  } catch { return null; }
}

export function requireSameOrigin(request, config) {
  if (!config) throw new ConsumerError(503, "EGGS accounts are not available yet.");
  // Required even for login: prevent account-switching CSRF. No forwarded-host
  // inference or caller-controlled redirect destinations.
  if (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ConsumerError(403, "Please submit this request from EGGS.");
  }
}

export async function readConsumerJson(request) {
  if (!/^application\/json(?:;|$)/iu.test(request.headers.get("content-type") || "")) throw new ConsumerError(415, "Send JSON data.");
  const reader = request.body?.getReader();
  let size = 0; const chunks = [];
  if (!reader) throw new ConsumerError(400, "A request body is required.");
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new ConsumerError(413, "This request is too large."); }
    chunks.push(value);
  }
  try {
    const buffer = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ConsumerError(400, "Invalid request data."); }
}

export function onlyFields(value, allowed) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ConsumerError(400, "This request contains fields that cannot be changed.");
}
export function boundedText(value, name, max, { required = false } = {}) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new ConsumerError(400, `Check ${name}.`);
  return value;
}
export function profileInput(value, creating = false) {
  onlyFields(value, creating ? ["handle", "display_name", "bio", "visibility"] : ["display_name", "bio", "visibility"]);
  const result = {};
  if (creating) {
    if (typeof value.handle !== "string" || value.handle.length < 3 || value.handle.length > 30 || /[^a-z0-9_]/u.test(value.handle)) throw new ConsumerError(400, "Use 3–30 lowercase letters, numbers or underscores for your handle.");
    result.handle = value.handle;
  }
  if (creating || Object.hasOwn(value, "display_name")) result.display_name = boundedText(value.display_name || (creating ? value.handle : ""), "display name", 80, { required: true }).trim();
  if (Object.hasOwn(value, "bio")) result.bio = boundedText(value.bio, "bio", 500);
  if (Object.hasOwn(value, "visibility")) {
    if (!["private", "public"].includes(value.visibility)) throw new ConsumerError(400, "Choose public or private visibility.");
    result.visibility = value.visibility;
  }
  if (!Object.keys(result).length) throw new ConsumerError(400, "Choose a field to update.");
  return result;
}
export function uuid(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)) throw new ConsumerError(400, "Choose a valid record.");
  return value;
}
export function databaseError(error) {
  if (["23505", "55000"].includes(error?.code)) return new ConsumerError(409, "This handle or association is unavailable, or the request has already been resolved. Refresh and try again.");
  if (["23514", "23502", "23503", "22023", "22P02"].includes(error?.code)) return new ConsumerError(400, "Check the submitted fields. Reserved handles and invalid records cannot be used.");
  if (error?.code === "42501") return new ConsumerError(403, "You do not have access to this action.");
  return new ConsumerError(503, "EGGS accounts are temporarily unavailable. Please try again later.");
}
