import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

// Disposable HTTP fixtures only. This test never uses a real Supabase project,
// provider key, account, database, or network address other than loopback.
const operatorId = "11111111-1111-4111-8111-111111111111";
const viewerId = "22222222-2222-4222-8222-222222222222";
const playerId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const serviceSentinel = "eggs-http-test-service-secret-never-public";
const sections = ["players", "sessions", "standings", "moments", "articles"];
const generations = ["articles", "moments", "player-session-recaps", "profiles", "recaps", "social-captions", "standings"];

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function startApp(env) {
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(), env: { ...process.env, SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", ...env },
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => output += chunk);
  child.stderr.on("data", chunk => output += chunk);
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return { base, child };
    } catch { /* local server starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error(`Local app did not start: ${output}`);
}

async function stopApp(child) {
  if (child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
}

test("disconnected shell works, profile handles do not fabricate records, legacy redirects preserve queries", { timeout: 60000 }, async () => {
  const app = await startApp({});
  try {
    for (const route of ["/", "/para", "/music", "/library", "/profile", "/login"]) {
      const response = await fetch(app.base + route);
      assert.equal(response.status, 200, route);
      assert.match(await response.text(), /EGGS/);
    }
    const missing = await fetch(app.base + "/profile/somebody");
    assert.equal(missing.status, 404);
    const league = await fetch(app.base + "/para/poker/players");
    assert.match(await league.text(), /League records are unavailable/);
    for (const section of sections) {
      for (const suffix of ["", "/legacy-id"]) {
        const response = await fetch(`${app.base}/${section}${suffix}?season=S0&view=full`, { redirect: "manual" });
        assert.equal(response.status, 307);
        assert.equal(response.headers.get("location"), `/para/poker/${section}${suffix}?season=S0&view=full`);
      }
    }
    const admin = await fetch(app.base + "/admin", { redirect: "manual" });
    assert.equal(new URL(admin.headers.get("location"), app.base).pathname, "/operator-login");
    for (const route of generations) {
      const response = await fetch(`${app.base}/api/${route}/generate`, { method: "POST", body: "not-json" });
      assert.equal(response.status, 401, route);
    }
  } finally { await stopApp(app.child); }
});

test("league adapters render fixture dossiers and operator boundaries verify UUIDs without leaking credentials", { timeout: 90000 }, async () => {
  const requests = [];
  const fixture = createServer((request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    requests.push({ path: url.pathname, method: request.method });
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") {
      const token = request.headers.authorization;
      if (!["Bearer operator-token", "Bearer viewer-token"].includes(token)) {
        response.writeHead(401).end(JSON.stringify({ message: "Invalid token" }));
      } else response.end(JSON.stringify({ id: token === "Bearer operator-token" ? operatorId : viewerId, user_metadata: { role: "owner" } }));
      return;
    }
    const table = url.pathname.split("/").at(-1);
    let rows = [];
    if (table === "profiles") {
      const id = url.searchParams.get("auth_user_id")?.replace("eq.", "");
      rows = [{ id: "legacy-profile", auth_user_id: id, role: id === operatorId ? "owner" : "viewer" }];
    }
    if (table === "players") rows = [{ id: playerId, slug: "fixture-player", display_name: "Fixture Player", pokernow_name: "Fixture Player", created_at: "2026-08-01" }];
    if (table === "sessions") rows = [{ id: sessionId, session_code: "S0-001", session_number: 1, season_code: "S0", played_at: "2026-08-01", status: "completed" }];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.") || value.startsWith("ilike.")) rows = rows.filter(row => String(row[key]) === value.slice(value.indexOf(".") + 1));
    }
    response.end(JSON.stringify(rows));
  });
  const fixturePort = await listen(fixture);
  let app;
  try {
    app = await startApp({ SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_PUBLISHABLE_KEY: "test-publishable", SUPABASE_SERVICE_ROLE_KEY: serviceSentinel });
    const routes = ["/para/poker", ...sections.map(s => `/para/poker/${s}`), "/para/poker/players/fixture-player", "/para/poker/sessions/S0-001"];
    for (const route of routes) {
      const response = await fetch(app.base + route);
      const html = await response.text();
      assert.equal(response.status, 200, route);
      assert.ok(!html.includes(serviceSentinel), `${route} leaked service key`);
      if (route.endsWith("fixture-player")) assert.match(html, /Fixture Player/);
      if (route.endsWith("S0-001")) assert.match(html, /S0-001/);
      assert.ok(!/href="\/(?:players|sessions|standings|moments|articles)(?:\/|\")/.test(html), `${route} emits legacy public links`);
    }
    assert.equal((await fetch(app.base + "/para/poker/players/unknown")).status, 404);
    for (const route of generations) {
      const response = await fetch(`${app.base}/api/${route}/generate`, { method: "POST", headers: { Authorization: "Bearer viewer-token" }, body: "not-json" });
      assert.equal(response.status, 403, `${route}: user metadata must not authorize`);
    }
    for (const [token, status] of [["invalid", 401], ["viewer-token", 403], ["operator-token", 200]]) {
      const response = await fetch(app.base + "/api/operator-session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, status, token);
      assert.match(response.headers.get("cache-control"), /no-store/);
      if (status === 200) {
        assert.equal((await response.json()).operator.userId, operatorId);
        const cookie = response.headers.get("set-cookie");
        for (const attribute of [/^para_league_operator=operator-token;/, /; HttpOnly/i, /; Secure/i, /; SameSite=strict/i, /; Max-Age=3600/]) {
          assert.match(cookie, attribute);
        }
      }
    }
    const consumerCookie = await fetch(app.base + "/api/admin/homepage-settings", { headers: { Cookie: "eggs_session=operator-token" } });
    assert.equal(consumerCookie.status, 401);
    assert.ok(requests.every(request => request.method === "GET"), "A denied request reached a backend write");
  } finally {
    if (app) await stopApp(app.child);
    fixture.closeAllConnections();
    await new Promise(resolve => fixture.close(resolve));
  }
});

test("built browser assets contain no service credential access", async () => {
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const filename = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (filename.endsWith(".js")) {
        const source = await readFile(filename, "utf8");
        assert.ok(!source.includes("SUPABASE_SERVICE_ROLE_KEY"), filename);
        assert.ok(!source.includes(serviceSentinel), filename);
      }
    }
  }
  await walk(".next/static");
});
