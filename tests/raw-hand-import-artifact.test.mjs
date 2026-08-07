import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildRawHandImportArtifact,
  canonicalJson,
  computePreviewChecksum,
  sha256Utf8,
} from "../src/lib/imports/rawHandImportArtifact.js";
import { parseRawHandCommitBody } from "../src/lib/imports/rawHandCommitContract.js";
import { rawHandImportStateReducer } from "../src/lib/imports/rawHandImportUiState.js";
import { isMissingSchemaFieldError } from "../src/lib/newsroom/schemaCompatibility.js";

const fixtureBytes = fs.readFileSync(new URL("./fixtures/parapoker-local-match-entry-order-hand-history.csv", import.meta.url));
const metadata = {
  sessionCode: "S0-TEST-1",
  seasonCode: "S0",
  playedAt: "2026-08-01T20:00:00.000Z",
  tableName: "Test Table",
  format: "Imported hand history",
  sourceKind: "csv_file",
  inputMode: "csv",
  replaceExisting: false,
};

function artifact(bytes = fixtureBytes, overrides = {}) {
  return buildRawHandImportArtifact({
    sourceBytes: new Uint8Array(bytes),
    source: { filename: "hands.csv", mediaType: "text/csv" },
    metadata: { ...metadata, ...overrides },
  });
}

test("canonical JSON sorts object keys recursively while preserving array order", () => {
  assert.equal(canonicalJson({ z: 1, a: { d: 4, c: 3 }, rows: [{ b: 2, a: 1 }, 4] }), '{"a":{"c":3,"d":4},"rows":[{"a":1,"b":2},4],"z":1}');
});

test("legacy schema fallback recognizes only the requested missing field", () => {
  assert.equal(isMissingSchemaFieldError({ code: "42703", message: "column sessions.result_review_status does not exist" }, "result_review_status"), true);
  assert.equal(isMissingSchemaFieldError({ code: "PGRST204", message: "Could not find the is_stale column" }, "is_stale"), true);
  assert.equal(isMissingSchemaFieldError({ code: "42501", message: "permission denied for is_stale" }, "is_stale"), false);
  assert.equal(isMissingSchemaFieldError({ code: "42703", message: "column another_field does not exist" }, "is_stale"), false);
});

test("artifact preserves the exact source bytes and is deterministic", () => {
  const first = artifact();
  const second = artifact();
  assert.deepEqual(first.sourceBytes, new Uint8Array(fixtureBytes));
  assert.equal(first.canonicalManifest, second.canonicalManifest);
  assert.equal(first.manifestChecksum, second.manifestChecksum);
  const expectedManifestChecksum = fixtureBytes.includes(Buffer.from("\r\n"))
    ? "edb376353133ad15e9e14c3392ec2e534f3b195944410b5e6cb3dc4c499be926"
    : "9e4b794237c450142d2c6b7b6f56cb3b72b0ced053d63ca64ca8a6feffd0756c";
  assert.equal(first.manifestChecksum, expectedManifestChecksum);
  assert.deepEqual(first.manifest.totals, {
    sourceRows: 25,
    sourceBytes: fixtureBytes.byteLength,
    players: 2,
    hands: 2,
    actions: 15,
    notableHands: 2,
    playerSessionStats: 2,
  });
  assert.equal(first.validationReport.valid, true);
});

test("LF and CRLF source files have different source and preview checksums", () => {
  const lf = Buffer.from("entry\n\"Hand #1 hand-1\"\n", "utf8");
  const crlf = Buffer.from("entry\r\n\"Hand #1 hand-1\"\r\n", "utf8");
  const left = artifact(lf);
  const right = artifact(crlf);
  assert.notEqual(left.sourceChecksum, right.sourceChecksum);
  const context = { targetSessionId: null, expectedCurrentEvidenceRevisionId: null };
  assert.notEqual(computePreviewChecksum({ ...left, ...context }), computePreviewChecksum({ ...right, ...context }));
});

test("metadata, parser, manifest, and validation changes alter preview checksum", () => {
  const base = artifact();
  const input = {
    sourceChecksum: base.sourceChecksum,
    metadataChecksum: base.metadataChecksum,
    parserVersion: base.parserVersion,
    manifestChecksum: base.manifestChecksum,
    validationReportChecksum: base.validationReportChecksum,
    targetSessionId: null,
    expectedCurrentEvidenceRevisionId: null,
  };
  const checksum = computePreviewChecksum(input);
  assert.notEqual(checksum, computePreviewChecksum({ ...input, metadataChecksum: sha256Utf8("metadata changed") }));
  assert.notEqual(checksum, computePreviewChecksum({ ...input, parserVersion: "raw-hand-csv-v2" }));
  assert.notEqual(checksum, computePreviewChecksum({ ...input, manifestChecksum: sha256Utf8("manifest changed") }));
  assert.notEqual(checksum, computePreviewChecksum({ ...input, validationReportChecksum: sha256Utf8("validation changed") }));
});

test("metadata changes alter canonical metadata and manifest checksums", () => {
  const first = artifact();
  const changed = artifact(fixtureBytes, { tableName: "Changed Table" });
  assert.notEqual(first.metadataChecksum, changed.metadataChecksum);
  assert.notEqual(first.manifestChecksum, changed.manifestChecksum);
});

test("invalid UTF-8 is a blocking validation error without changing exact bytes", () => {
  const bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
  const result = artifact(bytes);
  assert.deepEqual(result.sourceBytes, bytes);
  assert.equal(result.validationReport.valid, false);
  assert.ok(result.validationReport.errors.includes("Source bytes are not valid UTF-8."));
});

test("duplicate hand identifiers are blocking", () => {
  const sourceBytes = new TextEncoder().encode([
    "Hand #1 (id: first-hand)",
    "\"Maven\" collected 10 from pot",
    "Hand #1 (id: second-hand)",
    "\"You\" collected 20 from pot",
  ].join("\n"));
  const result = buildRawHandImportArtifact({
    sourceBytes,
    source: { filename: "duplicate.txt", mediaType: "text/plain" },
    metadata: { ...metadata, sourceKind: "pasted_text", inputMode: "raw_text" },
  });
  assert.equal(result.validationReport.valid, false);
  assert.ok(result.validationReport.errors.includes("Duplicate hand number: 1."));
});

test("commit allowlist rejects browser source or manifest data", () => {
  const valid = {
    importId: "11111111-1111-4111-8111-111111111111",
    previewChecksum: "a".repeat(64),
    confirm: true,
    confirmReplace: false,
    expectedCurrentEvidenceRevisionId: null,
  };
  assert.deepEqual(parseRawHandCommitBody(valid), valid);
  for (const extra of ["manifest", "sourceBytes", "rawText", "csvText", "metadata", "hands"]) {
    assert.throws(() => parseRawHandCommitBody({ ...valid, [extra]: {} }), /unsupported fields/u);
  }
});

test("changing source or parser-relevant form fields invalidates preview", () => {
  const preview = { importId: "preview" };
  const state = { form: metadata, file: null, preview, result: { sessionId: "session" }, busy: "", error: "" };
  for (const field of ["sessionCode", "seasonCode", "sessionNumber", "tableName", "playedAt", "format", "replaceExisting", "pastedText"]) {
    const next = rawHandImportStateReducer(state, { type: "field_changed", field, value: "changed" });
    assert.equal(next.preview, null, `${field} should invalidate preview`);
    assert.equal(next.result, null);
  }
  assert.equal(rawHandImportStateReducer(state, { type: "file_changed", file: { name: "new.csv" } }).preview, null);
});
