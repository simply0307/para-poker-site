import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = (await readFile(new URL("../src/lib/newsroom/aiClient.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/^export /gm, "");
const schema = { name: "fixture", schema: { type: "object", properties: { headline: { type: "string" } } } };

function client(env, fetch) {
  return runInNewContext(`${source}\ncallNewsroomAiJson;`, {
    process: { env }, fetch, console: { info() {} },
    buildNewsroomSystemPrompt: () => "Fixture editorial instructions.",
    setTimeout: () => { throw new Error("Unexpected retry"); },
  });
}

for (const baseUrl of [undefined, "https://gateway.example.test/gemini", "https://gateway.example.test/gemini/"]) {
  test(`Gemini uses ${baseUrl || "the direct Google default"} with the matching header credential`, async () => {
    const requests = [];
    const generate = client({ GEMINI_API_KEY: "secret-fixture", GOOGLE_GEMINI_BASE_URL: baseUrl }, async (url, init) => {
      requests.push({ url, init });
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"headline":"Draft fixture"}' }] } }] });
    });
    const result = await generate({ scope: "session", schema, packet: { sessionId: "fixture" } });
    assert.equal(requests.length, 1);
    const [{ url, init }] = requests;
    assert.equal(url, `${(baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "")}/v1beta/models/gemini-2.5-flash-lite:generateContent`);
    assert.equal(url.includes("secret-fixture"), false);
    assert.equal(init.headers["x-goog-api-key"], "secret-fixture");
    assert.equal(init.method, "POST");
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(body.generationConfig.responseSchema, schema.schema);
    assert.equal(JSON.parse(body.contents[0].parts[0].text).sessionId, "fixture");
    assert.equal(result.provider, "gemini");
    assert.equal(result.model, "gemini-2.5-flash-lite");
    assert.equal(result.draft.headline, "Draft fixture");
  });
}

test("Gemini model configuration remains in effect through the gateway", async () => {
  const generate = client({ GEMINI_API_KEY: "fixture", GOOGLE_GEMINI_BASE_URL: "https://gateway.example.test/gemini", GEMINI_MODEL: "configured-model" }, async (url) => {
    assert.ok(url.endsWith("/models/configured-model:generateContent"));
    return Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
  });
  assert.equal((await generate({ scope: "session", schema, packet: {} })).model, "configured-model");
});

test("invalid Gemini credentials stop without provider switching or retries", async () => {
  let requests = 0;
  const generate = client({ GEMINI_API_KEY: "fixture", GEMINI_FALLBACK_MODELS: "fallback-model" }, async () => {
    requests += 1;
    return Response.json({ error: { message: "API key not valid." } }, { status: 400 });
  });
  await assert.rejects(generate({ scope: "session", schema, packet: {} }), /API key not valid/);
  assert.equal(requests, 1);
});
