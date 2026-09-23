import { createServer } from "node:http";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

export const consumerIds = {
  alice: "60000000-0000-4000-8000-000000000001", bob: "60000000-0000-4000-8000-000000000002", operator: "60000000-0000-4000-8000-000000000003",
  player: "70000000-0000-4000-8000-000000000001", otherPlayer: "70000000-0000-4000-8000-000000000002",
};
export const fixtureServiceKey = "consumer-fixture-service-key-never-public";
export const fixturePublishableKey = "consumer-fixture-publishable";
export async function listen(server) { server.listen(0, "127.0.0.1"); await once(server, "listening"); return server.address().port; }

export async function startConsumerApp(env = {}, fixedPort) {
  const reservation = createServer(); const port = fixedPort || await listen(reservation);
  if (!fixedPort) await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", EGGS_CONSUMER_ENABLED: "true", EGGS_SITE_URL: base, ...env },
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", chunk => { logs += chunk; }); child.stderr.on("data", chunk => { logs += chunk; });
  for (let count = 0; count < 120; count++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) return { base, child, logs: () => logs }; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  child.kill(); throw new Error(logs);
}
export async function stopConsumerApp(app) {
  if (app?.child.exitCode === null) { const ended = once(app.child, "exit"); app.child.kill(); await ended; }
}
export class CookieJar {
  values = new Map();
  absorb(response) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"); const split = pair.indexOf("=");
      const name = pair.slice(0, split); const value = pair.slice(split + 1);
      if (!value) this.values.delete(name); else this.values.set(name, value);
    }
  }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join("; "); }
  clone() { const copy = new CookieJar(); copy.values = new Map(this.values); return copy; }
}

