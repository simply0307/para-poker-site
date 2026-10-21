import test from "node:test";
import assert from "node:assert/strict";
import { readConsumerJson } from "../src/lib/eggs/consumerCore.mjs";

const jsonRequest = (body, contentType = "application/json") => new Request("https://eggs.example/api", {
  method: "POST", headers: { "Content-Type": contentType }, body,
});
const sizedJson = (size) => JSON.stringify({ text: "x".repeat(size - JSON.stringify({ text: "" }).length) });

test("JSON reader keeps its exact default 8 KiB boundary and measures UTF-8 bytes", async () => {
  assert.equal((await readConsumerJson(jsonRequest(sizedJson(8192)))) .text.length, 8192 - 11);
  await assert.rejects(() => readConsumerJson(jsonRequest(sizedJson(8193))), { status: 413 });
  await assert.rejects(() => readConsumerJson(jsonRequest(sizedJson(8193)), undefined), { status: 413 });
  const unicode = JSON.stringify({ text: "é".repeat(4200) });
  assert.ok(unicode.length < 8192);
  assert.ok(new TextEncoder().encode(unicode).byteLength > 8192);
  await assert.rejects(() => readConsumerJson(jsonRequest(unicode)), { status: 413 });
});

test("only an explicit allowed limit accepts a 96 KiB lore JSON object", async () => {
  const maximum = sizedJson(98304);
  assert.equal((await readConsumerJson(jsonRequest(maximum), 98304)).text.length, 98304 - 11);
  await assert.rejects(() => readConsumerJson(jsonRequest(maximum)), { status: 413 });
  await assert.rejects(() => readConsumerJson(jsonRequest(sizedJson(98305)), 98304), { status: 413 });
  await assert.rejects(() => readConsumerJson(jsonRequest("[]"), 98304), { status: 400 });
  await assert.rejects(() => readConsumerJson(jsonRequest("null"), 98304), { status: 400 });
  await assert.rejects(() => readConsumerJson(jsonRequest("{}", "text/plain"), 98304), { status: 415 });
});

test("invalid JSON byte limits fail before the request body is consumed", async () => {
  const request = { body: { getReader() { throw new Error("Body must not be consumed"); } } };
  for (const limit of [0, -1, 1.5, NaN, Infinity, null, "98304", 98305, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(() => readConsumerJson(request, limit), TypeError);
});

test("oversized streamed JSON is cancelled and returns 413 at either boundary", async () => {
  for (const limit of [8192, 98304]) {
    let cancelled = false, chunksRead = 0;
    const chunks = [new Uint8Array(limit), new Uint8Array(1), new Uint8Array(100)];
    const stream = new ReadableStream({
      pull(controller) { if (chunksRead < chunks.length) controller.enqueue(chunks[chunksRead++]); else controller.close(); },
      cancel() { cancelled = true; },
    });
    const request = new Request("https://eggs.example/api", { method: "POST", duplex: "half", headers: { "Content-Type": "application/json" }, body: stream });
    await assert.rejects(() => readConsumerJson(request, limit), { status: 413 });
    assert.equal(cancelled, true); assert.ok(chunksRead <= 3);
  }
});
