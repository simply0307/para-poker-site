// Never enable fixture guidance for a hosted origin or hosted Auth server.
// Only local preview launchers set these values; deployment configuration does not.
const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);
const local = (url) => url.protocol === "http:" && loopback.has(url.hostname) && !url.username && !url.password && !url.search && !url.hash;
export function localPreviewAuth(env = process.env) {
  if (env.EGGS_LOCAL_PREVIEW_AUTH !== "true") return null;
  try {
    const site = new URL(env.EGGS_SITE_URL), auth = new URL(env.SUPABASE_URL), inbox = new URL(env.EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL);
    if (!local(site) || site.pathname !== "/" || !local(auth) || auth.pathname !== "/" || !local(inbox) || inbox.origin !== auth.origin || inbox.pathname !== "/__eggs_preview/inbox") return null;
    return { inboxUrl: inbox.href };
  } catch { return null; }
}
