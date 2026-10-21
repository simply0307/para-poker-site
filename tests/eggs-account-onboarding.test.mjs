// Fresh-account integration: actual app, PostgreSQL 17 and PostgREST.
// Auth issuance, email confirmation and refresh transport are synthetic fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hasPostgrest } from "./helpers/localPostgrest.mjs";
import { communityHttpFixture } from "./helpers/communityHttpFixture.mjs";
import { CookieJar, startConsumerApp, stopConsumerApp } from "./helpers/consumerHttpFixture.mjs";
import { editableRoom } from "../src/lib/rooms/core.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";

test("Fresh player: signup/PKCE to private/public page with real PG17/PostgREST", { skip: !hasPostgres || !hasPostgrest, timeout: 180000 }, async (t) => {
  const cleanup = [];
  t.after(async () => { for (const fn of cleanup.reverse()) await fn(); });
  const fixture = await communityHttpFixture({ after: (fn) => cleanup.push(fn) });
  const app = await startConsumerApp(fixture.env);
  cleanup.push(() => stopConsumerApp(app));
  async function request(route, { jar, method = "GET", body } = {}) {
    const response = await fetch(app.base + route, {
      method, redirect: "manual",
      headers: { ...(jar ? { Cookie: jar.header() } : {}), ...(method !== "GET" ? { Origin: app.base } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    jar?.absorb(response); return response;
  }
  const own = new CookieJar(), other = new CookieJar();
  const email = "fresh-player@fixture.invalid", handle = "fresh_player";
  const bio = "FRESH_PRIVATE_BIO_SENTINEL", note = "FRESH_PRIVATE_NOTE_SENTINEL";
  let profile, room, post;
  await t.test("confirmation is required; wrong-browser PKCE fails; same-browser synthetic callback creates a live identity", async () => {
    assert.equal((await request("/api/eggs/profile", { jar: own })).status, 401);
    const register = await request("/api/eggs/auth", { jar: own, method: "POST", body: { action: "register", email, password: "fixture-password" } });
    assert.equal(register.status, 202, await register.clone().text());
    assert.ok([...own.values.keys()].some((name) => name.includes("code-verifier")));
    assert.equal((await request("/api/eggs/profile", { jar: own, method: "POST", body: { handle } })).status, 401);
    assert.equal((await fixture.db.admin.query("select count(*)::int n from public.eggs_profiles")).rows[0].n, 0);
    const wrong = await request("/auth/callback?code=fixture-confirm-code");
    assert.match(wrong.headers.get("location"), /confirmation=failed/u);
    const callback = await request("/auth/callback?code=fixture-confirm-code&next=https://attacker.invalid", { jar: own });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), app.base + "/profile");
    assert.equal((await (await request("/api/eggs/profile", { jar: own })).json()).profile, null);
    const mirrored = (await fixture.db.admin.query("select email_confirmed_at,is_anonymous from auth.users where email=$1", [email])).rows[0];
    assert.ok(mirrored.email_confirmed_at); assert.equal(mirrored.is_anonymous, false);
  });
  await t.test("new player chooses a permanent handle; page starts private and room starts empty", async () => {
    assert.match(await (await request("/profile", { jar: own })).text(), /Choose your handle/u);
    const created = await request("/api/eggs/profile", { jar: own, method: "POST", body: { handle, display_name: "Fresh player", bio } });
    assert.equal(created.status, 201, await created.clone().text()); profile = (await created.json()).profile;
    assert.equal(profile.visibility, "private"); assert.ok(!Object.hasOwn(profile, "auth_user_id"));
    assert.equal((await request("/api/eggs/profile", { jar: own, method: "POST", body: { handle } })).status, 200);
    assert.equal((await request("/api/eggs/profile", { jar: own, method: "POST", body: { handle: "different_player" } })).status, 409);
    assert.equal((await request("/profile/" + handle)).status, 404);
    assert.equal((await request("/profile/" + handle, { jar: own })).status, 404);
    const mine = await request("/api/eggs/room", { jar: own });
    assert.equal(mine.status, 200, await mine.clone().text()); room = (await mine.json()).room;
    assert.equal(room.revision, 0); assert.equal(room.visibility, "private"); assert.deepEqual(room.modules.showcase, []);
    assert.match(await (await request("/profile/edit", { jar: own })).text(), /Edit My Page/u);
    assert.deepEqual((await (await request("/api/eggs/people?q=" + handle)).json()).people, []);
  });
  await t.test("atomic first save persists appearance, interests and board; stale save preserves winner", async () => {
    const value = editableRoom(room);
    value.appearance = { theme: "after-hours", wallpaper: "stars", cover: "midnight", avatar: "spark", accent: "rose", stamps: ["maker", "night-owl"] };
    value.expression.favorite_project_ids = [bootstrapProjects[0].id];
    value.expression.affiliation = "maker";
    value.expression.featured_note = note;
    value.showcase = bootstrapProjects.slice(0, 2).map((project) => ({ type: "project", id: project.id }));
    const saved = await request("/api/eggs/room", { jar: own, method: "PUT", body: { revision: 0, value } });
    assert.equal(saved.status, 200, await saved.clone().text()); room = (await saved.json()).room;
    assert.equal(room.revision, 1); assert.equal(room.appearance.theme, "after-hours"); assert.equal(room.modules.showcase.length, 2);
    assert.deepEqual((await (await request("/api/eggs/room", { jar: own })).json()).room, room);
    assert.equal((await request("/api/eggs/room", { jar: own, method: "PUT", body: { revision: 0, value } })).status, 409);
    assert.deepEqual((await (await request("/api/eggs/room", { jar: own })).json()).room, room);
    assert.equal((await request("/api/eggs/profile", { jar: own, method: "PATCH", body: { bio: "Revision bypass" } })).status, 409);
  });
  await t.test("public opt-in uses narrow room projection in API, HTML/hydration and discovery", async () => {
    const value = editableRoom(room);
    value.profile.visibility = "public"; value.module_visibility.bio = false; value.module_visibility.featured_note = false;
    const saved = await request("/api/eggs/room", { jar: own, method: "PUT", body: { revision: room.revision, value } });
    assert.equal(saved.status, 200, await saved.clone().text()); room = (await saved.json()).room;
    const publicResponse = await request("/api/eggs/rooms/" + handle); assert.equal(publicResponse.status, 200);
    const publicRoom = (await publicResponse.json()).room;
    assert.ok(!Object.hasOwn(publicRoom.modules, "bio")); assert.ok(!Object.hasOwn(publicRoom.modules, "featured_note"));
    const html = await (await request("/profile/" + handle)).text();
    for (const hidden of [bio, note, fixture.users.get(email).id]) assert.ok(!html.includes(hidden));
    assert.match(html, /Fresh player/u);
    const people = await (await request("/api/eggs/people?q=" + handle)).json();
    assert.deepEqual(people.people.map((person) => person.handle), [handle]);
    const session = (await (await request("/api/eggs/community/session", { jar: own })).json()).session;
    assert.equal(session.profile.id, profile.id); assert.equal(session.profile.visibility, "public");
    const shared = await request("/api/eggs/community/post", { jar: own, method: "POST", body: { action: "create", body: "A fresh player's first public post." } });
    assert.equal(shared.status, 200, await shared.clone().text()); post = (await shared.json()).post;
    assert.ok((await (await request("/api/eggs/community")).json()).posts.some((row) => row.id === post.id));
  });
  await t.test("fresh user token reaches actual PostgREST owner RPC; anonymous/unrelated tokens cannot read private owner projection", async () => {
    const token = [...fixture.tokens].find(([, actor]) => actor.user.email === email && actor.active)[0];
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const direct = await fetch(fixture.rest.url + "/rpc/get_my_eggs_room", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fixture.rest.sign(claims) }, body: "{}" });
    assert.equal(direct.status, 200); assert.equal((await direct.json()).modules.bio, bio);
    assert.equal((await fixture.rest.request("/rpc/get_my_eggs_room", { method: "POST", body: {} })).status, 401);
    assert.equal((await fixture.rest.request("/rpc/get_my_eggs_room", { method: "POST", body: {}, user: "bob" })).status, 403);
    assert.equal((await fixture.rest.request("/eggs_profiles?select=bio")).status, 401);
    const login = await request("/api/eggs/auth", { jar: other, method: "POST", body: { action: "login", email: "bob@fixture.invalid", password: "fixture-password" } });
    assert.equal(login.status, 200);
    assert.equal((await request("/api/eggs/room", { jar: other })).status, 403);
    const forged = editableRoom(room); forged.profile.id = profile.id;
    assert.equal((await request("/api/eggs/room", { jar: own, method: "PUT", body: { revision: room.revision, value: forged } })).status, 400);
  });
  await t.test("private opt-out removes player page, people entry and authored feed content; owner editing remains", async () => {
    const value = editableRoom(room); value.profile.visibility = "private";
    const saved = await request("/api/eggs/room", { jar: own, method: "PUT", body: { revision: room.revision, value } });
    assert.equal(saved.status, 200); room = (await saved.json()).room;
    assert.equal((await request("/profile/" + handle)).status, 404);
    assert.equal((await request("/api/eggs/rooms/" + handle)).status, 404);
    assert.deepEqual((await (await request("/api/eggs/people?q=" + handle)).json()).people, []);
    assert.ok(!(await (await request("/api/eggs/community")).json()).posts.some((row) => row.id === post.id));
    assert.equal((await request("/api/eggs/community/posts/" + post.id)).status, 404);
    assert.equal((await request("/api/eggs/room", { jar: own })).status, 200);
  });
  await t.test("logout invalidates a copied session; existing confirmed account can sign in again without replaying signup", async () => {
    const copied = own.clone();
    assert.equal((await request("/api/eggs/auth/logout", { jar: own, method: "POST" })).status, 200);
    assert.equal((await request("/api/eggs/profile", { jar: own })).status, 401);
    assert.equal((await request("/api/eggs/room", { jar: copied })).status, 401);
    const login = await request("/api/eggs/auth", { jar: own, method: "POST", body: { action: "login", email, password: "fixture-password" } });
    assert.equal(login.status, 200);
    assert.equal((await (await request("/api/eggs/room", { jar: own })).json()).room.profile.handle, handle);
    assert.equal((await fixture.db.admin.query("select count(*)::int n from public.eggs_profiles where handle=$1", [handle])).rows[0].n, 1);
  });
});