// Transport/SDK fixture, never a substitute for the real PostgreSQL RLS suite.
// All identities, keys, passwords, sessions and records are synthetic.
export async function consumerFixture() {
  const requests = []; const users = new Map(); const tokens = new Map(); const refreshTokens = new Map();
  const profiles = []; const claims = []; const links = []; const handles = new Set();
  const players = [
    { player_id: consumerIds.player, display_name: "Test Competitor", season_code: "S0", rank: 2, points: 75, sessions_played: 4 },
    { player_id: consumerIds.otherPlayer, display_name: "Second Competitor", season_code: null, rank: null, points: null, sessions_played: null },
  ];
  let serial = 10; let signupChallenge; let signupUser;
  const makeId = () => `80000000-0000-4000-8000-${String(++serial).padStart(12,"0")}`;
  for (const name of ["alice", "bob", "operator"]) users.set(`${name}@fixture.invalid`, { id: consumerIds[name], email: `${name}@fixture.invalid`, email_confirmed_at: "2026-09-01T00:00:00Z", is_anonymous: false, user_metadata: { role: "owner" } });
  function issue(user) {
    const now = Math.floor(Date.now() / 1000);
    const access_token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, session_id: makeId(), role: "authenticated", iat: now, exp: now + 3600 })).toString("base64url"), "Zml4dHVyZXNpZ25hdHVyZQ"].join(".");
    const refresh_token = `fixture-refresh-${++serial}`;
    const session = { access_token, refresh_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user };
    tokens.set(access_token, { user, active: true }); refreshTokens.set(refresh_token, { user, active: true, access_token });
    return session;
  }
  const dto = claim => ({ ...claim, handle: profiles.find(profile => profile.id === claim.claimant_profile_id)?.handle || null,
    player_name: players.find(player => player.player_id === claim.player_id)?.display_name, holds: claim.holds || [], hold_active: false });
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    // The existing operator sign-in talks to Auth from the browser. Permit
    // only the disposable loopback app origin, like hosted Auth's CORS layer.
    if (/^http:\/\/127\.0\.0\.1:\d+$/u.test(request.headers.origin || "")) {
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
      response.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    const url = new URL(request.url, "http://fixture.invalid"); let body = {};
    try {
      let text = ""; for await (const chunk of request) text += chunk; if (text) body = JSON.parse(text);
      const token = (request.headers.authorization || "").replace(/^Bearer /u, "");
      const actor = tokens.get(token); const user = actor?.user;
      requests.push({ path: url.pathname, method: request.method, key: request.headers.apikey, token, body, query: url.search });
      const send = (data, status = 200) => { response.writeHead(status).end(JSON.stringify(data)); };
      const fail = (code, status = 400) => send({ code, message: "Synthetic backend detail must not leak" }, status);
      if (url.pathname === "/auth/v1/signup") {
        signupChallenge = body.code_challenge;
        signupUser = { id: makeId(), email: body.email, email_confirmed_at: null, is_anonymous: false, identities: [] };
        users.set(body.email, signupUser); return send(signupUser);
      }
      if (url.pathname === "/auth/v1/token") {
        const grant = url.searchParams.get("grant_type");
        if (grant === "password") {
          const account = users.get(body.email);
          if (!account || body.password !== "fixture-password") return fail("invalid_credentials", 400);
          return send(issue(account));
        }
        if (grant === "pkce") {
          if (body.auth_code !== "fixture-confirm-code" || createHash("sha256").update(body.code_verifier || "").digest("base64url") !== signupChallenge) return fail("invalid_grant");
          signupUser.email_confirmed_at = new Date().toISOString(); return send(issue(signupUser));
        }
        if (grant === "refresh_token") {
          const previous = refreshTokens.get(body.refresh_token);
          if (!previous?.active) return fail("refresh_token_not_found");
          previous.active = false; return send(issue(previous.user));
        }
      }
      if (url.pathname === "/auth/v1/user") return user ? send(user) : fail("bad_jwt", 401);
      if (url.pathname === "/auth/v1/logout") {
        if (actor) actor.active = false;
        for (const session of refreshTokens.values()) if (session.access_token === token) session.active = false;
        response.writeHead(204).end(); return;
      }
      const name = url.pathname.split("/").at(-1);
      const own = profiles.find(profile => profile.owner === user?.id);
      const operator = user?.id === consumerIds.operator;
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        if (name === "is_eggs_session_active") return send(Boolean(actor?.active && user?.email_confirmed_at));
        if (name === "get_my_eggs_profile") return send(own && actor?.active ? [Object.fromEntries(Object.entries(own).filter(([key]) => key !== "owner"))] : []);
        if (name === "get_public_poker_players") return send(players.filter(player => (!body.p_player_id || body.p_player_id === player.player_id) && player.display_name.toLowerCase().includes((body.p_search || "").toLowerCase())));
        if (name === "get_my_poker_claims") return send(claims.filter(claim => claim.claimant_profile_id === own?.id).map(dto));
        if (name === "get_poker_claim_review_queue") return operator ? send(claims.filter(claim => !body.p_status || body.p_status === "all" || claim.status === body.p_status).map(dto)) : fail("42501", 403);
        if (name === "get_poker_claim_retention_status") return operator ? send({ last_run_at: new Date().toISOString(), last_redacted_count: 0, total_redacted_count: 0, overdue_count: 0, unreviewed_overdue_count: 0 }) : fail("42501", 403);
        const claim = claims.find(value => value.id === body.p_claim_id);
        if (name === "review_para_poker_claim") {
          if (!operator || !actor.active) return fail("42501", 403);
          if (!claim) return fail("55000");
          if (claim.status !== "pending") return fail("55000");
          if (body.p_decision === "approve" && links.some(link => link.player_id === claim.player_id || link.profile_id === claim.claimant_profile_id)) return fail("23505", 409);
          claim.status = body.p_decision === "approve" ? "approved" : "rejected";
          claim.decision_reason = body.p_note; claim.resolved_at = claim.reviewed_at = new Date().toISOString();
          claim.evidence_expires_at = new Date(Date.now() + 90 * 86400000).toISOString();
          if (claim.status === "approved") links.push({ profile_id: claim.claimant_profile_id, player_id: claim.player_id, show_on_profile: false });
          return send({ claim_id: claim.id, status: claim.status, profile_id: claim.claimant_profile_id, player_id: claim.player_id });
        }
        if (name === "withdraw_para_poker_claim") {
          if (!claim || claim.claimant_profile_id !== own?.id) return fail("42501", 403);
          if (!["pending", "withdrawn"].includes(claim.status)) return fail("55000");
          claim.status = "withdrawn"; return send({ claim_id: claim.id, status: claim.status });
        }
        if (name === "set_poker_claim_evidence_hold") return operator ? send(dto(claim)) : fail("42501", 403);
        return fail("PGRST202", 404);
      }
      function rows(data) {
        const eq = [...url.searchParams].filter(([, value]) => value.startsWith("eq."));
        let filtered = data.filter(row => eq.every(([key, value]) => String(row[key]) === value.slice(3)));
        const fields = url.searchParams.get("select");
        if (fields && fields !== "*") filtered = filtered.map(row => Object.fromEntries(fields.split(",").map(key => [key, row[key]])));
        if ((request.headers.accept || "").includes("vnd.pgrst.object")) return filtered.length === 1 ? send(filtered[0]) : fail("PGRST116", 406);
        return send(filtered);
      }
      if (name === "profiles") {
        if (request.headers.apikey !== fixtureServiceKey || request.method !== "GET") return fail("42501", 403);
        const id = url.searchParams.get("auth_user_id")?.slice(3);
        return rows([{ id: "90000000-0000-4000-8000-000000000001", auth_user_id: id, role: id === consumerIds.operator ? "owner" : "viewer" }]);
      }
      if (name === "eggs_public_profiles") return rows(profiles.filter(profile => profile.visibility === "public"));
      if (name === "para_poker_public_profile_links") return rows(links.filter(link => link.show_on_profile && profiles.some(profile => profile.id === link.profile_id && profile.visibility === "public")));
      if (request.headers.apikey === fixtureServiceKey) return fail("42501", 403);
      if (!user || !actor.active) return fail("42501", 403);
      if (name === "eggs_profiles") {
        if (request.method === "POST") {
          if (handles.has(body.handle) || own) return fail("23505", 409);
          if (["admin", "poker", "para"].includes(body.handle)) return fail("23514");
          const row = { id: makeId(), owner: user.id, handle: body.handle, display_name: body.display_name, bio: body.bio || "", avatar_path: null, visibility: body.visibility || "private", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          handles.add(row.handle); profiles.push(row); return rows([row]);
        }
        if (request.method === "PATCH" && own) { Object.assign(own, body); return rows([own]); }
        return rows(own ? [own] : []);
      }
      if (name === "para_poker_player_claims") {
        if (request.method === "POST") {
          if (!own) return fail("42501", 403);
          if (!players.some(player => player.player_id === body.player_id)) return fail("23503");
          if (claims.some(claim => claim.claimant_profile_id === own.id && claim.player_id === body.player_id && claim.status === "pending")) return fail("23505", 409);
          const claim = { id: makeId(), claimant_profile_id: own.id, player_id: body.player_id, status: "pending", evidence_note: body.evidence_note, submitted_at: new Date().toISOString(), decision_reason: null };
          claims.push(claim); return rows([claim]);
        }
        return rows(claims.filter(claim => claim.claimant_profile_id === own?.id));
      }
      if (name === "para_poker_profile_links") {
        const link = links.find(value => value.profile_id === own?.id);
        if (request.method === "PATCH" && link) Object.assign(link, body);
        return rows(link ? [link] : []);
      }
      return rows([]);
    } catch (error) { response.writeHead(500).end(JSON.stringify({ message: error.message })); }
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}`, users, tokens, profiles, claims, links, requests, issue,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}
