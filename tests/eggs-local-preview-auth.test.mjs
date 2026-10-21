import test from "node:test";
import assert from "node:assert/strict";
import { localPreviewAuth } from "../src/lib/eggs/localPreview.mjs";
import { consumerFixture } from "./helpers/consumerHttpFixture.mjs";
const enabled = { EGGS_LOCAL_PREVIEW_AUTH: "true", EGGS_SITE_URL: "http://127.0.0.1:3114", SUPABASE_URL: "http://127.0.0.1:45123", EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: "http://127.0.0.1:45123/__eggs_preview/inbox" };
test("fixture guidance requires explicit opt-in and exact loopback Auth/inbox/app origins", () => {
  assert.deepEqual(localPreviewAuth(enabled), { inboxUrl: enabled.EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL });
  for (const override of [
    { EGGS_LOCAL_PREVIEW_AUTH: undefined }, { EGGS_LOCAL_PREVIEW_AUTH: "false" },
    { EGGS_SITE_URL: "https://eggs.example" }, { SUPABASE_URL: "https://production.supabase.co" },
    { EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: "https://production.supabase.co/__eggs_preview/inbox" },
    { EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: "http://127.0.0.1:9999/__eggs_preview/inbox" },
    { EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: "http://127.0.0.1:45123/other" },
    { EGGS_LOCAL_PREVIEW_AUTH_INBOX_URL: "http://127.0.0.1:45123/__eggs_preview/inbox?token=secret" },
    { EGGS_SITE_URL: "http://user:secret@127.0.0.1:3114" },
  ]) assert.equal(localPreviewAuth({ ...enabled, ...override }), null);
});
test("local inbox contains only the newest synthetic confirmation and escapes its address", async (t) => {
  const fixture = await consumerFixture(); t.after(() => fixture.close());
  let inbox = await fetch(fixture.previewInboxUrl); assert.equal(inbox.status, 200);
  assert.match(await inbox.text(), /No pending local confirmation/u);
  const signup = await fetch(fixture.url + "/auth/v1/signup?redirect_to=" + encodeURIComponent("http://127.0.0.1:3114/auth/callback"), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "<script>fixture</script>@fixture.invalid", password: "fixture-password", code_challenge: "synthetic" }),
  }); assert.equal(signup.status, 200);
  inbox = await fetch(fixture.previewInboxUrl);
  assert.match(inbox.headers.get("cache-control"), /no-store/u);
  assert.match(inbox.headers.get("content-security-policy"), /default-src 'none'/u);
  const html = await inbox.text();
  assert.ok(html.includes("&lt;script&gt;fixture&lt;/script&gt;@fixture.invalid"));
  assert.ok(!html.includes("<script>")); assert.ok(!html.includes("fixture-password")); assert.ok(!html.includes("access_token"));
  assert.match(html, /http:\/\/127\.0\.0\.1:3114\/auth\/callback\?code=fixture-confirm-code/u);
  assert.equal((await fetch(fixture.previewInboxUrl, { method: "POST" })).status, 405);
});
test("synthetic inbox refuses hosted callback targets", async (t) => {
  const fixture = await consumerFixture(); t.after(() => fixture.close());
  await fetch(fixture.url + "/auth/v1/signup?redirect_to=" + encodeURIComponent("https://eggs.example/auth/callback"), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "test@fixture.invalid", password: "fixture-password", code_challenge: "synthetic" }),
  });
  const html = await (await fetch(fixture.previewInboxUrl)).text();
  assert.match(html, /No pending local confirmation/u); assert.ok(!html.includes("https://eggs.example"));
});
