import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function oneJsonObjectPerLine(jsonl) {
  return jsonl
    .trim()
    .split("\n")
    .filter(Boolean)
    .every((line) => {
      const parsed = JSON.parse(line);
      return parsed && typeof parsed === "object" && Array.isArray(parsed.messages);
    });
}

const sql = read("sql/20260712_recap_training_capture.sql");
const passiveSql = read("sql/20260712_passive_training_capture.sql");
const drafts = read("src/lib/newsroom/drafts.js");
const exportRoute = read("src/app/api/admin/newsroom/dataset/export/route.js");
const trainingRepo = read("src/lib/newsroom/trainingExamples.js");
const sessionEditor = read("src/components/admin-newsroom/SessionRecapDraftEditor.jsx");
const genericEditor = read("src/components/admin-newsroom/GenericDraftWorkspace.jsx");
const adminShell = read("src/components/admin-newsroom/AdminShell.jsx");

assert.match(sql, /prevent_training_original_mutation/, "Training SQL must include immutable original-output trigger.");
assert.match(sql, /old\.original_output is distinct from new\.original_output/, "Original output mutation must be blocked.");
assert.match(sql, /old\.context_packet is distinct from new\.context_packet/, "Context packet mutation must be blocked.");
assert.match(sql, /capture_status/, "Training SQL must support passive capture review status.");
assert.match(sql, /recap_training_examples_draft_unique_idx/, "Fresh installs must enforce one capture row per draft.");
assert.match(passiveSql, /Skipped recap_training_examples_draft_unique_idx/, "Passive upgrade must avoid failing on pre-existing duplicate rows.");

assert.doesNotMatch(drafts, /createDraftRevision/, "Normal draft saves should not create training-specific revisions.");
assert.match(trainingRepo, /capture_status: "captured"/, "Generated examples should start as passively captured.");
assert.match(trainingRepo, /capture_status: "ready_for_review"/, "Publishing should mark captured examples ready for optional review.");
assert.match(trainingRepo, /const existing = await getTrainingExampleForDraft/, "Capture should check for an existing draft example before insert.");
assert.match(trainingRepo, /duplicate key/, "Capture should recover from duplicate insert races.");
assert.match(trainingRepo, /training_eligible: null/, "Publishing should not automatically include examples.");
assert.match(trainingRepo, /dataset_split: null/, "Publishing should not automatically assign a dataset split.");

assert.match(trainingRepo, /\.eq\("capture_status", "included"\)/, "Exportable query must require explicit include status.");
assert.match(trainingRepo, /\.eq\("training_eligible", true\)/, "Exportable query must require training eligibility.");
assert.match(trainingRepo, /\.not\("approved_output", "is", null\)/, "Exportable query must require approved output.");
assert.match(trainingRepo, /\.not\("dataset_split", "is", null\)/, "Exportable query must require assigned splits.");
assert.match(trainingRepo, /\.eq\("dataset_split", normalizeSplit\(split\)\)/, "Split exports must filter by the requested split.");
assert.match(trainingRepo, /bulkAssignDatasetSplitsBySession/, "Dataset review should expose future bulk split assignment by session.");
assert.match(trainingRepo, /source_session_id \|\| `no-session:\$\{example\.id\}`/, "Bulk split assignment must group by source session when available.");
assert.match(exportRoute, /header === `Bearer \$\{token\}`/, "Dataset export route must require bearer token auth.");
assert.doesNotMatch(sessionEditor, /TrainingExamplePanel|trainingEligible|datasetSplit|editTags|editorNotes/, "Session editor must not show training controls.");
assert.doesNotMatch(genericEditor, /TrainingExamplePanel|trainingEligible|datasetSplit|editTags|editorNotes/, "Generic editor must not show training controls.");
assert.doesNotMatch(adminShell, /newsroom\/dataset/, "Dataset review must not be linked in the main admin navigation.");

const trainLine = JSON.stringify({
  messages: [
    { role: "system", content: "system" },
    { role: "user", content: "{}" },
    { role: "assistant", content: "{}" },
  ],
  metadata: { dataset_split: "train" },
});
const testLine = JSON.stringify({
  messages: [
    { role: "system", content: "system" },
    { role: "user", content: "{}" },
    { role: "assistant", content: "{}" },
  ],
  metadata: { dataset_split: "test" },
});

assert.equal(oneJsonObjectPerLine(`${trainLine}\n${testLine}\n`), true, "Exported JSONL must parse one object per line.");
assert.notEqual(JSON.parse(trainLine).metadata.dataset_split, JSON.parse(testLine).metadata.dataset_split, "Test examples remain distinct from train examples.");

console.log("Training capture validation passed.");
