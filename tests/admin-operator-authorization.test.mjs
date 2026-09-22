import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ALLOWED_OPERATOR_ROLES,
  OPERATOR_SESSION_COOKIE,
  authorizeOperatorRequest,
  isAdminWorkspacePath,
  isPrivilegedAdminApiPath,
} from "../src/lib/auth/operatorAuthorizationCore.mjs";

const OPERATOR_USER_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SERVER_SECRET_SENTINEL = "must-never-leak";

function dependencies({ role = "owner", userId = OPERATOR_USER_ID } = {}) {
  return {
    verifyAccessToken: async (token) => {
      if (token === "operator-token") return { id: userId };
      if (token === "viewer-token") return { id: VIEWER_USER_ID };
      throw new Error(`invalid token ${SERVER_SECRET_SENTINEL}`);
    },
    resolveProfile: async (verifiedUserId) => ({
      id: "profile-1",
      auth_user_id: verifiedUserId,
      role: verifiedUserId === VIEWER_USER_ID ? "viewer" : role,
      service_secret: SERVER_SECRET_SENTINEL,
    }),
  };
}

async function authorize(url, init = {}, overrides = {}) {
  return authorizeOperatorRequest(new Request(url, init), {
    ...dependencies(),
    ...overrides,
  });
}

test("anonymous EGGS preview and commit requests are 401", async () => {
  for (const endpoint of ["preview", "commit"]) {
    const result = await authorize(`https://league.test/api/admin/imports/eggs-sessions/${endpoint}`, { method: "POST" });
    assert.equal(result.ok, false);
    assert.equal(result.response.status, 401);
  }
});

test("an authenticated non-operator is 403", async () => {
  const result = await authorize("https://league.test/api/admin/homepage-settings", {
    headers: { Authorization: "Bearer viewer-token" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 403);
});

test("malformed cookies fail closed and consumer sessions do not grant operator access", async () => {
  for (const cookie of [`${OPERATOR_SESSION_COOKIE}=%zz`, "eggs_session=operator-token"]) {
    const result = await authorize("https://league.test/api/admin/rules", { headers: { Cookie: cookie } });
    assert.equal(result.response.status, 401);
  }
});

test("operator lookup outage fails closed", async () => {
  const result = await authorize("https://league.test/api/admin/rules", { headers: { Authorization: "Bearer operator-token" } }, {
    resolveProfile: async () => { throw new Error("database unavailable"); },
  });
  assert.equal(result.response.status, 503);
});

test("existing admin and owner roles are authorized by stable auth user ID", async () => {
  assert.deepEqual([...ALLOWED_OPERATOR_ROLES].sort(), ["admin", "owner"]);
  for (const role of ALLOWED_OPERATOR_ROLES) {
    const result = await authorize("https://league.test/api/admin/homepage-settings", {
      headers: { Authorization: "Bearer operator-token" },
    }, dependencies({ role }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.operator, {
      profileId: "profile-1",
      role,
      userId: OPERATOR_USER_ID,
    });
  }
});

test("spoofed email, role, profile, query, and body fields grant no access", async () => {
  const result = await authorize("https://league.test/api/admin/imports/eggs-sessions/preview?role=owner&email=owner@example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Operator-Role": "owner", "X-Operator-Email": "owner@example.test" },
    body: JSON.stringify({ role: "owner", email: "owner@example.test", auth_user_id: OPERATOR_USER_ID }),
  });
  assert.equal(result.response.status, 401);
});

test("profile must be linked to the exact verified Supabase user ID", async () => {
  const result = await authorize("https://league.test/api/admin/rules", {
    headers: { Authorization: "Bearer operator-token" },
  }, {
    ...dependencies(),
    resolveProfile: async () => ({ id: "profile-1", role: "owner", auth_user_id: VIEWER_USER_ID }),
  });
  assert.equal(result.response.status, 403);
});

test("HttpOnly session cookie can authenticate while dataset bearer token remains separate", async () => {
  const result = await authorize("https://league.test/api/admin/newsroom/dataset/export", {
    headers: {
      Authorization: "Bearer independent-dataset-token",
      Cookie: `${OPERATOR_SESSION_COOKIE}=operator-token`,
    },
  }, { ...dependencies(), allowBearer: false });
  assert.equal(result.ok, true);
});

test("authorization failures never include verifier or profile secrets", async () => {
  const result = await authorize("https://league.test/api/admin/homepage-settings", {
    headers: { Authorization: "Bearer bad-token" },
  });
  const body = await result.response.text();
  assert.equal(result.response.status, 401);
  assert.equal(body.includes(SERVER_SECRET_SENTINEL), false);
});

test("every exported /api/admin method invokes the shared guard", async () => {
  const root = path.resolve("src/app/api/admin");
  const routes = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.name === "route.js") routes.push(target);
    }
  }
  await walk(root);
  assert.ok(routes.length >= 20);
  for (const route of routes) {
    const source = await readFile(route, "utf8");
    const exportedMethods = source.match(/export async function (?:GET|POST|PUT|PATCH|DELETE)\b/g) || [];
    const guards = source.match(/await requireOperator\(/g) || [];
    assert.equal(guards.length, exportedMethods.length, `${path.relative(root, route)} is not fully guarded`);
  }
});

