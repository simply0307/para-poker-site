import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function checksum(value) {
  const json = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const importer = read("src/lib/imports/parapokerPackageImporter.js");
const sql = read("sql/20260713_game_session_imports.sql");
const panel = read("src/components/admin-newsroom/ParaPokerPackageImportPanel.jsx");
const adminPage = read("src/app/admin/imports/page.jsx");
const packagePage = read("src/app/admin/imports/parapoker/page.jsx");
const previewRoute = read("src/app/api/admin/imports/parapoker/preview/route.js");
const commitRoute = read("src/app/api/admin/imports/parapoker/commit/route.js");
const handHistory = read("src/lib/poker/handHistory.js");
read("src/app/api/admin/imports/raw-hands/preview/route.js");
read("src/app/api/admin/imports/raw-hands/commit/route.js");

assert.match(importer, /para-completed-session-v1/, "Importer must support the completed-session package schema.");
assert.match(importer, /parapoker-official-client/, "Importer must restrict source application.");
assert.match(importer, /poker-event-v1/, "Importer must validate event schema version.");
assert.match(importer, /stableChecksum/, "Importer must implement stable checksum validation.");
assert.match(importer, /BLOCKED_KEYS/, "Importer must reject private or sensitive fields.");
assert.match(importer, /deckorder|rngstate|entropy|canonicalgamestate|holecardsdealt/i, "Importer must include private-data rejection keys.");
assert.match(importer, /validateMappingForCommit/, "Importer must block missing participant mapping.");
assert.match(importer, /archiveOnly/, "Importer must allow explicit archive-only human confirmation.");
assert.match(importer, /participant\.kind === "npc" \? null/, "NPCs must not map to league player IDs.");
assert.match(importer, /sourceMatchId/, "Importer must use stable source match ID.");
assert.match(importer, /readExistingImport/, "Importer must check existing imports for idempotency.");
assert.match(importer, /commit_parapoker_session_import/, "Importer must commit through the package RPC.");
assert.doesNotMatch(importer, /from\("players"\)\.insert/, "Package importer must not auto-create league players.");

assert.match(sql, /create table if not exists public\.game_session_imports/, "Migration must create import audit table.");
assert.match(sql, /unique index if not exists game_session_imports_source_uidx/, "Migration must enforce source app/match idempotency.");
assert.match(sql, /create or replace function public\.commit_parapoker_session_import/, "Migration must create commit RPC.");
assert.match(sql, /for update/, "RPC must lock import/session rows during commit.");
assert.match(sql, /delete from public\.actions/, "RPC must replace session evidence atomically on retry.");
assert.match(sql, /revoke all on function public\.commit_parapoker_session_import/, "RPC execute must not be public.");
assert.match(sql, /grant execute .* to service_role/s, "RPC must be callable by the server service role.");
assert.match(sql, /status = 'failed'/, "RPC must retain auditable failed imports.");

assert.match(panel, /type="file"/, "Admin panel must support JSON file upload.");
assert.match(panel, /Paste package JSON/, "Admin panel must support pasted JSON.");
assert.match(panel, /Participant mapping/, "Admin panel must expose participant mapping.");
assert.match(panel, /Commit Import/, "Admin panel must require explicit commit.");
assert.match(panel, /migration\/RPC is not installed/, "Admin panel must explain missing migration state.");
assert.match(adminPage, /\/admin\/imports\/parapoker/, "Import control room must link to package importer.");
assert.match(packagePage, /ParaPokerPackageImportPanel/, "Package route must render the package import workspace.");
assert.match(previewRoute, /previewCompletedSessionPackage/, "Preview route must use server-side validation.");
assert.match(commitRoute, /commitCompletedSessionPackage/, "Commit route must use server-side commit.");
assert.match(handHistory, /boardCardsForStreet/, "Existing hand history normalizer must support board cards on streets.");

const fixturePath = "C:/Users/gjoep/OneDrive/Documents/parapoker official client/tests/fixtures/para-completed-session-v1.json";
if (existsSync(fixturePath)) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const { integrity: _integrity, ...withoutIntegrity } = fixture;
  assert.equal(fixture.schemaVersion, "para-completed-session-v1", "Client fixture must be package v1.");
  assert.equal(fixture.source.app, "parapoker-official-client", "Client fixture must be from official client.");
  assert.equal(fixture.integrity.eventCount, fixture.orderedPublicEvents.length, "Fixture event count must match.");
  assert.equal(fixture.integrity.handCount, fixture.hands.length, "Fixture hand count must match.");
  assert.match(checksum(withoutIntegrity), /^[0-9a-f]{8}$/, "Fixture checksum algorithm must produce an 8-char hash.");
}

console.log("ParaPoker package import validation passed.");
