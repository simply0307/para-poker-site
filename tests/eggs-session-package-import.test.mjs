import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  EGGS_SCHEMA_CHECKSUM,
  buildEggsSessionImportArtifact,
  computeEggsPackageChecksum,
} from "../src/lib/imports/eggsSessionPackageArtifact.js";
import { preserveAuthoritativeResultEvidence } from "../src/lib/imports/authoritativeResultReview.js";

const fixtureUrl = new URL("./fixtures/para-completed-session-v2.json", import.meta.url);
const fixtureBytes = fs.readFileSync(fixtureUrl);
const fixture = JSON.parse(fixtureBytes);
const participantMappings = {
  "eggs-player-alice": "11111111-1111-4111-8111-111111111111",
  "eggs-player-bob": "22222222-2222-4222-8222-222222222222",
};
const leaguePlayers = [
  { id: participantMappings["eggs-player-alice"], display_name: "League Alice" },
  { id: participantMappings["eggs-player-bob"], display_name: "League Bob" },
];

function artifact(packageValue = fixture, mappings = participantMappings) {
  const sourceBytes = packageValue === fixture
    ? new Uint8Array(fixtureBytes)
    : new TextEncoder().encode(JSON.stringify(packageValue));
  return buildEggsSessionImportArtifact({
    sourceBytes,
    source: { filename: "completed-session.json", mediaType: "application/json" },
    participantMappings: mappings,
    leaguePlayers,
    metadata: { seasonCode: "S0", sessionCode: "S0-EGGS-1" },
  });
}

test("the checked-in producer fixture is a valid deterministic EGGS import", () => {
  const first = artifact();
  const second = artifact();
  assert.equal(first.validationReport.valid, true);
  assert.deepEqual(first.validationReport.errors, []);
  assert.equal(fixture.integrity.contractSchemaChecksum, EGGS_SCHEMA_CHECKSUM);
  assert.equal(computeEggsPackageChecksum(fixture), fixture.integrity.packageChecksum);
  assert.equal(first.canonicalManifest, second.canonicalManifest);
  assert.equal(first.manifestChecksum, second.manifestChecksum);
  assert.deepEqual(first.manifest.totals, {
    sourceRows: 0,
    sourceBytes: fixtureBytes.byteLength,
    players: 2,
    hands: 1,
    actions: 3,
    events: 13,
    notableHands: 1,
    playerSessionStats: 2,
    sessionResults: 2,
  });
});

test("the direct adapter preserves authority evidence without invoking the raw parser", () => {
  const result = artifact();
  const source = fs.readFileSync(new URL("../src/lib/imports/eggsSessionPackageArtifact.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /rawHandHistoryParser/u);
  assert.equal(result.manifest.publicEvents.some((event) => event.type === "holeCardsDealt"), false);
  const ability = result.manifest.publicEvents.find((event) => event.type === "factionAbilityUsed");
  assert.deepEqual(ability, fixture.orderedPublicEvents.find((event) => event.type === "factionAbilityUsed"));
  assert.ok(result.manifest.authorityConsequences.progressionEffects.some((effect) => effect.effectType === "factionCredit"));
  assert.deepEqual(result.manifest.hands[0].settlementEventIds, fixture.hands[0].settlement.settlementEventIds);
  assert.equal(result.manifest.actions[2].targetContribution, fixture.hands[0].actions[2].targetContribution);
});

test("stable league-player mappings are mandatory and display names are never identity", () => {
  const result = artifact(fixture, {});
  assert.equal(result.validationReport.valid, false);
  assert.deepEqual(result.validationReport.unresolvedPlayerMappings.map((row) => row.sourcePlayerId), [
    "eggs-player-alice",
    "eggs-player-bob",
  ]);
});

test("checksum tampering, event reordering, and missing referenced evidence fail closed", () => {
  const badChecksum = structuredClone(fixture);
  badChecksum.integrity.packageChecksum = "0".repeat(64);
  assert.ok(artifact(badChecksum).validationReport.errors.includes("Package checksum is invalid."));

  const reordered = structuredClone(fixture);
  [reordered.orderedPublicEvents[0], reordered.orderedPublicEvents[1]] = [reordered.orderedPublicEvents[1], reordered.orderedPublicEvents[0]];
  reordered.integrity.packageChecksum = computeEggsPackageChecksum(reordered);
  assert.ok(artifact(reordered).validationReport.errors.some((error) => error.includes("out of order")));

  const missing = structuredClone(fixture);
  missing.orderedPublicEvents = missing.orderedPublicEvents.filter((event) => event.eventId !== missing.hands[0].actions[0].eventId);
  missing.integrity.packageChecksum = computeEggsPackageChecksum(missing);
  assert.ok(artifact(missing).validationReport.errors.some((error) => error.includes("evidence is incomplete")));
});

test("authoritative outcomes and projections are explicit materialization inputs", () => {
  const result = artifact();
  assert.deepEqual(result.manifest.sessionResults.map((row) => [row.sourcePlayerId, row.finish, row.approved]), [
    ["eggs-player-alice", 1, false],
    ["eggs-player-bob", 2, false],
  ]);
  assert.equal(result.manifest.playerSessionStats.length, 2);
  assert.equal(result.manifest.playerSessionStats.every((row) => row.sourcePlayerId), true);
  assert.deepEqual(result.manifest.playerSessionStats.map((row) => ({
    sourcePlayerId: row.sourcePlayerId,
    hands: row.hands,
    handsWon: row.handsWon,
    totalCollected: row.totalCollected,
    vpipPct: row.vpipPct,
  })), [
    { sourcePlayerId: "eggs-player-alice", hands: 1, handsWon: 1, totalCollected: 4, vpipPct: 100 },
    { sourcePlayerId: "eggs-player-bob", hands: 1, handsWon: 0, totalCollected: 0, vpipPct: 0 },
  ]);
  assert.equal(result.manifest.session.resultReviewStatus, "awaiting_result_review");
});

test("result review can approve but cannot retype authoritative outcome evidence", () => {
  const evidenceRevisionId = "33333333-3333-4333-8333-333333333333";
  const existing = artifact().manifest.sessionResults.map((row, index) => ({
    id: index + 1,
    session_id: "44444444-4444-4444-8444-444444444444",
    evidence_revision_id: evidenceRevisionId,
    player_id: row.leaguePlayerId,
    player_name: row.playerName,
    finish: row.finish,
    final_stack: row.finalStack,
    league_points: 0,
    confidence: "authoritative_eggs",
    notes: "",
    approved: false,
  }));
  const submitted = existing.map((row) => ({ ...row, league_points: row.finish === 1 ? 10 : 5, notes: "reviewed" }));
  const approved = preserveAuthoritativeResultEvidence(existing, submitted);
  assert.equal(approved.every((row) => row.approved && row.evidence_revision_id === evidenceRevisionId), true);
  assert.throws(
    () => preserveAuthoritativeResultEvidence(existing, submitted.map((row, index) => index ? row : { ...row, finish: 2 })),
    /cannot be changed/u
  );
});