test("public league surfaces stay outside the admin boundary", () => {
  for (const pathname of ["/", "/para/poker/players", "/para/poker/players/player-1", "/para/poker/sessions/S0-001", "/para/poker/standings"]) {
    assert.equal(isPrivilegedAdminApiPath(pathname), false);
    assert.equal(isAdminWorkspacePath(pathname), false);
  }
  assert.equal(isPrivilegedAdminApiPath("/api/admin/homepage-settings"), true);
  assert.equal(isAdminWorkspacePath("/admin/imports"), true);
});

const generationRoutes = [
  "recaps", "profiles", "articles", "standings", "social-captions", "moments", "player-session-recaps",
];

async function generationHandler(route, authDependencies, calls) {
  const source = await readFile(path.resolve(`src/app/api/${route}/generate/route.js`), "utf8");
  // Execute the real POST body with isolated I/O dependencies. No production DB or AI is contacted.
  const handlerSource = source.slice(source.indexOf("export async function POST(")).replace(/^export /, "");
  assert.ok(handlerSource.startsWith("async function POST("));
  const context = async () => {
    calls.push("context");
    return { scope: "session", sourceSessionId: "session-fixture", sourcePlayerId: "player-fixture", packet: {} };
  };
  const saveDraft = async (draft) => {
    calls.push("saveDraft");
    assert.equal(draft.provider, "gemini");
    assert.equal(draft.modelUsed, "model-fixture");
    return { id: "draft-fixture", status: "draft", visibility: "admin" };
  };
  const bindings = {
    NextResponse: Response,
    requireOperator: (request) => authorizeOperatorRequest(request, authDependencies),
    buildSessionRecapInputPacket: context,
    buildPlayerRecapInputPacket: context,
    buildArticleInputPacket: context,
    buildStandingsInputPacket: context,
    buildSocialCaptionInputPacket: context,
    buildMomentBlurbInputPacket: context,
    buildPlayerSessionRecapInputPacket: context,
    callNewsroomAiJson: async () => {
      calls.push("ai");
      return { draft: {}, provider: "gemini", model: "model-fixture" };
    },
    getNewsroomAiDiagnostics: () => { calls.push("diagnostics"); return {}; },
    logGeneration: async () => { calls.push("logGeneration"); },
    saveRecapDraft: saveDraft,
    saveNewsroomDraft: saveDraft,
    editorialDocIds: () => [],
    validateDraftShape: () => [],
    sessionRecapDraftSchema: {},
    profileDraftSchema: {},
    articleDraftSchema: {},
    socialCaptionDraftSchema: {},
    revalidatePath: () => { calls.push("revalidate"); },
    console: { info() {} },
  };
  return new Function(...Object.keys(bindings), `${handlerSource}\nreturn POST;`)(...Object.values(bindings));
}

for (const route of generationRoutes) {
  for (const [identity, token, status] of [
    ["anonymous", "", 401], ["invalid token", "invalid-token", 401], ["unrelated user", "viewer-token", 403],
  ]) {
    test(`${route} generation rejects ${identity} before reading body, data, AI, or writes`, async () => {
      const calls = [];
      const post = await generationHandler(route, dependencies(), calls);
      const request = new Request(`https://league.test/api/${route}/generate?role=owner`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ role: "owner", sessionId: "session-fixture", playerId: "player-fixture" }),
      });
      const response = await post(request);
      assert.equal(response.status, status);
      assert.equal(request.bodyUsed, false);
      assert.deepEqual(calls, []);
    });
  }

  for (const role of ["owner", "admin"]) {
    test(`${route} generation preserves the draft pipeline for the mapped ${role}`, async () => {
      const calls = [];
      const post = await generationHandler(route, dependencies({ role }), calls);
      const response = await post(new Request(`https://league.test/api/${route}/generate`, {
        method: "POST",
        headers: { Cookie: `${OPERATOR_SESSION_COOKIE}=operator-token` },
        body: JSON.stringify({ sessionId: "session-fixture", playerId: "player-fixture", momentId: "moment-fixture" }),
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { draft: { id: "draft-fixture", status: "draft", visibility: "admin" } });
      assert.deepEqual(calls.filter((call) => !["diagnostics", "revalidate"].includes(call)), ["context", "ai", "saveDraft"]);
    });
  }
}
