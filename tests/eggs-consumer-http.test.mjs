import assert from "node:assert/strict";
import test from "node:test";
import { CookieJar, consumerFixture, consumerIds, fixturePublishableKey, fixtureServiceKey, startConsumerApp, stopConsumerApp } from "./helpers/consumerHttpFixture.mjs";

test("consumer HTTP flow verifies Auth, scopes RLS requests, separates operators and never exposes session secrets", { timeout: 120000 }, async t => {
  const fixture = await consumerFixture(); let app;
  t.after(async () => { await stopConsumerApp(app); await fixture.close(); });
  app = await startConsumerApp({ SUPABASE_URL: fixture.url, SUPABASE_PUBLISHABLE_KEY: fixturePublishableKey, SUPABASE_SERVICE_ROLE_KEY: fixtureServiceKey });
  async function request(path, { jar, method = "GET", body, headers = {}, origin = app.base } = {}) {
    const response = await fetch(app.base + path, { method, redirect: "manual", headers: {
      ...(jar ? { Cookie: jar.header() } : {}), ...(method === "GET" ? {} : { Origin: origin }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    jar?.absorb(response); return response;
  }
  async function login(name) {
    const jar = new CookieJar();
    const response = await request("/api/eggs/auth", { jar, method: "POST", body: { action: "login", email: `${name}@fixture.invalid`, password: "fixture-password" } });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("cache-control"), /private.*no-store/u);
    const cookies = response.headers.getSetCookie(); assert.ok(cookies.length);
    for (const cookie of cookies) { assert.match(cookie, /^eggs_consumer/u); assert.match(cookie, /HttpOnly/u); assert.match(cookie, /SameSite=lax/iu); assert.doesNotMatch(cookie, /para_league_operator/u); }
    return jar;
  }

  assert.match(await (await request("/login")).text(), /Create account/u);
  assert.equal((await request("/profile")).status, 307);
  for (const path of ["/api/eggs/profile", "/api/eggs/poker/claims", "/api/eggs/poker/players"]) assert.equal((await request(path)).status, 401, path);
  assert.equal((await request("/api/eggs/profile", { headers: { Cookie: "para_league_operator=pretend", Authorization: "Bearer pretend" } })).status, 401);
  assert.equal((await request("/api/eggs/auth", { method: "POST", origin: "https://attacker.invalid", body: { action: "login", email: "alice@fixture.invalid", password: "fixture-password" } })).status, 403);
  assert.equal((await request("/api/eggs/auth", { method: "POST", headers: { "Content-Type": "text/plain" }, body: {} })).status, 415);
  assert.equal((await request("/api/eggs/auth", { method: "POST", body: { action: "login", email: "alice@fixture.invalid", password: "bad-password" } })).status, 400);

  const signup = new CookieJar();
  const registration = await request("/api/eggs/auth", { jar: signup, method: "POST", body: { action: "register", email: "new@fixture.invalid", password: "fixture-password" } });
  assert.equal(registration.status, 202, await registration.clone().text());
  assert.ok([...signup.values.keys()].some(name => name.includes("code-verifier")));
  assert.ok(fixture.requests.find(entry => entry.path === "/auth/v1/signup").body.code_challenge);
  const callback = await request("/auth/callback?code=fixture-confirm-code&next=https://attacker.invalid", { jar: signup });
  assert.equal(new URL(callback.headers.get("location")).pathname, "/profile", await callback.clone().text());
  assert.equal(new URL(callback.headers.get("location")).origin, app.base);
  assert.match(callback.headers.get("cache-control"), /no-store/u);
  const badCallback = await request("/auth/callback?code=fixture-confirm-code");
  assert.match(badCallback.headers.get("location"), /confirmation=failed/u);

  const alice = await login("alice");
  const bob = await login("bob");
  assert.equal((await (await request("/api/eggs/profile", { jar: alice })).json()).profile, null);
  assert.match(await (await request("/profile", { jar: alice })).text(), /Choose your handle/u);
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "POST", body: { handle: "Alice" } })).status, 400);
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "POST", body: { handle: "alice", auth_user_id: consumerIds.bob } })).status, 400);
  const created = await request("/api/eggs/profile", { jar: alice, method: "POST", body: { handle: "alice", display_name: "Alice Example", bio: "A small profile." } });
  assert.equal(created.status, 201, await created.clone().text());
  const profile = (await created.json()).profile;
  assert.equal(profile.visibility, "private"); assert.ok(!Object.hasOwn(profile, "auth_user_id"));
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "POST", body: { handle: "alice" } })).status, 200, "Creation retry returns existing profile");
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "POST", body: { handle: "different" } })).status, 409);
  assert.equal((await request("/profile/alice")).status, 404);
  assert.equal((await request("/profile/alice", { jar: alice })).status, 404, "Owner cookie cannot make private profile URL public");
  assert.equal((await request("/api/eggs/profile", { jar: bob, method: "POST", body: { handle: "alice" } })).status, 409);
  assert.equal((await request("/api/eggs/profile", { jar: bob, method: "POST", body: { handle: "bob" } })).status, 201);
  assert.equal((await request("/api/eggs/profile", { jar: bob, method: "PATCH", body: { id: profile.id, bio: "stolen" } })).status, 400);
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "PATCH", body: { handle: "renamed" } })).status, 400);
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "PATCH", origin: "https://attacker.invalid", body: { bio: "bad" } })).status, 403);
  assert.equal((await request("/api/eggs/profile", { jar: alice, method: "PATCH", body: { visibility: "public", bio: "<script>fixture()</script>" } })).status, 200);
  const publicHtml = await (await request("/profile/alice")).text();
  assert.match(publicHtml, /Alice Example/u); assert.ok(!publicHtml.includes("<script>fixture()</script>"));
  assert.ok(!publicHtml.includes(consumerIds.alice)); assert.ok(!publicHtml.includes("Test Competitor"));

  const players = await request("/api/eggs/poker/players?q=Test", { jar: alice });
  assert.equal((await players.json()).players[0].player_id, consumerIds.player);
  assert.match(await (await request("/profile/claim", { jar: alice })).text(), /Supporting evidence stays attached/u);
  const claimResponse = await request("/api/eggs/poker/claims", { jar: alice, method: "POST", body: { player_id: consumerIds.player, evidence_note: "Private proof from fixture" } });
  assert.equal(claimResponse.status, 201, await claimResponse.clone().text());
  const claim = (await claimResponse.json()).claim;
  const retry = await request("/api/eggs/poker/claims", { jar: alice, method: "POST", body: { player_id: consumerIds.player, evidence_note: "Do not replace prior evidence" } });
  assert.equal(retry.status, 200); assert.equal((await retry.json()).claim.id, claim.id);
  assert.equal(fixture.claims[0].evidence_note, "Private proof from fixture");
  assert.deepEqual((await (await request("/api/eggs/poker/claims", { jar: bob })).json()).claims, []);
  assert.equal((await request("/api/eggs/poker/claims", { jar: bob, method: "POST", body: { player_id: consumerIds.player, status: "approved" } })).status, 400);
  assert.equal((await request(`/api/eggs/poker/claims/${claim.id}/withdraw`, { jar: bob, method: "POST" })).status, 403);
  assert.equal((await request("/api/admin/player-claims", { jar: alice })).status, 401);
  const bobSession = [...fixture.tokens].find(([, value]) => value.user.id === consumerIds.bob)[0];
  assert.equal((await request("/api/admin/player-claims", { headers: { Authorization: `Bearer ${bobSession}` } })).status, 403);
  const operatorSession = fixture.issue(fixture.users.get("operator@fixture.invalid"));
  const operator = new CookieJar(); operator.values.set("para_league_operator", operatorSession.access_token);
  assert.equal((await request("/api/eggs/profile", { jar: operator })).status, 401);
  const queueResponse=await request("/api/admin/player-claims", { jar: operator });
  assert.equal(queueResponse.status,200);
  assert.deepEqual(Object.keys(await queueResponse.json()),["claims"]);
  assert.equal((await request(`/api/admin/player-claims/${claim.id}/review`, { jar: operator, method: "POST", body: { decision: "approve", reason: "Verified ownership", reviewer_id: consumerIds.bob } })).status, 400);
  const approval = await request(`/api/admin/player-claims/${claim.id}/review`, { jar: operator, method: "POST", body: { decision: "approve", reason: "Verified ownership" } });
  assert.equal(approval.status, 200, await approval.clone().text());
  assert.ok(!(await (await request("/profile/alice")).text()).includes("Test Competitor"));
  assert.equal((await request("/api/eggs/poker/link", { jar: bob, method: "PATCH", body: { show_on_profile: true } })).status, 409);
  assert.equal((await request("/api/eggs/poker/link", { jar: alice, method: "PATCH", body: { show_on_profile: true, player_id: consumerIds.otherPlayer } })).status, 400);
  assert.equal((await request("/api/eggs/poker/link", { jar: alice, method: "PATCH", body: { show_on_profile: true } })).status, 200);
  const summary = await (await request("/profile/alice")).text();
  assert.match(summary, /Test Competitor/u); assert.ok(summary.includes(`/para/poker/players/${consumerIds.player}`));
  assert.ok(!summary.includes("Private proof from fixture")); assert.ok(!summary.includes(consumerIds.alice));
  await request("/api/eggs/profile", { jar: alice, method: "PATCH", body: { visibility: "private" } });
  assert.equal((await request("/profile/alice")).status, 404);

  // Expired access cookies trigger server refresh and persist new cookies.
  const encoded = decodeURIComponent(bob.values.get("eggs_consumer"));
  const session = JSON.parse(Buffer.from(encoded.slice("base64-".length), "base64url").toString());
  session.expires_at = Math.floor(Date.now() / 1000) - 10;
  bob.values.set("eggs_consumer", `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`);
  const refreshed = await request("/api/eggs/profile", { jar: bob });
  assert.equal(refreshed.status, 200, await refreshed.clone().text()); assert.ok(refreshed.headers.getSetCookie().length);
  assert.ok(fixture.requests.some(entry => entry.query === "?grant_type=refresh_token"));
  const refreshedSession=JSON.parse(Buffer.from(decodeURIComponent(bob.values.get("eggs_consumer")).slice("base64-".length),"base64url").toString());
  refreshedSession.expires_at=Math.floor(Date.now()/1000)-10;
  bob.values.set("eggs_consumer",`base64-${Buffer.from(JSON.stringify(refreshedSession)).toString("base64url")}`);
  const refreshedPage=await request("/profile",{jar:bob});
  assert.equal(refreshedPage.status,200);assert.match(await refreshedPage.text(),/@bob/u);
  assert.ok(refreshedPage.headers.getSetCookie().length,"Page proxy must persist refreshed cookies");
  const stale = alice.clone(); alice.values.set("para_league_operator", operatorSession.access_token);
  const logout = await request("/api/eggs/auth/logout", { jar: alice, method: "POST" });
  assert.equal(logout.status, 200); assert.ok(![...alice.values.keys()].some(name => name.startsWith("eggs_consumer")));
  assert.equal(alice.values.get("para_league_operator"), operatorSession.access_token);
  assert.equal((await request("/api/eggs/profile", { jar: stale })).status, 401, "Revoked session rejects a replayed cookie");
  assert.equal((await request("/api/admin/player-claims", { jar: alice })).status, 200, "Consumer logout leaves independent operator session intact");

  const dataRequests = fixture.requests.filter(entry => entry.path.startsWith("/rest/v1/") && !entry.path.endsWith("/profiles"));
  assert.ok(dataRequests.length > 15);
  assert.ok(dataRequests.every(entry => entry.key === fixturePublishableKey), "Consumer and review operations must use the publishable key and request token");
  const reviewRequest = dataRequests.find(entry => entry.path.endsWith("/review_para_poker_claim"));
  assert.equal(reviewRequest.token, operatorSession.access_token);
  assert.ok(!app.logs().includes("Private proof from fixture"));
});

test("HTTPS configuration sets Secure cookies and confines confirmation redirects to the configured origin",{timeout:60000},async t=>{
  const fixture=await consumerFixture();let app;
  t.after(async()=>{await stopConsumerApp(app);await fixture.close();});
  app=await startConsumerApp({SUPABASE_URL:fixture.url,SUPABASE_PUBLISHABLE_KEY:fixturePublishableKey,EGGS_SITE_URL:"https://eggs.example"});
  const response=await fetch(app.base+"/api/eggs/auth",{method:"POST",headers:{Origin:"https://eggs.example","Content-Type":"application/json"},body:JSON.stringify({action:"login",email:"alice@fixture.invalid",password:"fixture-password"})});
  assert.equal(response.status,200);
  for(const cookie of response.headers.getSetCookie())assert.match(cookie,/; Secure/iu);
  const mismatch=await fetch(app.base+"/api/eggs/auth",{method:"POST",headers:{Origin:app.base,"Content-Type":"application/json"},body:"{}"});
  assert.equal(mismatch.status,403);
});
