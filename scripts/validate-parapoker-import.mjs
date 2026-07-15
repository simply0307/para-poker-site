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
const rawRepository = read("src/lib/imports/rawHandImportRepository.js");
const rawPanel = read("src/components/admin-newsroom/RawHandImportPanel.jsx");
const adminPage = read("src/app/admin/imports/page.jsx");
const previewRoute = read("src/app/api/admin/imports/raw-hands/preview/route.js");
const commitRoute = read("src/app/api/admin/imports/raw-hands/commit/route.js");
const handHistory = read("src/lib/poker/handHistory.js");
const handHistoryUi = read("src/components/poker/HandActionLog.jsx");
const adminRoutes = read("src/lib/newsroom/adminRoutes.js");
const { nextSessionNumber, positiveSessionNumber } = await import("../src/lib/imports/sessionNumber.js");

assert.match(rawPanel, /accept="\.csv,text\/csv"/, "Import panel must accept CSV uploads.");
assert.match(rawPanel, /fetch\("\/api\/admin\/imports\/raw-hands\/preview"/, "Import panel must preview through the raw-hand API.");
assert.match(rawPanel, /fetch\("\/api\/admin\/imports\/raw-hands\/commit"/, "Import panel must commit through the raw-hand API.");
assert.match(rawPanel, /Commit Live/, "Import panel must make live Supabase commit explicit.");
assert.match(adminPage, /RawHandImportPanel/, "Import control room must center the raw hand CSV import panel.");
assert.doesNotMatch(adminPage, /\/admin\/imports\/parapoker/, "Import control room must not promote the legacy package importer.");
assert.doesNotMatch(adminRoutes, /\/admin\/imports\/parapoker/, "Admin navigation must not expose the legacy package importer.");

assert.match(previewRoute, /previewRawHandImport/, "Preview route must use server-side raw hand parsing.");
assert.match(commitRoute, /commitRawHandImport/, "Commit route must use server-side Supabase commit.");
assert.match(rawRepository, /\.from\("sessions"\)/, "Raw import repository must write sessions through Supabase.");
assert.match(rawRepository, /\.from\("hands"\)\.insert/s, "Raw import repository must write hands through Supabase.");
assert.match(rawRepository, /\.from\("actions"\)\.insert/s, "Raw import repository must write chronological actions through Supabase.");
assert.match(rawRepository, /\.from\("notable_hands"\)\.insert/s, "Raw import repository must write detected moment candidates through Supabase.");
assert.match(rawRepository, /player_session_stats/, "Raw import repository must create basic player-session stats.");
assert.match(rawRepository, /resolveSessionNumber/, "Raw imports must resolve a non-null session number before writing sessions.");
assert.match(rawPanel, /assigned automatically within the selected season/i, "The import UI must explain automatic session numbering.");

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
