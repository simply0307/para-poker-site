import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function parseCsvRows(csvText = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(csvText || "").replace(/^\uFEFF/u, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  const headers = rows[0].map((header) => String(header || "").trim().toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()])));
}

function orderValue(row = {}) {
  const explicit = Number(row.log_order || row.order || row.action_order);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const timestamp = Date.parse(row.at || row.timestamp || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function chronologicalCsvRows(rows = []) {
  return rows
    .map((row, index) => ({ ...row, __originalIndex: index }))
    .sort((left, right) => {
      const leftSort = orderValue(left);
      const rightSort = orderValue(right);
      if (leftSort !== null && rightSort !== null) return leftSort - rightSort || left.__originalIndex - right.__originalIndex;
      if (leftSort !== null) return -1;
      if (rightSort !== null) return 1;
      return left.__originalIndex - right.__originalIndex;
    });
}

const rawParser = read("src/lib/imports/rawHandHistoryParser.js");
const rawArtifact = read("src/lib/imports/rawHandImportArtifact.js");
const rawRepository = read("src/lib/imports/rawHandImportRepository.js");
const commitContract = read("src/lib/imports/rawHandCommitContract.js");
const rawPanel = read("src/components/admin-newsroom/RawHandImportPanel.jsx");
const importManager = read("src/components/admin-newsroom/ImportSessionManager.jsx");
const resultReviewPanel = read("src/components/admin-newsroom/SessionResultReviewPanel.jsx");
const adminPage = read("src/app/admin/imports/page.jsx");
const previewRoute = read("src/app/api/admin/imports/raw-hands/preview/route.js");
const commitRoute = read("src/app/api/admin/imports/raw-hands/commit/route.js");
const sessionImportRoute = read("src/app/api/admin/imports/sessions/[sessionId]/route.js");
const sessionResultsRoute = read("src/app/api/admin/imports/sessions/[sessionId]/results/route.js");
const handHistory = read("src/lib/poker/handHistory.js");
const handHistoryUi = read("src/components/poker/HandActionLog.jsx");
const adminRoutes = read("src/lib/newsroom/adminRoutes.js");
const revisionMigration = read("sql/20260805213435_raw_hand_evidence_revisions.sql");
const { nextSessionNumber, positiveSessionNumber } = await import("../src/lib/imports/sessionNumber.js");

assert.match(rawPanel, /accept="\.csv,text\/csv"/, "Import panel must accept CSV uploads.");
assert.match(rawPanel, /fetch\("\/api\/admin\/imports\/raw-hands\/preview"/, "Import panel must preview through the raw-hand API.");
assert.match(rawPanel, /fetch\("\/api\/admin\/imports\/raw-hands\/commit"/, "Import panel must commit through the raw-hand API.");
assert.match(rawPanel, /new FormData\(\)/, "Import preview must upload exact file bytes with FormData.");
assert.match(rawPanel, /body\.append\("file", file, file\.name\)/, "The selected File must be uploaded rather than converted to browser text.");
assert.match(rawPanel, /Create immutable preview/, "Import panel must name the persisted preview boundary.");
assert.match(rawPanel, /Confirm replacement/, "Import panel must require a second explicit replacement confirmation.");
assert.match(rawPanel, /importId: preview\.importId/, "Commit must reference only the persisted import ID.");
assert.doesNotMatch(rawPanel.match(/body: JSON\.stringify\(\{[\s\S]*?\}\),/)?.[0] || "", /(manifest|rawText|sourceBytes|hands):/, "Commit JSON must not contain browser evidence.");
assert.match(adminPage, /RawHandImportPanel/, "Import control room must center the raw hand CSV import panel.");
assert.match(adminPage, /ImportSessionManager/, "Import control room must expose session import edit/delete controls.");
assert.doesNotMatch(adminPage, /\/admin\/imports\/parapoker/, "Import control room must not promote the legacy package importer.");
assert.doesNotMatch(adminRoutes, /\/admin\/imports\/parapoker/, "Admin navigation must not expose the legacy package importer.");

assert.match(previewRoute, /persistRawHandImportPreview/, "Preview route must persist the canonical server artifact.");
assert.match(previewRoute, /await uploaded\.arrayBuffer\(\)/, "Preview route must consume the exact uploaded file bytes.");
assert.match(commitRoute, /commitRawHandImport/, "Commit route must use server-side Supabase commit.");
assert.match(commitRoute, /parseRawHandCommitBody/, "Commit route must enforce the five-field allowlist.");
assert.match(sessionImportRoute, /updateImportedSession/, "Imported sessions must be editable through an admin API.");
assert.match(sessionImportRoute, /deleteImportedSession/, "Imported sessions must be deletable through an admin API.");
assert.match(importManager, /Delete Imported Session/, "Import manager must expose a clear imported-session delete action.");
assert.match(resultReviewPanel, /Recalc Season \+ Career/, "Import review must expose season/career stat recalculation.");
assert.match(resultReviewPanel, /Backfill BB Fields/, "Import review must expose a BB backfill control after the normalization migration is applied.");
assert.match(sessionResultsRoute, /backfillSessionPotNormalization/, "Session result route must support server-side BB backfill.");
assert.match(rawRepository, /rpc\("create_raw_hand_import_preview"/, "Preview repository must call the persistence RPC.");
assert.match(rawRepository, /rpc\("commit_raw_hand_session_import"/, "Commit repository must use one transactional RPC.");
assert.match(rawRepository, /current_evidence_revision_id/, "Legacy maintenance must reject revisioned sessions server-side.");
assert.match(commitContract, /ALLOWED_COMMIT_FIELDS/, "Commit contract must use an explicit field allowlist.");
assert.doesNotMatch(commitContract, /manifest|rawText|csvText|sourceBytes/, "Commit contract must not accept evidence payload fields.");
assert.match(rawArtifact, /TextDecoder\("utf-8", \{ fatal: true \}\)/, "Artifacts must strictly decode UTF-8.");
assert.match(rawArtifact, /canonicalJson/, "Artifacts must use canonical JSON.");
assert.match(rawArtifact, /derivePlayerSessionStatsFromRows/, "Artifacts must include deterministic player-session stats.");
assert.match(revisionMigration, /create table public\.session_evidence_revisions/, "Migration must create durable evidence revisions.");
assert.match(revisionMigration, /begin[\s\S]*exception when others[\s\S]*get stacked diagnostics/, "Commit RPC must use a nested rollback boundary with durable failure reporting.");
assert.match(revisionMigration, /pg_advisory_xact_lock/, "Commit RPC must serialize session/source allocation and replacements.");
assert.match(revisionMigration, /affected_aggregates_removed_pending_result_review/, "Replacement must explicitly report the safe aggregate fallback.");

assert.equal(positiveSessionNumber("12"), 12, "Explicit positive session numbers must be preserved.");
assert.equal(positiveSessionNumber(""), null, "Blank session numbers must request automatic allocation.");
assert.equal(positiveSessionNumber("0"), null, "Zero is not a valid session number.");
assert.equal(nextSessionNumber([]), 1, "The first session in a season must be numbered 1.");
assert.equal(nextSessionNumber([{ session_number: 4 }, { session_number: 9 }]), 10, "Automatic numbering must follow the current season maximum.");

assert.match(rawParser, /chronologicalCsvRows/, "Raw hand CSV imports must normalize chronological row order.");
assert.match(rawParser, /rowSortValue/, "Raw hand CSV imports must sort by explicit order values when present.");
assert.match(rawParser, /ending\\s\+hand/, "Raw hand parser must ignore ending-hand markers as hand starts.");
assert.match(rawParser, /line\.match\(\/\\\(id:/, "Raw hand parser must prefer explicit hand IDs from starting hand lines.");
assert.match(rawParser, /collected\[collected\.length - 1\] \|\| winners/, "Raw hand parser must prefer collected-pot lines over match-win lines.");
assert.match(rawParser, /winningHandName/, "Raw hand parser must preserve winning hand text from collected-pot rows.");
assert.match(rawParser, /inputMode: String\(csvText/, "Raw parser must report CSV mode when CSV is supplied.");
assert.match(handHistory, /boardCardsForStreet/, "Hand history normalizer must support board cards on streets.");
assert.match(handHistory, /boardText: cards\.join/, "Hand history normalizer must attach board text to streets.");
assert.match(handHistoryUi, /street\.boardText/, "Hand history UI must render street board text.");

const sampleCsv = `log_order,raw_entry
3,"""Para-Poker"" collected 1000 from pot with Pair"
1,"Hand #1 (id: hand-alpha)"
2,"""panicmixie"" calls 500"
4,"-- ending hand #1"
`;
const ordered = chronologicalCsvRows(parseCsvRows(sampleCsv)).map((row) => row.raw_entry);
assert.deepEqual(
  ordered,
  [
    "Hand #1 (id: hand-alpha)",
    "\"panicmixie\" calls 500",
    "\"Para-Poker\" collected 1000 from pot with Pair",
    "-- ending hand #1",
  ],
  "CSV rows must sort chronologically by explicit order."
);

console.log("ParaPoker CSV import validation passed.");
